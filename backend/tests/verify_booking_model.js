import mongoose from 'mongoose';
import Booking from '../src/models/Booking.js';
import Travel from '../src/models/Travel.js';

async function runBookingModelTests() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  await mongoose.connect(mongoUri);

  console.log('================================================================');
  console.log('TEST SUITE: Task 11 Part 1 - Booking Model Verification');
  console.log('================================================================\n');

  const createdDocIds = [];

  try {
    // Sync indexes to MongoDB
    await Booking.syncIndexes();

    // Setup dummy Travel document ID
    const dummyTravelId = new mongoose.Types.ObjectId();
    const ownerId = 'user_travel_owner_101';
    const passengerId = 'user_travel_passenger_202';

    // ------------------------------------------------------------
    // TEST 1: Valid Booking document creation
    // ------------------------------------------------------------
    console.log('>>> 1. Test Valid Booking Document Creation <<<');
    const validBooking = new Booking({
      travelId: dummyTravelId,
      ownerId,
      passengerId,
      requestedSeats: 2,
      status: 'pending'
    });

    await validBooking.validate();
    const savedBooking = await validBooking.save();
    createdDocIds.push(savedBooking._id);

    console.log('Valid Booking created successfully:');
    console.log({
      _id: savedBooking._id.toString(),
      travelId: savedBooking.travelId.toString(),
      ownerId: savedBooking.ownerId,
      passengerId: savedBooking.passengerId,
      requestedSeats: savedBooking.requestedSeats,
      status: savedBooking.status,
      createdAt: savedBooking.createdAt,
      updatedAt: savedBooking.updatedAt
    });
    console.log('Result: PASS\n');

    // ------------------------------------------------------------
    // TEST 2: Invalid requestedSeats (< 1, float, non-number)
    // ------------------------------------------------------------
    console.log('>>> 2. Test Invalid requestedSeats Validation <<<');
    
    // 2a. Zero seats
    let caughtZero = false;
    try {
      const bZero = new Booking({
        travelId: dummyTravelId,
        ownerId,
        passengerId,
        requestedSeats: 0
      });
      await bZero.validate();
    } catch (err) {
      caughtZero = true;
      console.log('2a. requestedSeats = 0 error caught:', err.errors['requestedSeats']?.message);
    }
    console.log('2a. Zero seats rejected:', caughtZero ? 'PASS' : 'FAIL');

    // 2b. Negative seats
    let caughtNegative = false;
    try {
      const bNeg = new Booking({
        travelId: dummyTravelId,
        ownerId,
        passengerId,
        requestedSeats: -3
      });
      await bNeg.validate();
    } catch (err) {
      caughtNegative = true;
      console.log('2b. requestedSeats = -3 error caught:', err.errors['requestedSeats']?.message);
    }
    console.log('2b. Negative seats rejected:', caughtNegative ? 'PASS' : 'FAIL');

    // 2c. Non-integer seats (e.g. 1.5)
    let caughtFloat = false;
    try {
      const bFloat = new Booking({
        travelId: dummyTravelId,
        ownerId,
        passengerId,
        requestedSeats: 1.5
      });
      await bFloat.validate();
    } catch (err) {
      caughtFloat = true;
      console.log('2c. requestedSeats = 1.5 error caught:', err.errors['requestedSeats']?.message);
    }
    console.log('2c. Fractional seats rejected:', caughtFloat ? 'PASS' : 'FAIL\n');

    // ------------------------------------------------------------
    // TEST 3: Invalid status
    // ------------------------------------------------------------
    console.log('\n>>> 3. Test Invalid status Validation <<<');
    let caughtStatus = false;
    try {
      const bInvalidStatus = new Booking({
        travelId: dummyTravelId,
        ownerId,
        passengerId,
        requestedSeats: 1,
        status: 'approved_unsupported'
      });
      await bInvalidStatus.validate();
    } catch (err) {
      caughtStatus = true;
      console.log('Invalid status error caught:', err.errors['status']?.message);
    }
    console.log('Invalid status rejected:', caughtStatus ? 'PASS' : 'FAIL\n');

    // ------------------------------------------------------------
    // TEST 4: ownerId and passengerId being identical
    // ------------------------------------------------------------
    console.log('>>> 4. Test ownerId and passengerId Being Identical <<<');
    let caughtSameUser = false;
    try {
      const bSameUser = new Booking({
        travelId: dummyTravelId,
        ownerId: 'user_same_identity_999',
        passengerId: 'user_same_identity_999',
        requestedSeats: 1
      });
      await bSameUser.validate();
    } catch (err) {
      caughtSameUser = true;
      console.log('Same user error caught:', err.errors['passengerId']?.message);
    }
    console.log('Identical owner and passenger rejected:', caughtSameUser ? 'PASS' : 'FAIL\n');

    // ------------------------------------------------------------
    // TEST 5: Verify Indexes
    // ------------------------------------------------------------
    console.log('>>> 5. Verify Indexes on Bookings Collection <<<');
    const indexes = await Booking.collection.listIndexes().toArray();
    console.log('Registered MongoDB Indexes:');
    indexes.forEach((idx) => {
      console.log(` - Index "${idx.name}":`, JSON.stringify(idx.key));
    });

    const hasTravelIdIdx = indexes.some((idx) => idx.key.travelId !== undefined);
    const hasOwnerIdIdx = indexes.some((idx) => idx.key.ownerId !== undefined);
    const hasPassengerIdIdx = indexes.some((idx) => idx.key.passengerId !== undefined);
    const hasStatusIdx = indexes.some((idx) => idx.key.status !== undefined);

    console.log('travelId indexed:', hasTravelIdIdx ? 'PASS' : 'FAIL');
    console.log('ownerId indexed:', hasOwnerIdIdx ? 'PASS' : 'FAIL');
    console.log('passengerId indexed:', hasPassengerIdIdx ? 'PASS' : 'FAIL');
    console.log('status indexed:', hasStatusIdx ? 'PASS' : 'FAIL\n');

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    // ------------------------------------------------------------
    // TEST 6: Clean up test documents
    // ------------------------------------------------------------
    console.log('>>> 6. Clean up Test Documents <<<');
    if (createdDocIds.length > 0) {
      const deleteResult = await Booking.deleteMany({ _id: { $in: createdDocIds } });
      console.log(`Deleted ${deleteResult.deletedCount} test document(s) from MongoDB.`);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    console.log('\n================================================================');
    console.log('Booking Model Verification Completed Successfully.');
    console.log('================================================================');
  }
}

runBookingModelTests();
