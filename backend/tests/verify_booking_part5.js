import dotenv from 'dotenv';
dotenv.config();
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';

// Setup RSA key pair for testing Clerk JWT token verification
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_bWludC1zZWFndWxsLTkzNTIuY2xlcmsuYWNjb3VudHMuZGV2JA';
process.env.CLERK_SECRET_KEY = 'sk_test_gMb6su0ewLT3mJhj9hlubhxGD7Iv7HLH0vj6sO4qAl';
process.env.CLERK_JWT_KEY = publicKey;

function generateTestToken(userId) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + 3600,
    nbf: now - 5,
    sid: 'sess_test_p5_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const ownerId = 'user_p5_owner_101';
const passengerId = 'user_p5_passenger_202';
const passenger2Id = 'user_p5_passenger_303';
const passenger3Id = 'user_p5_passenger_404';
const strangerId = 'user_p5_stranger_505';

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenStranger = generateTestToken(strangerId);

async function runPart5Tests() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  await mongoose.connect(mongoUri);

  const allUsers = [ownerId, passengerId, passenger2Id, passenger3Id, strangerId];
  await Travel.deleteMany({ userId: { $in: allUsers } });
  await Booking.deleteMany({ $or: [{ ownerId: { $in: allUsers } }, { passengerId: { $in: allUsers } }] });
  await Student.deleteMany({ clerkId: { $in: allUsers } });

  // Create Student profiles
  await Student.create([
    {
      clerkId: ownerId,
      name: 'Rohan Sharma',
      email: 'rohan.owner@campus.edu',
      phone: '+919876543210',
      college: 'IIT Delhi'
    },
    {
      clerkId: passengerId,
      name: 'Aarav Gupta',
      email: 'aarav.passenger@campus.edu',
      phone: '+919123456789',
      college: 'IIT Delhi'
    },
    {
      clerkId: passenger2Id,
      name: 'Priya Verma',
      email: 'priya.verma@campus.edu',
      phone: '+919988776655',
      college: 'IIT Delhi'
    },
    {
      clerkId: passenger3Id,
      name: 'Kavita Singh',
      email: 'kavita.singh@campus.edu',
      phone: '+919776655443',
      college: 'IIT Delhi'
    }
  ]);

  const port = 5010;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: Task 11 Part 5 - Final Booking Confirmation & Atomic Seats');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  try {
    // ----------------------------------------------------------------
    // Setup Travel Offer and Bookings
    // ----------------------------------------------------------------
    const travelDate = '2026-11-28';
    const offer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 1',
      destination: 'Railway Station',
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 0,
      status: 'active'
    });

    // 1. Accepted Booking (2 seats)
    const acceptedBooking1 = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId,
      requestedSeats: 2,
      status: 'accepted'
    });

    // 2. Pending Booking (1 seat)
    const pendingBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: passenger2Id,
      requestedSeats: 1,
      status: 'pending'
    });

    // 3. Rejected Booking (1 seat)
    const rejectedBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: passenger3Id,
      requestedSeats: 1,
      status: 'rejected'
    });

    // ----------------------------------------------------------------
    // 1. Missing Authentication -> 401
    // ----------------------------------------------------------------
    console.log('>>> 1. Missing Authentication <<<');
    const resNoAuth = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST'
    });
    assert(resNoAuth.status === 401, 'Missing token returns HTTP 401');

    // ----------------------------------------------------------------
    // 2. Invalid Booking ID -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 2. Invalid Booking ID <<<');
    const resInvalidId = await fetch(`${baseUrl}/api/bookings/invalid-booking-id/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resInvalidId.status === 400, 'Invalid MongoDB ObjectId returns HTTP 400');

    // ----------------------------------------------------------------
    // 3. Non-existent Booking -> 404
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Non-existent Booking <<<');
    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/bookings/${fakeId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resNotFound.status === 404, 'Non-existent booking returns HTTP 404');

    // ----------------------------------------------------------------
    // 4. Non-owner cannot confirm -> 403
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Non-owner cannot confirm <<<');
    const resPassenger = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resPassenger.status === 403, 'Passenger cannot confirm booking (HTTP 403)');

    const resStranger = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStranger}` }
    });
    assert(resStranger.status === 403, 'Unrelated user cannot confirm booking (HTTP 403)');

    // ----------------------------------------------------------------
    // 5. Pending booking cannot confirm -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Pending booking cannot confirm <<<');
    const resPending = await fetch(`${baseUrl}/api/bookings/${pendingBooking._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resPending.status === 400, 'Pending booking cannot be confirmed (HTTP 400)');

    // ----------------------------------------------------------------
    // 6. Rejected booking cannot confirm -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Rejected booking cannot confirm <<<');
    const resRejected = await fetch(`${baseUrl}/api/bookings/${rejectedBooking._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resRejected.status === 400, 'Rejected booking cannot be confirmed (HTTP 400)');

    // ----------------------------------------------------------------
    // 7. Inactive or expired travel post cannot confirm -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 7. Inactive or expired travel post <<<');
    const inactiveOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 1',
      destination: 'Railway Station',
      travelDate: new Date('2026-11-28'),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 3,
      status: 'cancelled'
    });
    const inactiveBooking = await Booking.create({
      travelId: inactiveOffer._id,
      ownerId,
      passengerId,
      requestedSeats: 1,
      status: 'accepted'
    });
    const resInactive = await fetch(`${baseUrl}/api/bookings/${inactiveBooking._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resInactive.status === 400, 'Inactive travel post cannot confirm booking (HTTP 400)');

    const expiredOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 1',
      destination: 'Railway Station',
      travelDate: new Date('2025-01-01'),
      expiresAt: new Date('2025-01-02T00:00:00.000Z'),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 3,
      status: 'active'
    });
    const expiredBooking = await Booking.create({
      travelId: expiredOffer._id,
      ownerId,
      passengerId,
      requestedSeats: 1,
      status: 'accepted'
    });
    const resExpired = await fetch(`${baseUrl}/api/bookings/${expiredBooking._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resExpired.status === 400, 'Expired travel post cannot confirm booking (HTTP 400)');

    // ----------------------------------------------------------------
    // 8. Accepted booking can be confirmed by owner
    // ----------------------------------------------------------------
    console.log('\n>>> 8. Accepted booking can be confirmed by owner <<<');
    const resConfirm1 = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    const confirmData1 = await resConfirm1.json();
    assert(resConfirm1.status === 200, 'Owner successfully confirms accepted booking (HTTP 200)');
    assert(confirmData1.data?.booking?.status === 'confirmed', 'Booking status transitioned to "confirmed"');
    assert(confirmData1.data?.travel?.bookedSeats === 2, 'Travel bookedSeats updated to 2');
    assert(confirmData1.data?.travel?.availableSeats === 2, 'Available seats correctly calculated as 2 (4 - 2)');
    assert(confirmData1.data?.travel?.totalSeats === 4, 'Total seat capacity remains 4 (not overwritten)');
    assert(confirmData1.data?.phone === undefined, 'Phone numbers not exposed in confirm API');

    // Verify in database
    const dbOffer = await Travel.findById(offer._id);
    assert(dbOffer.seats === 4, 'Database Travel.seats capacity remains unchanged at 4');
    assert(dbOffer.bookedSeats === 2, 'Database Travel.bookedSeats is 2');

    // ----------------------------------------------------------------
    // 9. Repeated confirmation is rejected without double reservation
    // ----------------------------------------------------------------
    console.log('\n>>> 9. Repeated confirmation is rejected <<<');
    const resRepeat = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resRepeat.status === 400, 'Repeated confirmation on already confirmed booking is rejected (HTTP 400)');
    const dbOfferAfterRepeat = await Travel.findById(offer._id);
    assert(dbOfferAfterRepeat.bookedSeats === 2, 'Booked seats not incremented on repeated call (remains 2)');

    // ----------------------------------------------------------------
    // 10. Insufficient seats prevent confirmation
    // ----------------------------------------------------------------
    console.log('\n>>> 10. Insufficient seats prevent confirmation <<<');
    // Offer currently has 4 total - 2 booked = 2 available. Create accepted booking for 3 seats.
    const excessBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: passenger2Id,
      requestedSeats: 3,
      status: 'accepted'
    });
    const resExcess = await fetch(`${baseUrl}/api/bookings/${excessBooking._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resExcess.status === 400, 'Confirmation rejected when requested seats (3) > available (2)');
    const dbOfferAfterExcess = await Travel.findById(offer._id);
    assert(dbOfferAfterExcess.bookedSeats === 2, 'Booked seats remain 2 after failed reservation');
    const dbExcessBooking = await Booking.findById(excessBooking._id);
    assert(dbExcessBooking.status === 'accepted', 'Booking remains "accepted" when confirmation fails');

    // ----------------------------------------------------------------
    // 11. Concurrent confirmation requests cannot cause overbooking
    // ----------------------------------------------------------------
    console.log('\n>>> 11. Concurrent confirmation race test <<<');
    // Create a new offer with exactly 2 seats total
    const raceOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 2',
      destination: 'City Center',
      travelDate: new Date('2026-11-29'),
      departureTime: 700,
      timeFlexibility: 30,
      seats: 2,
      bookedSeats: 0,
      status: 'active'
    });

    // Create 2 concurrent accepted bookings each requesting 2 seats
    const raceBookingA = await Booking.create({
      travelId: raceOffer._id,
      ownerId,
      passengerId: passengerId,
      requestedSeats: 2,
      status: 'accepted'
    });

    const raceBookingB = await Booking.create({
      travelId: raceOffer._id,
      ownerId,
      passengerId: passenger2Id,
      requestedSeats: 2,
      status: 'accepted'
    });

    // Execute confirmations simultaneously
    const [raceResA, raceResB] = await Promise.all([
      fetch(`${baseUrl}/api/bookings/${raceBookingA._id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOwner}` }
      }),
      fetch(`${baseUrl}/api/bookings/${raceBookingB._id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOwner}` }
      })
    ]);

    const statusA = raceResA.status;
    const statusB = raceResB.status;
    console.log(`Race results: Request A: ${statusA}, Request B: ${statusB}`);

    const onePassedOneFailed =
      (statusA === 200 && statusB === 400) || (statusA === 400 && statusB === 200);
    assert(onePassedOneFailed, 'Exactly one concurrent request succeeded and one was rejected');

    const dbRaceOffer = await Travel.findById(raceOffer._id);
    assert(dbRaceOffer.bookedSeats === 2, `Total bookedSeats is exactly 2 (found: ${dbRaceOffer.bookedSeats})`);
    assert(dbRaceOffer.bookedSeats <= dbRaceOffer.seats, 'Atomic conditional update prevented overbooking');

    console.log(`\n================================================================`);
    console.log(`SUMMARY: ${passedTests} / ${totalTests} assertions passed`);
    console.log(`================================================================\n`);

    if (passedTests !== totalTests) {
      throw new Error(`Some assertions failed: ${passedTests}/${totalTests}`);
    }
  } finally {
    server.close();
    await mongoose.connection.close();
    try {
      const { closeNotificationQueue } = await import('../src/queues/notification.queue.js');
      await closeNotificationQueue();
    } catch {}
    process.exit(0);
  }
}

runPart5Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
