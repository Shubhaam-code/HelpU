/**
 * CampusPool Notification Job Definitions
 */

export const NOTIFICATION_JOB_TYPES = {
  TEST_NOTIFICATION: 'test-notification'
};

/**
 * Validates and formats a test notification job payload
 * @param {Object} payload 
 * @param {string} payload.recipientId - Test recipient identifier
 * @param {string} payload.message - Test message content
 * @param {boolean} [payload.shouldFail] - Optional flag for testing retry behavior
 */
export function buildTestNotificationPayload({ recipientId = 'test-user', message = 'CampusPool test notification', shouldFail = false } = {}) {
  return {
    recipientId,
    message,
    shouldFail,
    timestamp: new Date().toISOString()
  };
}
