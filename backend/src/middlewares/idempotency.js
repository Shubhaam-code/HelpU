import { getSharedRedisClient } from '../config/redis.js';

/**
 * Reusable Idempotency Middleware for critical write operations.
 * 
 * Safety & Guarantees:
 * 1. Read 'Idempotency-Key' from request headers.
 * 2. Scope keys: helpu:idempotency:<userId>:<method>:<path>:<key> (isolated namespace, never collides with BullMQ).
 * 3. Atomic lock acquisition via Redis SET key val EX 30 NX.
 * 4. In-progress requests return 409 Conflict with a clear message.
 * 5. Completed successful responses (2xx) are cached for 120 seconds.
 * 6. Repeated requests replay the cached response with 'Idempotency-Replay: true'.
 * 7. Failed requests (4xx/5xx) or client socket aborts release the lock immediately so clients can retry.
 * 8. If Redis is down or unavailable, fails safely with 503 for critical idempotent operations without crashing.
 */
export function requireIdempotency(options = { required: true }) {
  const isRequired = options?.required !== false;

  return async (req, res, next) => {
    // 1. Read header
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!rawKey || !String(rawKey).trim()) {
      if (isRequired) {
        return res.status(400).json({
          success: false,
          message: 'Bad Request: Missing required Idempotency-Key header for this operation'
        });
      }
      return next();
    }

    const key = String(rawKey).trim();

    // 2. Format validation (length between 8 and 128 chars, safe characters)
    if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9_\-.:]+$/.test(key)) {
      return res.status(400).json({
        success: false,
        message: 'Bad Request: Invalid Idempotency-Key format. Must be 8-128 alphanumeric characters (hyphens, underscores, dots, colons allowed).'
      });
    }

    // 3. Connect to Redis safely
    let redis = null;
    try {
      redis = getSharedRedisClient();
    } catch (clientErr) {
      console.warn('[Idempotency] Redis client retrieval failed:', clientErr.message);
    }

    // Check if Redis is connected and ready
    const isRedisReady = redis && (redis.status === 'ready' || redis.status === 'connect');
    if (!isRedisReady) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable: Idempotency verification requires active cache service. Please try again shortly.'
      });
    }

    // 4. Construct isolated namespace key scoped by user, method, and endpoint
    const userId = req.userId || 'anonymous';
    const method = (req.method || 'POST').toUpperCase();
    const endpoint = ((req.baseUrl || '') + (req.path || '')).replace(/\/+$/, '') || '/';
    const redisKey = `helpu:idempotency:${userId}:${method}:${endpoint}:${key}`;

    try {
      // 5. Atomic Lock Acquisition using SET NX EX (30 seconds in-flight lock)
      const lockPayload = JSON.stringify({
        status: 'IN_FLIGHT',
        userId,
        method,
        endpoint,
        createdAt: Date.now()
      });

      const acquired = await redis.set(redisKey, lockPayload, 'EX', 30, 'NX');

      if (acquired !== 'OK') {
        // Key already exists in Redis: inspect status
        const existingDataRaw = await redis.get(redisKey);
        if (existingDataRaw) {
          try {
            const existing = JSON.parse(existingDataRaw);

            if (existing.status === 'IN_FLIGHT') {
              return res.status(409).json({
                success: false,
                message: 'Conflict: An identical operation is currently being processed. Please wait.'
              });
            }

            if (existing.status === 'COMPLETED') {
              // Return cached response
              res.setHeader('Idempotency-Replay', 'true');
              if (existing.headers && typeof existing.headers === 'object') {
                for (const [hName, hVal] of Object.entries(existing.headers)) {
                  try { res.setHeader(hName, hVal); } catch {}
                }
              }
              return res.status(existing.statusCode || 200).json(existing.body);
            }
          } catch (parseErr) {
            console.warn('[Idempotency] Failed to parse cached payload:', parseErr.message);
          }
        }

        return res.status(409).json({
          success: false,
          message: 'Conflict: Concurrent operation detected with this Idempotency-Key.'
        });
      }

      // 6. Lock acquired successfully: Intercept response to cache only on success
      let finished = false;
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      const finalize = async (statusCode, bodyPayload) => {
        if (finished) return;
        finished = true;

        try {
          // Rule: Only cache successful responses (2xx) for 120 seconds
          if (statusCode >= 200 && statusCode < 300) {
            const completedPayload = JSON.stringify({
              status: 'COMPLETED',
              statusCode,
              body: bodyPayload,
              completedAt: Date.now()
            });
            await redis.set(redisKey, completedPayload, 'EX', 120);
          } else {
            // Failed requests (4xx / 5xx) must NOT be cached permanently: release lock immediately
            await redis.del(redisKey);
          }
        } catch (finalizeErr) {
          console.warn('[Idempotency] Failed to finalize key in Redis:', finalizeErr.message);
        }
      };

      res.json = function (body) {
        finalize(res.statusCode, body).finally(() => {
          originalJson(body);
        });
      };

      res.send = function (body) {
        let parsed = body;
        try {
          if (typeof body === 'string') parsed = JSON.parse(body);
        } catch {}
        finalize(res.statusCode, parsed).finally(() => {
          originalSend(body);
        });
      };

      // If client terminates request early before response finishes
      req.on('close', () => {
        if (!finished) {
          redis.del(redisKey).catch(() => {});
        }
      });

      return next();
    } catch (redisErr) {
      console.error('[Idempotency] Redis error during key processing:', redisErr.message);
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable: Cache error during idempotency check. Please try again shortly.'
      });
    }
  };
}

