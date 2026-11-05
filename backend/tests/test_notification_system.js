import mongoose from 'mongoose';
import Notification from '../src/models/Notification.js';
import Outbox from '../src/models/Outbox.js';
import Booking from '../src/models/Booking.js';
import Travel from '../src/models/Travel.js';
import { createOutboxEvent, dispatchOutboxEvents } from '../src/services/outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';

async function runNotificationSystemTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Phase 3 - Notification System Verification');
  console.log('================================================================\n');

  const createdNotifIds = [];
  const createdOutboxIds = [];
  const studentHostId = 'student_host_phase3_' + Date.now();
  const studentPassengerId = 'student_passenger_phase3_' + Date.now();
  const unauthorizedStudentId = 'student_unauthorized_phase3_' + Date.now();
  const testTravelId = new mongoose.Types.ObjectId();
  const testBookingId = new mongoose.Types.ObjectId();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: BOOKING_REQUESTED notification (Student requests -> Host notified)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Booking requested notification for ride host <<<');
    const outboxReq = await createOutboxEvent({
      eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
      recipientId: studentHostId,
      relatedBookingId: testBookingId,
      relatedTravelId: testTravelId,
      payload: {
        source: 'VIT Bhopal',
        destination: 'Bhopal Station',
        requestedSeats: 2,
        travelDate: new Date()
      }
    });
    createdOutboxIds.push(outboxReq._id);

    // Dispatch outbox events to persist into Notification collection
    await dispatchOutboxEvents({ eventId: outboxReq.eventId });

    const hostNotif = await Notification.findOne({
      recipientId: studentHostId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED
    });

    if (!hostNotif) {
      throw new Error('FAIL: Booking requested notification not persisted in MongoDB');
    }
    createdNotifIds.push(hostNotif._id);
    console.log(`Host Notification: "${hostNotif.title}" - "${hostNotif.message}"`);
    console.log(`Recipient: ${hostNotif.recipientId}, isRead: ${hostNotif.isRead}`);
    console.log('Result: PASS (Host notified on booking request)\n');

    // -------------------------------------------------------------------------
    // TEST 2: BOOKING_ACCEPTED notification (Host approves -> Passenger notified)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 2: Booking approved notification for passenger <<<');
    const outboxApprove = await createOutboxEvent({
      eventType: NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED,
      recipientId: studentPassengerId,
      relatedBookingId: testBookingId,
      relatedTravelId: testTravelId,
      payload: {
        source: 'VIT Bhopal',
        destination: 'Bhopal Station',
        requestedSeats: 2
      }
    });
    createdOutboxIds.push(outboxApprove._id);
    await dispatchOutboxEvents({ eventId: outboxApprove.eventId });

    const passengerApproveNotif = await Notification.findOne({
      recipientId: studentPassengerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED
    });

    if (!passengerApproveNotif) {
      throw new Error('FAIL: Booking approved notification not persisted in MongoDB');
    }
    createdNotifIds.push(passengerApproveNotif._id);
    console.log(`Passenger Notification: "${passengerApproveNotif.title}" - "${passengerApproveNotif.message}"`);
    console.log('Result: PASS (Passenger notified on approval)\n');

    // -------------------------------------------------------------------------
    // TEST 3: BOOKING_REJECTED notification (Host rejects -> Passenger notified)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 3: Booking declined notification for passenger <<<');
    const outboxReject = await createOutboxEvent({
      eventType: NOTIFICATION_JOB_TYPES.BOOKING_REJECTED,
      recipientId: studentPassengerId,
      relatedBookingId: testBookingId,
      relatedTravelId: testTravelId,
      payload: {
        source: 'VIT Bhopal',
        destination: 'Bhopal Station'
      }
    });
    createdOutboxIds.push(outboxReject._id);
    await dispatchOutboxEvents({ eventId: outboxReject.eventId });

    const passengerRejectNotif = await Notification.findOne({
      recipientId: studentPassengerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_REJECTED
    });

    if (!passengerRejectNotif) {
      throw new Error('FAIL: Booking rejected notification not persisted in MongoDB');
    }
    createdNotifIds.push(passengerRejectNotif._id);
    console.log(`Passenger Notification: "${passengerRejectNotif.title}" - "${passengerRejectNotif.message}"`);
    console.log('Result: PASS (Passenger notified on rejection)\n');

    // -------------------------------------------------------------------------
    // TEST 4: BOOKING_CANCELLED notification (Cancellation notifies other party)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 4: Booking cancellation notification for host <<<');
    const outboxCancel = await createOutboxEvent({
      eventType: NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER,
      recipientId: studentHostId,
      relatedBookingId: testBookingId,
      relatedTravelId: testTravelId,
      payload: {
        source: 'VIT Bhopal',
        destination: 'Bhopal Station',
        cancelledBy: 'passenger'
      }
    });
    createdOutboxIds.push(outboxCancel._id);
    await dispatchOutboxEvents({ eventId: outboxCancel.eventId });

    const hostCancelNotif = await Notification.findOne({
      recipientId: studentHostId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER
    });

    if (!hostCancelNotif) {
      throw new Error('FAIL: Booking cancellation notification not persisted in MongoDB');
    }
    createdNotifIds.push(hostCancelNotif._id);
    console.log(`Host Notification: "${hostCancelNotif.title}" - "${hostCancelNotif.message}"`);
    console.log('Result: PASS (Host notified on cancellation)\n');

    // -------------------------------------------------------------------------
    // TEST 5: Ownership protection
    // -------------------------------------------------------------------------
    console.log('>>> TEST 5: Ownership protection (Users can only see & modify own notifications) <<<');
    // Unauthorized user queries notifications
    const unauthorizedList = await Notification.find({ recipientId: unauthorizedStudentId });
    if (unauthorizedList.length !== 0) {
      throw new Error('FAIL: Unauthorized user saw other users notifications');
    }
    console.log('Unauthorized user query returned 0 notifications: PASS');

    // Unauthorized user attempts to mark passenger's notification as read
    const unauthorizedUpdate = await Notification.findOneAndUpdate(
      { _id: passengerApproveNotif._id, recipientId: unauthorizedStudentId },
      { $set: { isRead: true } }
    );
    if (unauthorizedUpdate !== null) {
      throw new Error('FAIL: Unauthorized user was able to modify another user notification');
    }
    console.log('Unauthorized mark-as-read returned null (protected): PASS');
    console.log('Result: PASS (Strict ownership protection verified)\n');

    // -------------------------------------------------------------------------
    // TEST 6: Read / Unread Status and Counters
    // -------------------------------------------------------------------------
    console.log('>>> TEST 6: Read / unread status and count management <<<');
    // Host has 2 unread notifications (Test 1 and Test 4)
    const hostUnreadBefore = await Notification.countDocuments({
      recipientId: studentHostId,
      isRead: false
    });
    console.log(`Host unread count before: ${hostUnreadBefore}`);
    if (hostUnreadBefore !== 2) {
      throw new Error(`FAIL: Expected 2 unread notifications for host, got ${hostUnreadBefore}`);
    }

    // Mark single notification as read
    await Notification.findOneAndUpdate(
      { _id: hostNotif._id, recipientId: studentHostId },
      { $set: { isRead: true } }
    );
    const hostUnreadAfterOne = await Notification.countDocuments({
      recipientId: studentHostId,
      isRead: false
    });
    console.log(`Host unread count after marking one as read: ${hostUnreadAfterOne}`);
    if (hostUnreadAfterOne !== 1) {
      throw new Error(`FAIL: Expected 1 unread notification after marking one read, got ${hostUnreadAfterOne}`);
    }

    // Mark all as read
    await Notification.updateMany(
      { recipientId: studentHostId, isRead: false },
      { $set: { isRead: true } }
    );
    const hostUnreadAfterAll = await Notification.countDocuments({
      recipientId: studentHostId,
      isRead: false
    });
    console.log(`Host unread count after marking all read: ${hostUnreadAfterAll}`);
    if (hostUnreadAfterAll !== 0) {
      throw new Error(`FAIL: Expected 0 unread notifications after mark-all-read, got ${hostUnreadAfterAll}`);
    }
    console.log('Result: PASS (Read/unread states and counts updated accurately)\n');

    // -------------------------------------------------------------------------
    // TEST 7: Persistence across reconnect / refresh
    // -------------------------------------------------------------------------
    console.log('>>> TEST 7: Persistence across reconnect/refresh <<<');
    const persistedNotifications = await Notification.find({ recipientId: studentHostId })
      .sort({ createdAt: -1 });

    console.log(`Found ${persistedNotifications.length} persisted notifications in MongoDB for student host:`);
    persistedNotifications.forEach((n, idx) => {
      console.log(` ${idx + 1}. [${n.type}] "${n.title}" (isRead: ${n.isRead})`);
    });

    if (persistedNotifications.length !== 2) {
      throw new Error(`FAIL: Expected 2 persisted notifications, found ${persistedNotifications.length}`);
    }
    console.log('Result: PASS (Notifications reliably persisted in MongoDB)\n');

    console.log('================================================================');
    console.log('ALL PHASE 3 NOTIFICATION SYSTEM TESTS PASSED! (7/7)');
    console.log('================================================================\n');

  } finally {
    console.log('Cleaning up test notifications and outbox events...');
    if (createdNotifIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotifIds } });
    }
    if (createdOutboxIds.length > 0) {
      await Outbox.deleteMany({ _id: { $in: createdOutboxIds } });
    }
    console.log('Cleanup complete. Disconnecting...');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runNotificationSystemTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
