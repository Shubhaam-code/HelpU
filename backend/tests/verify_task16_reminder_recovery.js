import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import Outbox from '../src/models/Outbox.js';
import { getNotificationQueue } from '../src/queues/notification.queue.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';
import {
  scheduleBookingReminders,
  cancelBookingReminders,
  reconcileBookingReminders,
  calculateDepartureTimestamp
} from '../src/services/reminder.service.js';
import { processNotificationJob } from '../src/workers/notification.worker.js';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedAssertions++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Task 16 - Reminder Recovery & Cancellation Hardening');
  console.log('================================================================\n');

  await connectDB();
  console.log('Connected to MongoDB Atlas successfully.');

  const queue = getNotificationQueue();

  const timestamp = Date.now();
  const ownerClerkId = `user_task16_owner_${timestamp}`;
  const passengerClerkId = `user_task16_pass_${timestamp}`;

  const owner = await Student.create({
    clerkId: ownerClerkId,
    email: `owner_${timestamp}@thapar.edu`,
    name: 'Owner T16'
  });

  const passenger = await Student.create({
    clerkId: passengerClerkId,
    email: `pass_${timestamp}@thapar.edu`,
    name: 'Passenger T16'
  });

  const testTravels = [];
  const testBookings = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Cancellation racing with reminder scheduling
    // -------------------------------------------------------------
    console.log('>>> 1. Cancellation Racing With Reminder Scheduling <<<');

    const futureTravelDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const travel1 = await Travel.create({
      userId: ownerClerkId,
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Railway Station',
      travelDate: futureTravelDate,
      departureTime: 600, // 10:00 AM
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
    });
    testTravels.push(travel1._id);

    const bookingRace = await Booking.create({
      travelId: travel1._id,
      passengerId: passengerClerkId,
      ownerId: ownerClerkId,
      requestedSeats: 2,
      status: 'confirmed'
    });
    testBookings.push(bookingRace._id);

    // Simulate cancellation happening right when scheduling begins / completes
    // Update booking status to cancelled in DB
    await Booking.updateOne({ _id: bookingRace._id }, { $set: { status: 'cancelled' } });

    // When scheduleBookingReminders runs, its pre-check or post-check will detect cancellation
    const raceResult = await scheduleBookingReminders(bookingRace, travel1);
    assert(
      raceResult.scheduled24h === false && raceResult.scheduled1h === false,
      'Pre-check or post-check detected cancellation and aborted scheduling'
    );

    const job24Race = await queue.getJob(`reminder-24h-${bookingRace._id}`);
    const job1Race = await queue.getJob(`reminder-1h-${bookingRace._id}`);
    assert(job24Race === undefined || job24Race === null, 'No 24h reminder job remains in queue after race');
    assert(job1Race === undefined || job1Race === null, 'No 1h reminder job remains in queue after race');

    // -------------------------------------------------------------
    // Test 2: Post-scheduling cancellation detection
    // -------------------------------------------------------------
    console.log('\n>>> 2. Post-Scheduling Cancellation Detection & Purge <<<');

    const bookingRacePost = await Booking.create({
      travelId: travel1._id,
      passengerId: passengerClerkId,
      ownerId: ownerClerkId,
      requestedSeats: 1,
      status: 'confirmed'
    });
    testBookings.push(bookingRacePost._id);

    // Directly schedule reminders while confirmed
    const initialSched = await scheduleBookingReminders(bookingRacePost, travel1);
    assert(initialSched.scheduled24h === true, 'Initially scheduled 24h reminder');
    assert(initialSched.scheduled1h === true, 'Initially scheduled 1h reminder');

    // Cancel booking and call cancelBookingReminders
    await Booking.updateOne({ _id: bookingRacePost._id }, { $set: { status: 'cancelled' } });
    await cancelBookingReminders(bookingRacePost._id);

    const checkJob24 = await queue.getJob(`reminder-24h-${bookingRacePost._id}`);
    const checkJob1 = await queue.getJob(`reminder-1h-${bookingRacePost._id}`);
    assert(checkJob24 === undefined || checkJob24 === null, '24h reminder successfully purged on cancellation');
    assert(checkJob1 === undefined || checkJob1 === null, '1h reminder successfully purged on cancellation');

    // -------------------------------------------------------------
    // Test 3: Cancellation followed by worker retry
    // -------------------------------------------------------------
    console.log('\n>>> 3. Cancellation Followed by Worker Retry <<<');

    // Worker processes a retried BOOKING_CONFIRMED job for an already-cancelled booking
    const fakeConfirmedJob = {
      id: `evt_retry_cancelled_${timestamp}`,
      name: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      attemptsMade: 1,
      data: {
        eventId: `evt_retry_cancelled_${timestamp}`,
        recipientId: passengerClerkId,
        relatedBookingId: bookingRacePost._id.toString(),
        relatedTravelId: travel1._id.toString(),
        payload: {
          source: travel1.source,
          destination: travel1.destination,
          travelDate: travel1.travelDate
        }
      }
    };

    const workerResult = await processNotificationJob(fakeConfirmedJob);
    assert(workerResult.success === true, 'Worker handled retried event without crashing');

    const retryJob24 = await queue.getJob(`reminder-24h-${bookingRacePost._id}`);
    const retryJob1 = await queue.getJob(`reminder-1h-${bookingRacePost._id}`);
    assert(retryJob24 === undefined || retryJob24 === null, 'Worker retry did not recreate 24h reminder for cancelled booking');
    assert(retryJob1 === undefined || retryJob1 === null, 'Worker retry did not recreate 1h reminder for cancelled booking');

    // -------------------------------------------------------------
    // Test 4: Redis Queue Emptied and Reconciliation Restores Reminders
    // -------------------------------------------------------------
    console.log('\n>>> 4. Redis Queue Emptied and Reconciliation Restores Reminders <<<');

    const bookingConfirmed = await Booking.create({
      travelId: travel1._id,
      passengerId: passengerClerkId,
      ownerId: ownerClerkId,
      requestedSeats: 1,
      status: 'confirmed'
    });
    testBookings.push(bookingConfirmed._id);

    // Initial schedule
    await scheduleBookingReminders(bookingConfirmed, travel1);
    assert(await queue.getJob(`reminder-24h-${bookingConfirmed._id}`) !== null, 'Reminder 24h exists prior to simulated Redis loss');

    // Simulate Redis data loss by removing the reminder jobs
    await cancelBookingReminders(bookingConfirmed._id);
    assert((await queue.getJob(`reminder-24h-${bookingConfirmed._id}`)) == null, 'Simulated Redis loss: 24h job removed');
    assert((await queue.getJob(`reminder-1h-${bookingConfirmed._id}`)) == null, 'Simulated Redis loss: 1h job removed');

    // Run reconciliation
    const statsRecon = await reconcileBookingReminders({ batchSize: 50 });
    assert(statsRecon.scanned >= 1, `Reconciliation scanned at least 1 confirmed booking (scanned: ${statsRecon.scanned})`);
    assert(statsRecon.scheduled24h >= 1, `Reconciliation restored 24h reminder (restored: ${statsRecon.scheduled24h})`);
    assert(statsRecon.scheduled1h >= 1, `Reconciliation restored 1h reminder (restored: ${statsRecon.scheduled1h})`);

    const restored24 = await queue.getJob(`reminder-24h-${bookingConfirmed._id}`);
    const restored1 = await queue.getJob(`reminder-1h-${bookingConfirmed._id}`);
    assert(restored24 !== null && restored24 !== undefined, '24h reminder verified restored in BullMQ');
    assert(restored1 !== null && restored1 !== undefined, '1h reminder verified restored in BullMQ');
    assert(restored24.delay > 0, 'Restored 24h reminder has correct positive delay');
    assert(restored1.delay > 0, 'Restored 1h reminder has correct positive delay');

    // -------------------------------------------------------------
    // Test 5: Duplicate reconciliation does not duplicate jobs
    // -------------------------------------------------------------
    console.log('\n>>> 5. Duplicate Reconciliation Does Not Duplicate Jobs <<<');

    const statsDup = await reconcileBookingReminders({ batchSize: 50 });
    assert(statsDup.scheduled24h === 0, 'Second reconciliation added 0 duplicate 24h reminders');
    assert(statsDup.scheduled1h === 0, 'Second reconciliation added 0 duplicate 1h reminders');

    // -------------------------------------------------------------
    // Test 6: Confirmed bookings receive expected reminders
    // -------------------------------------------------------------
    console.log('\n>>> 6. Confirmed Bookings Receive Expected Reminders <<<');

    const fakeReminder24Job = {
      id: `reminder-24h-${bookingConfirmed._id}`,
      name: NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
      attemptsMade: 0,
      data: {
        bookingId: bookingConfirmed._id.toString(),
        travelId: travel1._id.toString(),
        reminderType: '24h',
        departureTime: travel1.travelDate.toISOString()
      }
    };

    const reminderExecResult = await processNotificationJob(fakeReminder24Job);
    assert(reminderExecResult.success === true, 'Reminder job executed successfully for confirmed booking');

    const notifPass = await Notification.findOne({
      recipientId: passengerClerkId,
      type: NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
      relatedBookingId: bookingConfirmed._id
    });
    assert(notifPass !== null, 'In-app reminder notification delivered to passenger');

    const notifOwner = await Notification.findOne({
      recipientId: ownerClerkId,
      type: NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
      relatedBookingId: bookingConfirmed._id
    });
    assert(notifOwner !== null, 'In-app reminder notification delivered to travel owner');

    // -------------------------------------------------------------
    // Test 7: Cancelled bookings do not receive reminders
    // -------------------------------------------------------------
    console.log('\n>>> 7. Cancelled Bookings Do Not Receive Reminders <<<');

    const bookingCancelledExecution = await Booking.create({
      travelId: travel1._id,
      passengerId: passengerClerkId,
      ownerId: ownerClerkId,
      requestedSeats: 1,
      status: 'cancelled'
    });
    testBookings.push(bookingCancelledExecution._id);

    const fakeReminderCancelledJob = {
      id: `reminder-24h-${bookingCancelledExecution._id}`,
      name: NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
      attemptsMade: 0,
      data: {
        bookingId: bookingCancelledExecution._id.toString(),
        travelId: travel1._id.toString(),
        reminderType: '24h',
        departureTime: travel1.travelDate.toISOString()
      }
    };

    const cancelledExecResult = await processNotificationJob(fakeReminderCancelledJob);
    assert(cancelledExecResult.skipped === true, 'Worker skipped reminder for cancelled booking');
    assert(cancelledExecResult.reason === 'booking_not_confirmed', 'Worker identified reason as booking_not_confirmed');

    const notifCancelled = await Notification.findOne({
      relatedBookingId: bookingCancelledExecution._id,
      type: NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H
    });
    assert(notifCancelled === null, 'No notification was created for cancelled booking');

    // -------------------------------------------------------------
    // Test 8: Past departure travel is skipped
    // -------------------------------------------------------------
    console.log('\n>>> 8. Past Departure Travel Is Skipped <<<');

    const pastTravelDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const pastTravel = await Travel.create({
      userId: ownerClerkId,
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Railway Station',
      travelDate: pastTravelDate,
      departureTime: 480, // 8:00 AM
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 1,
      status: 'active',
      expiresAt: pastTravelDate
    });
    testTravels.push(pastTravel._id);

    const bookingPast = await Booking.create({
      travelId: pastTravel._id,
      passengerId: passengerClerkId,
      ownerId: ownerClerkId,
      requestedSeats: 1,
      status: 'confirmed'
    });
    testBookings.push(bookingPast._id);

    const pastSched = await scheduleBookingReminders(bookingPast, pastTravel);
    assert(pastSched.scheduled24h === false, 'Did not schedule 24h reminder for past departure');
    assert(pastSched.scheduled1h === false, 'Did not schedule 1h reminder for past departure');

  } finally {
    console.log('\nCleaning up Task 16 test data...');
    try {
      if (testBookings.length > 0) {
        for (const bId of testBookings) {
          await cancelBookingReminders(bId);
        }
        await Booking.deleteMany({ _id: { $in: testBookings } });
        await Notification.deleteMany({ relatedBookingId: { $in: testBookings } });
      }
      if (testTravels.length > 0) {
        await Travel.deleteMany({ _id: { $in: testTravels } });
      }
      await Student.deleteMany({ clerkId: { $in: [ownerClerkId, passengerClerkId] } });
      await Notification.deleteMany({ recipientId: { $in: [ownerClerkId, passengerClerkId] } });
      await queue.close();
      await mongoose.disconnect();
      console.log('Cleanup completed and disconnected.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr.message);
    }
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedAssertions} / ${totalAssertions} assertions passed (${Math.round((passedAssertions / totalAssertions) * 100)}%)`);
  console.log('================================================================\n');

  if (passedAssertions !== totalAssertions) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Unexpected error running Task 16 tests:', err);
  process.exit(1);
});
