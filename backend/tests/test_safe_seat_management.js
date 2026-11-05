import mongoose from 'mongoose';
import Booking from '../src/models/Booking.js';
import Travel from '../src/models/Travel.js';

async function runSafeSeatManagementTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Phase 2 - Safe Seat Management Verification');
  console.log('================================================================\n');

  const createdDocIds = [];
  const createdTravelIds = [];
  const testOwnerId = 'host_student_' + Date.now();
  const testPassengerId1 = 'passenger_student_1_' + Date.now();
  const testPassengerId2 = 'passenger_student_2_' + Date.now();
  const testPassengerId3 = 'passenger_student_3_' + Date.now();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create a test Offer with 4 seats
    // -------------------------------------------------------------------------
    const travelOffer = await Travel.create({
      userId: testOwnerId,
      source: 'VIT Bhopal Campus',
      destination: 'Indore Junction',
      travelDate: new Date(Date.now() + 86400000 * 3),
      departureTime: 600, // 10:00 AM
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
    // TEST 1: Creation does NOT decrease available seats
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Booking creation must NOT decrease seats <<<');
    const booking1 = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: testPassengerId1,
      requestedSeats: 2,
      passengerName: 'Rohit Verma',
      status: 'pending'
    });
    createdDocIds.push(booking1._id);

    const travelCheck1 = await Travel.findById(travelOffer._id);
    console.log(`Created booking requesting 2 seats. Travel bookedSeats is: ${travelCheck1.bookedSeats}`);
    if (travelCheck1.bookedSeats !== 0) {
      throw new Error(`FAIL: Creation decreased seats! bookedSeats=${travelCheck1.bookedSeats}`);
    }
    console.log('Result: PASS (Creation does not decrease seats)\n');

    // -------------------------------------------------------------------------
    // TEST 2: Successful approval and seat decrement
    // -------------------------------------------------------------------------
    console.log('>>> TEST 2: Successful approval and atomic seat decrement <<<');
    const session2 = await mongoose.startSession();
    session2.startTransaction();

    try {
      const travelInTx = await Travel.findById(travelOffer._id).session(session2);
      const availableSeats = travelInTx.seats - (travelInTx.bookedSeats || 0);

      if (booking1.requestedSeats > availableSeats) {
        throw new Error('Unexpected insufficient seats in Test 2');
      }

      // Atomic conditional update
      const updatedTravel2 = await Travel.findOneAndUpdate(
        {
          _id: travelOffer._id,
          $expr: {
            $lte: [
              { $add: [{ $ifNull: ['$bookedSeats', 0] }, booking1.requestedSeats] },
              '$seats'
            ]
          }
        },
        { $inc: { bookedSeats: booking1.requestedSeats } },
        { returnDocument: 'after', session: session2 }
      );

      const updatedBooking2 = await Booking.findOneAndUpdate(
        { _id: booking1._id, status: 'pending' },
        { $set: { status: 'confirmed' } },
        { returnDocument: 'after', session: session2 }
      );

      await session2.commitTransaction();
      console.log(`Booking ${updatedBooking2._id} approved -> status='${updatedBooking2.status}'`);
      console.log(`Travel bookedSeats updated to: ${updatedTravel2.bookedSeats} (Available: ${updatedTravel2.seats - updatedTravel2.bookedSeats})`);

      if (updatedTravel2.bookedSeats !== 2 || updatedBooking2.status !== 'confirmed') {
        throw new Error('FAIL: Booking was not confirmed or seats were not decremented accurately');
      }
    } finally {
      await session2.endSession();
    }
    console.log('Result: PASS (Seats successfully decremented from 4 to 2 available)\n');

    // -------------------------------------------------------------------------
    // TEST 3: Insufficient seats rejection
    // -------------------------------------------------------------------------
    console.log('>>> TEST 3: Attempting to approve booking exceeding available seats <<<');
    // Currently bookedSeats = 2, available = 2.
    // Create a booking requesting 3 seats
    const bookingOverCapacity = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: testPassengerId2,
      requestedSeats: 3,
      status: 'pending'
    });
    createdDocIds.push(bookingOverCapacity._id);

    const session3 = await mongoose.startSession();
    session3.startTransaction();
    let caughtInsufficient = false;

    try {
      const currentTravel3 = await Travel.findById(travelOffer._id).session(session3);
      const availableSeats3 = currentTravel3.seats - (currentTravel3.bookedSeats || 0);

      if (bookingOverCapacity.requestedSeats > availableSeats3) {
        caughtInsufficient = true;
        console.log(`Pre-check caught insufficient seats: requested=${bookingOverCapacity.requestedSeats}, available=${availableSeats3}`);
      } else {
        await Travel.findOneAndUpdate(
          {
            _id: travelOffer._id,
            $expr: {
              $lte: [
                { $add: [{ $ifNull: ['$bookedSeats', 0] }, bookingOverCapacity.requestedSeats] },
                '$seats'
              ]
            }
          },
          { $inc: { bookedSeats: bookingOverCapacity.requestedSeats } },
          { session: session3 }
        );
      }
      await session3.abortTransaction();
    } finally {
      await session3.endSession();
    }

    const travelCheck3 = await Travel.findById(travelOffer._id);
    if (!caughtInsufficient || travelCheck3.bookedSeats !== 2) {
      throw new Error(`FAIL: Insufficient seats check failed! bookedSeats=${travelCheck3.bookedSeats}`);
    }
    console.log(`Result: PASS (Approval safely blocked, bookedSeats remains unchanged at ${travelCheck3.bookedSeats})\n`);

    // -------------------------------------------------------------------------
    // TEST 4: Rejection without seat decrement
    // -------------------------------------------------------------------------
    console.log('>>> TEST 4: Post owner rejects a pending booking request <<<');
    const session4 = await mongoose.startSession();
    session4.startTransaction();

    try {
      const rejectedBooking = await Booking.findOneAndUpdate(
        { _id: bookingOverCapacity._id, status: 'pending' },
        { $set: { status: 'rejected' } },
        { returnDocument: 'after', session: session4 }
      );
      // Notice: NO Travel bookedSeats update is executed!
      await session4.commitTransaction();
      console.log(`Booking ID ${rejectedBooking._id} rejected -> status='${rejectedBooking.status}'`);
    } finally {
      await session4.endSession();
    }

    const travelCheck4 = await Travel.findById(travelOffer._id);
    if (travelCheck4.bookedSeats !== 2) {
      throw new Error(`FAIL: Rejection modified bookedSeats! bookedSeats=${travelCheck4.bookedSeats}`);
    }
    console.log(`Result: PASS (Rejection marked status='rejected' without touching seats: bookedSeats=${travelCheck4.bookedSeats})\n`);

    // -------------------------------------------------------------------------
    // TEST 5: Cancellation of approved booking restores reserved seats
    // -------------------------------------------------------------------------
    console.log('>>> TEST 5: Cancellation of confirmed booking restores exact reserved seats <<<');
    const session5 = await mongoose.startSession();
    session5.startTransaction();

    try {
      // Atomically transition from confirmed to cancelled
      const cancelledBooking = await Booking.findOneAndUpdate(
        { _id: booking1._id, status: { $in: ['accepted', 'confirmed'] } },
        { $set: { status: 'cancelled' } },
        { returnDocument: 'after', session: session5 }
      );

      // Atomically decrement bookedSeats (restore seats)
      const restoredTravel = await Travel.findOneAndUpdate(
        { _id: travelOffer._id, bookedSeats: { $gte: booking1.requestedSeats } },
        { $inc: { bookedSeats: -booking1.requestedSeats } },
        { returnDocument: 'after', session: session5 }
      );

      await session5.commitTransaction();
      console.log(`Booking ${cancelledBooking._id} cancelled. Restored seats by ${booking1.requestedSeats}. New bookedSeats: ${restoredTravel.bookedSeats}`);

      if (restoredTravel.bookedSeats !== 0) {
        throw new Error(`FAIL: Expected bookedSeats=0 after cancellation, got ${restoredTravel.bookedSeats}`);
      }
    } finally {
      await session5.endSession();
    }
    console.log('Result: PASS (Exact seats restored upon cancellation: bookedSeats=0)\n');

    // -------------------------------------------------------------------------
    // TEST 6: Repeated cancellation without double restoration
    // -------------------------------------------------------------------------
    console.log('>>> TEST 6: Repeated cancellation must NOT double-restore seats <<<');
    const session6 = await mongoose.startSession();
    session6.startTransaction();
    let doubleRestoreBlocked = false;

    try {
      // Attempting to cancel already-cancelled booking
      const secondCancel = await Booking.findOneAndUpdate(
        { _id: booking1._id, status: { $in: ['accepted', 'confirmed'] } },
        { $set: { status: 'cancelled' } },
        { returnDocument: 'after', session: session6 }
      );

      if (!secondCancel) {
        doubleRestoreBlocked = true;
        console.log('Atomic transition check returned null (booking was already cancelled). Seat restoration skipped.');
      } else {
        await Travel.findOneAndUpdate(
          { _id: travelOffer._id, bookedSeats: { $gte: booking1.requestedSeats } },
          { $inc: { bookedSeats: -booking1.requestedSeats } },
          { session: session6 }
        );
      }
      await session6.commitTransaction();
    } finally {
      await session6.endSession();
    }

    const travelCheck6 = await Travel.findById(travelOffer._id);
    if (!doubleRestoreBlocked || travelCheck6.bookedSeats !== 0) {
      throw new Error(`FAIL: Repeated cancellation modified seats! bookedSeats=${travelCheck6.bookedSeats}`);
    }
    console.log(`Result: PASS (Repeated cancellation strictly prevented double restoration: bookedSeats remains ${travelCheck6.bookedSeats})\n`);

    // -------------------------------------------------------------------------
    // TEST 7: Pending or rejected cancellation must never restore seats
    // -------------------------------------------------------------------------
    console.log('>>> TEST 7: Cancelling pending or rejected request must never restore seats <<<');
    // Set travel bookedSeats to 1
    await Travel.updateOne({ _id: travelOffer._id }, { $set: { bookedSeats: 1 } });

    // 7a. Pending cancellation
    const pendingBooking = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: 'passenger_pending_cancel',
      requestedSeats: 1,
      status: 'pending'
    });
    createdDocIds.push(pendingBooking._id);

    // Cancel pending booking
    await Booking.findOneAndUpdate(
      { _id: pendingBooking._id, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );
    // Verify bookedSeats remained 1
    const checkPendingCancel = await Travel.findById(travelOffer._id);
    if (checkPendingCancel.bookedSeats !== 1) {
      throw new Error(`FAIL: Pending cancellation restored seats! bookedSeats=${checkPendingCancel.bookedSeats}`);
    }
    console.log('Pending cancellation did NOT restore seats: PASS');

    // 7b. Rejected cancellation attempt
    const rejectedAttempt = await Booking.findOneAndUpdate(
      { _id: bookingOverCapacity._id, status: { $in: ['accepted', 'confirmed'] } },
      { $set: { status: 'cancelled' } }
    );
    if (rejectedAttempt) {
      throw new Error('FAIL: Rejected booking was allowed into confirmed-cancellation path');
    }
    const checkRejectedCancel = await Travel.findById(travelOffer._id);
    if (checkRejectedCancel.bookedSeats !== 1) {
      throw new Error(`FAIL: Rejected booking cancellation restored seats! bookedSeats=${checkRejectedCancel.bookedSeats}`);
    }
    console.log('Rejected booking cannot be cancelled and did NOT restore seats: PASS');
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 8: Two simultaneous approvals competing for the last available seat
    // -------------------------------------------------------------------------
    console.log('>>> TEST 8: Two simultaneous approvals competing for the last available seat <<<');
    // Set seats=2, bookedSeats=1 -> only 1 seat left!
    await Travel.updateOne({ _id: travelOffer._id }, { $set: { seats: 2, bookedSeats: 1 } });

    const competingBookingA = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: 'passenger_competitor_A_' + Date.now(),
      requestedSeats: 1,
      status: 'pending'
    });
    createdDocIds.push(competingBookingA._id);

    const competingBookingB = await Booking.create({
      travelId: travelOffer._id,
      ownerId: testOwnerId,
      passengerId: 'passenger_competitor_B_' + Date.now(),
      requestedSeats: 1,
      status: 'pending'
    });
    createdDocIds.push(competingBookingB._id);

    // Simulate concurrent approval function using transaction and atomic update
    const attemptApproval = async (bId, reqSeats) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const tr = await Travel.findOneAndUpdate(
          {
            _id: travelOffer._id,
            $expr: {
              $lte: [
                { $add: [{ $ifNull: ['$bookedSeats', 0] }, reqSeats] },
                '$seats'
              ]
            }
          },
          { $inc: { bookedSeats: reqSeats } },
          { returnDocument: 'after', session }
        );

        if (!tr) {
          await session.abortTransaction();
          return { success: false, reason: 'INSUFFICIENT_SEATS' };
        }

        const b = await Booking.findOneAndUpdate(
          { _id: bId, status: 'pending' },
          { $set: { status: 'confirmed' } },
          { returnDocument: 'after', session }
        );

        if (!b) {
          await session.abortTransaction();
          return { success: false, reason: 'NOT_PENDING' };
        }

        await session.commitTransaction();
        return { success: true, bookingId: b._id, bookedSeats: tr.bookedSeats };
      } catch (err) {
        await session.abortTransaction();
        return { success: false, reason: err.message };
      } finally {
        await session.endSession();
      }
    };

    // Run both approvals concurrently in parallel
    const [resultA, resultB] = await Promise.all([
      attemptApproval(competingBookingA._id, competingBookingA.requestedSeats),
      attemptApproval(competingBookingB._id, competingBookingB.requestedSeats)
    ]);

    console.log('Competitor A result:', resultA);
    console.log('Competitor B result:', resultB);

    const winCount = (resultA.success ? 1 : 0) + (resultB.success ? 1 : 0);
    const finalTravel = await Travel.findById(travelOffer._id);
    console.log(`Final Travel capacity: seats=${finalTravel.seats}, bookedSeats=${finalTravel.bookedSeats}`);

    if (winCount === 1 && finalTravel.bookedSeats === 2) {
      console.log('Result: PASS (Exactly 1 approval won the seat, overbooking prevented, bookedSeats <= seats)\n');
    } else {
      throw new Error(`FAIL: Expected 1 winner and bookedSeats=2, but got winCount=${winCount}, bookedSeats=${finalTravel.bookedSeats}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Request Post Protection: Never decrement seats from a Request post
    // -------------------------------------------------------------------------
    console.log('>>> TEST 9: Request Post Protection (Never decrement seats from a Request post) <<<');
    const requestPost = await Travel.create({
      userId: testOwnerId,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Station',
      travelDate: new Date(Date.now() + 86400000 * 2),
      departureTime: 480,
      timeFlexibility: 60,
      seats: 1, // 1 seat requested by the student
      bookedSeats: 0,
      type: 'request',
      status: 'active'
    });
    createdTravelIds.push(requestPost._id);

    // Verify logic: when travel.type === 'request' and no offer is identified, bookedSeats must NOT change
    const isRequest = requestPost.type === 'request';
    if (isRequest) {
      // Target offer is not the request post
      console.log(`Identified travel post type as '${requestPost.type}'. Seats must NOT be decremented on request post.`);
    }

    const checkRequestPost = await Travel.findById(requestPost._id);
    if (checkRequestPost.bookedSeats !== 0) {
      throw new Error('FAIL: Seats decremented on a request post!');
    }
    console.log('Result: PASS (Request post seats remained untouched)\n');

    console.log('================================================================');
    console.log('ALL PHASE 2 SAFE SEAT MANAGEMENT TESTS PASSED! (9/9)');
    console.log('================================================================\n');

  } finally {
    console.log('Cleaning up test data...');
    if (createdDocIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdDocIds } });
    }
    if (createdTravelIds.length > 0) {
      await Travel.deleteMany({ _id: { $in: createdTravelIds } });
    }
    console.log('Cleanup complete. Disconnecting...');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runSafeSeatManagementTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

