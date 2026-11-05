import mongoose from 'mongoose';
import Booking from '../src/models/Booking.js';
import Travel from '../src/models/Travel.js';

async function runDuplicateBookingProtectionTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Phase 1 - Duplicate Booking Request Protection');
  console.log('================================================================\n');

  const createdDocIds = [];
  const testTravelId = new mongoose.Types.ObjectId();
  const testOwnerId = 'student_host_' + Date.now();
  const testStudentId = 'student_passenger_' + Date.now();

  try {
    // Ensure MongoDB indexes (including the unique partial index) are in sync
    console.log('Syncing Booking indexes with MongoDB...');
    await Booking.syncIndexes();
    console.log('Indexes synced successfully.\n');

    // Create a mock travel post to satisfy any foreign constraints
    const travelDoc = await Travel.create({
      _id: testTravelId,
      userId: testOwnerId,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: new Date(Date.now() + 86400000 * 2), // 2 days in future
      departureTime: 540, // 09:00 AM
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 0,
      pricePerSeat: 350,
      type: 'offer',
      status: 'active'
    });
    console.log(`Setup: Created test travel offer (${travelDoc._id})\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Initial Booking Creation (Pending)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Student creates initial pending booking request <<<');
    const firstBooking = await Booking.create({
      travelId: testTravelId,
      ownerId: testOwnerId,
      passengerId: testStudentId,
      requestedSeats: 1,
      passengerName: 'Aarav Sharma',
      status: 'pending'
    });
    createdDocIds.push(firstBooking._id);
    console.log(`Result: Created booking ID ${firstBooking._id} with status='${firstBooking.status}'`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 2: Duplicate Request while Pending
    // -------------------------------------------------------------------------
    console.log('>>> TEST 2: Student attempts duplicate request while first is Pending <<<');
    let duplicateBlocked = false;
    try {
      // Simulate duplicate check as done in booking.controller.js
      const existing = await Booking.findOne({
        travelId: testTravelId,
        passengerId: testStudentId,
        status: { $in: ['pending', 'accepted', 'confirmed'] }
      });

      if (existing) {
        duplicateBlocked = true;
        console.log(`Pre-check caught active booking (${existing.status}). Blocked as expected.`);
      } else {
        const dupBooking = await Booking.create({
          travelId: testTravelId,
          ownerId: testOwnerId,
          passengerId: testStudentId,
          requestedSeats: 1,
          status: 'pending'
        });
        createdDocIds.push(dupBooking._id);
      }
    } catch (err) {
      if (err.code === 11000) {
        duplicateBlocked = true;
        console.log('Unique partial index caught duplicate pending booking at database level.');
      } else {
        throw err;
      }
    }

    if (!duplicateBlocked) {
      throw new Error('FAIL: Duplicate request was allowed while previous was pending!');
    }
    console.log('Result: PASS (Duplicate pending request was strictly blocked)\n');

    // -------------------------------------------------------------------------
    // TEST 3: Database Unique Partial Index Enforcement on Pending
    // -------------------------------------------------------------------------
    console.log('>>> TEST 3: Direct insert bypass to verify MongoDB unique partial index <<<');
    let indexCaught = false;
    try {
      await Booking.create({
        travelId: testTravelId,
        ownerId: testOwnerId,
        passengerId: testStudentId,
        requestedSeats: 1,
        status: 'pending'
      });
    } catch (err) {
      if (err.code === 11000) {
        indexCaught = true;
        console.log(`Unique index enforced error E11000: ${err.message}`);
      } else {
        throw err;
      }
    }

    if (!indexCaught) {
      throw new Error('FAIL: Database unique partial index did not catch duplicate insert!');
    }
    console.log('Result: PASS (Database-level protection verified)\n');

    // -------------------------------------------------------------------------
    // TEST 4: Rebooking allowed after previous request is Rejected
    // -------------------------------------------------------------------------
    console.log('>>> TEST 4: Student re-booking after previous request is Rejected <<<');
    firstBooking.status = 'rejected';
    await firstBooking.save();
    console.log(`Updated first booking ID ${firstBooking._id} to status='rejected'`);

    // Verify active check returns null now
    const activeCheckAfterReject = await Booking.findOne({
      travelId: testTravelId,
      passengerId: testStudentId,
      status: { $in: ['pending', 'accepted', 'confirmed'] }
    });
    console.log('Active check after reject:', activeCheckAfterReject ? 'Found active' : 'None active');

    // Rebook request
    const rebookedAfterReject = await Booking.create({
      travelId: testTravelId,
      ownerId: testOwnerId,
      passengerId: testStudentId,
      requestedSeats: 1,
      passengerName: 'Aarav Sharma',
      status: 'pending'
    });
    createdDocIds.push(rebookedAfterReject._id);
    console.log(`Result: Created new booking ID ${rebookedAfterReject._id} with status='pending'`);
    console.log('Result: PASS (Rebooking allowed after rejection)\n');

    // -------------------------------------------------------------------------
    // TEST 5: Rebooking allowed after previous request is Cancelled
    // -------------------------------------------------------------------------
    console.log('>>> TEST 5: Student re-booking after previous request is Cancelled <<<');
    rebookedAfterReject.status = 'cancelled';
    await rebookedAfterReject.save();
    console.log(`Updated second booking ID ${rebookedAfterReject._id} to status='cancelled'`);

    // Rebook request
    const rebookedAfterCancel = await Booking.create({
      travelId: testTravelId,
      ownerId: testOwnerId,
      passengerId: testStudentId,
      requestedSeats: 1,
      passengerName: 'Aarav Sharma',
      status: 'pending'
    });
    createdDocIds.push(rebookedAfterCancel._id);
    console.log(`Result: Created third booking ID ${rebookedAfterCancel._id} with status='pending'`);
    console.log('Result: PASS (Rebooking allowed after cancellation)\n');

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate Request while Confirmed
    // -------------------------------------------------------------------------
    console.log('>>> TEST 6: Student attempts duplicate request when already Confirmed <<<');
    rebookedAfterCancel.status = 'confirmed';
    await rebookedAfterCancel.save();
    console.log(`Updated booking ID ${rebookedAfterCancel._id} to status='confirmed'`);

    let confirmedDuplicateBlocked = false;
    const existingConfirmed = await Booking.findOne({
      travelId: testTravelId,
      passengerId: testStudentId,
      status: { $in: ['pending', 'accepted', 'confirmed'] }
    });

    if (existingConfirmed) {
      confirmedDuplicateBlocked = true;
      console.log(`Pre-check caught confirmed booking (${existingConfirmed.status}). Blocked as expected.`);
    }

    let directIndexBlocked = false;
    try {
      await Booking.create({
        travelId: testTravelId,
        ownerId: testOwnerId,
        passengerId: testStudentId,
        requestedSeats: 1,
        status: 'pending'
      });
    } catch (err) {
      if (err.code === 11000) {
        directIndexBlocked = true;
        console.log('Database index strictly blocked insertion when a confirmed booking exists.');
      }
    }

    if (!confirmedDuplicateBlocked || !directIndexBlocked) {
      throw new Error('FAIL: Duplicate request allowed when user is already confirmed!');
    }
    console.log('Result: PASS (Confirmed bookings cannot be duplicated)\n');

    // -------------------------------------------------------------------------
    // TEST 7: Race Condition: Simultaneous Requests
    // -------------------------------------------------------------------------
    console.log('>>> TEST 7: Race condition: simultaneous concurrent requests from same student <<<');
    const simultaneousStudentId = 'student_simultaneous_' + Date.now();

    // Fire 2 concurrent create calls in parallel
    const [req1, req2] = await Promise.allSettled([
      Booking.create({
        travelId: testTravelId,
        ownerId: testOwnerId,
        passengerId: simultaneousStudentId,
        requestedSeats: 1,
        status: 'pending'
      }),
      Booking.create({
        travelId: testTravelId,
        ownerId: testOwnerId,
        passengerId: simultaneousStudentId,
        requestedSeats: 1,
        status: 'pending'
      })
    ]);

    const successes = [req1, req2].filter(r => r.status === 'fulfilled');
    const rejections = [req1, req2].filter(r => r.status === 'rejected');

    console.log(`Simultaneous calls result: ${successes.length} fulfilled, ${rejections.length} rejected`);

    if (successes.length === 1 && rejections.length === 1) {
      const successfulDoc = successes[0].value;
      createdDocIds.push(successfulDoc._id);
      const rejectedError = rejections[0].reason;
      console.log(`Successful booking ID: ${successfulDoc._id}`);
      console.log(`Rejected reason code: ${rejectedError.code} (${rejectedError.name})`);
      if (rejectedError.code === 11000) {
        console.log('Result: PASS (Exactly 1 concurrent request succeeded, race condition safely blocked by MongoDB)\n');
      } else {
        throw new Error(`FAIL: Unexpected error code on rejected call: ${rejectedError.message}`);
      }
    } else {
      throw new Error(`FAIL: Race condition test expected 1 success and 1 failure, but got ${successes.length} successes and ${rejections.length} failures.`);
    }

    console.log('================================================================');
    console.log('ALL PHASE 1 DUPLICATE BOOKING TESTS PASSED SUCCESSFULLY! (7/7)');
    console.log('================================================================\n');

  } finally {
    console.log('Cleaning up test data...');
    if (createdDocIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdDocIds } });
    }
    await Travel.deleteOne({ _id: testTravelId });
    console.log('Cleanup complete. Disconnecting...');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runDuplicateBookingProtectionTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

