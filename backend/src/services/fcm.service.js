import { getFirebaseMessaging, isFirebaseConfigured } from '../config/firebase.js';
import DeviceToken from '../models/DeviceToken.js';

/**
 * Maximum batch size supported by Firebase Admin sendEachForMulticast
 */
export const FCM_MULTICAST_MAX_BATCH_SIZE = 500;

/**
 * High-importance Android notification channel matching frontend Capacitor setup
 */
export const HELPU_NOTIFICATION_CHANNEL_ID = 'helpu_alerts_v2';

/**
 * Permanent error codes from Firebase Admin SDK that warrant token deletion
 */
export const PERMANENT_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

/**
 * Helper to check whether a Firebase error code is permanent and should trigger token removal
 */
export function isPermanentTokenError(errorCode) {
  if (!errorCode || typeof errorCode !== 'string') return false;
  return PERMANENT_TOKEN_ERROR_CODES.has(errorCode);
}

/**
 * Sanitizes and converts all custom data payload key-value pairs into strings,
 * as strictly required by Firebase Cloud Messaging.
 * @param {Object} data - Custom key-value pairs
 * @returns {Record<string, string>}
 */
export function sanitizeCustomData(data = {}) {
  if (!data || typeof data !== 'object') return {};

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      sanitized[String(key)] = '';
    } else if (typeof value === 'object') {
      try {
        sanitized[String(key)] = JSON.stringify(value);
      } catch (e) {
        sanitized[String(key)] = String(value);
      }
    } else {
      sanitized[String(key)] = String(value);
    }
  }

  return sanitized;
}

/**
 * Helper to split an array of tokens into chunks of max 500 tokens
 * @param {string[]} tokens
 * @param {number} batchSize
 * @returns {string[][]}
 */
export function batchTokens(tokens, batchSize = FCM_MULTICAST_MAX_BATCH_SIZE) {
  if (!tokens || !Array.isArray(tokens)) return [];
  const batches = [];
  for (let i = 0; i < tokens.length; i += batchSize) {
    batches.push(tokens.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Removes permanently invalid or unregistered tokens from MongoDB DeviceToken collection.
 * Never deletes tokens for transient errors or network issues.
 * @param {string[]} tokens - List of invalid tokens to prune
 * @returns {Promise<number>} - Count of deleted tokens
 */
export async function removeInvalidTokens(tokens) {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return 0;
  }

  const validTokens = Array.from(new Set(tokens.filter((t) => typeof t === 'string' && t.trim().length > 0)));
  if (validTokens.length === 0) return 0;

  try {
    const result = await DeviceToken.deleteMany({ token: { $in: validTokens } });
    if (result.deletedCount > 0) {
      console.log(`[HelpuFCM] Pruned ${result.deletedCount} permanent invalid/expired token(s) from MongoDB`);
    }
    return result.deletedCount;
  } catch (err) {
    console.error('[HelpuFCM] Error pruning invalid tokens from database:', err.message);
    return 0;
  }
}

/**
 * Sends a push notification to a list of device tokens with automatic batching,
 * multicast messaging, and invalid token cleanup.
 *
 * @param {string[]} rawTokens - Device FCM registration tokens
 * @param {Object} notification - Notification content { title, body, imageUrl }
 * @param {Object} [data] - Custom data payload { bookingId, travelId, route, type, ... }
 * @param {Object} [options] - Optional overrides (e.g. mockMessaging for testing)
 * @returns {Promise<{ success: boolean, sent: number, failed: number, skipped: boolean, removedTokens: number, batchCount: number, reason?: string }>}
 */
export async function sendPushToTokens(rawTokens, notification = {}, data = {}, options = {}) {
  // 1. Check Firebase Admin availability
  const messaging = options.messaging !== undefined ? options.messaging : getFirebaseMessaging();
  const configured = options.messaging !== undefined ? Boolean(options.messaging) : isFirebaseConfigured();

  if (!configured || !messaging) {
    return {
      success: false,
      skipped: true,
      reason: 'firebase_not_configured',
      sent: 0,
      failed: 0,
      removedTokens: 0,
      batchCount: 0
    };
  }

  // 2. Filter and deduplicate tokens to prevent sending duplicate notifications
  if (!rawTokens || !Array.isArray(rawTokens) || rawTokens.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'no_tokens_provided',
      sent: 0,
      failed: 0,
      removedTokens: 0,
      batchCount: 0
    };
  }

  const uniqueTokens = Array.from(
    new Set(rawTokens.filter((t) => typeof t === 'string' && t.trim().length > 0))
  );

  if (uniqueTokens.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'no_valid_tokens_after_filtering',
      sent: 0,
      failed: 0,
      removedTokens: 0,
      batchCount: 0
    };
  }

  // 3. Prepare payload and sanitized data
  const title = notification.title || 'HelpU Notification';
  const body = notification.body || notification.message || '';
  const imageUrl = notification.imageUrl || null;
  const sanitizedData = sanitizeCustomData(data);

  // Split into batches of at most 500 tokens
  const tokenBatches = batchTokens(uniqueTokens, FCM_MULTICAST_MAX_BATCH_SIZE);

  let totalSent = 0;
  let totalFailed = 0;
  const invalidTokensToPrune = [];

  // 4. Dispatch batches
  for (const batch of tokenBatches) {
    const hasValidImage = typeof imageUrl === 'string' && imageUrl.trim().startsWith('http');

    const multicastMessage = {
      tokens: batch,
      notification: {
        title,
        body,
        ...(hasValidImage ? { imageUrl: imageUrl.trim() } : {})
      },
      android: {
        priority: 'high',
        notification: {
          channelId: HELPU_NOTIFICATION_CHANNEL_ID,
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          ...(hasValidImage ? { imageUrl: imageUrl.trim() } : {})
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
            badge: 1
          }
        }
      },
      data: sanitizedData
    };

    try {
      const response = await messaging.sendEachForMulticast(multicastMessage);

      totalSent += response.successCount;
      totalFailed += response.failureCount;

      // Inspect per-token results to identify permanent errors
      if (response.failureCount > 0 && Array.isArray(response.responses)) {
        response.responses.forEach((res, idx) => {
          if (!res.success && res.error) {
            const errCode = res.error.code;
            const token = batch[idx];
            const tokenPrefix = token.slice(0, 8) + '...';

            if (isPermanentTokenError(errCode)) {
              console.warn(`[HelpuFCM] Permanent token error (${errCode}) for token prefix ${tokenPrefix}. Marking for removal.`);
              invalidTokensToPrune.push(token);
            } else {
              console.warn(`[HelpuFCM] Transient/retryable push error (${errCode}) for token prefix ${tokenPrefix}: ${res.error.message}`);
            }
          }
        });
      }
    } catch (batchErr) {
      console.error('[HelpuFCM] Error dispatching multicast batch:', batchErr.message);
      totalFailed += batch.length;
    }
  }

  // 5. Clean up any permanent invalid tokens
  let removedCount = 0;
  if (invalidTokensToPrune.length > 0) {
    removedCount = await removeInvalidTokens(invalidTokensToPrune);
  }

  return {
    success: totalSent > 0 || (totalSent === 0 && totalFailed === 0),
    sent: totalSent,
    failed: totalFailed,
    skipped: false,
    removedTokens: removedCount,
    batchCount: tokenBatches.length
  };
}

