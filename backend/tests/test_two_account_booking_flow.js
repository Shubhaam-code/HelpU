import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';
import Notification from '../src/models/Notification.js';
import OutboxEvent from '../src/models/Outbox.js';
import { 
  createBookingRequest, 
  confirmBooking, 
  cancelBooking, 
  getBookingById,
  getWhatsAppDetails 
} from '../src/controllers/booking.controller.js';
import { getMyNotifications } from '../src/controllers/notification.controller.js';

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

async function runTwoAccountTest() {
  console.log('=== RUNNING TWO-ACCOUNT BOOKING FLOW TEST ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const now = Date.now();
  const studentAClerkId = `student_a_${now}`;
  const studentBClerkId = `student_b_${now}`;

  try {
    // 1. Create Student A (Host) and Student B (Requester)
    const [studentA, studentB] = await Student.create([
      {
        clerkId: studentAClerkId,
        name: 'Aarav Patel (Student A)',
        email: `aarav_${now}@vitbhopal.ac.in`,
        phone: '+919876543210',
        whatsappNumber: '+919876543210',
        college: 'VIT, Bhopal',
        isVerified: true
      },
      {
        clerkId: studentBClerkId,
        name: 'Diya Sharma (Student B)',
        email: `diya_${now}@vitbhopal.ac.in`,
        phone: '+919123456789',
        whatsappNumber: '+919123456789',
        college: 'VIT, Bhopal',
        isVerified: true
      }
    ]);
    console.log(`✓ Student A: "${studentA.name}" (${studentA.clerkId})`);
    console.log(`✓ Student B: "${studentB.name}" (${studentB.clerkId})`);

    // 2. Student A publishes an Offer post (2 available seats)
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const offerPost = await Travel.create({
      userId: studentAClerkId,
      type: 'offer',
      source: 'VIT Bhopal Boys Hostel',
      destination: 'Bhopal Railway Station',
      travelDate: tomorrow,
      departureTime: 480, // 08:00 AM
      timeFlexibility: 30,
      seats: 2,
      bookedSeats: 0,
      pricePerSeat: 350,
      carModel: 'Creta',
      status: 'active',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000)
    });
    console.log(`✓ Student A published Offer post: seats=2, bookedSeats=0`);

    // 3. Student B sends a booking request for 1 seat
    console.log('\n--- STEP 1: STUDENT B BOOKS A SEAT ---');
    const bookReq = {
      userId: studentBClerkId,
      body: {
        travelId: offerPost._id.toString(),
        requestedSeats: 1,
        passengerName: 'Diya Sharma (Student B)',
        passengerPhone: '+919123456789',
        notes: 'Carrying 1 backpack'
      }
    };
    const bookRes = mockRes();
    await createBookingRequest(bookReq, bookRes);

    if (bookRes.statusCode !== 201) {
      throw new Error(`Booking request creation failed: ${JSON.stringify(bookRes.data)}`);
    }
    const createdBooking = bookRes.data.data;
    console.log(`✓ Booking request created by Student B: ID=${createdBooking._id}, status="${createdBooking.status}"`);

    // Verify seats NOT decremented yet
    const offerAfterRequest = await Travel.findById(offerPost._id);
    if (offerAfterRequest.bookedSeats !== 0) {
      throw new Error(`Expected bookedSeats to be 0 at pending stage, got ${offerAfterRequest.bookedSeats}`);
    }
    console.log(`✓ Offer seats NOT decremented yet (bookedSeats: 0 / total: 2)`);

    // 4. Verify Student A receives a notification with relatedBookingId
    console.log('\n--- STEP 2: NOTIFICATION ROUTING FOR STUDENT A ---');
    const outboxEvt = await OutboxEvent.findOne({
      relatedBookingId: createdBooking._id,
      recipientId: studentAClerkId
    });
    if (!outboxEvt) {
      throw new Error('Outbox event for Student A was not created');
    }
    console.log(`✓ Outbox event created for Student A: ${outboxEvt.eventType}`);
    console.log(`✓ Outbox relatedBookingId matches booking ID: ${outboxEvt.relatedBookingId}`);

    // Create corresponding notification document (mimicking outbox processor)
    await Notification.create({
      recipientId: studentAClerkId,
      eventId: outboxEvt.eventId,
      type: outboxEvt.eventType,
      title: 'New Booking Request',
      message: 'Diya Sharma (Student B) requested 1 seat(s) for your ride',
      relatedBookingId: createdBooking._id,
      relatedTravelId: offerPost._id,
      isRead: false
    });

    const notifRes = mockRes();
    await getMyNotifications({ userId: studentAClerkId, query: {} }, notifRes);
    const notifications = notifRes.data.data;
    const targetNotif = notifications.find(n => n.relatedBookingId?.toString() === createdBooking._id.toString());
    if (!targetNotif) {
      throw new Error('Notification not found in Student A inbox');
    }
    console.log(`✓ Student A received notification linking to booking: ${targetNotif.relatedBookingId}`);

    // 5. Student A opens the Booking Details page (GET /api/bookings/:id)
    console.log('\n--- STEP 3: STUDENT A OPENS BOOKING DETAILS ---');
    const detailsResA = mockRes();
    await getBookingById({ params: { id: createdBooking._id.toString() }, userId: studentAClerkId }, detailsResA);
    if (detailsResA.statusCode !== 200) {
      throw new Error(`Student A could not load booking: ${JSON.stringify(detailsResA.data)}`);
    }

    const bookingDataForA = detailsResA.data.data;
    console.log(`✓ Booking data loaded successfully for Student A`);
    console.log(`  - Owner ID: ${bookingDataForA.ownerId} (Student A)`);
    console.log(`  - Passenger ID: ${bookingDataForA.passengerId} (Student B)`);
    console.log(`  - Passenger Student: "${bookingDataForA.passengerStudent?.name}"`);
    console.log(`  - Owner Student: "${bookingDataForA.ownerStudent?.name}"`);

    // Verify Student A sees Student B's details as the requester (not Student A's own profile)
    if (bookingDataForA.passengerStudent?.clerkId !== studentBClerkId) {
      throw new Error('passengerStudent does not point to Student B!');
    }
    if (bookingDataForA.passengerName !== 'Diya Sharma (Student B)') {
      throw new Error('passengerName is incorrect!');
    }
    console.log(`✓ Verified: Student A correctly sees Student B ("${bookingDataForA.passengerStudent.name}") as the requester!`);

    // 6. Student A coordinates on WhatsApp (checks WhatsApp URL)
    const waResA = mockRes();
    await getWhatsAppDetails({ params: { id: createdBooking._id.toString() }, userId: studentAClerkId }, waResA);
    if (waResA.statusCode !== 200 || !waResA.data?.data?.whatsappUrl) {
      throw new Error('Student A could not get WhatsApp URL');
    }
    console.log(`✓ Student A can coordinate with Student B on WhatsApp: ${waResA.data.data.whatsappUrl}`);

    // 7. Student A confirms the booking
    console.log('\n--- STEP 4: STUDENT A CONFIRMS THE BOOKING ---');
    const confirmResA = mockRes();
    await confirmBooking({ params: { id: createdBooking._id.toString() }, userId: studentAClerkId }, confirmResA);
    if (confirmResA.statusCode !== 200) {
      throw new Error(`Student A confirmation failed: ${JSON.stringify(confirmResA.data)}`);
    }
    console.log(`✓ Student A confirmed the booking successfully`);

    // Verify Offer post seats decremented exactly once
    const offerAfterConfirm = await Travel.findById(offerPost._id);
    if (offerAfterConfirm.bookedSeats !== 1) {
      throw new Error(`Expected bookedSeats to be 1, got ${offerAfterConfirm.bookedSeats}`);
    }
    console.log(`✓ Offer bookedSeats updated: ${offerAfterConfirm.bookedSeats} / ${offerAfterConfirm.seats} (1 seat remaining)`);

    // 8. Student B fetches the booking details: status is confirmed
    console.log('\n--- STEP 5: STUDENT B CHECKS CONFIRMED STATUS ---');
    const detailsResB = mockRes();
    await getBookingById({ params: { id: createdBooking._id.toString() }, userId: studentBClerkId }, detailsResB);
    if (detailsResB.statusCode !== 200) {
      throw new Error(`Student B could not load booking: ${JSON.stringify(detailsResB.data)}`);
    }
    const bookingDataForB = detailsResB.data.data;
    if (bookingDataForB.status !== 'confirmed') {
      throw new Error(`Expected status to be confirmed, got: ${bookingDataForB.status}`);
    }
    console.log(`✓ Student B sees updated status: "${bookingDataForB.status}"`);
    console.log(`✓ Student B sees Host: "${bookingDataForB.ownerStudent.name}"`);

    // 9. Repeated confirmation prevented (idempotent, no double decrement)
    const reConfirmRes = mockRes();
    await confirmBooking({ params: { id: createdBooking._id.toString() }, userId: studentAClerkId }, reConfirmRes);
    const offerAfterReconfirm = await Travel.findById(offerPost._id);
    if (offerAfterReconfirm.bookedSeats !== 1) {
      throw new Error(`Booked seats changed on reconfirm: ${offerAfterReconfirm.bookedSeats}`);
    }
    console.log(`✓ Repeated confirm safely handled without double decrement (bookedSeats: 1)`);

    // 10. Student B cancels booking -> restores seat exactly once
    console.log('\n--- STEP 6: CANCELLATION & SEAT RESTORATION ---');
    const cancelRes = mockRes();
    await cancelBooking({ params: { id: createdBooking._id.toString() }, userId: studentBClerkId }, cancelRes);
    if (cancelRes.statusCode !== 200) {
      throw new Error(`Cancel failed: ${JSON.stringify(cancelRes.data)}`);
    }
    const offerAfterCancel = await Travel.findById(offerPost._id);
    if (offerAfterCancel.bookedSeats !== 0) {
      throw new Error(`Seats not restored: bookedSeats is ${offerAfterCancel.bookedSeats}`);
    }
    console.log(`✓ Booking cancelled and seats restored to 0 successfully`);

    console.log('\n======================================================');
    console.log('>>> TWO-ACCOUNT END-TO-END FLOW VERIFICATION PASSED! <<<');
    console.log('======================================================\n');
  } finally {
    // Cleanup test data
    await Student.deleteMany({ clerkId: { $in: [studentAClerkId, studentBClerkId] } });
    await Travel.deleteMany({ userId: { $in: [studentAClerkId, studentBClerkId] } });
    await Booking.deleteMany({ $or: [{ ownerId: studentAClerkId }, { passengerId: studentBClerkId }] });
    await Notification.deleteMany({ recipientId: { $in: [studentAClerkId, studentBClerkId] } });
    await OutboxEvent.deleteMany({ recipientId: { $in: [studentAClerkId, studentBClerkId] } });
    await mongoose.disconnect();
    console.log('Cleanup complete and disconnected from MongoDB.');
  }
}

runTwoAccountTest().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

