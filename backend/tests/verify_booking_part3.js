import dotenv from 'dotenv';
dotenv.config();
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';

import { setMockAuth } from '../src/config/firebase.js';

setMockAuth({
  verifyIdToken: async (token) => {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      return {
        uid: payload.sub,
        email: `${payload.sub}@vitbhopal.ac.in`,
        email_verified: true
      };
    } catch {
      throw new Error('Invalid test token');
    }
  }
});

function generateTestToken(userId) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    uid: userId,
    email: `${userId}@vitbhopal.ac.in`,
    email_verified: true
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedHeader}.${encodedPayload}.test_sig`;
}

const ownerId = 'user_p3_owner_101';
const passengerId = 'user_p3_passenger_202';
const passenger2Id = 'user_p3_passenger_303';
const strangerId = 'user_p3_stranger_404';

const tokenOwner = generateTestToken(ownerId);
const tokenPassenger = generateTestToken(passengerId);
const tokenPassenger2 = generateTestToken(passenger2Id);
const tokenStranger = generateTestToken(strangerId);

async function runPart3Tests() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  await mongoose.connect(mongoUri);

  const allUsers = [ownerId, passengerId, passenger2Id, strangerId];
  await Travel.deleteMany({ userId: { $in: allUsers } });
  await Booking.deleteMany({ $or: [{ ownerId: { $in: allUsers } }, { passengerId: { $in: allUsers } }] });
  await Student.deleteMany({ clerkId: { $in: allUsers } });

  // Create Student profiles with private phone numbers
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
    }
  ]);

  const port = 5008;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: Task 11 Part 3 - Owner Accept / Reject APIs');
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
    // Setup Travel Offer
    // ----------------------------------------------------------------
    const travelDate = '2026-11-20';
    const offer = await Travel.create({
      userId: ownerId,
      type: 'offer',
      source: 'Main Campus',
      destination: 'Central Railway Station',
      travelDate: new Date(travelDate),
      departureTime: 540,
      timeFlexibility: 30,
      seats: 4,
      status: 'active'
    });

    console.log(`Setup: Created Offer ${offer._id} with 4 seats by owner ${ownerId}`);

    // Create 2 booking requests
    const bookingRes1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger}`
      },
      body: JSON.stringify({ travelId: offer._id, requestedSeats: 1 })
    });
    const booking1 = (await bookingRes1.json()).data;

    const bookingRes2 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger2}`
      },
      body: JSON.stringify({ travelId: offer._id, requestedSeats: 2 })
    });
    const booking2 = (await bookingRes2.json()).data;

    console.log(`Setup: Created Booking 1 (${booking1._id}) and Booking 2 (${booking2._id})\n`);

    // ----------------------------------------------------------------
    // 1. GET /api/bookings/received (Owner sees received requests)
    // ----------------------------------------------------------------
    console.log('>>> 1. GET /api/bookings/received <<<');
    const resReceived = await fetch(`${baseUrl}/api/bookings/received`, {
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    const receivedData = await resReceived.json();
    assert(resReceived.status === 200, 'Owner can access /api/bookings/received (HTTP 200)');
    assert(receivedData.count === 2, `Owner sees 2 booking requests (found: ${receivedData.count})`);
    assert(receivedData.data[0].travelId?.source === 'Main Campus', 'Travel details populated on received booking');
    assert(
      receivedData.data.every((b) => b.passenger && b.passenger.phone === undefined),
      'Passenger details populated WITHOUT exposing private phone numbers'
    );
    assert(
      new Date(receivedData.data[0].createdAt) >= new Date(receivedData.data[1].createdAt),
      'Received bookings are sorted newest first'
    );

    // ----------------------------------------------------------------
    // 2. GET /api/bookings/my (Passenger sees their own requests)
    // ----------------------------------------------------------------
    console.log('\n>>> 2. GET /api/bookings/my <<<');
    const resMy = await fetch(`${baseUrl}/api/bookings/my`, {
      headers: { Authorization: `Bearer ${tokenPassenger}` }
    });
    const myData = await resMy.json();
    assert(resMy.status === 200, 'Passenger can access /api/bookings/my (HTTP 200)');
    assert(myData.count === 1, `Passenger 1 sees only their own request (found: ${myData.count})`);
    assert(myData.data[0]._id === booking1._id, 'Booking matches Passenger 1 ID');
    assert(myData.data[0].travelId?.destination === 'Central Railway Station', 'Travel details included in /api/bookings/my');
    assert(
      myData.data.every((b) => b.owner && b.owner.phone === undefined),
      'Owner details included WITHOUT exposing private phone numbers'
    );

    // ----------------------------------------------------------------
    // 3. Invalid booking ID & Invalid Action on PATCH /:id/respond
    // ----------------------------------------------------------------
    console.log('\n>>> 3. Validation on PATCH /:id/respond <<<');
    const resInvalidId = await fetch(`${baseUrl}/api/bookings/not-valid-id/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert(resInvalidId.status === 400, 'Invalid MongoDB ObjectId returns 400');

    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/bookings/${fakeId}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert(resNotFound.status === 404, 'Non-existent booking ID returns 404');

    const resInvalidAction = await fetch(`${baseUrl}/api/bookings/${booking1._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'confirm' })
    });
    assert(resInvalidAction.status === 400, 'Invalid action "confirm" is rejected with 400');

    // ----------------------------------------------------------------
    // 4. Unauthorized responding: Non-owner and Passenger
    // ----------------------------------------------------------------
    console.log('\n>>> 4. Authorization checks on respond <<<');
    const resStranger = await fetch(`${baseUrl}/api/bookings/${booking1._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStranger}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert(resStranger.status === 403, 'Stranger (non-owner) cannot respond (HTTP 403)');

    const resPassengerRespond = await fetch(`${baseUrl}/api/bookings/${booking1._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenPassenger}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert(resPassengerRespond.status === 403, 'Passenger cannot respond to their own booking request as owner (HTTP 403)');

    // ----------------------------------------------------------------
    // 5. Correct owner accepts booking
    // ----------------------------------------------------------------
    console.log('\n>>> 5. Owner accepts booking <<<');
    const resAccept = await fetch(`${baseUrl}/api/bookings/${booking1._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    const acceptData = await resAccept.json();
    assert(resAccept.status === 200, 'Owner can accept booking (HTTP 200)');
    assert(acceptData.data?.status === 'accepted', 'Booking status updated to "accepted"');

    // Verify Travel seats remain unchanged after acceptance
    const postOffer = await Travel.findById(offer._id);
    assert(postOffer.seats === 4, `Travel offer seats remain unchanged (expected 4, found ${postOffer.seats})`);

    // Verify booking is not marked as confirmed yet
    assert(acceptData.data?.status !== 'confirmed', 'Booking is NOT marked as confirmed');

    // ----------------------------------------------------------------
    // 6. Duplicate response to non-pending booking is rejected
    // ----------------------------------------------------------------
    console.log('\n>>> 6. Duplicate response to non-pending booking <<<');
    const resDuplicateAccept = await fetch(`${baseUrl}/api/bookings/${booking1._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert(resDuplicateAccept.status === 400, 'Responding to already accepted booking returns 400');

    const resDuplicateReject = await fetch(`${baseUrl}/api/bookings/${booking1._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'reject' })
    });
    assert(resDuplicateReject.status === 400, 'Rejecting an already accepted booking returns 400');

    // ----------------------------------------------------------------
    // 7. Correct owner rejects booking
    // ----------------------------------------------------------------
    console.log('\n>>> 7. Owner rejects booking <<<');
    const resReject = await fetch(`${baseUrl}/api/bookings/${booking2._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'reject' })
    });
    const rejectData = await resReject.json();
    assert(resReject.status === 200, 'Owner can reject booking (HTTP 200)');
    assert(rejectData.data?.status === 'rejected', 'Booking status updated to "rejected"');

    // Duplicate response to rejected booking is rejected
    const resDuplicateOnRejected = await fetch(`${baseUrl}/api/bookings/${booking2._id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    assert(resDuplicateOnRejected.status === 400, 'Responding to already rejected booking returns 400');

    // ----------------------------------------------------------------
    // 8. Verify GET /received and GET /my with updated statuses
    // ----------------------------------------------------------------
    console.log('\n>>> 8. Verify status reflections on GET endpoints <<<');
    const resReceivedUpdated = await fetch(`${baseUrl}/api/bookings/received`, {
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    const updatedReceived = (await resReceivedUpdated.json()).data;
    const statuses = updatedReceived.map((b) => b.status);
    assert(statuses.includes('accepted') && statuses.includes('rejected'), 'Owner received list reflects accepted and rejected statuses');

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

runPart3Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
