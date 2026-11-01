import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import app from '../src/app.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Outbox from '../src/models/Outbox.js';
import Notification from '../src/models/Notification.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';
import {
  createOutboxEvent,
  dispatchOutboxEvents,
  triggerOutboxSweep
} from '../src/services/outbox.service.js';
import {
  scheduleBookingReminders,
  cancelBookingReminders,
  calculateDepartureTimestamp
} from '../src/services/reminder.service.js';
import {
  startNotificationWorker,
  closeNotificationWorker
} from '../src/workers/notification.worker.js';
import {
  getNotificationQueue,
  closeNotificationQueue
} from '../src/queues/notification.queue.js';

// Setup Mock RSA Token for Clerk Authentication Testing
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

process.env.CLERK_JWT_KEY = publicKey;

function generateTestToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: nowSec - 60,
      nbf: nowSec - 60,
      exp: nowSec + 3600
    })
  ).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

const ownerId = `user_owner_${Date.now()}`;
const passengerId = `user_pass_${Date.now()}`;
const passenger2Id = `user_pass2_${Date.now()}`;
const strangerId = `user_stranger_${Date.now()}`;

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenPassenger2 = generateTestToken(passenger2Id);
const tokenStranger = generateTestToken(strangerId);

let testServer = null;
let baseUrl = '';

async function apiRequest(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, body: data };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNotification(filter, maxWaitMs = 3500) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const notif = await Notification.findOne(filter);
    if (notif) return notif;
    await sleep(150);
  }
  return await Notification.findOne(filter);
}

