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
    sid: 'sess_test_p6_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const ownerId = 'user_p6_owner_101';
const passengerId = 'user_p6_passenger_202';
const passenger2Id = 'user_p6_passenger_303';
const strangerId = 'user_p6_stranger_404';

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenPassenger2 = generateTestToken(passenger2Id);
const tokenStranger = generateTestToken(strangerId);

async function runPart6Tests() {
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
      clerkId: strangerId,
      name: 'Kavita Singh',
      email: 'kavita.singh@campus.edu',
      phone: '+919776655443',
      college: 'IIT Delhi'
    }
  ]);

  const port = 5011;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: Task 11 Part 6 - Booking Cancellation & Seat Release');
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
    const travelDate = '2026-11-30';
    const offer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Campus Gate 2',
      destination: 'Metro Station',
      travelDate: new Date(travelDate),
      departureTime: 660,
      timeFlexibility: 30,
      seats: 5,
      bookedSeats: 3, // 2 from booking 1, 1 from booking 2
      status: 'active'
    });

    // 1. Confirmed Booking 1 (2 seats)
    const confirmedBooking1 = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId,
      requestedSeats: 2,
      status: 'confirmed'
    });

    // 2. Confirmed Booking 2 (1 seat)
    const confirmedBooking2 = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: passenger2Id,
      requestedSeats: 1,
      status: 'confirmed'
    });

    // 3. Pending Booking
    const pendingBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: strangerId,
      requestedSeats: 1,
      status: 'pending'
    });

    // 4. Accepted Booking
    const acceptedBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: strangerId,
      requestedSeats: 1,
      status: 'accepted'
    });

    // 5. Rejected Booking
    const rejectedBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: strangerId,
      requestedSeats: 1,
      status: 'rejected'
    });

    // ----------------------------------------------------------------
    // 1. Missing Authentication -> 401
    // ----------------------------------------------------------------
    console.log('>>> 1. Missing Authentication <<<');
    const resNoAuth = await fetch(`${baseUrl}/api/bookings/${confirmedBooking1._id}/cancel`, {
      method: 'PATCH'
    });
    assert(resNoAuth.status === 401, 'Missing token returns HTTP 401');

    // ----------------------------------------------------------------
    // 2. Invalid Booking ID -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 2. Invalid Booking ID <<<');
    const resInvalidId = await fetch(`${baseUrl}/api/bookings/invalid-booking-id/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resInvalidId.status === 400, 'Invalid MongoDB ObjectId returns HTTP 400');

    // ----------------------------------------------------------------
    // 3. Missing Booking -> 404
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Non-existent Booking <<<');
    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/bookings/${fakeId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resNotFound.status === 404, 'Non-existent booking returns HTTP 404');

    // ----------------------------------------------------------------
    // 4. Unrelated User -> 403
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Unrelated User Access <<<');
    const resStranger = await fetch(`${baseUrl}/api/bookings/${confirmedBooking1._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenStranger}` }
    });
    assert(resStranger.status === 403, 'Unrelated user receives HTTP 403 Forbidden');

    // ----------------------------------------------------------------
    // 5. Non-confirmed bookings cannot be cancelled -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Non-confirmed bookings rejection <<<');
    const resCancelPending = await fetch(`${baseUrl}/api/bookings/${pendingBooking._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resCancelPending.status === 400, 'Pending booking cannot be cancelled (HTTP 400)');

    const resCancelAccepted = await fetch(`${baseUrl}/api/bookings/${acceptedBooking._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resCancelAccepted.status === 400, 'Accepted booking cannot be cancelled (HTTP 400)');

    const resCancelRejected = await fetch(`${baseUrl}/api/bookings/${rejectedBooking._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resCancelRejected.status === 400, 'Rejected booking cannot be cancelled (HTTP 400)');

    // ----------------------------------------------------------------
    // 6. Passenger cancels confirmed booking (multiple-seat release: 2 seats)
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Passenger cancels confirmed booking (2 seats) <<<');
    const resPassengerCancel = await fetch(`${baseUrl}/api/bookings/${confirmedBooking1._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    const cancelData1 = await resPassengerCancel.json();
    assert(resPassengerCancel.status === 200, 'Passenger successfully cancels confirmed booking (HTTP 200)');
    assert(cancelData1.data?.booking?.status === 'cancelled', 'Booking status transitioned to "cancelled"');
    assert(cancelData1.data?.cancelledBy === 'passenger', 'Identifies passenger as canceller');
    assert(cancelData1.data?.travel?.bookedSeats === 1, 'Booked seats correctly decremented from 3 to 1 (2 released)');
    assert(cancelData1.data?.travel?.availableSeats === 4, 'Available seats correctly calculated as 4 (5 - 1)');
    assert(cancelData1.data?.travel?.totalSeats === 5, 'Total seat capacity remains 5');
    assert(cancelData1.data?.phone === undefined, 'No phone numbers exposed in cancellation response');

    // Verify in database
    const dbOfferAfterCancel1 = await Travel.findById(offer._id);
    assert(dbOfferAfterCancel1.seats === 5, 'Travel total capacity unchanged at 5');
    assert(dbOfferAfterCancel1.bookedSeats === 1, 'Database bookedSeats is 1');

    // ----------------------------------------------------------------
    // 7. Owner cancels confirmed booking (1 seat)
    // ----------------------------------------------------------------
    console.log('\n>>> 7. Owner cancels confirmed booking (1 seat) <<<');
    const resOwnerCancel = await fetch(`${baseUrl}/api/bookings/${confirmedBooking2._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    const cancelData2 = await resOwnerCancel.json();
    assert(resOwnerCancel.status === 200, 'Owner successfully cancels confirmed booking (HTTP 200)');
    assert(cancelData2.data?.booking?.status === 'cancelled', 'Booking status transitioned to "cancelled"');
    assert(cancelData2.data?.cancelledBy === 'owner', 'Identifies owner as canceller');
    assert(cancelData2.data?.travel?.bookedSeats === 0, 'Booked seats decremented to 0');
    assert(cancelData2.data?.travel?.availableSeats === 5, 'Available seats restored to full capacity of 5');

    const dbOfferAfterCancel2 = await Travel.findById(offer._id);
    assert(dbOfferAfterCancel2.bookedSeats === 0, 'Database bookedSeats is exactly 0');

    // ----------------------------------------------------------------
    // 8. Repeated cancellation rejected & No double seat release
    // ----------------------------------------------------------------
    console.log('\n>>> 8. Repeated cancellation rejected <<<');
    const resRepeatPassenger = await fetch(`${baseUrl}/api/bookings/${confirmedBooking1._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resRepeatPassenger.status === 400, 'Repeated cancellation is rejected with HTTP 400');

    const resRepeatOwner = await fetch(`${baseUrl}/api/bookings/${confirmedBooking2._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resRepeatOwner.status === 400, 'Repeated cancellation by owner is rejected with HTTP 400');

    const dbOfferAfterRepeat = await Travel.findById(offer._id);
    assert(dbOfferAfterRepeat.bookedSeats === 0, 'Booked seats remain 0 (not negative, no double release)');

    // ----------------------------------------------------------------
    // 9. Concurrent cancellation race test
    // ----------------------------------------------------------------
    console.log('\n>>> 9. Concurrent cancellation race test <<<');
    const raceOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 3',
      destination: 'Airport',
      travelDate: new Date('2026-12-01'),
      departureTime: 720,
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 2,
      status: 'active'
    });

    const raceBooking = await Booking.create({
      travelId: raceOffer._id,
      ownerId,
      passengerId,
      requestedSeats: 2,
      status: 'confirmed'
    });

    // Send simultaneous cancellation requests for the same booking
    const [raceResA, raceResB] = await Promise.all([
      fetch(`${baseUrl}/api/bookings/${raceBooking._id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenPassenger}` }
      }),
      fetch(`${baseUrl}/api/bookings/${raceBooking._id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenOwner}` }
      })
    ]);

    const statusA = raceResA.status;
    const statusB = raceResB.status;
    console.log(`Race results: Request A: ${statusA}, Request B: ${statusB}`);

    const onePassedOneFailed =
      (statusA === 200 && statusB === 400) || (statusA === 400 && statusB === 200);
    assert(onePassedOneFailed, 'Exactly one concurrent cancellation succeeded and one was rejected');

    const dbRaceOffer = await Travel.findById(raceOffer._id);
    assert(dbRaceOffer.bookedSeats === 0, `Seats released exactly once (bookedSeats: ${dbRaceOffer.bookedSeats})`);

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

runPart6Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
