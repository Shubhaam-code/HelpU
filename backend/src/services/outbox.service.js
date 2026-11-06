import crypto from 'crypto';
import Outbox from '../models/Outbox.js';
import Notification from '../models/Notification.js';
import { formatNotificationContent } from '../jobs/notification.jobs.js';
import { emitRealtimeNotification } from './socket.service.js';
import { sendPushToUser } from './fcm.service.js';
import { addNotificationJob } from '../queues/notification.queue.js';
import { hasRedisConfigured } from '../config/redis.js';

let processorIntervalTimer = null;
let isProcessing = false;

/**
 * Creates an Outbox event inside an optional MongoDB transaction session.
 * @param {Object} params
 * @param {string} [params.eventId] - Unique event ID (generated if not provided)
 * @param {string} params.eventType - e.g. BOOKING_REQUESTED, BOOKING_CONFIRMED, etc.
 * @param {string} params.recipientId - Canonical user ID of recipient
 * @param {string|mongoose.Types.ObjectId} [params.relatedBookingId]
 * @param {string|mongoose.Types.ObjectId} [params.relatedTravelId]
 * @param {Object} params.payload - Notification payload
 * @param {ClientSession} [session] - MongoDB transaction session
 * @returns {Promise<Outbox>}
 */
export async function createOutboxEvent(
  { eventId, eventType, recipientId, relatedBookingId, relatedTravelId, payload },
  session = null
) {
  const generatedId = eventId || `evt_${crypto.randomUUID()}`;

  const doc = {
    eventId: generatedId,
    eventType,
    recipientId,
    relatedBookingId,
    relatedTravelId,
    payload,
    status: 'pending',
    retries: 0
  };

  const options = session ? { session } : {};
  const [created] = await Outbox.create([doc], options);
  return created;
}

/**
 * Dispatches pending and stale locked outbox events to the BullMQ queue.
 * Implements atomic status transitions and lease reclamation to prevent
 * duplicate processing across multiple processor instances.
 */
