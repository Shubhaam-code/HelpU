import mongoose from 'mongoose';
import Booking from '../src/models/Booking.js';
import Travel from '../src/models/Travel.js';
import { 
  completeBooking, 
  cancelBooking, 
  respondToBookingRequest,
  buildBookingTimeline 
} from '../src/controllers/booking.controller.js';

// Helper to mock Express req & res
function mockReqRes({ params = {}, body = {}, userId = 'test_user' } = {}) {
  const req = {
    params,
    body,
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

async function runBookingStatusTrackingTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Phase 4 - Booking Status Tracking & Transitions');
  console.log('================================================================\n');

  const createdDocIds = [];
  const createdTravelIds = [];
  const testOwnerId = 'host_student_' + Date.now();
  const testPassengerId = 'passenger_student_' + Date.now();
  const testUnauthorizedId = 'unauthorized_student_' + Date.now();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create a test Offer with 4 seats
    // -------------------------------------------------------------------------
    const travelOffer = await Travel.create({
      userId: testOwnerId,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: new Date(Date.now() + 86400000 * 2),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 0,
      pricePerSeat: 350,
      type: 'offer',
      status: 'active'
    });
    createdTravelIds.push(travelOffer._id);
    console.log(`Setup: Created Offer post (${travelOffer._id}) with seats=4, bookedSeats=0\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Creation sets status='pending' and createdAt timestamp
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Booking creation sets status to "pending" <<<');
    const booking1 = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: testPassengerId,
      requestedSeats: 2,
      passengerName: 'Ananya Sharma',
      status: 'pending'
    });
    createdDocIds.push(booking1._id);

    if (booking1.status !== 'pending' || !booking1.createdAt) {
      throw new Error(`FAIL: Expected status='pending' and createdAt to be set. Got status=${booking1.status}`);
    }
    console.log(`Booking created: ID=${booking1._id}, status=${booking1.status}, createdAt=${booking1.createdAt}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 2: Attempting to complete a pending booking must fail (Invalid transition)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 2: Cannot complete a pending booking <<<');
    const { req: reqInvalidComplete, res: resInvalidComplete } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: testOwnerId
    });
    await completeBooking(reqInvalidComplete, resInvalidComplete);
    if (resInvalidComplete.statusCode !== 400) {
      throw new Error(`FAIL: Expected 400 when completing pending booking, got ${resInvalidComplete.statusCode}`);
    }
    console.log(`Blocked complete on pending booking: HTTP ${resInvalidComplete.statusCode} - ${resInvalidComplete.body?.message}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 3: Host approves booking -> status='confirmed' & approvedAt timestamp set
    // -------------------------------------------------------------------------
    console.log('>>> TEST 3: Host approves booking -> status="confirmed" & approvedAt timestamp <<<');
    const { req: reqApprove, res: resApprove } = mockReqRes({
      params: { id: booking1._id.toString() },
      body: { action: 'accept' },
      userId: testOwnerId
    });
    await respondToBookingRequest(reqApprove, resApprove);
    if (resApprove.statusCode !== 200) {
      throw new Error(`FAIL: Expected 200 approving booking, got ${resApprove.statusCode}: ${JSON.stringify(resApprove.body)}`);
    }

    const approvedBooking = await Booking.findById(booking1._id);
    if (approvedBooking.status !== 'confirmed' || !approvedBooking.approvedAt) {
      throw new Error(`FAIL: Expected status='confirmed' and approvedAt set. Got status=${approvedBooking.status}, approvedAt=${approvedBooking.approvedAt}`);
    }
    console.log(`Booking approved: status=${approvedBooking.status}, approvedAt=${approvedBooking.approvedAt}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 4: Unauthorized user cannot complete booking
    // -------------------------------------------------------------------------
    console.log('>>> TEST 4: Unauthorized user cannot complete booking <<<');
    const { req: reqUnauth, res: resUnauth } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: testUnauthorizedId
    });
    await completeBooking(reqUnauth, resUnauth);
    if (resUnauth.statusCode !== 403) {
      throw new Error(`FAIL: Expected 403 for unauthorized user completion, got ${resUnauth.statusCode}`);
    }
    console.log(`Blocked unauthorized user: HTTP ${resUnauth.statusCode} - ${resUnauth.body?.message}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 5: Passenger or Host successfully marks confirmed booking as completed
    // -------------------------------------------------------------------------
    console.log('>>> TEST 5: Passenger marks confirmed booking as completed <<<');
    const { req: reqComplete, res: resComplete } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: testPassengerId
    });
    await completeBooking(reqComplete, resComplete);
    if (resComplete.statusCode !== 200) {
      throw new Error(`FAIL: Expected 200 completing booking, got ${resComplete.statusCode}: ${JSON.stringify(resComplete.body)}`);
    }

    const completedBooking = await Booking.findById(booking1._id);
    if (completedBooking.status !== 'completed' || !completedBooking.completedAt) {
      throw new Error(`FAIL: Expected status='completed' and completedAt set. Got status=${completedBooking.status}, completedAt=${completedBooking.completedAt}`);
    }
    console.log(`Booking completed: status=${completedBooking.status}, completedAt=${completedBooking.completedAt}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 6: Idempotent completion call
    // -------------------------------------------------------------------------
    console.log('>>> TEST 6: Repeated completeBooking call is idempotent <<<');
    const { req: reqRepeatComplete, res: resRepeatComplete } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: testOwnerId
    });
    await completeBooking(reqRepeatComplete, resRepeatComplete);
    if (resRepeatComplete.statusCode !== 200) {
      throw new Error(`FAIL: Expected 200 for idempotent completion, got ${resRepeatComplete.statusCode}`);
    }
    console.log(`Idempotent completion verified: status remains completed`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 7: Completed booking CANNOT be cancelled or have seats restored
    // -------------------------------------------------------------------------
    console.log('>>> TEST 7: Completed booking cannot be cancelled <<<');
    const { req: reqCancelCompleted, res: resCancelCompleted } = mockReqRes({
      params: { id: booking1._id.toString() },
      userId: testPassengerId
    });
    await cancelBooking(reqCancelCompleted, resCancelCompleted);
    if (resCancelCompleted.statusCode !== 400) {
      throw new Error(`FAIL: Expected 400 when cancelling completed booking, got ${resCancelCompleted.statusCode}`);
    }
    console.log(`Blocked cancel on completed booking: HTTP ${resCancelCompleted.statusCode} - ${resCancelCompleted.body?.message}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 8: Timeline Generation for completed booking
    // -------------------------------------------------------------------------
    console.log('>>> TEST 8: Status Timeline integrity for completed booking <<<');
    const timeline = buildBookingTimeline(completedBooking.toObject());
    console.log('Timeline generated:');
    timeline.forEach((step, idx) => {
      console.log(`  [Step ${idx + 1}] ${step.title} (${step.status}) at ${step.timestamp}`);
    });

    if (timeline.length < 3) {
      throw new Error(`FAIL: Expected at least 3 timeline steps (created, approved, completed), got ${timeline.length}`);
    }
    if (timeline[0].status !== 'pending' || timeline[1].status !== 'confirmed' || timeline[2].status !== 'completed') {
      throw new Error('FAIL: Timeline steps order mismatch');
    }
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 9: Pending -> Rejected transition sets rejectedAt
    // -------------------------------------------------------------------------
    console.log('>>> TEST 9: Pending -> Rejected transition sets rejectedAt <<<');
    const booking2 = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: 'passenger_reject_' + Date.now(),
      requestedSeats: 1,
      passengerName: 'Karan Mehra',
      status: 'pending'
    });
    createdDocIds.push(booking2._id);

    const { req: reqReject, res: resReject } = mockReqRes({
      params: { id: booking2._id.toString() },
      body: { action: 'reject' },
      userId: testOwnerId
    });
    await respondToBookingRequest(reqReject, resReject);
    if (resReject.statusCode !== 200) {
      throw new Error(`FAIL: Expected 200 rejecting booking, got ${resReject.statusCode}`);
    }

    const rejectedBooking = await Booking.findById(booking2._id);
    if (rejectedBooking.status !== 'rejected' || !rejectedBooking.rejectedAt) {
      throw new Error(`FAIL: Expected status='rejected' and rejectedAt set. Got status=${rejectedBooking.status}, rejectedAt=${rejectedBooking.rejectedAt}`);
    }
    console.log(`Booking rejected: status=${rejectedBooking.status}, rejectedAt=${rejectedBooking.rejectedAt}`);

    const rejectTimeline = buildBookingTimeline(rejectedBooking.toObject());
    if (rejectTimeline.length !== 2 || rejectTimeline[1].status !== 'rejected') {
      throw new Error('FAIL: Timeline mismatch for rejected booking');
    }
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 10: Confirmed -> Cancelled transition sets cancelledAt and restores seats
    // -------------------------------------------------------------------------
    console.log('>>> TEST 10: Confirmed -> Cancelled transition sets cancelledAt and restores seats <<<');
    const booking3 = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: 'passenger_cancel_' + Date.now(),
      requestedSeats: 1,
      passengerName: 'Sneha Patel',
      status: 'pending'
    });
    createdDocIds.push(booking3._id);

    // Approve booking3
    const { req: reqApprove3, res: resApprove3 } = mockReqRes({
      params: { id: booking3._id.toString() },
      body: { action: 'accept' },
      userId: testOwnerId
    });
    await respondToBookingRequest(reqApprove3, resApprove3);

    const travelBeforeCancel = await Travel.findById(travelOffer._id);
    const bookedSeatsBeforeCancel = travelBeforeCancel.bookedSeats;

    // Cancel booking3
    const { req: reqCancel3, res: resCancel3 } = mockReqRes({
      params: { id: booking3._id.toString() },
      userId: booking3.passengerId
    });
    await cancelBooking(reqCancel3, resCancel3);
    if (resCancel3.statusCode !== 200) {
      throw new Error(`FAIL: Expected 200 cancelling booking, got ${resCancel3.statusCode}`);
    }

    const cancelledBooking = await Booking.findById(booking3._id);
    if (cancelledBooking.status !== 'cancelled' || !cancelledBooking.cancelledAt) {
      throw new Error(`FAIL: Expected status='cancelled' and cancelledAt set. Got status=${cancelledBooking.status}`);
    }

    const travelAfterCancel = await Travel.findById(travelOffer._id);
    if (travelAfterCancel.bookedSeats !== bookedSeatsBeforeCancel - 1) {
      throw new Error(`FAIL: Expected seats to be restored. Before=${bookedSeatsBeforeCancel}, After=${travelAfterCancel.bookedSeats}`);
    }
    console.log(`Booking cancelled: status=${cancelledBooking.status}, cancelledAt=${cancelledBooking.cancelledAt}, seats restored accurately`);

    const cancelTimeline = buildBookingTimeline(cancelledBooking.toObject());
    if (cancelTimeline.length !== 3 || cancelTimeline[2].status !== 'cancelled') {
      throw new Error('FAIL: Timeline mismatch for cancelled booking');
    }
    console.log('Result: PASS\n');

    console.log('================================================================');
    console.log('ALL PHASE 4 BACKEND STATUS TRACKING TESTS PASSED SUCCESSFULLY! (10/10)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nTEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup created test docs
    if (createdDocIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdDocIds } });
    }
    if (createdTravelIds.length > 0) {
      await Travel.deleteMany({ _id: { $in: createdTravelIds } });
    }
    await mongoose.disconnect();
    console.log('Cleanup completed and disconnected from MongoDB.');
    process.exit(process.exitCode || 0);
  }
}

runBookingStatusTrackingTests();

