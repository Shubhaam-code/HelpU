import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Travel, { calculateExpiresAt } from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import { confirmBooking, cancelBooking, respondToBookingRequest } from '../src/controllers/booking.controller.js';
import { isSameDirection, isSameCalendarDay } from '../src/services/matching.service.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Helpu FIND Dynamic Seat Status & Booking Regression');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const testUserOffer = `test_host_${Date.now()}`;
  const testUserFind = `test_finder_${Date.now()}`;
  const testUnrelatedUser = `test_unrelated_${Date.now()}`;

  const today = new Date();
  const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const diffDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);

  let offerPost = null;
  let findPost = null;
  let booking = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Create OFFER post (3 seats) and FIND post (1 seat)
    // -------------------------------------------------------------
    offerPost = await Travel.create({
      userId: testUserOffer,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 480, // 8:00 AM
      timeFlexibility: 30,
      seats: 3,
      bookedSeats: 0,
      pricePerSeat: 350,
      expiresAt: calculateExpiresAt(travelDate),
      status: 'active'
    });

    findPost = await Travel.create({
      userId: testUserFind,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 490, // 8:10 AM
      timeFlexibility: 30,
      seats: 1, // Enforced to 1
      bookedSeats: 0,
      pricePerSeat: 350,
      expiresAt: calculateExpiresAt(travelDate),
      status: 'active'
    });

    console.log('✓ Initial OFFER post created with seats = 3, bookedSeats = 0');
    console.log('✓ Initial FIND post created with seats = 1, bookedSeats = 0\n');

    // -------------------------------------------------------------
    // TEST 1: Pending Booking State
    // -------------------------------------------------------------
    console.log('TEST 1: Pending Booking Creation');
    booking = await Booking.create({
      travelId: offerPost._id,
      matchedTravelId: findPost._id,
      ownerId: testUserOffer,
      passengerId: testUserFind,
      requestedSeats: 1,
      passengerName: 'Test Finder',
      status: 'pending'
    });

    // Check FIND post fulfillment under pending booking
    const pendingDirect = await Booking.findOne({
      $or: [{ travelId: findPost._id }, { matchedTravelId: findPost._id }],
      status: { $in: ['accepted', 'confirmed', 'completed'] }
    });
    console.log(`  - Direct/Matched confirmed booking for FIND post: ${Boolean(pendingDirect)} (Expected: false)`);
    if (pendingDirect) throw new Error('Pending booking should not be considered confirmed!');

    console.log('  ✔ FIND post seat status remains "1 seat needed" under pending request\n');

    // -------------------------------------------------------------
    // TEST 2: Rejected Booking State
    // -------------------------------------------------------------
    console.log('TEST 2: Rejected Booking State');
    const mockResReject = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await respondToBookingRequest({ params: { id: booking._id.toString() }, body: { action: 'reject' }, userId: testUserOffer }, mockResReject);
    
    const rejectedBooking = await Booking.findById(booking._id);
    console.log(`  - Booking status after rejection: ${rejectedBooking.status}`);

    const rejectedDirect = await Booking.findOne({
      $or: [{ travelId: findPost._id }, { matchedTravelId: findPost._id }],
      status: { $in: ['accepted', 'confirmed', 'completed'] }
    });
    console.log(`  - Confirmed booking for FIND post after rejection: ${Boolean(rejectedDirect)} (Expected: false)`);
    if (rejectedDirect) throw new Error('Rejected booking should not fulfill FIND post!');

    const findAfterReject = await Travel.findById(findPost._id);
    console.log(`  - FIND post bookedSeats after rejection: ${findAfterReject.bookedSeats} (Expected: 0)`);
    if (findAfterReject.bookedSeats !== 0) throw new Error('FIND post bookedSeats must be 0 after rejection!');
    console.log('  ✔ FIND post seat status remains "1 seat needed" after rejection\n');

    // -------------------------------------------------------------
    // TEST 3: Confirmed Booking State & Offer Seat Decrement
    // -------------------------------------------------------------
    console.log('TEST 3: Confirmed Booking Flow');
    // Create new pending booking to confirm
    const booking2 = await Booking.create({
      travelId: offerPost._id,
      matchedTravelId: findPost._id,
      ownerId: testUserOffer,
      passengerId: testUserFind,
      requestedSeats: 1,
      passengerName: 'Test Finder',
      status: 'pending'
    });

    const mockResConfirm = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await confirmBooking({ params: { id: booking2._id.toString() }, userId: testUserOffer }, mockResConfirm);

    const confirmedBooking = await Booking.findById(booking2._id);
    console.log(`  - Booking status: ${confirmedBooking.status}`);
    if (confirmedBooking.status !== 'confirmed') throw new Error('Booking status must be confirmed!');

    // Check OFFER post seat decrement
    const updatedOffer = await Travel.findById(offerPost._id);
    console.log(`  - OFFER post bookedSeats: ${updatedOffer.bookedSeats} (Expected: 1)`);
    console.log(`  - OFFER post availableSeats: ${updatedOffer.seats - updatedOffer.bookedSeats} (Expected: 2)`);
    if (updatedOffer.bookedSeats !== 1) throw new Error('OFFER post bookedSeats should be 1!');

    // Check FIND post fulfillment
    const updatedFind = await Travel.findById(findPost._id);
    console.log(`  - FIND post bookedSeats: ${updatedFind.bookedSeats} (Expected: 1)`);
    if (updatedFind.bookedSeats !== 1) throw new Error('FIND post bookedSeats should be 1 after confirmation!');

    const confirmedDirect = await Booking.findOne({
      $or: [{ travelId: findPost._id }, { matchedTravelId: findPost._id }],
      status: { $in: ['accepted', 'confirmed', 'completed'] }
    });
    console.log(`  - Confirmed booking link verified: ${Boolean(confirmedDirect)} (Expected: true)`);
    if (!confirmedDirect) throw new Error('Confirmed booking link not found!');

    console.log('  ✔ OFFER decremented from 3 to 2 seats left');
    console.log('  ✔ FIND post dynamically updated to "1 seat found" (Ride Found)\n');

    // -------------------------------------------------------------
    // TEST 4: Cancelled Booking State & Offer Seat Restoration
    // -------------------------------------------------------------
    console.log('TEST 4: Booking Cancellation & Status Reversion');
    const mockResCancel = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await cancelBooking({ params: { id: booking2._id.toString() }, userId: testUserOffer }, mockResCancel);

    const cancelledBooking = await Booking.findById(booking2._id);
    console.log(`  - Booking status: ${cancelledBooking.status}`);
    if (cancelledBooking.status !== 'cancelled') throw new Error('Booking status must be cancelled!');

    // Check OFFER seat restoration
    const restoredOffer = await Travel.findById(offerPost._id);
    console.log(`  - Restored OFFER bookedSeats: ${restoredOffer.bookedSeats} (Expected: 0)`);
    console.log(`  - Restored OFFER availableSeats: ${restoredOffer.seats - restoredOffer.bookedSeats} (Expected: 3)`);
    if (restoredOffer.bookedSeats !== 0) throw new Error('OFFER post bookedSeats should be restored to 0!');

    // Check FIND post reversion
    const revertedFind = await Travel.findById(findPost._id);
    console.log(`  - Reverted FIND bookedSeats: ${revertedFind.bookedSeats} (Expected: 0)`);
    if (revertedFind.bookedSeats !== 0) throw new Error('FIND post bookedSeats should revert to 0!');

    const cancelledDirect = await Booking.findOne({
      $or: [{ travelId: findPost._id }, { matchedTravelId: findPost._id }],
      status: { $in: ['accepted', 'confirmed', 'completed'] }
    });
    console.log(`  - Confirmed booking link after cancellation: ${Boolean(cancelledDirect)} (Expected: false)`);
    if (cancelledDirect) throw new Error('Cancelled booking should not be considered active!');

    console.log('  ✔ OFFER restored from 2 to 3 seats left');
    console.log('  ✔ FIND post dynamically reverted to "1 seat needed" (Looking for a ride)\n');

    // -------------------------------------------------------------
    // TEST 5: Proof that Unrelated Bookings CANNOT Fulfill FIND Post
    // -------------------------------------------------------------
    console.log('TEST 5: Proof of Unrelated Booking Isolation');
    // Create an unrelated OFFER post for a DIFFERENT route (VIT -> Indore)
    const unrelatedRouteOffer = await Travel.create({
      userId: testUnrelatedUser,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Indore',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 3,
      pricePerSeat: 500,
      expiresAt: calculateExpiresAt(travelDate),
      status: 'active'
    });

    // Create and confirm an unrelated booking for Finder on Indore route
    const unrelatedRouteBooking = await Booking.create({
      travelId: unrelatedRouteOffer._id,
      ownerId: testUnrelatedUser,
      passengerId: testUserFind,
      requestedSeats: 1,
      status: 'confirmed'
    });

    // Verify if unrelated booking can match the original FIND post (VIT -> Bhopal Railway Station)
    const routeMatches = isSameDirection(
      unrelatedRouteOffer.source,
      unrelatedRouteOffer.destination,
      findPost.source,
      findPost.destination
    );
    console.log(`  - Does unrelated route (Indore) match FIND route (Bhopal Station): ${routeMatches} (Expected: false)`);
    if (routeMatches) throw new Error('Unrelated route must not match!');

    // Create an unrelated date OFFER post (same route, different date)
    const unrelatedDateOffer = await Travel.create({
      userId: testUnrelatedUser,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: diffDate,
      departureTime: 480,
      timeFlexibility: 30,
      seats: 3,
      pricePerSeat: 350,
      expiresAt: calculateExpiresAt(diffDate),
      status: 'active'
    });

    const dateMatches = isSameCalendarDay(unrelatedDateOffer.travelDate, findPost.travelDate);
    console.log(`  - Does different travel date match FIND post date: ${dateMatches} (Expected: false)`);
    if (dateMatches) throw new Error('Different calendar day must not match!');

    const findAfterUnrelated = await Travel.findById(findPost._id);
    console.log(`  - FIND post bookedSeats after unrelated bookings: ${findAfterUnrelated.bookedSeats} (Expected: 0)`);
    if (findAfterUnrelated.bookedSeats !== 0) throw new Error('Unrelated bookings must not fulfill FIND post!');

    console.log('  ✔ Unrelated routes cannot fulfill FIND post');
    console.log('  ✔ Unrelated travel dates cannot fulfill FIND post\n');

    // Clean up created unrelated records
    await Travel.deleteMany({ _id: { $in: [unrelatedRouteOffer._id, unrelatedDateOffer._id] } });
    await Booking.deleteMany({ _id: unrelatedRouteBooking._id });

    console.log('================================================================');
    console.log('ALL 5 INTEGRATION & REGRESSION TESTS PASSED (100% SUCCESS)');
    console.log('================================================================');
  } finally {
    // Clean up test data
    if (offerPost) await Travel.deleteOne({ _id: offerPost._id });
    if (findPost) await Travel.deleteOne({ _id: findPost._id });
    await Booking.deleteMany({ passengerId: testUserFind });
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB & cleaned up test data.');
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
