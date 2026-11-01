import { getNotificationQueue, addNotificationJob } from '../queues/notification.queue.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';
import Booking from '../models/Booking.js';
import Travel from '../models/Travel.js';

/**
 * Calculates the exact UTC departure timestamp from travelDate and departureTime (in minutes from midnight)
 * in Asia/Kolkata timezone (UTC+05:30).
 * @param {Date|string} travelDate 
 * @param {number} departureMinutes 
 * @returns {Date}
 */
export function calculateDepartureTimestamp(travelDate, departureMinutes = 0) {
  if (!travelDate) return null;
  const dateObj = new Date(travelDate);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [year, month, day] = formatter.format(dateObj).split('-').map(Number);
  const hours = Math.floor(departureMinutes / 60);
  const minutes = departureMinutes % 60;

  // Convert IST (UTC+05:30) to UTC milliseconds
  const departureUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - (5 * 60 + 30) * 60 * 1000;
  return new Date(departureUtc);
}

/**
 * Schedules 24h and 1h delayed reminder jobs for confirmed bookings.
 * Performs pre-scheduling and post-scheduling status validation against MongoDB
 * to prevent race conditions when a booking is cancelled concurrently.
 * 
 * @param {Object} booking 
 * @param {Object} travel 
 */
export async function scheduleBookingReminders(booking, travel) {
  if (!booking || !travel) {
    return { scheduled24h: false, scheduled1h: false };
  }

  // 1. Pre-scheduling validation: check live status in MongoDB if document exists
  const currentBooking = await Booking.findById(booking._id).select('status').lean();
  if (currentBooking && currentBooking.status !== 'confirmed') {
    console.log(`[Reminders] Skipped scheduling for booking ${booking._id}: status is "${currentBooking.status}"`);
    return { scheduled24h: false, scheduled1h: false };
  }
  if (!currentBooking && booking.status !== 'confirmed') {
    console.log(`[Reminders] Skipped scheduling for booking ${booking._id}: status is "${booking.status}"`);
    return { scheduled24h: false, scheduled1h: false };
  }

  const departureDate = calculateDepartureTimestamp(travel.travelDate, travel.departureTime);
  if (!departureDate) return { scheduled24h: false, scheduled1h: false };

  const now = Date.now();
  const reminder24hTime = departureDate.getTime() - 24 * 60 * 60 * 1000;
  const reminder1hTime = departureDate.getTime() - 1 * 60 * 60 * 1000;

  let scheduled24h = false;
  let scheduled1h = false;

  // Schedule 24-hour reminder if in the future
  if (reminder24hTime > now) {
    const delay = reminder24hTime - now;
    await addNotificationJob(
      NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
      {
        bookingId: booking._id.toString(),
        travelId: travel._id.toString(),
        reminderType: '24h',
        departureTime: departureDate.toISOString()
      },
      {
        delay,
        jobId: `reminder-24h-${booking._id}` // Stable ID prevents duplicate scheduling
      }
    );
    scheduled24h = true;
    console.log(`[Reminders] Scheduled 24h reminder for booking ${booking._id} in ${Math.round(delay / 1000)}s`);
  }

  // Schedule 1-hour reminder if in the future
  if (reminder1hTime > now) {
    const delay = reminder1hTime - now;
    await addNotificationJob(
      NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H,
      {
        bookingId: booking._id.toString(),
        travelId: travel._id.toString(),
        reminderType: '1h',
        departureTime: departureDate.toISOString()
      },
      {
        delay,
        jobId: `reminder-1h-${booking._id}` // Stable ID prevents duplicate scheduling
      }
    );
    scheduled1h = true;
    console.log(`[Reminders] Scheduled 1h reminder for booking ${booking._id} in ${Math.round(delay / 1000)}s`);
  }

  // 2. Post-scheduling race hardening: re-verify booking status to catch concurrent cancellation
  const freshBooking = await Booking.findById(booking._id).select('status').lean();
  if (freshBooking && freshBooking.status !== 'confirmed') {
    console.log(`[Reminders] Detected concurrent cancellation for booking ${booking._id} during scheduling. Purging reminders.`);
    await cancelBookingReminders(booking._id);
    return { scheduled24h: false, scheduled1h: false, raceCancelled: true };
  }

  return { scheduled24h, scheduled1h };
}

/**
 * Cancels or invalidates pending reminders when a booking is cancelled.
 * @param {string|mongoose.Types.ObjectId} bookingId 
 */
