import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import { createBookingRequest } from '../src/controllers/booking.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

function mockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  const userA = 'user_rahul_' + Date.now();
  const userB = 'user_amit_' + Date.now();
  const travelDate = '2026-11-25';

  const cleanupIds = { travels: [], bookings: [] };

  try {
    console.log('1. Setting up matching travel posts for Rahul (User A) and Amit (User B)...');

    // Post A by Rahul
    const postA = await Travel.create({
      userId: userA,
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 3,
      bookedSeats: 0,
      pricePerSeat: 300,
      type: 'offer',
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 5)
    });
    cleanupIds.travels.push(postA._id);

    // Post B by Amit (matching route and date)
    const postB = await Travel.create({
      userId: userB,
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 630,
      timeFlexibility: 30,
      seats: 2,
      bookedSeats: 0,
      pricePerSeat: 300,
      type: 'offer',
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 5)
    });
    cleanupIds.travels.push(postB._id);

    console.log(`- Created Post A (${postA._id}) for Rahul (${userA})`);
    console.log(`- Created Post B (${postB._id}) for Amit (${userB})\n`);

    // 2. Amit sends a booking request to Rahul on Post A
    console.log('2. Amit (User B) sends a booking request to Rahul (User A) for Post A...');
    const req1 = {
      userId: userB,
      body: {
        travelId: postA._id.toString(),
        requestedSeats: 1,
        passengerName: 'Amit Kumar',
        passengerPhone: '9876543210'
      }
    };
    const res1 = mockResponse();
    await createBookingRequest(req1, res1);

    if (res1.statusCode !== 201) {
      throw new Error(`Expected 201 from Amit's booking request, got ${res1.statusCode}: ${JSON.stringify(res1.data)}`);
    }
    const booking1Id = res1.data.data._id;
    cleanupIds.bookings.push(booking1Id);
    console.log(`- SUCCESS: Amit successfully sent booking request (Booking ID: ${booking1Id}, Status: pending)\n`);

    // 3. Rahul attempts to send a duplicate request for Post A (direct check)
    console.log('3. Amit attempts to send a duplicate booking request for Post A (should fail)...');
    const reqDuplicate = {
      userId: userB,
      body: {
        travelId: postA._id.toString(),
        requestedSeats: 1,
        passengerName: 'Amit Kumar'
      }
    };
    const resDuplicate = mockResponse();
    await createBookingRequest(reqDuplicate, resDuplicate);
    if (resDuplicate.statusCode !== 409 || resDuplicate.data?.code !== 'DUPLICATE_BOOKING_REQUEST') {
      throw new Error(`Expected 409 DUPLICATE_BOOKING_REQUEST, got ${resDuplicate.statusCode}: ${JSON.stringify(resDuplicate.data)}`);
    }
    console.log(`- SUCCESS: Rejected duplicate request with 409: ${resDuplicate.data.message}\n`);

    // 4. Rahul attempts to send a REVERSE booking request to Amit for Post B (matching pair)
    console.log('4. Rahul (User A) attempts to send a REVERSE booking request to Amit (User B) for Post B...');
    const reqReverse = {
      userId: userA,
      body: {
        travelId: postB._id.toString(),
        requestedSeats: 1,
        passengerName: 'Rahul Verma',
        matchedTravelId: postA._id.toString()
      }
    };
    const resReverse = mockResponse();
    await createBookingRequest(reqReverse, resReverse);

    if (resReverse.statusCode !== 409 || resReverse.data?.code !== 'REVERSE_BOOKING_EXISTS') {
      throw new Error(`Expected 409 REVERSE_BOOKING_EXISTS, got ${resReverse.statusCode}: ${JSON.stringify(resReverse.data)}`);
    }
    console.log(`- SUCCESS: Reverse booking request was blocked with 409 REVERSE_BOOKING_EXISTS!`);
    console.log(`  Message: "${resReverse.data.message}"`);
    console.log(`  Existing Incoming Booking ID: ${resReverse.data.bookingId}\n`);

    // 5. Amit cancels his original booking request
    console.log('5. Amit cancels his booking request on Post A...');
    await Booking.findByIdAndUpdate(booking1Id, { status: 'cancelled' });
    console.log('- Amit cancelled booking request.\n');

    // 6. Rahul now tries again to send booking request to Amit for Post B (should now succeed)
    console.log('6. Rahul attempts to book Post B again after previous request was cancelled...');
    const resAllowed = mockResponse();
    await createBookingRequest(reqReverse, resAllowed);

    if (resAllowed.statusCode !== 201) {
      throw new Error(`Expected 201 after cancellation, got ${resAllowed.statusCode}: ${JSON.stringify(resAllowed.data)}`);
    }
    cleanupIds.bookings.push(resAllowed.data.data._id);
    console.log(`- SUCCESS: Rahul's booking request now succeeded (Booking ID: ${resAllowed.data.data._id})\n`);

    console.log('=================================================================');
    console.log('ALL REVERSE & DUPLICATE BOOKING GUARD TESTS PASSED PERFECTLY!');
    console.log('=================================================================');

  } finally {
    // Cleanup
    if (cleanupIds.bookings.length) {
      await Booking.deleteMany({ _id: { $in: cleanupIds.bookings } });
    }
    if (cleanupIds.travels.length) {
      await Travel.deleteMany({ _id: { $in: cleanupIds.travels } });
    }
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