/**
 * Sends a push notification to all active registered devices belonging to one or more user IDs.
 *
 * @param {string|string[]} userIds - Single user ID or array of user IDs
 * @param {Object} notification - Notification content { title, body, imageUrl }
 * @param {Object} [data] - Custom data payload { bookingId, travelId, type, route, ... }
 * @param {Object} [options] - Optional overrides
 * @returns {Promise<{ success: boolean, sent: number, failed: number, skipped: boolean, removedTokens: number, batchCount: number, reason?: string }>}
 */
export async function sendPushToUsers(userIds, notification = {}, data = {}, options = {}) {
  // Normalize user IDs
  const rawList = Array.isArray(userIds) ? userIds : [userIds];
  const validUserIds = Array.from(
    new Set(rawList.filter((id) => typeof id === 'string' && id.trim().length > 0))
  );

  if (validUserIds.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'no_users_provided',
      sent: 0,
      failed: 0,
      removedTokens: 0,
      batchCount: 0
    };
  }

  try {
    // Fetch all active device tokens for the target users
    const deviceDocs = await DeviceToken.find(
      { userId: { $in: validUserIds } },
      { token: 1, userId: 1, platform: 1 }
    ).lean();

    if (!deviceDocs || deviceDocs.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: 'no_registered_devices_for_users',
        sent: 0,
        failed: 0,
        removedTokens: 0,
        batchCount: 0
      };
    }

    const tokens = deviceDocs.map((d) => d.token).filter(Boolean);

    return await sendPushToTokens(tokens, notification, data, options);
  } catch (err) {
    console.error('[HelpuFCM] Error querying device tokens for push delivery:', err.message);
    return {
      success: false,
      skipped: false,
      reason: 'database_query_error',
      error: err.message,
      sent: 0,
      failed: 0,
      removedTokens: 0,
      batchCount: 0
    };
  }
}

/**
 * Convenience helper to send a push notification to a single user's devices.
 *
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification content { title, body, imageUrl }
 * @param {Object} [data] - Custom data payload { bookingId, travelId, type, route, ... }
 * @param {Object} [options] - Optional overrides
 * @returns {Promise<{ success: boolean, sent: number, failed: number, skipped: boolean, removedTokens: number, batchCount: number, reason?: string }>}
 */
export async function sendPushToUser(userId, notification = {}, data = {}, options = {}) {
  return await sendPushToUsers([userId], notification, data, options);
}

export default {
  sendPushToUser,
  sendPushToUsers,
  sendPushToTokens,
  removeInvalidTokens,
  sanitizeCustomData,
  batchTokens,
  isPermanentTokenError,
  FCM_MULTICAST_MAX_BATCH_SIZE,
  HELPU_NOTIFICATION_CHANNEL_ID,
  PERMANENT_TOKEN_ERROR_CODES
};

