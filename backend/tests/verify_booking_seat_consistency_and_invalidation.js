/**
 * Verification of Booking & Seat Consistency:
 * 1. Student A posts OFFER ride with 4 seats
 * 2. Student B requests and reserves 2 seats
 * 3. Available seats decreases to 2 atomically
 * 4. Insufficient seat requests (> 2) are safely rejected
 * 5. Booking cancellation restores available seats to 4
 * 6. Duplicate cancellations do not corrupt the count
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';
import { 
  createBookingRequest, 
  confirmBooking, 
  cancelBooking 
} from '../src/controllers/booking.controller.js';

function mockReqRes(body = {}, params = {}, userId = '') {
  const req = { 
    body, 
    params, 
    userId,
    user: { id: userId, userId }
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    getStatusCode() {
      return statusCode;
    },
    getData() {
      return responseData;
    }
  };

  return { req, res };
}

async function runAudit() {
  console.log('================================================================');
  console.log('HELPU — BACKEND BOOKING & SEAT CONSISTENCY AUDIT');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✔ Connected to MongoDB.');

  const driverId = 'student_driver_' + Date.now();
  const passengerBId = 'student_passB_' + Date.now();
  const passengerCId = 'student_passC_' + Date.now();

  try {
    // 1. Create Driver Profile and OFFER Travel Post
    await Student.create([
      { clerkId: driverId, userId: driverId, name: 'Driver Student', email: `${driverId}@test.com`, phone: '+919876543210' },
      { clerkId: passengerBId, userId: passengerBId, name: 'Passenger B', email: `${passengerBId}@test.com`, phone: '+919876543211' },
      { clerkId: passengerCId, userId: passengerCId, name: 'Passenger C', email: `${passengerCId}@test.com`, phone: '+919876543212' }
    ]);

    const offerPost = await Travel.create({
      userId: driverId,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: new Date('2026-11-20'),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 4,
      bookedSeats: 0,
      pricePerSeat: 250,
      status: 'active'
    });
    console.log(`✔ Step 1: Created OFFER ride (${offerPost._id}) with 4 initial seats.`);

    // 2. Student B requests 2 seats
    const { req: reqB, res: resB } = mockReqRes(
      { travelId: offerPost._id.toString(), requestedSeats: 2 },
      {},
      passengerBId
    );
    await createBookingRequest(reqB, resB);
    const bookingB = resB.getData()?.data || resB.getData()?.booking;
    if (resB.getStatusCode() !== 201 && resB.getStatusCode() !== 200) {
      throw new Error(`Failed to create booking: ${JSON.stringify(resB.getData())}`);
    }
    console.log(`✔ Step 2: Student B created booking request (${bookingB._id}) for 2 seats.`);

    // Confirm booking to decrement seats atomically
    const { req: confReqB, res: confResB } = mockReqRes({}, { id: bookingB._id.toString() }, driverId);
    await confirmBooking(confReqB, confResB);
    
    // Inspect refreshed Travel document
    const refreshedAfterB = await Travel.findById(offerPost._id);
    const availableAfterB = refreshedAfterB.seats - (refreshedAfterB.bookedSeats || 0);
    console.log(`✔ Step 3: Available seats after Student B confirmation: ${availableAfterB} (expected: 2).`);
    if (availableAfterB !== 2) {
      throw new Error(`Expected 2 seats available, got ${availableAfterB}`);
    }

    // 3. Student C attempts to book 3 seats (only 2 left)
    const { req: reqC, res: resC } = mockReqRes(
      { travelId: offerPost._id.toString(), requestedSeats: 3 },
      {},
      passengerCId
    );
    await createBookingRequest(reqC, resC);
    console.log(`✔ Step 4: Student C request for 3 seats was rejected with status: ${resC.getStatusCode()} (Message: "${resC.getData()?.message}").`);
    if (resC.getStatusCode() !== 400) {
      throw new Error(`Expected 400 for excessive seat request, got ${resC.getStatusCode()}`);
    }

    // 4. Student B cancels booking
    const { req: cancelReq, res: cancelRes } = mockReqRes({}, { id: bookingB._id.toString() }, passengerBId);
    await cancelBooking(cancelReq, cancelRes);
    if (cancelRes.getStatusCode() !== 200) {
      throw new Error(`Failed to cancel booking: ${JSON.stringify(cancelRes.getData())}`);
    }

    const refreshedAfterCancel = await Travel.findById(offerPost._id);
    const availableAfterCancel = refreshedAfterCancel.seats - (refreshedAfterCancel.bookedSeats || 0);
    console.log(`✔ Step 5: Available seats after cancellation: ${availableAfterCancel} (expected: 4).`);
    if (availableAfterCancel !== 4) {
      throw new Error(`Expected 4 seats available after cancellation, got ${availableAfterCancel}`);
    }

    // 5. Attempt duplicate cancellation
    const { req: dupCancelReq, res: dupCancelRes } = mockReqRes({}, { id: bookingB._id.toString() }, passengerBId);
    await cancelBooking(dupCancelReq, dupCancelRes);
    const refreshedAfterDup = await Travel.findById(offerPost._id);
    const availableAfterDup = refreshedAfterDup.seats - (refreshedAfterDup.bookedSeats || 0);
    console.log(`✔ Step 6: Available seats after duplicate cancellation attempt: ${availableAfterDup} (remained: 4).`);
    if (availableAfterDup !== 4) {
      throw new Error(`Duplicate cancellation corrupted seat count! Got ${availableAfterDup}`);
    }

    console.log('\n================================================================');
    console.log('ALL BACKEND BOOKING & SEAT CONSISTENCY SCENARIOS PASSED!');
    console.log('================================================================');
  } finally {
    // Cleanup
    await Student.deleteMany({ userId: { $in: [driverId, passengerBId, passengerCId] } });
    await Travel.deleteMany({ userId: { $in: [driverId, passengerBId, passengerCId] } });
    await Booking.deleteMany({ ownerId: { $in: [driverId, passengerBId, passengerCId] } });
    await Booking.deleteMany({ passengerId: { $in: [driverId, passengerBId, passengerCId] } });
    await mongoose.disconnect();
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
