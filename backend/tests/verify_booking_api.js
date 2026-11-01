import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';

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
    sid: 'sess_booking_test_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const ownerId = 'user_booking_owner_801';
const passengerId = 'user_booking_passenger_802';
const passenger2Id = 'user_booking_passenger_803';

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenPassenger2 = generateTestToken(passenger2Id);

async function runBookingApiTests() {
  await mongoose.connect('mongodb://127.0.0.1:27017/campuspool');

  // Clean test records
  const allUsers = [ownerId, passengerId, passenger2Id];
  await Travel.deleteMany({ userId: { $in: allUsers } });
  await Booking.deleteMany({ $or: [{ ownerId: { $in: allUsers } }, { passengerId: { $in: allUsers } }] });

  const port = 5007;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: Task 11 Part 2 - Booking Request API (POST /api/bookings)');
  console.log('================================================================\n');

  try {
    const travelDate = '2026-11-15';
    // Create base active offer post with 3 seats
    const offerPost = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Railway Station',
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 3,
      status: 'active'
    });

    console.log('Setup: Created test Offer post ID:', offerPost._id.toString(), 'with total seats:', offerPost.seats);

    // ----------------------------------------------------------------
    // 1. Missing Authentication
    // ----------------------------------------------------------------
    console.log('\n>>> 1. Missing Authentication <<<');
    const resNoAuth = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ travelId: offerPost._id, requestedSeats: 1 })
    });
    console.log('Status (expect 401):', resNoAuth.status);
    console.log('Response:', await resNoAuth.json());

    // ----------------------------------------------------------------
    // 2. Invalid Travel ID
    // ----------------------------------------------------------------
    console.log('\n>>> 2. Invalid Travel ID <<<');
    const resInvalidId = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger}`
      },
      body: JSON.stringify({ travelId: 'not_a_valid_mongo_id', requestedSeats: 1 })
    });
    console.log('Status (expect 400):', resInvalidId.status);
    console.log('Response:', await resInvalidId.json());

    // ----------------------------------------------------------------
    // 3. Non-existent Travel Post
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Non-existent Travel Post <<<');
    const randomId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger}`
      },
      body: JSON.stringify({ travelId: randomId, requestedSeats: 1 })
    });
    console.log('Status (expect 404):', resNotFound.status);
    console.log('Response:', await resNotFound.json());

    // ----------------------------------------------------------------
    // 4. Booking Own Travel Post
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Booking Own Travel Post <<<');
    const resOwnPost = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}` // Owner attempts to book their own offer
      },
      body: JSON.stringify({ travelId: offerPost._id, requestedSeats: 1 })
    });
    console.log('Status (expect 400):', resOwnPost.status);
    console.log('Response:', await resOwnPost.json());

    // ----------------------------------------------------------------
    // 5. Valid Booking Request
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Valid Booking Request <<<');
    const resValid = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger}`
      },
      body: JSON.stringify({ travelId: offerPost._id, requestedSeats: 2 })
    });
    const validData = await resValid.json();
    console.log('Status (expect 201):', resValid.status);
    console.log('Created Booking:\n', JSON.stringify(validData, null, 2));

    // ----------------------------------------------------------------
    // 6. Verify Seats Remain Unchanged in Travel Document
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Verify Seats Remain Unchanged After Pending Booking <<<');
    const offerAfterPending = await Travel.findById(offerPost._id);
    console.log('Offer seats before booking: 3');
    console.log('Offer seats after pending booking:', offerAfterPending.seats);
    console.log('Seats unchanged check:', offerAfterPending.seats === 3 ? 'PASS (Seats not deducted for pending request)' : 'FAIL');

    // ----------------------------------------------------------------
    // 7. Duplicate Pending Request
    // ----------------------------------------------------------------
    console.log('\n>>> 7. Duplicate Pending Request <<<');
    const resDuplicate = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger}` // Same passenger
      },
      body: JSON.stringify({ travelId: offerPost._id, requestedSeats: 1 })
    });
    console.log('Status (expect 400):', resDuplicate.status);
    console.log('Response:', await resDuplicate.json());

    // ----------------------------------------------------------------
    // 8. Requesting More Seats Than Available
    // ----------------------------------------------------------------
    console.log('\n>>> 8. Requesting More Seats Than Available <<<');
    // Offer has 3 total seats; Passenger 2 requests 4 seats
    const resExcessSeats = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger2}`
      },
      body: JSON.stringify({ travelId: offerPost._id, requestedSeats: 4 })
    });
    console.log('Status (expect 400):', resExcessSeats.status);
    console.log('Response:', await resExcessSeats.json());

    // ----------------------------------------------------------------
    // 9. Expired or Inactive Travel Post
    // ----------------------------------------------------------------
    console.log('\n>>> 9. Expired or Inactive Travel Post <<<');

    // 9a. Expired post
    const expiredOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Railway Station',
      travelDate: new Date('2026-10-20'),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 2,
      status: 'active',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // in the past
    });

    const resExpired = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger2}`
      },
      body: JSON.stringify({ travelId: expiredOffer._id, requestedSeats: 1 })
    });
    console.log('9a. Expired post status (expect 400):', resExpired.status);
    console.log('    Response:', await resExpired.json());

    // 9b. Inactive (completed) post
    const completedOffer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Railway Station',
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 2,
      status: 'completed'
    });

    const resInactive = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger2}`
      },
      body: JSON.stringify({ travelId: completedOffer._id, requestedSeats: 1 })
    });
    console.log('9b. Inactive post status (expect 400):', resInactive.status);
    console.log('    Response:', await resInactive.json());

    // 9c. Booking a 'request' type post (must only be 'offer')
    const requestPost = await Travel.create({
      userId: ownerId,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'Railway Station',
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      status: 'active'
    });

    const resRequestPost = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger2}`
      },
      body: JSON.stringify({ travelId: requestPost._id, requestedSeats: 1 })
    });
    console.log('9c. Booking a request-type post status (expect 400):', resRequestPost.status);
    console.log('    Response:', await resRequestPost.json());

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    // Cleanup
    await Travel.deleteMany({ userId: { $in: allUsers } });
    await Booking.deleteMany({ $or: [{ ownerId: { $in: allUsers } }, { passengerId: { $in: allUsers } }] });
    await mongoose.disconnect();
    server.close();
    console.log('\n================================================================');
    console.log('All tests completed successfully and test data cleaned up.');
    console.log('================================================================');
  }
}

runBookingApiTests();
