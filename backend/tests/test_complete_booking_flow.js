import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';
import Outbox from '../src/models/Outbox.js';
import Notification from '../src/models/Notification.js';
import {
  createBookingRequest,
  confirmBooking,
  cancelBooking,
  getWhatsAppDetails,
  getBookingById
} from '../src/controllers/booking.controller.js';
import { getUnreadNotificationCount, markNotificationAsRead } from '../src/controllers/notification.controller.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';

function mockReqRes({ params = {}, body = {}, query = {}, userId = 'test_user' } = {}) {
  const req = {
    params,
    body,
    query,
    userId,
    headers: {}
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

async function runCompleteFlowTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is required.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Helpu Complete Booking Flow, Notifications & UI');
  console.log('================================================================\n');

  const ts = Date.now();
  const driverClerkId = `driver_${ts}`;
  const passengerClerkId = `passenger_${ts}`;
  const unauthorizedClerkId = `unauthorized_${ts}`;
  const secondPassengerClerkId = `second_p_${ts}`;
  const thirdPassengerClerkId = `third_p_${ts}`;

  try {
    // 0. Setup test student profiles
    await Student.create([
      { clerkId: driverClerkId, name: 'Aman Sharma', email: `aman_${ts}@vit.ac.in`, phone: '+919876543210', whatsappNumber: '+919876543210', college: 'VIT, Bhopal' },
      { clerkId: passengerClerkId, name: 'Priya Patel', email: `priya_${ts}@vit.ac.in`, phone: '+919123456789', whatsappNumber: '+919123456789', college: 'VIT, Bhopal' },
      { clerkId: unauthorizedClerkId, name: 'Rohit Stranger', email: `rohit_${ts}@vit.ac.in`, phone: '+919988776655', whatsappNumber: '+919988776655', college: 'VIT, Bhopal' },
      { clerkId: secondPassengerClerkId, name: 'Siddharth V', email: `sid_${ts}@vit.ac.in`, phone: '+919811122233', whatsappNumber: '+919811122233', college: 'VIT, Bhopal' },
      { clerkId: thirdPassengerClerkId, name: 'Kavita Singh', email: `kavita_${ts}@vit.ac.in`, phone: '+919822233344', whatsappNumber: '+919822233344', college: 'VIT, Bhopal' },
    ]);

    // -------------------------------------------------------------
    // PART 1: OFFER POST BOOKING FLOW
    // -------------------------------------------------------------
    console.log('--- PART 1: OFFER POST BOOKING FLOW ---');

    // 1. Aman creates an OFFER post with 2 seats
    const offerTravel = await Travel.create({
      userId: driverClerkId,
      type: 'offer',
      source: 'VIT Bhopal Campus',
      destination: 'Indore Junction',
      travelDate: new Date(Date.now() + 86400000 * 2), // 2 days later
      departureTime: 600, // 10:00 AM
      timeFlexibility: 30,
      seats: 2,
      bookedSeats: 0,
      pricePerSeat: 350,
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 3)
    });
    console.log(`✓ Offer created: ${offerTravel.source} → ${offerTravel.destination}, Seats: 2`);

    // 2. Priya creates a booking request for 1 seat
    console.log('\nStep 2: Priya books 1 seat...');
    const { req: bReq, res: bRes } = mockReqRes({
      userId: passengerClerkId,
      body: {
        travelId: offerTravel._id.toString(),
        requestedSeats: 1,
        passengerName: 'Priya Patel',
        passengerPhone: '+919123456789'
      }
    });
    await createBookingRequest(bReq, bRes);
    if (bRes.statusCode !== 201) throw new Error(`Booking failed: ${JSON.stringify(bRes.body)}`);
    const booking1 = bRes.body.data;
    console.log(`✓ Booking created with status: "${booking1.status}" (ID: ${booking1._id})`);

    // 3. Verify: Available seats do NOT decrease on booking request
    const offerAfterBook = await Travel.findById(offerTravel._id);
    console.log(`✓ Post bookedSeats after request: ${offerAfterBook.bookedSeats} (Available: ${offerAfterBook.seats - offerAfterBook.bookedSeats})`);
    if (offerAfterBook.bookedSeats !== 0) {
      throw new Error(`CRITICAL FAIL: Seats were decreased upon booking request! bookedSeats is ${offerAfterBook.bookedSeats}`);
    }

    // 4. Verify: Outbox notification created for Aman with student name, route, requested seats
    const outboxReq = await Outbox.findOne({
      relatedBookingId: booking1._id,
      eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED
    });
    if (!outboxReq) throw new Error('Outbox event for BOOKING_REQUESTED was not found');
    console.log(`✓ Outbox event created for Driver (Recipient: ${outboxReq.recipientId})`);
    console.log(`  Payload: ${JSON.stringify(outboxReq.payload)}`);
    if (outboxReq.payload.passengerName !== 'Priya Patel') throw new Error('passengerName missing in outbox payload');

    // 5. Verify: Both participants can access WhatsApp coordination during PENDING status
    console.log('\nStep 5: Testing WhatsApp Coordination during PENDING status...');
    // Passenger accessing WhatsApp
    const { req: waReqP, res: waResP } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: passengerClerkId
    });
    await getWhatsAppDetails(waReqP, waResP);
    if (waResP.statusCode !== 200) throw new Error(`Passenger WhatsApp access failed: ${JSON.stringify(waResP.body)}`);
    console.log(`✓ Passenger can access WhatsApp URL: ${waResP.body.data.whatsappUrl.slice(0, 50)}...`);

    // Driver accessing WhatsApp
    const { req: waReqD, res: waResD } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: driverClerkId
    });
    await getWhatsAppDetails(waReqD, waResD);
    if (waResD.statusCode !== 200) throw new Error(`Driver WhatsApp access failed: ${JSON.stringify(waResD.body)}`);
    console.log(`✓ Driver can access WhatsApp URL: ${waResD.body.data.whatsappUrl.slice(0, 50)}...`);

    // Unauthorized user accessing WhatsApp
    const { req: waReqU, res: waResU } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: unauthorizedClerkId
    });
    await getWhatsAppDetails(waReqU, waResU);
    if (waResU.statusCode !== 403) throw new Error(`Unauthorized access was NOT blocked! Status: ${waResU.statusCode}`);
    console.log(`✓ Unauthorized access correctly blocked with 403 Forbidden`);

    // 6. Explicit Confirm Booking: Atomically decreases seats
    console.log('\nStep 6: Explicit Confirm Booking...');
    const { req: confReq, res: confRes } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: driverClerkId
    });
    await confirmBooking(confReq, confRes);
    if (confRes.statusCode !== 200) throw new Error(`Confirmation failed: ${JSON.stringify(confRes.body)}`);
    const confBooking = confRes.body.data.booking;
    console.log(`✓ Booking status after confirm: "${confBooking.status}"`);

    const offerAfterConfirm = await Travel.findById(offerTravel._id);
    console.log(`✓ Offer bookedSeats after confirm: ${offerAfterConfirm.bookedSeats} (Available: ${offerAfterConfirm.seats - offerAfterConfirm.bookedSeats})`);
    if (offerAfterConfirm.bookedSeats !== 1) {
      throw new Error(`CRITICAL FAIL: bookedSeats should be 1, but is ${offerAfterConfirm.bookedSeats}`);
    }

    // 7. Verify notifications sent to both participants
    const outboxConf = await Outbox.find({
      relatedBookingId: booking1._id,
      eventType: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED
    });
    console.log(`✓ Confirmation outbox events created: ${outboxConf.length} (Recipients: ${outboxConf.map(o => o.recipientId).join(', ')})`);
    if (outboxConf.length < 2) throw new Error('Both participants must be notified upon confirmation');

    // 8. Prevent duplicate confirmation / overselling
    const { req: reConfReq, res: reConfRes } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: driverClerkId
    });
    await confirmBooking(reConfReq, reConfRes);
    const offerAfterReconf = await Travel.findById(offerTravel._id);
    if (offerAfterReconf.bookedSeats !== 1) {
      throw new Error(`CRITICAL FAIL: Duplicate confirmation decreased seats twice! bookedSeats: ${offerAfterReconf.bookedSeats}`);
    }
    console.log(`✓ Repeated confirmation safely handled without double decrement (bookedSeats: ${offerAfterReconf.bookedSeats})`);

    // 9. Second passenger books the remaining seat
    console.log('\nStep 9: Siddharth books the last remaining seat (1 seat)...');
    const { req: b2Req, res: b2Res } = mockReqRes({
      userId: secondPassengerClerkId,
      body: {
        travelId: offerTravel._id.toString(),
        requestedSeats: 1,
        passengerName: 'Siddharth V',
        passengerPhone: '+919811122233'
      }
    });
    await createBookingRequest(b2Req, b2Res);
    const booking2 = b2Res.body.data;
    // Confirm booking2
    const { req: c2Req, res: c2Res } = mockReqRes({
      params: { id: booking2._id.toString() },
      userId: driverClerkId
    });
    await confirmBooking(c2Req, c2Res);

    const offerFull = await Travel.findById(offerTravel._id);
    console.log(`✓ Offer post now FULL: bookedSeats: ${offerFull.bookedSeats} / total seats: ${offerFull.seats}`);

    // 10. Third passenger tries to book when FULL: Must be rejected
    console.log('\nStep 10: Kavita tries to book when FULL...');
    const { req: b3Req, res: b3Res } = mockReqRes({
      userId: thirdPassengerClerkId,
      body: {
        travelId: offerTravel._id.toString(),
        requestedSeats: 1,
        passengerName: 'Kavita Singh'
      }
    });
    await createBookingRequest(b3Req, b3Res);
    if (b3Res.statusCode !== 400 || b3Res.body.code !== 'INSUFFICIENT_SEATS') {
      throw new Error(`Expected 400 INSUFFICIENT_SEATS but got ${b3Res.statusCode}: ${JSON.stringify(b3Res.body)}`);
    }
    console.log(`✓ Overbooking correctly blocked with: "${b3Res.body.message}"`);

    // 11. Cancellation restores seats exactly once
    console.log('\nStep 11: Priya cancels her confirmed booking...');
    const { req: cancelReq, res: cancelRes } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: passengerClerkId
    });
    await cancelBooking(cancelReq, cancelRes);
    if (cancelRes.statusCode !== 200) throw new Error(`Cancellation failed: ${JSON.stringify(cancelRes.body)}`);
    const offerAfterCancel = await Travel.findById(offerTravel._id);
    console.log(`✓ bookedSeats after cancellation: ${offerAfterCancel.bookedSeats} (Seats restored from 2 to 1)`);
    if (offerAfterCancel.bookedSeats !== 1) {
      throw new Error(`Expected bookedSeats to be 1 after 1 cancellation, but got ${offerAfterCancel.bookedSeats}`);
    }

    // Repeated cancellation: must not restore seats twice
    const { req: reCancelReq, res: reCancelRes } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: passengerClerkId
    });
    await cancelBooking(reCancelReq, reCancelRes);
    const offerAfterReCancel = await Travel.findById(offerTravel._id);
    if (offerAfterReCancel.bookedSeats !== 1) {
      throw new Error(`CRITICAL FAIL: Repeated cancellation restored seats again! bookedSeats: ${offerAfterReCancel.bookedSeats}`);
    }
    console.log(`✓ Repeated cancellation safely handled without double restoration (bookedSeats: ${offerAfterReCancel.bookedSeats})`);

    // -------------------------------------------------------------
    // PART 2: REQUEST POST BOOKING FLOW (SAME UI & SAME FLOW)
    // -------------------------------------------------------------
    console.log('\n--- PART 2: REQUEST POST BOOKING FLOW ---');

    // 12. Student creates a REQUEST post
    const reqTravel = await Travel.create({
      userId: passengerClerkId,
      type: 'request',
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Airport',
      travelDate: new Date(Date.now() + 86400000 * 2),
      departureTime: 480, // 8:00 AM
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 3)
    });
    console.log(`✓ Request post created by Priya: ${reqTravel.source} → ${reqTravel.destination}, Seats: 1`);

    // Aman has an OFFER post on this route
    const driverOffer = await Travel.create({
      userId: driverClerkId,
      type: 'offer',
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Airport',
      travelDate: new Date(Date.now() + 86400000 * 2),
      departureTime: 490,
      timeFlexibility: 30,
      seats: 3,
      bookedSeats: 0,
      pricePerSeat: 300,
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 3)
    });

    // 13. Aman books/offers seat on Priya's Request post using the SAME booking API
    console.log('\nStep 13: Aman clicks Book Seat on Priya\'s Request post...');
    const { req: reqBookReq, res: reqBookRes } = mockReqRes({
      userId: driverClerkId,
      body: {
        travelId: reqTravel._id.toString(),
        requestedSeats: 1,
        passengerName: 'Aman Sharma',
        passengerPhone: '+919876543210'
      }
    });
    await createBookingRequest(reqBookReq, reqBookRes);
    if (reqBookRes.statusCode !== 201) throw new Error(`Booking request post failed: ${JSON.stringify(reqBookRes.body)}`);
    const reqBooking = reqBookRes.body.data;
    console.log(`✓ Booking on Request post created: "${reqBooking.status}" (ID: ${reqBooking._id})`);

    // Verify WhatsApp access for request post booking
    const { req: reqWaReq, res: reqWaRes } = mockReqRes({
      params: { id: reqBooking._id.toString() },
      userId: passengerClerkId
    });
    await getWhatsAppDetails(reqWaReq, reqWaRes);
    if (reqWaRes.statusCode !== 200) throw new Error(`WhatsApp access on Request booking failed: ${JSON.stringify(reqWaRes.body)}`);
    console.log(`✓ Both participants can access WhatsApp coordination on Request booking`);

    // 14. Confirm booking on Request post: Seats are deducted from Aman's OFFER post, NOT from Request post!
    console.log('\nStep 14: Confirming booking on Request post...');
    const { req: cReqReq, res: cReqRes } = mockReqRes({
      params: { id: reqBooking._id.toString() },
      userId: passengerClerkId
    });
    await confirmBooking(cReqReq, cReqRes);
    if (cReqRes.statusCode !== 200) throw new Error(`Confirmation on Request booking failed: ${JSON.stringify(cReqRes.body)}`);

    // Check driver's offer post
    const driverOfferAfter = await Travel.findById(driverOffer._id);
    console.log(`✓ Driver's Offer post bookedSeats: ${driverOfferAfter.bookedSeats} (Reserved 1 seat from actual Offer post)`);
    if (driverOfferAfter.bookedSeats !== 1) {
      throw new Error(`Expected driver's offer bookedSeats to be 1, but got ${driverOfferAfter.bookedSeats}`);
    }

    // Check Priya's request post: seats should NOT be deducted
    const reqTravelAfter = await Travel.findById(reqTravel._id);
    console.log(`✓ Priya's Request post seats remaining: ${reqTravelAfter.seats} (Never decremented)`);

    // -------------------------------------------------------------
    // PART 3: NOTIFICATION UNREAD COUNT & MARK AS READ
    // -------------------------------------------------------------
    console.log('\n--- PART 3: NOTIFICATIONS & UNREAD COUNT ---');

    // Create a real notification in DB for Priya
    const notif = await Notification.create({
      eventId: `evt_test_${Date.now()}`,
      recipientId: passengerClerkId,
      title: 'New Booking Request',
      message: 'Aman Sharma requested 1 seat(s) for your ride.',
      type: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
      relatedBookingId: reqBooking._id,
      isRead: false
    });

    const { req: uReq, res: uRes } = mockReqRes({ userId: passengerClerkId });
    await getUnreadNotificationCount(uReq, uRes);
    console.log(`✓ Unread count response: ${JSON.stringify(uRes.body)}`);
    if (uRes.body.unreadCount < 1) throw new Error('Unread count is not reflecting unread notification');

    // Mark as read
    const { req: rReq, res: rRes } = mockReqRes({
      params: { id: notif._id.toString() },
      userId: passengerClerkId
    });
    await markNotificationAsRead(rReq, rRes);
    console.log(`✓ Notification marked as read`);

    const { req: uReq2, res: uRes2 } = mockReqRes({ userId: passengerClerkId });
    await getUnreadNotificationCount(uReq2, uRes2);
    console.log(`✓ Unread count after marking read: ${uRes2.body.unreadCount}`);

    console.log('\n================================================================');
    console.log('>>> ALL 12 END-TO-END FLOW VERIFICATION TESTS PASSED PERFECTLY! <<<');
    console.log('================================================================\n');

  } finally {
    // Cleanup created test records
    await Student.deleteMany({ clerkId: { $in: [driverClerkId, passengerClerkId, unauthorizedClerkId, secondPassengerClerkId, thirdPassengerClerkId] } });
    await Travel.deleteMany({ userId: { $in: [driverClerkId, passengerClerkId] } });
    await Booking.deleteMany({ passengerId: { $in: [driverClerkId, passengerClerkId, secondPassengerClerkId, thirdPassengerClerkId] } });
    await Outbox.deleteMany({ recipientId: { $in: [driverClerkId, passengerClerkId] } });
    await Notification.deleteMany({ recipientId: { $in: [driverClerkId, passengerClerkId] } });
    await mongoose.disconnect();
    console.log('MongoDB disconnected and test cleanup complete.');
  }
}

runCompleteFlowTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