export async function dispatchOutboxEvents({ batchSize = 100, leaseMs = 2 * 60 * 1000, eventId = null } = {}) {
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - leaseMs);

  const filter = eventId
    ? { eventId }
    : {
        $or: [
          { status: 'pending' },
          { status: 'processing', lockedAt: { $lt: leaseCutoff } }
        ]
      };

  // Find candidate events
  const candidates = await Outbox.find(filter, { _id: 1 })
    .sort({ createdAt: 1 })
    .limit(batchSize);

  let processedCount = 0;

  for (const candidate of candidates) {
    // Atomically claim the event with a lease
    const claimFilter = eventId
      ? { _id: candidate._id }
      : {
          _id: candidate._id,
          $or: [
            { status: 'pending' },
            { status: 'processing', lockedAt: { $lt: leaseCutoff } }
          ]
        };

    const event = await Outbox.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          status: 'processing',
          lockedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // If another processor claimed it concurrently, skip
    if (!event) continue;

    try {
      // 1. Idempotently persist in-app notification in MongoDB using eventId
      const { title, message } = formatNotificationContent(event.eventType, event.payload || {});
      const notificationDoc = await Notification.findOneAndUpdate(
        { eventId: event.eventId },
        {
          $setOnInsert: {
            recipientId: event.recipientId,
            eventId: event.eventId,
            type: event.eventType,
            title,
            message,
            relatedBookingId: event.relatedBookingId || null,
            relatedTravelId: event.relatedTravelId || null,
            isRead: false
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      // 2. Real-time Socket.IO emission if available
      emitRealtimeNotification(event.recipientId, {
        _id: notificationDoc?._id,
        eventId: event.eventId,
        type: event.eventType,
        title,
        message,
        relatedBookingId: event.relatedBookingId,
        relatedTravelId: event.relatedTravelId,
        isRead: false,
        createdAt: notificationDoc?.createdAt || new Date()
      });

      // 3. Native Mobile FCM Push Notification (idempotent, isolated, non-blocking)
      if (!event.pushSentAt) {
        try {
          const pushPayloadData = {
            notificationId: notificationDoc?._id ? String(notificationDoc._id) : '',
            eventId: event.eventId,
            type: event.eventType,
            bookingId: event.relatedBookingId ? String(event.relatedBookingId) : '',
            travelId: event.relatedTravelId ? String(event.relatedTravelId) : '',
            route: event.relatedBookingId
              ? `/bookings/${event.relatedBookingId}`
              : (event.relatedTravelId ? `/rides/${event.relatedTravelId}` : '/notifications')
          };

          const pushResult = await sendPushToUser(
            event.recipientId,
            {
              title,
              body: message
            },
            pushPayloadData
          );

          if (!pushResult.skipped) {
            // Atomically record push dispatch time to prevent duplicates on outbox retries
            await Outbox.updateOne(
              { _id: event._id },
              { $set: { pushSentAt: new Date() } }
            );
          }
        } catch (pushErr) {
          // FCM failure must never roll back committed transactions or break in-app notifications
          console.warn(`[Outbox] Non-fatal push delivery error for event ${event.eventId}:`, pushErr.message);
        }
      } else {
        console.log(`[Outbox] Push notification already sent for event ${event.eventId}. Skipping duplicate push.`);
      }

      // 4. If Redis is configured, also enqueue into BullMQ for background reminder scheduling
      if (hasRedisConfigured()) {
        try {
          await addNotificationJob(
            event.eventType,
            {
              eventId: event.eventId,
              eventType: event.eventType,
              recipientId: event.recipientId,
              relatedBookingId: event.relatedBookingId,
              relatedTravelId: event.relatedTravelId,
              payload: event.payload,
              createdAt: event.createdAt
            },
            {
              jobId: event.eventId
            }
          );
        } catch (queueErr) {
          console.warn(`[Outbox] Optional queue enqueue failed for ${event.eventId}:`, queueErr.message);
        }
      }

      // 4. Mark outbox event as successfully processed
      await Outbox.updateOne(
        { _id: event._id },
        {
          $set: {
            status: 'processed',
            processedAt: new Date(),
            lastError: null
          }
        }
      );

      processedCount++;
    } catch (err) {
      console.error(`[Outbox] Failed to deliver event ${event.eventId}:`, err.message);

      const nextRetries = (event.retries || 0) + 1;
      const nextStatus = nextRetries >= (event.maxRetries || 3) ? 'failed' : 'pending';

      await Outbox.updateOne(
        { _id: event._id },
        {
          $set: {
            status: nextStatus,
            retries: nextRetries,
            lastError: err.message
          }
        }
      );
    }
  }

  return processedCount;
}

/**
 * Triggers an immediate outbox dispatch (e.g. immediately after a transaction commits).
 */
export function triggerOutboxSweep() {
  setImmediate(async () => {
    if (isProcessing) return;
    try {
      isProcessing = true;
      await dispatchOutboxEvents();
    } catch (err) {
      console.error('[Outbox] Error during immediate sweep:', err.message);
    } finally {
      isProcessing = false;
    }
  });
}

/**
 * Starts periodic background polling of the Outbox.
 */
export function startOutboxProcessor({ intervalMs = 3000 } = {}) {
  if (processorIntervalTimer) return;

  console.log(`[Outbox] Starting periodic outbox processor (interval: ${intervalMs}ms)...`);
  processorIntervalTimer = setInterval(async () => {
    if (isProcessing) return;
    try {
      isProcessing = true;
      await dispatchOutboxEvents();
    } catch (err) {
      console.error('[Outbox] Periodic sweep error:', err.message);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);
}

/**
 * Stops the periodic background outbox processor.
 */
export function stopOutboxProcessor() {
  if (processorIntervalTimer) {
    clearInterval(processorIntervalTimer);
    processorIntervalTimer = null;
    console.log('[Outbox] Periodic outbox processor stopped.');
  }
}
