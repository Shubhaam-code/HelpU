import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { NOTIFICATION_QUEUE_NAME } from '../queues/notification.queue.js';
import { NOTIFICATION_JOB_TYPES, formatNotificationContent } from '../jobs/notification.jobs.js';
import Notification from '../models/Notification.js';
import Booking from '../models/Booking.js';
import Travel from '../models/Travel.js';
import {
  scheduleBookingReminders,
  cancelBookingReminders,
  reconcileBookingReminders
} from '../services/reminder.service.js';

let notificationWorker = null;
let workerRedisConnection = null;
let reconciliationIntervalTimer = null;
let isReconciling = false;

/**
 * Job processing function
 */
export async function processNotificationJob(job) {
  const { name, data, id, attemptsMade } = job;
  console.log(`[Worker] Processing job "${name}" (ID: ${id}, Attempt: ${attemptsMade + 1})`);

  switch (name) {
    case NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION: {
      const { recipientId, message, shouldFail, alwaysFail } = data;

      if (alwaysFail) {
        throw new Error(`Intentional permanent test failure for job ${id}`);
      }

      if (shouldFail && attemptsMade < 1) {
        throw new Error(`Transient test failure for job ${id} (Attempt ${attemptsMade + 1})`);
      }

      console.log(`[Worker] Successfully processed test notification for recipient "${recipientId}": ${message}`);
      return {
        success: true,
        recipientId,
        processedAt: new Date().toISOString()
      };
    }

    case NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED:
    case NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED:
    case NOTIFICATION_JOB_TYPES.BOOKING_REJECTED:
    case NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED:
    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER:
    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER: {
      const { eventId, recipientId, relatedBookingId, relatedTravelId, payload } = data;

      if (!recipientId || !eventId) {
        throw new Error(`Missing required notification fields: recipientId or eventId for job ${id}`);
      }

      const { title, message } = formatNotificationContent(name, payload);

      // Idempotently create in-app notification using unique eventId
      await Notification.updateOne(
        { eventId },
        {
          $setOnInsert: {
            recipientId,
            eventId,
            type: name,
            title,
            message,
            relatedBookingId: relatedBookingId || null,
            relatedTravelId: relatedTravelId || null,
            isRead: false
          }
        },
        { upsert: true }
      );

      console.log(`[Worker] In-app notification delivered for event ${eventId} to recipient ${recipientId} (${name})`);

      // Reliably schedule travel reminders from the worker upon processing BOOKING_CONFIRMED
      if (name === NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED && relatedBookingId) {
        try {
          const booking = await Booking.findById(relatedBookingId);
          if (booking && booking.status === 'confirmed') {
            const travel = await Travel.findById(booking.travelId || relatedTravelId);
            if (travel && travel.status === 'active') {
              await scheduleBookingReminders(booking, travel);
            } else {
              console.log(`[Worker] Skipped reminder scheduling for booking ${booking._id}: travel not found or inactive`);
            }
          } else {
            console.log(`[Worker] Skipped reminder scheduling: booking ${relatedBookingId} is not in confirmed status (${booking?.status})`);
          }
        } catch (reminderErr) {
          console.error(`[Worker] Error scheduling reminders for booking ${relatedBookingId}:`, reminderErr.message);
        }
      }

      // Hardening: when processing cancellation events, ensure any pending reminders are purged from Redis
      if (
        (name === NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER ||
          name === NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER) &&
        relatedBookingId
      ) {
        await cancelBookingReminders(relatedBookingId);
      }

      return {
        success: true,
        eventId,
        recipientId,
        type: name
      };
    }

    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H:
    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H: {
      const { bookingId, travelId, reminderType } = data;

      // 1. Verify booking still exists and is confirmed
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        console.log(`[Worker] Reminder skipped: booking ${bookingId} not found.`);
        return { skipped: true, reason: 'booking_not_found' };
      }

      if (booking.status !== 'confirmed') {
        console.log(`[Worker] Reminder skipped: booking ${bookingId} status is "${booking.status}" (must be confirmed).`);
        await cancelBookingReminders(bookingId);
        return { skipped: true, reason: 'booking_not_confirmed' };
      }

      // 2. Verify associated travel still exists and is active
      const travel = await Travel.findById(booking.travelId || travelId);
      if (!travel || travel.status !== 'active') {
        console.log(`[Worker] Reminder skipped: travel ${travelId} not found or inactive.`);
        await cancelBookingReminders(bookingId);
        return { skipped: true, reason: 'travel_not_active' };
      }

      const payload = {
        source: travel.source,
        destination: travel.destination,
        travelDate: travel.travelDate
      };
      const { title, message } = formatNotificationContent(name, payload);

      // Deliver reminder to passenger
      const passengerEventId = `${id}-passenger`;
      await Notification.updateOne(
        { eventId: passengerEventId },
        {
          $setOnInsert: {
            recipientId: booking.passengerId,
            eventId: passengerEventId,
            type: name,
            title,
            message,
            relatedBookingId: booking._id,
            relatedTravelId: travel._id,
            isRead: false
          }
        },
        { upsert: true }
      );

      // Deliver reminder to travel owner
      const ownerEventId = `${id}-owner`;
      await Notification.updateOne(
        { eventId: ownerEventId },
        {
          $setOnInsert: {
            recipientId: booking.ownerId,
            eventId: ownerEventId,
            type: name,
            title,
            message,
            relatedBookingId: booking._id,
            relatedTravelId: travel._id,
            isRead: false
          }
        },
        { upsert: true }
      );

      console.log(`[Worker] ${reminderType} reminder delivered to passenger ${booking.passengerId} and owner ${booking.ownerId}`);
      return {
        success: true,
        type: name,
        bookingId: booking._id
      };
    }

    default:
      console.warn(`[Worker] Unknown job type received: "${name}"`);
      return { skipped: true, reason: 'unknown_job_type' };
  }
}

