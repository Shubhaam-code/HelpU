import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';
import OutboxEvent from '../src/models/Outbox.js';
import { 
  createBookingRequest, 
  confirmBooking, 
  cancelBooking, 
  getWhatsAppDetails 
} from '../src/controllers/booking.controller.js';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is required.');
  process.exit(1);
}

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.data = null;
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.data = data;
    return res;
  };
  return res;
}

async function runTests() {
  console.log('=== STARTING WHATSAPP CONTACT & BOOKING FLOW VERIFICATION ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const now = Date.now();
  const driverClerkId = `driver_flow_${now}`;
  const passengerClerkId = `passenger_flow_${now}`;

  try {
    // 1. Create Driver and Passenger Students with valid WhatsApp numbers
    await Student.create([
      {
        clerkId: driverClerkId,
        name: 'Aarav Patel',
        email: `aarav_${now}@vitbhopal.ac.in`,
        phone: '+919876543210',
        whatsappNumber: '+919876543210',
        college: 'VIT, Bhopal',
        isVerified: true
      },
      {
        clerkId: passengerClerkId,
        name: 'Diya Sharma',
        email: `diya_${now}@vitbhopal.ac.in`,
        phone: '+919123456789',
        whatsappNumber: '+919123456789',
        college: 'VIT, Bhopal',
        isVerified: true
      }
    ]);
    console.log('✓ Test students created with valid WhatsApp numbers.');

    // -------------------------------------------------------------
    // PART 1: OFFER POST JOURNEY
    // -------------------------------------------------------------
    console.log('\n--- PART 1: OFFER POST BOOKING & WHATSAPP FLOW ---');

    // Create 2-seat Offer
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const offerPost = await Travel.create({
      userId: driverClerkId,
      type: 'offer',
      source: 'VIT Bhopal Boys Hostel',
      destination: 'Bhopal Railway Station',
      travelDate: tomorrow,
      departureTime: 480, // 08:00 AM
      timeFlexibility: 30,
      seats: 2,
      bookedSeats: 0,
      pricePerSeat: 350,
      carModel: 'Omni',
      status: 'active',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000)
    });
    console.log(`✓ Offer post created (seats: 2, booked: 0)`);

    // Step A: Passenger creates booking request (Book Seat)
    const req1 = {
      userId: passengerClerkId,
      body: {
        travelId: offerPost._id.toString(),
        requestedSeats: 1,
        passengerName: 'Diya Sharma',
        passengerPhone: '+919123456789'
      }
    };
    const res1 = mockRes();
    await createBookingRequest(req1, res1);

    if (res1.statusCode !== 201) {
      throw new Error(`Booking creation failed: ${JSON.stringify(res1.data)}`);
    }
    const booking = res1.data.data;
    console.log(`✓ Booking request created with status: "${booking.status}" (ID: ${booking._id})`);

    // Verify seats NOT decremented yet
    const offerCheck1 = await Travel.findById(offerPost._id);
    if (offerCheck1.bookedSeats !== 0) {
      throw new Error(`Expected bookedSeats to be 0 at pending stage, but got: ${offerCheck1.bookedSeats}`);
    }
    console.log(`✓ Seats NOT decremented at Pending stage (bookedSeats: 0, available: 2)`);

    // Verify Outbox notification sent to driver
    const outboxEvent = await OutboxEvent.findOne({
      relatedBookingId: booking._id,
      eventType: 'BOOKING_REQUESTED'
    });
    if (!outboxEvent || outboxEvent.recipientId !== driverClerkId) {
      throw new Error('Outbox event for driver notification was not created properly');
    }
    console.log(`✓ Post owner (driver) notified via outbox: eventType "${outboxEvent.eventType}"`);

    // Step B: WhatsApp coordination IMMEDIATELY AVAILABLE for BOTH participants while Pending
    // Test passenger requesting WhatsApp details
    const resPassWA = mockRes();
    await getWhatsAppDetails({ params: { id: booking._id.toString() }, userId: passengerClerkId }, resPassWA);
    if (resPassWA.statusCode !== 200 || !resPassWA.data?.data?.whatsappUrl) {
      throw new Error(`Passenger could not get WhatsApp details: ${JSON.stringify(resPassWA.data)}`);
    }
    console.log(`✓ Passenger got WhatsApp link while Pending: ${resPassWA.data.data.whatsappUrl}`);

    // Test driver requesting WhatsApp details
    const resDriverWA = mockRes();
    await getWhatsAppDetails({ params: { id: booking._id.toString() }, userId: driverClerkId }, resDriverWA);
    if (resDriverWA.statusCode !== 200 || !resDriverWA.data?.data?.whatsappUrl) {
      throw new Error(`Driver could not get WhatsApp details: ${JSON.stringify(resDriverWA.data)}`);
    }
    console.log(`✓ Driver got WhatsApp link while Pending: ${resDriverWA.data.data.whatsappUrl}`);

    // Step C: Confirm Booking (via in-app Confirm Booking action)
    const resConfirm = mockRes();
    await confirmBooking({ params: { id: booking._id.toString() }, userId: passengerClerkId }, resConfirm);
    if (resConfirm.statusCode !== 200) {
      throw new Error(`Confirm booking failed: ${JSON.stringify(resConfirm.data)}`);
    }
    console.log(`✓ Booking confirmed via in-app action`);

    // Verify seats decremented on Offer post ONLY upon confirmation
    const offerCheck2 = await Travel.findById(offerPost._id);
    if (offerCheck2.bookedSeats !== 1) {
      throw new Error(`Expected bookedSeats to be 1 after confirmation, got: ${offerCheck2.bookedSeats}`);
    }
    console.log(`✓ Offer bookedSeats after confirmation: 1 (Remaining available: 1)`);

    // Step D: Cancel booking releases seat
    const resCancel = mockRes();
    await cancelBooking({ params: { id: booking._id.toString() }, userId: passengerClerkId }, resCancel);
    if (resCancel.statusCode !== 200) {
      throw new Error(`Cancel booking failed: ${JSON.stringify(resCancel.data)}`);
    }
    const offerCheck3 = await Travel.findById(offerPost._id);
    if (offerCheck3.bookedSeats !== 0) {
      throw new Error(`Expected bookedSeats to be restored to 0, got: ${offerCheck3.bookedSeats}`);
    }
    console.log(`✓ Cancellation restored seats successfully (bookedSeats: 0)`);

    // Step E: Second cancellation blocked (cannot restore seats twice)
    const resCancelTwice = mockRes();
    await cancelBooking({ params: { id: booking._id.toString() }, userId: passengerClerkId }, resCancelTwice);
    if (resCancelTwice.statusCode === 200) {
      throw new Error('Repeated cancellation should have been rejected');
    }
    console.log(`✓ Repeated cancellation safely blocked: "${resCancelTwice.data.message}"`);

    // -------------------------------------------------------------
    // PART 2: REQUEST POST JOURNEY (IDENTICAL FLOW)
    // -------------------------------------------------------------
    console.log('\n--- PART 2: REQUEST POST BOOKING & WHATSAPP FLOW ---');

    // Diya creates Request post
    const requestPost = await Travel.create({
      userId: passengerClerkId,
      type: 'request',
      source: 'VIT Bhopal Girls Hostel',
      destination: 'Raja Bhoj Airport',
      travelDate: tomorrow,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      pricePerSeat: 0,
      carModel: 'Ride Request',
      status: 'active',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000)
    });
    console.log(`✓ Request post created`);

    // Aarav (driver) offers to take Diya by booking her request
    const req2 = {
      userId: driverClerkId,
      body: {
        travelId: requestPost._id.toString(),
        requestedSeats: 1,
        passengerName: 'Aarav Patel',
        passengerPhone: '+919876543210'
      }
    };
    const res2 = mockRes();
    await createBookingRequest(req2, res2);

    if (res2.statusCode !== 201) {
      throw new Error(`Booking on request post failed: ${JSON.stringify(res2.data)}`);
    }
    const reqBooking = res2.data.data;
    console.log(`✓ Booking request created on Request post with status: "${reqBooking.status}"`);

    // Verify WhatsApp immediately available for BOTH on Request post
    const resReqWA1 = mockRes();
    await getWhatsAppDetails({ params: { id: reqBooking._id.toString() }, userId: driverClerkId }, resReqWA1);
    if (resReqWA1.statusCode !== 200 || !resReqWA1.data?.data?.whatsappUrl) {
      throw new Error(`Driver could not get WhatsApp on Request: ${JSON.stringify(resReqWA1.data)}`);
    }

    const resReqWA2 = mockRes();
    await getWhatsAppDetails({ params: { id: reqBooking._id.toString() }, userId: passengerClerkId }, resReqWA2);
    if (resReqWA2.statusCode !== 200 || !resReqWA2.data?.data?.whatsappUrl) {
      throw new Error(`Passenger could not get WhatsApp on Request: ${JSON.stringify(resReqWA2.data)}`);
    }
    console.log(`✓ Both participants unlocked WhatsApp coordination immediately on Request post`);

    // In-app confirm on Request post
    const resConfirmReq = mockRes();
    await confirmBooking({ params: { id: reqBooking._id.toString() }, userId: passengerClerkId }, resConfirmReq);
    if (resConfirmReq.statusCode !== 200) {
      throw new Error(`Confirm on request failed: ${JSON.stringify(resConfirmReq.data)}`);
    }
    console.log(`✓ In-app confirm completed on Request post`);

    console.log('\n======================================================');
    console.log('>>> ALL WHATSAPP & BOOKING FLOW TESTS PASSED! <<<');
    console.log('======================================================\n');
  } finally {
    // Cleanup
    await Student.deleteMany({ clerkId: { $in: [driverClerkId, passengerClerkId] } });
    await Travel.deleteMany({ userId: { $in: [driverClerkId, passengerClerkId] } });
    await Booking.deleteMany({ ownerId: { $in: [driverClerkId, passengerClerkId] } });
    await OutboxEvent.deleteMany({ recipientId: { $in: [driverClerkId, passengerClerkId] } });
    await mongoose.disconnect();
    console.log('Cleanup complete and disconnected from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
