import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { NOTIFICATION_QUEUE_NAME } from '../queues/notification.queue.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';

let notificationWorker = null;
let workerRedisConnection = null;

/**
 * Job processing function
 */
export async function processNotificationJob(job) {
  const { name, data, id, attemptsMade } = job;
  console.log(`[Worker] Processing job "${name}" (ID: ${id}, Attempt: ${attemptsMade + 1})`);

  switch (name) {
    case NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION: {
      const { recipientId, message, shouldFail, alwaysFail } = data;

      // Handle intentional failures for testing retry mechanisms
      if (alwaysFail) {
        throw new Error(`Intentional permanent test failure for job ${id}`);
      }

      if (shouldFail && attemptsMade < 1) {
        throw new Error(`Transient test failure for job ${id} (Attempt ${attemptsMade + 1})`);
      }

      // Successful test processing
      console.log(`[Worker] Successfully processed test notification for recipient "${recipientId}": ${message}`);
      return {
        success: true,
        recipientId,
        processedAt: new Date().toISOString()
      };
    }

    default:
      console.warn(`[Worker] Unknown job type received: "${name}"`);
      return { skipped: true, reason: 'unknown_job_type' };
  }
}

/**
 * Initialize and start the BullMQ notification worker
 */
export function startNotificationWorker() {
  if (!notificationWorker) {
    workerRedisConnection = createRedisConnection();

    notificationWorker = new Worker(NOTIFICATION_QUEUE_NAME, processNotificationJob, {
      connection: workerRedisConnection,
      concurrency: 5
    });

    notificationWorker.on('completed', (job, result) => {
      console.log(`[Worker] Job ${job.id} (${job.name}) completed successfully.`);
    });

    notificationWorker.on('failed', (job, err) => {
      console.warn(`[Worker] Job ${job?.id} (${job?.name}) failed on attempt ${job?.attemptsMade}: ${err.message}`);
    });

    notificationWorker.on('error', (err) => {
      console.error(`[Worker] Worker internal error: ${err.message}`);
    });

    console.log(`[Worker] Notification worker started on queue "${NOTIFICATION_QUEUE_NAME}".`);
  }

  return notificationWorker;
}

/**
 * Gracefully stop the notification worker and close its Redis connection
 */
export async function closeNotificationWorker() {
  if (notificationWorker) {
    console.log('[Worker] Stopping notification worker...');
    await notificationWorker.close();
    notificationWorker = null;
  }
  if (workerRedisConnection) {
    await workerRedisConnection.quit();
    workerRedisConnection = null;
  }
  console.log('[Worker] Notification worker stopped.');
}
