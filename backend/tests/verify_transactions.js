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
    sid: 'sess_tx_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const ownerId = 'user_tx_owner_101';
const passengerId = 'user_tx_passenger_202';
const passenger2Id = 'user_tx_passenger_303';
const strangerId = 'user_tx_stranger_404';

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenStranger = generateTestToken(strangerId);

async function runTransactionTests() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  await mongoose.connect(mongoUri);

  const allUsers = [ownerId, passengerId, passenger2Id, strangerId];
  await Travel.deleteMany({ userId: { $in: allUsers } });
  await Booking.deleteMany({ $or: [{ ownerId: { $in: allUsers } }, { passengerId: { $in: allUsers } }] });
  await Student.deleteMany({ clerkId: { $in: allUsers } });

  // Create Student profiles
  await Student.create([
    {
      clerkId: ownerId,
      name: 'Rohan Sharma',
      email: 'rohan.tx@campus.edu',
      phone: '+919876543210',
      college: 'IIT Delhi'
    },
    {
      clerkId: passengerId,
      name: 'Aarav Gupta',
      email: 'aarav.tx@campus.edu',
      phone: '+919123456789',
      college: 'IIT Delhi'
    },
    {
      clerkId: passenger2Id,
      name: 'Priya Verma',
      email: 'priya.tx@campus.edu',
      phone: '+919988776655',
      college: 'IIT Delhi'
    }
  ]);

  const port = 5012;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: Multi-Document Transactions (Confirm & Cancel)');
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
    // Setup Base Offer
    // ----------------------------------------------------------------
    const travelDate = '2026-12-10';
    const offer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 5',
      destination: 'Railway Station',
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 0,
      status: 'active'
    });

    const acceptedBooking1 = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId,
      requestedSeats: 2,
      status: 'accepted'
    });

    // ----------------------------------------------------------------
    // 1. Transactional Confirmation Success
    // ----------------------------------------------------------------
    console.log('>>> 1. Transactional Confirmation Success <<<');
    const resConfirm = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    const confirmData = await resConfirm.json();
    assert(resConfirm.status === 200, 'Confirmation returns HTTP 200');
    assert(confirmData.data?.booking?.status === 'confirmed', 'Booking status atomically committed as "confirmed"');
    assert(confirmData.data?.travel?.bookedSeats === 2, 'Travel bookedSeats atomically incremented to 2');
    assert(confirmData.data?.travel?.availableSeats === 2, 'Available seats correctly calculated as 2');

    const dbOfferAfterConfirm = await Travel.findById(offer._id);
    assert(dbOfferAfterConfirm.bookedSeats === 2, 'Database Travel.bookedSeats committed to 2');

    // ----------------------------------------------------------------
    // 2. Transaction Rollback on Failure (Insufficient Seats)
    // ----------------------------------------------------------------
    console.log('\n>>> 2. Transaction Rollback on Insufficient Seats <<<');
    // Available seats = 2. Create accepted booking for 3 seats.
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
    assert(resExcess.status === 400, 'Confirmation rejected when requested seats exceed available');

    // Verify rollback: bookedSeats remains 2, excessBooking status remains 'accepted'
    const dbOfferAfterRollback = await Travel.findById(offer._id);
    assert(dbOfferAfterRollback.bookedSeats === 2, 'Travel bookedSeats remains exactly 2 (rollback verified)');
    const dbBookingAfterRollback = await Booking.findById(excessBooking._id);
    assert(dbBookingAfterRollback.status === 'accepted', 'Booking status remains "accepted" (rollback verified)');

    // ----------------------------------------------------------------
    // 3. Duplicate Confirmation Rejection Under Transactions
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Duplicate Confirmation Rejection <<<');
    const resDuplicateConfirm = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resDuplicateConfirm.status === 400, 'Duplicate confirmation rejected with HTTP 400');
    const dbOfferAfterDup = await Travel.findById(offer._id);
    assert(dbOfferAfterDup.bookedSeats === 2, 'Booked seats not incremented on duplicate call (remains 2)');

    // ----------------------------------------------------------------
    // 4. Transactional Cancellation Success (Seats Released Atomically)
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Transactional Cancellation Success <<<');
    const resCancel = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    const cancelData = await resCancel.json();
    assert(resCancel.status === 200, 'Cancellation returns HTTP 200');
    assert(cancelData.data?.booking?.status === 'cancelled', 'Booking status atomically committed as "cancelled"');
    assert(cancelData.data?.travel?.bookedSeats === 0, 'Travel bookedSeats atomically decremented to 0');
    assert(cancelData.data?.travel?.availableSeats === 4, 'Available seats restored to 4');

    const dbOfferAfterCancel = await Travel.findById(offer._id);
    assert(dbOfferAfterCancel.bookedSeats === 0, 'Database Travel.bookedSeats committed to 0');

    // ----------------------------------------------------------------
    // 5. Duplicate Cancellation Rejection Under Transactions
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Duplicate Cancellation Rejection <<<');
    const resDuplicateCancel = await fetch(`${baseUrl}/api/bookings/${acceptedBooking1._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resDuplicateCancel.status === 400, 'Duplicate cancellation rejected with HTTP 400');
    const dbOfferAfterDupCancel = await Travel.findById(offer._id);
    assert(dbOfferAfterDupCancel.bookedSeats === 0, 'Booked seats remains 0 (no double release)');

    // ----------------------------------------------------------------
    // 6. Direct Transaction Abort / Rollback Verification
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Direct Transaction Abort Atomicity Test <<<');
    // Test that when a multi-document transaction aborts, all modified collections revert simultaneously
    const directSession = await mongoose.startSession();
    directSession.startTransaction();

    await Travel.updateOne(
      { _id: offer._id },
      { $inc: { bookedSeats: 3 } },
      { session: directSession }
    );
    await Booking.updateOne(
      { _id: excessBooking._id },
      { $set: { status: 'confirmed' } },
      { session: directSession }
    );

    // Abort the transaction
    await directSession.abortTransaction();
    await directSession.endSession();

    const directOffer = await Travel.findById(offer._id);
    const directBooking = await Booking.findById(excessBooking._id);
    assert(directOffer.bookedSeats === 0, 'Travel bookedSeats reverted to 0 after abortTransaction');
    assert(directBooking.status === 'accepted', 'Booking status reverted to "accepted" after abortTransaction');

    // ----------------------------------------------------------------
    // 7. Concurrent Confirmation Race Test with Transactions
    // ----------------------------------------------------------------
    console.log('\n>>> 7. Concurrent Confirmation Race Test with Transactions <<<');
    const raceOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Gate 3',
      destination: 'Airport',
      travelDate: new Date('2026-12-15'),
      departureTime: 700,
      timeFlexibility: 30,
      seats: 2,
      bookedSeats: 0,
      status: 'active'
    });

    const raceBookingA = await Booking.create({
      travelId: raceOffer._id,
      ownerId,
      passengerId,
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

    // Execute concurrent confirmations
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
    console.log(`Concurrent Race: Request A returned ${statusA}, Request B returned ${statusB}`);

    const onePassedOneFailed =
      (statusA === 200 && statusB === 400) || (statusA === 400 && statusB === 200);
    assert(onePassedOneFailed, 'Exactly one concurrent transaction committed and the other was aborted');

    const dbRaceOffer = await Travel.findById(raceOffer._id);
    assert(dbRaceOffer.bookedSeats === 2, `Total bookedSeats is exactly 2 (found: ${dbRaceOffer.bookedSeats})`);
    assert(dbRaceOffer.bookedSeats <= dbRaceOffer.seats, 'Transactions safely prevented overbooking under concurrency');

    console.log(`\n================================================================`);
    console.log(`SUMMARY: ${passedTests} / ${totalTests} assertions passed`);
    console.log(`================================================================\n`);

    if (passedTests !== totalTests) {
      throw new Error(`Some assertions failed: ${passedTests}/${totalTests}`);
    }
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runTransactionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
