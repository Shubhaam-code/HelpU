import crypto from 'crypto';
import Outbox from '../models/Outbox.js';
import { addNotificationJob } from '../queues/notification.queue.js';

let processorIntervalTimer = null;
let isProcessing = false;

/**
 * Creates an Outbox event inside an optional MongoDB transaction session.
 * @param {Object} params
 * @param {string} [params.eventId] - Unique event ID (generated if not provided)
 * @param {string} params.eventType - e.g. BOOKING_REQUESTED, BOOKING_CONFIRMED, etc.
 * @param {string} params.recipientId - Clerk ID of recipient
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
export async function dispatchOutboxEvents({ batchSize = 25, leaseMs = 2 * 60 * 1000 } = {}) {
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - leaseMs);

  // Find IDs of candidate events
  const candidates = await Outbox.find(
    {
      $or: [
        { status: 'pending' },
        { status: 'processing', lockedAt: { $lt: leaseCutoff } }
      ]
    },
    { _id: 1 }
  )
    .sort({ createdAt: 1 })
    .limit(batchSize);

  let processedCount = 0;

  for (const candidate of candidates) {
    // Atomically claim the event with a lease
    const event = await Outbox.findOneAndUpdate(
      {
        _id: candidate._id,
        $or: [
          { status: 'pending' },
          { status: 'processing', lockedAt: { $lt: leaseCutoff } }
        ]
      },
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
      // Enqueue into BullMQ using stable eventId as jobId for queue-level idempotency
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

      // Mark outbox event as successfully processed
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
      console.error(`[Outbox] Failed to enqueue event ${event.eventId}:`, err.message);

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
