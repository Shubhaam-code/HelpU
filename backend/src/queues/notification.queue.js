import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

export const NOTIFICATION_QUEUE_NAME = 'campuspool-notifications';

let notificationQueue = null;
let queueRedisConnection = null;

/**
 * Initialize and get the BullMQ notification queue
 */
export function getNotificationQueue() {
  if (!notificationQueue) {
    queueRedisConnection = createRedisConnection();

    notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: queueRedisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000 // 1s, 2s, 4s...
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600
        },
        removeOnFail: {
          count: 500 // Retain failed jobs for inspection
        }
      }
    });

    console.log(`[BullMQ] Queue "${NOTIFICATION_QUEUE_NAME}" initialized.`);
  }

  return notificationQueue;
}

/**
 * Enqueue a notification job with optional deduplication / stable job ID
 * @param {string} name - Job type name
 * @param {Object} data - Job payload
 * @param {Object} [opts] - Additional BullMQ job options
 */
export async function addNotificationJob(name, data, opts = {}) {
  const queue = getNotificationQueue();
  const job = await queue.add(name, data, opts);
  console.log(`[BullMQ] Enqueued job: ${name} (ID: ${job.id})`);
  return job;
}

/**
 * Gracefully close the notification queue and its Redis connection
 */
export async function closeNotificationQueue() {
  if (notificationQueue) {
    console.log(`[BullMQ] Closing queue "${NOTIFICATION_QUEUE_NAME}"...`);
    await notificationQueue.close();
    notificationQueue = null;
  }
  if (queueRedisConnection) {
    await queueRedisConnection.quit();
    queueRedisConnection = null;
  }
  console.log(`[BullMQ] Queue "${NOTIFICATION_QUEUE_NAME}" closed.`);
}
