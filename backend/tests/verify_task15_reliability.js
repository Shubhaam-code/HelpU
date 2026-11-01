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
  startNotificationWorker,
  closeNotificationWorker,
  processNotificationJob
} from '../src/workers/notification.worker.js';
import {
  getNotificationQueue,
  closeNotificationQueue
} from '../src/queues/notification.queue.js';
import {
  createRedisConnection,
  checkRedisEvictionPolicy
} from '../src/config/redis.js';

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

const ownerId = `user_task15_owner_${Date.now()}`;
const passengerId = `user_task15_pass_${Date.now()}`;

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);

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

async function runTask15Tests() {
  console.log('================================================================');
  console.log('TEST SUITE: Task 15 - Reliability Audit Fix Verification');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas successfully.');

  // Start HTTP Test Server on random available port
  testServer = app.listen(0);
  const assignedPort = testServer.address().port;
  baseUrl = `http://localhost:${assignedPort}`;

  // Start BullMQ Worker
  const worker = startNotificationWorker();
  console.log('BullMQ notification worker started.\n');

  const testTravels = [];
  const testBookings = [];

  try {
    // ----------------------------------------------------------------
    // TEST 1: REDIS EVICTION POLICY DETECTION
    // ----------------------------------------------------------------
    console.log('>>> 1. Redis Eviction Policy Non-Blocking Inspection <<<');
    const redisClient = createRedisConnection();
    const policy = await checkRedisEvictionPolicy(redisClient);
    assert(typeof policy === 'string' && policy.length > 0, `Eviction policy detected safely: "${policy}"`);
    await redisClient.quit();

    // ----------------------------------------------------------------
    // TEST 2: CONFIRMATION PROCESSED BY WORKER SCHEDULES REMINDERS
    // ----------------------------------------------------------------
    console.log('\n>>> 2. Confirmation Event in Worker Schedules Reminders <<<');
    const futureDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days ahead
    const travel1 = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 4',
      destination: 'Central Railway Station',
      travelDate: futureDate,
      departureTime: 14 * 60, // 2:00 PM
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 0,
      status: 'active',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    });
    testTravels.push(travel1._id);

    // Create booking
    const resReq = await apiRequest('POST', '/api/bookings', { travelId: travel1._id.toString(), requestedSeats: 1 }, tokenPassenger);
    assert(resReq.status === 201, 'Booking request created with HTTP 201');
    const booking1 = resReq.body.data;
    testBookings.push(booking1._id);

    // Accept booking
    const resAccept = await apiRequest('PATCH', `/api/bookings/${booking1._id}/respond`, { action: 'accept' }, tokenOwner);
    assert(resAccept.status === 200, 'Booking accepted with HTTP 200');

    // Confirm booking
    const resConfirm = await apiRequest('POST', `/api/bookings/${booking1._id}/confirm`, null, tokenOwner);
    assert(resConfirm.status === 200, 'Booking confirmed with HTTP 200');

    // Wait for outbox sweep and worker to process BOOKING_CONFIRMED
    await sleep(1000);

    const queue = getNotificationQueue();
    const job24h = await queue.getJob(`reminder-24h-${booking1._id}`);
    const job1h = await queue.getJob(`reminder-1h-${booking1._id}`);

    assert(job24h !== null && job24h !== undefined, '24h reminder scheduled by worker upon BOOKING_CONFIRMED event');
    assert(job1h !== null && job1h !== undefined, '1h reminder scheduled by worker upon BOOKING_CONFIRMED event');
    assert(job24h.opts.delay > 0, '24h reminder has positive delay configured');
    assert(job1h.opts.delay > 0, '1h reminder has positive delay configured');

    // ----------------------------------------------------------------
    // TEST 3: DUPLICATE CONFIRMATION EVENT DOES NOT DUPLICATE REMINDERS
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Idempotency: Duplicate Confirmation Event Processing <<<');
    // Simulate re-delivering the exact same BOOKING_CONFIRMED job to the worker
    await processNotificationJob({
      name: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      id: `evt_test_dup_${Date.now()}`,
      attemptsMade: 1,
      data: {
        eventId: `evt_dup_${Date.now()}`,
        recipientId: passengerId,
        relatedBookingId: booking1._id.toString(),
        relatedTravelId: travel1._id.toString(),
        payload: {
          source: travel1.source,
          destination: travel1.destination,
          travelDate: travel1.travelDate
        }
      }
    });

    const delayedJobs = await queue.getJobs(['delayed']);
    const matching24h = delayedJobs.filter((j) => j.id === `reminder-24h-${booking1._id}`);
    const matching1h = delayedJobs.filter((j) => j.id === `reminder-1h-${booking1._id}`);

    assert(matching24h.length === 1, 'Stable job ID prevented duplicate 24h reminder scheduling');
    assert(matching1h.length === 1, 'Stable job ID prevented duplicate 1h reminder scheduling');

    // ----------------------------------------------------------------
    // TEST 4: BOOKING CANCELLED AFTER SCHEDULING REMOVES REMINDERS
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Cancellation After Scheduling Invalidation <<<');
    const resCancel = await apiRequest('PATCH', `/api/bookings/${booking1._id}/cancel`, null, tokenPassenger);
    assert(resCancel.status === 200, 'Confirmed booking cancelled successfully (HTTP 200)');
    await sleep(300);

    const job24hAfterCancel = await queue.getJob(`reminder-24h-${booking1._id}`);
    const job1hAfterCancel = await queue.getJob(`reminder-1h-${booking1._id}`);

    assert(job24hAfterCancel === null || job24hAfterCancel === undefined, '24h reminder removed from queue on cancellation');
    assert(job1hAfterCancel === null || job1hAfterCancel === undefined, '1h reminder removed from queue on cancellation');

    // ----------------------------------------------------------------
    // TEST 5: BOOKING CANCELLED BEFORE EVENT PROCESSING SKIPS REMINDERS
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Cancellation Before Event Processing <<<');
    // Create a 2nd booking and directly set it to cancelled in DB to simulate race condition
    const fakeBookingId = new mongoose.Types.ObjectId();
    testBookings.push(fakeBookingId);

    await Booking.create({
      _id: fakeBookingId,
      travelId: travel1._id,
      ownerId,
      passengerId,
      requestedSeats: 1,
      status: 'cancelled' // Already cancelled before worker processes confirmation
    });

    // Simulate worker receiving a delayed/stale BOOKING_CONFIRMED job for this already-cancelled booking
    await processNotificationJob({
      name: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      id: `evt_cancelled_race_${Date.now()}`,
      attemptsMade: 0,
      data: {
        eventId: `evt_race_${Date.now()}`,
        recipientId: passengerId,
        relatedBookingId: fakeBookingId.toString(),
        relatedTravelId: travel1._id.toString(),
        payload: {
          source: travel1.source,
          destination: travel1.destination
        }
      }
    });

    const job24hRace = await queue.getJob(`reminder-24h-${fakeBookingId}`);
    assert(job24hRace === null || job24hRace === undefined, 'Reminders correctly skipped for booking that is no longer confirmed');

    // ----------------------------------------------------------------
    // TEST 6: PAST DEPARTURE TIME HANDLING
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Past Departure Time Handling <<<');
    const pastTravel = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 4',
      destination: 'Campus Gate',
      travelDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days in past
      departureTime: 10 * 60,
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    testTravels.push(pastTravel._id);

    const pastBookingId = new mongoose.Types.ObjectId();
    testBookings.push(pastBookingId);
    await Booking.create({
      _id: pastBookingId,
      travelId: pastTravel._id,
      ownerId,
      passengerId,
      requestedSeats: 1,
      status: 'confirmed'
    });

    await processNotificationJob({
      name: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      id: `evt_past_${Date.now()}`,
      attemptsMade: 0,
      data: {
        eventId: `evt_past_evt_${Date.now()}`,
        recipientId: passengerId,
        relatedBookingId: pastBookingId.toString(),
        relatedTravelId: pastTravel._id.toString(),
        payload: {
          source: pastTravel.source,
          destination: pastTravel.destination
        }
      }
    });

    const job24hPast = await queue.getJob(`reminder-24h-${pastBookingId}`);
    const job1hPast = await queue.getJob(`reminder-1h-${pastBookingId}`);
    assert(job24hPast === null || job24hPast === undefined, 'No 24h reminder scheduled for past departure');
    assert(job1hPast === null || job1hPast === undefined, 'No 1h reminder scheduled for past departure');

  } finally {
    // Clean up test data
    console.log('\nCleaning up test data...');
    if (testTravels.length > 0) {
      await Travel.deleteMany({ _id: { $in: testTravels } });
    }
    if (testBookings.length > 0) {
      await Booking.deleteMany({ _id: { $in: testBookings } });
    }
    await Outbox.deleteMany({ recipientId: { $in: [ownerId, passengerId] } });
    await Notification.deleteMany({ recipientId: { $in: [ownerId, passengerId] } });

    if (testServer) {
      testServer.close();
    }
    await closeNotificationWorker();
    await closeNotificationQueue();
    await mongoose.disconnect();
    console.log('Cleanup completed and disconnected.');
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} assertions passed (100%)`);
  console.log('================================================================\n');
}

runTask15Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[FATAL] Task 15 test execution failed:', err);
    process.exit(1);
  });
