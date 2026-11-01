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
    sid: 'sess_test_p4_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const ownerId = 'user_p4_owner_101';
const passengerId = 'user_p4_passenger_202';
const strangerId = 'user_p4_stranger_303';
const noPhoneUserId = 'user_p4_nophone_404';

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenStranger = generateTestToken(strangerId);
const tokenNoPhone = generateTestToken(noPhoneUserId);

async function runPart4Tests() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  await mongoose.connect(mongoUri);

  const allUsers = [ownerId, passengerId, strangerId, noPhoneUserId];
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
      phone: '9123456789', // 10-digit number without country code
      college: 'IIT Delhi'
    },
    {
      clerkId: strangerId,
      name: 'Priya Verma',
      email: 'priya.verma@campus.edu',
      phone: '+919988776655',
      college: 'IIT Delhi'
    },
    {
      clerkId: noPhoneUserId,
      name: 'Rohit Missing',
      email: 'rohit.nophone@campus.edu',
      college: 'IIT Delhi'
    }
  ]);

  const port = 5009;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: Task 11 Part 4 - WhatsApp Coordination API');
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
    const travelDate = '2026-11-25';
    const offer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Hostel 4',
      destination: 'Airport Terminal 3',
      travelDate: new Date(travelDate),
      departureTime: 480,
      timeFlexibility: 60,
      seats: 3,
      status: 'active'
    });

    // 1. Accepted Booking
    const acceptedBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId,
      requestedSeats: 1,
      status: 'accepted'
    });

    // 2. Pending Booking
    const pendingBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: strangerId,
      requestedSeats: 1,
      status: 'pending'
    });

    // 3. Rejected Booking
    const rejectedBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: strangerId,
      requestedSeats: 1,
      status: 'rejected'
    });

    // 4. Accepted Booking with User having no phone number
    const noPhoneBooking = await Booking.create({
      travelId: offer._id,
      ownerId,
      passengerId: noPhoneUserId,
      requestedSeats: 1,
      status: 'accepted'
    });

    // ----------------------------------------------------------------
    // 1. Missing Authentication -> 401
    // ----------------------------------------------------------------
    console.log('>>> 1. Missing Authentication <<<');
    const resNoAuth = await fetch(`${baseUrl}/api/bookings/${acceptedBooking._id}/whatsapp-details`);
    assert(resNoAuth.status === 401, 'Missing token returns HTTP 401');

    // ----------------------------------------------------------------
    // 2. Invalid Booking ID -> 400
    // ----------------------------------------------------------------
    console.log('\n>>> 2. Invalid Booking ID <<<');
    const resInvalidId = await fetch(`${baseUrl}/api/bookings/invalid-object-id/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resInvalidId.status === 400, 'Invalid MongoDB ObjectId returns HTTP 400');

    // ----------------------------------------------------------------
    // 3. Non-existent Booking -> 404
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Non-existent Booking <<<');
    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/bookings/${fakeId}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    assert(resNotFound.status === 404, 'Non-existent booking returns HTTP 404');

    // ----------------------------------------------------------------
    // 4. Unrelated User -> 403
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Unrelated User Access <<<');
    const resUnrelated = await fetch(`${baseUrl}/api/bookings/${acceptedBooking._id}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenStranger}` }
    });
    assert(resUnrelated.status === 403, 'Unrelated user receives HTTP 403 Forbidden');

    // ----------------------------------------------------------------
    // 5. Passenger can access accepted booking details
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Passenger Accesses Accepted Booking <<<');
    const resPassenger = await fetch(`${baseUrl}/api/bookings/${acceptedBooking._id}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    const passengerData = await resPassenger.json();
    assert(resPassenger.status === 200, 'Passenger receives HTTP 200');
    assert(passengerData.data?.name === 'Rohan Sharma', 'Passenger receives owner name');
    assert(passengerData.data?.phone === '+919876543210', 'Passenger receives owner phone');
    assert(passengerData.data?.normalizedPhone === '919876543210', 'Owner phone is properly normalized');
    assert(passengerData.data?.role === 'passenger', 'Role is identified as passenger');
    assert(passengerData.data?.email === undefined, 'Owner private email is NOT exposed');
    assert(passengerData.data?.college === undefined, 'Owner private college is NOT exposed');

    // Check WhatsApp URL format and encoding
    const expectedMsg = "Hi, I found your travel booking request on CampusPool. Let's coordinate our trip.";
    const expectedEncoded = encodeURIComponent(expectedMsg);
    const expectedUrl = `https://wa.me/919876543210?text=${expectedEncoded}`;
    assert(passengerData.data?.whatsappUrl === expectedUrl, `WhatsApp URL matches: ${expectedUrl}`);

    // ----------------------------------------------------------------
    // 6. Owner can access accepted booking details
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Owner Accesses Accepted Booking <<<');
    const resOwner = await fetch(`${baseUrl}/api/bookings/${acceptedBooking._id}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    const ownerData = await resOwner.json();
    assert(resOwner.status === 200, 'Owner receives HTTP 200');
    assert(ownerData.data?.name === 'Aarav Gupta', 'Owner receives passenger name');
    assert(ownerData.data?.phone === '9123456789', 'Owner receives passenger raw phone');
    assert(ownerData.data?.normalizedPhone === '919123456789', '10-digit Indian phone normalized with 91 prefix');
    assert(ownerData.data?.role === 'owner', 'Role is identified as owner');
    assert(ownerData.data?.email === undefined, 'Passenger private email is NOT exposed');

    const expectedPassengerUrl = `https://wa.me/919123456789?text=${expectedEncoded}`;
    assert(ownerData.data?.whatsappUrl === expectedPassengerUrl, `Owner WhatsApp URL matches: ${expectedPassengerUrl}`);

    // ----------------------------------------------------------------
    // 7. Pending Booking Cannot Access Details
    // ----------------------------------------------------------------
    console.log('\n>>> 7. Pending Booking Access <<<');
    const resPending = await fetch(`${baseUrl}/api/bookings/${pendingBooking._id}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resPending.status === 400, 'Pending booking receives HTTP 400');
    const pendingJson = await resPending.json();
    assert(pendingJson.message?.includes('accepted'), 'Error indicates coordination only for accepted bookings');

    // ----------------------------------------------------------------
    // 8. Rejected Booking Cannot Access Details
    // ----------------------------------------------------------------
    console.log('\n>>> 8. Rejected Booking Access <<<');
    const resRejected = await fetch(`${baseUrl}/api/bookings/${rejectedBooking._id}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resRejected.status === 400, 'Rejected booking receives HTTP 400');

    // ----------------------------------------------------------------
    // 9. Missing Phone Number Handled Correctly
    // ----------------------------------------------------------------
    console.log('\n>>> 9. Missing Phone Number <<<');
    const resNoPhone = await fetch(`${baseUrl}/api/bookings/${noPhoneBooking._id}/whatsapp-details`, {
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resNoPhone.status === 400, 'Missing phone number returns HTTP 400');
    const noPhoneJson = await resNoPhone.json();
    assert(
      noPhoneJson.message?.toLowerCase().includes('missing') || noPhoneJson.message?.toLowerCase().includes('unavailable'),
      'Returns clear error message when contact phone is missing'
    );

    // ----------------------------------------------------------------
    // 10. Verify Booking Status & Seats Unaltered
    // ----------------------------------------------------------------
    console.log('\n>>> 10. Booking Status & Seats Unaltered <<<');
    const refreshedBooking = await Booking.findById(acceptedBooking._id);
    assert(refreshedBooking.status === 'accepted', 'Booking status remains "accepted"');
    const refreshedOffer = await Travel.findById(offer._id);
    assert(refreshedOffer.seats === 3, 'Travel seats remain unchanged at 3');

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

runPart4Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
