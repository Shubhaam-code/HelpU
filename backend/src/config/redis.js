import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Resolve Redis URL from REDIS_URL or individual REDIS_* variables
 */
export function resolveRedisUrl() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  if (process.env.REDIS_HOST) {
    const isTls = process.env.REDIS_TLS === 'true' || process.env.REDIS_TLS === true;
    const protocol = isTls ? 'rediss' : 'redis';
    const username = process.env.REDIS_USERNAME || 'default';
    const password = process.env.REDIS_PASSWORD || '';
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT || 6379;

    const auth = password ? `${username}:${encodeURIComponent(password)}@` : '';
    return `${protocol}://${auth}${host}:${port}`;
  }

  return null;
}

export function hasRedisConfigured() {
  return Boolean(resolveRedisUrl());
}

/**
 * Sanitize Redis URL for safe logging (masks password)
 */
export function getSanitizedRedisUrl(url = resolveRedisUrl()) {
  if (!url) return 'UNDEFINED';
  try {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  } catch {
    return '[PROTECTED_REDIS_URL]';
  }
}

/**
 * Returns Redis connection options for BullMQ
 * BullMQ requires maxRetriesPerRequest: null
 */
export function getRedisConfig() {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) {
    throw new Error('Redis configuration is missing. Provide REDIS_URL or REDIS_HOST/PORT/PASSWORD.');
  }

  const isTls = redisUrl.startsWith('rediss://') || process.env.REDIS_TLS === 'true';

  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    }
  };

  if (isTls) {
    options.tls = {
      rejectUnauthorized: false
    };
  }

  return { redisUrl, options };
}

let redisClientInstance = null;

/**
 * Create or reuse an ioredis client instance for BullMQ / general operations
 */
export function createRedisConnection() {
  const { redisUrl, options } = getRedisConfig();
  const client = new Redis(redisUrl, options);

  client.on('connect', () => {
    console.log(`[Redis] Connection initiated to ${getSanitizedRedisUrl(redisUrl)}`);
  });

  client.on('ready', () => {
    console.log('[Redis] Connection ready.');
  });

  client.on('error', (err) => {
    console.error(`[Redis] Connection error: ${err.message}`);
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed.');
  });

  return client;
}