/**
 * Executes a single reminder reconciliation cycle.
 */
export async function runReminderReconciliation() {
  if (isReconciling) return;
  try {
    isReconciling = true;
    return await reconcileBookingReminders();
  } catch (err) {
    console.error('[Worker] Error during reminder reconciliation:', err.message);
  } finally {
    isReconciling = false;
  }
}

/**
 * Starts periodic reminder reconciliation.
 * @param {number} intervalMs 
 */
export function startReminderReconciliation(intervalMs = 15 * 60 * 1000) {
  if (reconciliationIntervalTimer) return;

  // Run initial reconciliation on startup shortly after initialization
  setTimeout(() => {
    runReminderReconciliation().catch(() => {});
  }, 1000);

  // Periodically repeat
  reconciliationIntervalTimer = setInterval(() => {
    runReminderReconciliation().catch(() => {});
  }, intervalMs);

  console.log(`[Worker] Periodic reminder reconciliation started (every ${Math.round(intervalMs / 1000)}s).`);
}

/**
 * Stops periodic reminder reconciliation.
 */
export function stopReminderReconciliation() {
  if (reconciliationIntervalTimer) {
    clearInterval(reconciliationIntervalTimer);
    reconciliationIntervalTimer = null;
    console.log('[Worker] Periodic reminder reconciliation stopped.');
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

    notificationWorker.on('completed', (job) => {
      console.log(`[Worker] Job ${job.id} (${job.name}) completed successfully.`);
    });

    notificationWorker.on('failed', (job, err) => {
      console.warn(`[Worker] Job ${job?.id} (${job?.name}) failed on attempt ${job?.attemptsMade}: ${err.message}`);
    });

    notificationWorker.on('error', (err) => {
      console.error(`[Worker] Worker internal error: ${err.message}`);
    });

    // Start background reminder reconciliation
    const intervalMs = Number(process.env.REMINDER_RECONCILIATION_INTERVAL_MS) || 15 * 60 * 1000;
    startReminderReconciliation(intervalMs);

    console.log(`[Worker] Notification worker started on queue "${NOTIFICATION_QUEUE_NAME}".`);
  }

  return notificationWorker;
}

/**
 * Gracefully stop the notification worker and close its Redis connection
 */
export async function closeNotificationWorker() {
  stopReminderReconciliation();

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