export async function cancelBookingReminders(bookingId) {
  try {
    const queue = getNotificationQueue();
    const idStr = bookingId.toString();
    let removedAny = false;

    const job24 = await queue.getJob(`reminder-24h-${idStr}`);
    if (job24) {
      await job24.remove();
      removedAny = true;
      console.log(`[Reminders] Removed pending 24h reminder for booking ${idStr}`);
    }

    const job1 = await queue.getJob(`reminder-1h-${idStr}`);
    if (job1) {
      await job1.remove();
      removedAny = true;
      console.log(`[Reminders] Removed pending 1h reminder for booking ${idStr}`);
    }

    return removedAny || true;
  } catch (err) {
    console.warn(`[Reminders] Notice while removing reminders for booking ${bookingId}:`, err.message);
    return false;
  }
}

/**
 * Reconciles reminder jobs in BullMQ against MongoDB source of truth.
 * Ensures all future active confirmed bookings have their 24h/1h reminders scheduled.
 * Removes orphaned reminder jobs for cancelled or inactive bookings.
 * 
 * Uses cursor pagination and batching to avoid overwhelming MongoDB or Redis.
 * 
 * @param {Object} options
 * @param {number} [options.batchSize=50]
 * @returns {Promise<{ scanned: number, scheduled24h: number, scheduled1h: number, cancelledCleaned: number }>}
 */
export async function reconcileBookingReminders({ batchSize = 50 } = {}) {
  const queue = getNotificationQueue();
  const stats = {
    scanned: 0,
    scheduled24h: 0,
    scheduled1h: 0,
    cancelledCleaned: 0
  };

  const now = Date.now();

  // 1. Process confirmed bookings in batches using indexed cursor pagination (_id > lastId)
  let lastId = null;

  while (true) {
    const query = { status: 'confirmed' };
    if (lastId) {
      query._id = { $gt: lastId };
    }

    const bookings = await Booking.find(query)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();

    if (!bookings || bookings.length === 0) {
      break;
    }

    // Batch-fetch associated travel records
    const travelIds = [...new Set(bookings.map((b) => b.travelId))];
    const travels = await Travel.find({ _id: { $in: travelIds } }).lean();
    const travelMap = new Map(travels.map((t) => [t._id.toString(), t]));

    for (const booking of bookings) {
      stats.scanned++;
      const travel = travelMap.get(booking.travelId.toString());

      // If travel not found or not active, clean up any orphaned reminders
      if (!travel || travel.status !== 'active') {
        const removed = await cancelBookingReminders(booking._id);
        if (removed) stats.cancelledCleaned++;
        continue;
      }

      // Check departure time in Asia/Kolkata timezone
      const departureDate = calculateDepartureTimestamp(travel.travelDate, travel.departureTime);
      if (!departureDate || departureDate.getTime() <= now) {
        // Departure is in the past: ensure no stale reminder jobs linger
        await cancelBookingReminders(booking._id);
        continue;
      }

      const reminder24hTime = departureDate.getTime() - 24 * 60 * 60 * 1000;
      const reminder1hTime = departureDate.getTime() - 1 * 60 * 60 * 1000;

      // 24-hour reminder check & restore
      if (reminder24hTime > now) {
        const jobId24 = `reminder-24h-${booking._id}`;
        const existingJob = await queue.getJob(jobId24);
        if (!existingJob) {
          const delay = reminder24hTime - now;
          await addNotificationJob(
            NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
            {
              bookingId: booking._id.toString(),
              travelId: travel._id.toString(),
              reminderType: '24h',
              departureTime: departureDate.toISOString()
            },
            { delay, jobId: jobId24 }
          );
          stats.scheduled24h++;
        }
      }

      // 1-hour reminder check & restore
      if (reminder1hTime > now) {
        const jobId1 = `reminder-1h-${booking._id}`;
        const existingJob = await queue.getJob(jobId1);
        if (!existingJob) {
          const delay = reminder1hTime - now;
          await addNotificationJob(
            NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H,
            {
              bookingId: booking._id.toString(),
              travelId: travel._id.toString(),
              reminderType: '1h',
              departureTime: departureDate.toISOString()
            },
            { delay, jobId: jobId1 }
          );
          stats.scheduled1h++;
        }
      }
    }

    lastId = bookings[bookings.length - 1]._id;
    if (bookings.length < batchSize) {
      break;
    }
  }

  // 2. Also check recently updated cancelled bookings to ensure clean removal
  try {
    const recentCancelled = await Booking.find({
      status: 'cancelled',
      updatedAt: { $gte: new Date(now - 48 * 60 * 60 * 1000) }
    })
      .limit(batchSize)
      .lean();

    for (const cb of recentCancelled) {
      await cancelBookingReminders(cb._id);
    }
  } catch (err) {
    console.warn('[Reminders] Notice during cancelled bookings cleanup:', err.message);
  }

  console.log(
    `[Reminders] Reconciliation finished: scanned ${stats.scanned} confirmed bookings, ` +
    `restored ${stats.scheduled24h} (24h) and ${stats.scheduled1h} (1h) reminders.`
  );

  return stats;
}