async function runNotificationSystemTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Task 13 - Complete Notification System');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas successfully.');

  // Start HTTP Test Server on random available port
  testServer = app.listen(0);
  const assignedPort = testServer.address().port;
  baseUrl = `http://localhost:${assignedPort}`;
  console.log(`Test API server running at ${baseUrl}`);

  // Start BullMQ Worker
  const worker = startNotificationWorker();
  console.log('BullMQ notification worker started.\n');

  const testTravels = [];
  const testBookings = [];
  const testEventIds = [];

  try {
    // ---------------------------------------------------------
    // PHASE 1: TRANSACTIONAL OUTBOX TESTS
    // ---------------------------------------------------------
    console.log('>>> 1. Transactional Outbox Pattern Tests <<<');

    // Test 1.1: Event saved inside committed transaction
    const sessionCommit = await mongoose.startSession();
    sessionCommit.startTransaction();
    const eventCommitId = `evt_test_commit_${Date.now()}`;
    testEventIds.push(eventCommitId);

    await createOutboxEvent(
      {
        eventId: eventCommitId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
        recipientId: ownerId,
        payload: { source: 'Campus A', destination: 'Station' }
      },
      sessionCommit
    );
    await sessionCommit.commitTransaction();
    await sessionCommit.endSession();

    const savedEvent = await Outbox.findOne({ eventId: eventCommitId });
    assert(savedEvent !== null, 'Outbox event successfully committed in MongoDB transaction');
    assert(savedEvent.status === 'pending', 'Outbox event initialized with status "pending"');

    // Test 1.2: Event NOT saved when transaction is aborted
    const sessionAbort = await mongoose.startSession();
    sessionAbort.startTransaction();
    const eventAbortId = `evt_test_abort_${Date.now()}`;

    await createOutboxEvent(
      {
        eventId: eventAbortId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
        recipientId: ownerId,
        payload: { source: 'Campus A', destination: 'Station' }
      },
      sessionAbort
    );
    await sessionAbort.abortTransaction();
    await sessionAbort.endSession();

    const abortedEvent = await Outbox.findOne({ eventId: eventAbortId });
    assert(abortedEvent === null, 'Outbox event safely rolled back when transaction is aborted');

    // Test 1.3: Duplicate eventId protection (unique index)
    let duplicateRejected = false;
    try {
      await createOutboxEvent({
        eventId: eventCommitId, // Same ID as already committed
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
        recipientId: ownerId,
        payload: {}
      });
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected === true, 'Outbox enforces unique index constraint on eventId');

    // Test 1.4: Outbox processor dispatching to BullMQ
    const dispatchedCount = await dispatchOutboxEvents({ batchSize: 10 });
    assert(dispatchedCount >= 1, `Outbox processor claimed and dispatched ${dispatchedCount} event(s)`);

    const updatedOutboxDoc = await Outbox.findOne({ eventId: eventCommitId });
    assert(updatedOutboxDoc.status === 'processed', 'Outbox event status atomically transitioned to "processed"');
    assert(updatedOutboxDoc.processedAt instanceof Date, 'Outbox event processedAt timestamp recorded');

    // Wait 500ms for BullMQ worker to consume and write in-app notification
    await sleep(600);
    const deliveredNotif = await Notification.findOne({ eventId: eventCommitId });
    assert(deliveredNotif !== null, 'BullMQ worker delivered in-app notification to MongoDB');
    assert(deliveredNotif.recipientId === ownerId, 'Notification recipient matches outbox recipientId');

    // ---------------------------------------------------------
    // PHASE 2: BOOKING NOTIFICATIONS (ALL 6 EVENT TYPES)
    // ---------------------------------------------------------
    console.log('\n>>> 2. Actual Booking Notifications Integration <<<');

    // Create a base Travel offer for testing booking actions
    const departureTimeMinutes = 10 * 60; // 10:00 AM
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days in future

    const travel = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 1',
      destination: 'Airport Terminal 2',
      travelDate: futureDate,
      departureTime: departureTimeMinutes,
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 0,
      status: 'active',
      expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
    });
    testTravels.push(travel._id);

    // Event 1: New Booking Request -> notifies Owner (BOOKING_REQUESTED)
    const resReq = await apiRequest('POST', '/api/bookings', { travelId: travel._id.toString(), requestedSeats: 2 }, tokenPassenger);
    assert(resReq.status === 201, 'Booking request created with HTTP 201');
    const booking1 = resReq.body.data;
    testBookings.push(booking1._id);

    const notifReq = await waitForNotification({
      recipientId: ownerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
      relatedBookingId: booking1._id
    });
    assert(notifReq !== null, 'Event 1 (BOOKING_REQUESTED): In-app notification delivered to travel owner');
    assert(notifReq.message.includes('2 seat(s)'), 'Notification payload correctly formats requested seats');

    // Event 2: Booking Accepted -> notifies Passenger (BOOKING_ACCEPTED)
    const resAccept = await apiRequest('PATCH', `/api/bookings/${booking1._id}/respond`, { action: 'accept' }, tokenOwner);
    assert(resAccept.status === 200, 'Booking request accepted with HTTP 200');

    const notifAccepted = await waitForNotification({
      recipientId: passengerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED,
      relatedBookingId: booking1._id
    });
    assert(notifAccepted !== null, 'Event 2 (BOOKING_ACCEPTED): In-app notification delivered to passenger');

    // Event 3: Booking Rejected -> notifies Passenger 2 (BOOKING_REJECTED)
    const resReq2 = await apiRequest('POST', '/api/bookings', { travelId: travel._id.toString(), requestedSeats: 1 }, tokenPassenger2);
    assert(resReq2.status === 201, 'Second booking request created (HTTP 201)');
    const booking2 = resReq2.body.data;
    testBookings.push(booking2._id);

    const resReject = await apiRequest('PATCH', `/api/bookings/${booking2._id}/respond`, { action: 'reject' }, tokenOwner);
    assert(resReject.status === 200, 'Booking request rejected with HTTP 200');

    const notifRejected = await waitForNotification({
      recipientId: passenger2Id,
      type: NOTIFICATION_JOB_TYPES.BOOKING_REJECTED,
      relatedBookingId: booking2._id
    });
    assert(notifRejected !== null, 'Event 3 (BOOKING_REJECTED): In-app notification delivered to passenger 2');

    // Event 4: Booking Confirmed -> notifies Passenger (BOOKING_CONFIRMED) & schedules reminders
    const resConfirm = await apiRequest('POST', `/api/bookings/${booking1._id}/confirm`, null, tokenOwner);
    assert(resConfirm.status === 200, 'Booking confirmed with HTTP 200');

    const notifConfirmed = await waitForNotification({
      recipientId: passengerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      relatedBookingId: booking1._id
    });
    assert(notifConfirmed !== null, 'Event 4 (BOOKING_CONFIRMED): In-app notification delivered to passenger');

    // Event 5: Booking Cancelled by Passenger -> notifies Owner (BOOKING_CANCELLED_BY_PASSENGER)
    const resCancelPassenger = await apiRequest('PATCH', `/api/bookings/${booking1._id}/cancel`, null, tokenPassenger);
    assert(resCancelPassenger.status === 200, 'Booking cancelled by passenger with HTTP 200');

    const notifCancelByPass = await waitForNotification({
      recipientId: ownerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER,
      relatedBookingId: booking1._id
    });
    assert(notifCancelByPass !== null, 'Event 5 (BOOKING_CANCELLED_BY_PASSENGER): Delivered to travel owner');

    // Event 6: Booking Cancelled by Owner -> notifies Passenger (BOOKING_CANCELLED_BY_OWNER)
    // Setup a 3rd booking, accept and confirm it first
    const resReq3 = await apiRequest('POST', '/api/bookings', { travelId: travel._id.toString(), requestedSeats: 1 }, tokenPassenger);
    const booking3 = resReq3.body.data;
    testBookings.push(booking3._id);

    await apiRequest('PATCH', `/api/bookings/${booking3._id}/respond`, { action: 'accept' }, tokenOwner);
    await apiRequest('POST', `/api/bookings/${booking3._id}/confirm`, null, tokenOwner);

    const resCancelOwner = await apiRequest('PATCH', `/api/bookings/${booking3._id}/cancel`, null, tokenOwner);
    assert(resCancelOwner.status === 200, 'Booking cancelled by owner with HTTP 200');

    const notifCancelByOwner = await waitForNotification({
      recipientId: passengerId,
      type: NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER,
      relatedBookingId: booking3._id
    });
    assert(notifCancelByOwner !== null, 'Event 6 (BOOKING_CANCELLED_BY_OWNER): Delivered to passenger');

    // ---------------------------------------------------------
    // PHASE 3: NOTIFICATION DELIVERY & API TESTS
    // ---------------------------------------------------------
    console.log('\n>>> 3. Notification APIs & Privacy Tests <<<');

    // Test 3.1: Unauthorized access
    const resNoAuth = await apiRequest('GET', '/api/notifications');
    assert(resNoAuth.status === 401, 'GET /api/notifications without token returns HTTP 401');

    // Test 3.2: Privacy/Ownership - stranger sees 0 notifications
    const resStranger = await apiRequest('GET', '/api/notifications', null, tokenStranger);
    assert(resStranger.status === 200, 'GET /api/notifications returns HTTP 200');
    assert(resStranger.body.count === 0, 'Stranger cannot see notifications belonging to other students');

    // Test 3.3: Passenger sees their notifications with pagination
    const resPassNotifs = await apiRequest('GET', '/api/notifications?page=1&limit=10', null, tokenPassenger);
    assert(resPassNotifs.status === 200, 'Passenger fetches notifications successfully');
    assert(resPassNotifs.body.count > 0, `Passenger received ${resPassNotifs.body.count} notification(s)`);
    assert(resPassNotifs.body.page === 1, 'Pagination page matches query');

    // Verify sorted newest first
    const items = resPassNotifs.body.data;
    if (items.length >= 2) {
      const isNewestFirst = new Date(items[0].createdAt) >= new Date(items[1].createdAt);
      assert(isNewestFirst === true, 'Notifications are sorted newest first (createdAt: -1)');
    }

    // Test 3.4: GET /api/notifications/unread-count
    const resUnread = await apiRequest('GET', '/api/notifications/unread-count', null, tokenPassenger);
    assert(resUnread.status === 200, 'GET /api/notifications/unread-count returns HTTP 200');
    assert(resUnread.body.unreadCount > 0, `Unread count correctly returned (${resUnread.body.unreadCount})`);

    // Test 3.5: PATCH /api/notifications/:id/read (mark single read)
    const targetNotif = items[0];
    const resMarkRead = await apiRequest('PATCH', `/api/notifications/${targetNotif._id}/read`, null, tokenPassenger);
    assert(resMarkRead.status === 200, 'Mark single notification as read returns HTTP 200');
    assert(resMarkRead.body.data.isRead === true, 'Notification isRead set to true');

    // Stranger cannot mark someone else's notification as read
    const resStrangerMark = await apiRequest('PATCH', `/api/notifications/${targetNotif._id}/read`, null, tokenStranger);
    assert(resStrangerMark.status === 404, 'Stranger cannot mark other student notification as read (HTTP 404)');

    // Test 3.6: PATCH /api/notifications/read-all
    const resReadAll = await apiRequest('PATCH', '/api/notifications/read-all', null, tokenPassenger);
    assert(resReadAll.status === 200, 'Mark all notifications as read returns HTTP 200');

    const resUnreadAfter = await apiRequest('GET', '/api/notifications/unread-count', null, tokenPassenger);
    assert(resUnreadAfter.body.unreadCount === 0, 'Unread count becomes 0 after read-all');

    // ---------------------------------------------------------
    // PHASE 4: SCHEDULED TRAVEL REMINDERS
    // ---------------------------------------------------------
    console.log('\n>>> 4. Scheduled Travel Reminders (Delayed Jobs) <<<');

    // Test 4.1: Asia/Kolkata departure calculation
    const depTime = calculateDepartureTimestamp('2026-11-15T00:00:00.000Z', 10 * 60 + 30); // 10:30 AM IST
    assert(depTime instanceof Date, 'Departure timestamp calculated as valid Date');
    const istHours = depTime.getUTCHours() + 5.5; // IST = UTC + 5.5
    assert(istHours === 10.5, 'Departure time correctly calculated in Asia/Kolkata timezone (10:30 IST)');

    // Test 4.2: Scheduling reminders for future confirmed booking
    const fakeConfirmedBooking = {
      _id: new mongoose.Types.ObjectId(),
      status: 'confirmed'
    };
    const futureTravel = {
      _id: new mongoose.Types.ObjectId(),
      travelDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days ahead
      departureTime: 12 * 60
    };

    const scheduleRes = await scheduleBookingReminders(fakeConfirmedBooking, futureTravel);
    assert(scheduleRes.scheduled24h === true, '24h reminder scheduled for future departure');
    assert(scheduleRes.scheduled1h === true, '1h reminder scheduled for future departure');

    // Verify queue contains the delayed jobs with stable IDs
    const queue = getNotificationQueue();
    const job24 = await queue.getJob(`reminder-24h-${fakeConfirmedBooking._id}`);
    assert(job24 !== null && job24 !== undefined, 'BullMQ delayed job exists for 24h reminder');
    assert(job24.opts.delay > 0, 'BullMQ job has positive delay configured');

    // Test 4.3: Prevent duplicate scheduling with stable job ID
    const duplicateSchedule = await scheduleBookingReminders(fakeConfirmedBooking, futureTravel);
    const allJobs = await queue.getJobs(['delayed', 'waiting']);
    const matching24 = allJobs.filter((j) => j.id === `reminder-24h-${fakeConfirmedBooking._id}`);
    assert(matching24.length === 1, 'Stable job ID prevented duplicate delayed job creation');

    // Test 4.4: Invalidate reminders on cancellation
    const cancelRes = await cancelBookingReminders(fakeConfirmedBooking._id);
    assert(cancelRes === true, 'cancelBookingReminders executed successfully');

    const job24AfterCancel = await queue.getJob(`reminder-24h-${fakeConfirmedBooking._id}`);
    assert(job24AfterCancel === null || job24AfterCancel === undefined, 'Delayed job removed from BullMQ upon cancellation');

    // Test 4.5: Past departure handling (should NOT schedule reminders)
    const pastTravel = {
      _id: new mongoose.Types.ObjectId(),
      travelDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days in past
      departureTime: 8 * 60
    };
    const pastSchedule = await scheduleBookingReminders(fakeConfirmedBooking, pastTravel);
    assert(pastSchedule.scheduled24h === false, 'Did not schedule 24h reminder for past departure');
    assert(pastSchedule.scheduled1h === false, 'Did not schedule 1h reminder for past departure');

  } finally {
    // Clean up test data
    console.log('\nCleaning up test data...');
    if (testTravels.length > 0) {
      await Travel.deleteMany({ _id: { $in: testTravels } });
    }
    if (testBookings.length > 0) {
      await Booking.deleteMany({ _id: { $in: testBookings } });
    }
    await Outbox.deleteMany({ recipientId: { $in: [ownerId, passengerId, passenger2Id, strangerId] } });
    await Notification.deleteMany({ recipientId: { $in: [ownerId, passengerId, passenger2Id, strangerId] } });

    // Close test HTTP server
    if (testServer) {
      testServer.close();
    }

    // Gracefully stop worker, queue, and disconnect
    await closeNotificationWorker();
    await closeNotificationQueue();
    await mongoose.disconnect();
    console.log('Cleanup completed and disconnected.');
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} assertions passed (100%)`);
  console.log('================================================================\n');
}

runNotificationSystemTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[FATAL] Notification test execution failed:', err);
    process.exit(1);
  });
