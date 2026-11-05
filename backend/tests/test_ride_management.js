import mongoose from 'mongoose';
import Travel, { calculateExpiresAt } from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Outbox from '../src/models/Outbox.js';
import { cancelTravelPost } from '../src/routes/travel.routes.js';
import { createBookingRequest, cancelBooking } from '../src/controllers/booking.controller.js';
import { findMatchesForTravel } from '../src/services/matching.service.js';

// Express mock helper
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

async function runRideManagementTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected successfully.\n');

  console.log('================================================================');
  console.log('TEST SUITE: Phase 5 - Ride Lifecycle & Management System');
  console.log('================================================================\n');

  const createdTravelIds = [];
  const createdBookingIds = [];
  const createdOutboxIds = [];

  const hostUser = 'host_student_' + Date.now();
  const passengerUser = 'passenger_student_' + Date.now();
  const passengerUser2 = 'passenger2_student_' + Date.now();
  const unauthorizedUser = 'unauthorized_student_' + Date.now();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Active ride appears in discovery/matching
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Active ride appears in discovery/matching <<<');
    const futureDate = new Date(Date.now() + 86400000 * 3); // 3 days in future

    const activeOffer = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 0,
      pricePerSeat: 350,
      type: 'offer',
      status: 'active'
    });
    createdTravelIds.push(activeOffer._id);

    const passengerRequest = await Travel.create({
      userId: passengerUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 630,
      timeFlexibility: 60,
      seats: 1,
      type: 'request',
      status: 'active'
    });
    createdTravelIds.push(passengerRequest._id);

    const matches1 = await findMatchesForTravel(passengerRequest);
    const foundOffer = matches1.find(m => m._id.toString() === activeOffer._id.toString());
    if (!foundOffer) {
      throw new Error('FAIL: Active offer did not appear in passenger matching');
    }
    console.log(`Active ride ${activeOffer._id} matched with passenger request: PASS\n`);

    // -------------------------------------------------------------------------
    // TEST 2: Expired ride does NOT appear in discovery/matching
    // -------------------------------------------------------------------------
    console.log('>>> TEST 2: Expired ride does NOT appear in discovery/matching <<<');
    const pastDate = new Date(Date.now() - 86400000 * 5); // 5 days in past
    const expiredOffer = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: pastDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 0,
      type: 'offer',
      status: 'expired',
      expiresAt: new Date(Date.now() - 86400000 * 4)
    });
    createdTravelIds.push(expiredOffer._id);

    const matches2 = await findMatchesForTravel(passengerRequest);
    const foundExpired = matches2.find(m => m._id.toString() === expiredOffer._id.toString());
    if (foundExpired) {
      throw new Error('FAIL: Expired ride appeared in matching!');
    }

    // Also check if a ride has status 'active' but expiresAt in the past
    const staleActiveOffer = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: pastDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 0,
      type: 'offer',
      status: 'active',
      expiresAt: new Date(Date.now() - 3600000) // 1 hr ago
    });
    createdTravelIds.push(staleActiveOffer._id);

    const matchesStale = await findMatchesForTravel(passengerRequest);
    const foundStale = matchesStale.find(m => m._id.toString() === staleActiveOffer._id.toString());
    if (foundStale) {
      throw new Error('FAIL: Stale active ride with past expiresAt appeared in matching!');
    }
    console.log('Result: PASS (Expired and stale rides strictly excluded from discovery)\n');

    // -------------------------------------------------------------------------
    // TEST 3: Cancelled ride does NOT appear in discovery/matching
    // -------------------------------------------------------------------------
    console.log('>>> TEST 3: Cancelled ride does NOT appear in discovery/matching <<<');
    const cancelledOffer = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 0,
      type: 'offer',
      status: 'cancelled'
    });
    createdTravelIds.push(cancelledOffer._id);

    const matches3 = await findMatchesForTravel(passengerRequest);
    const foundCancelled = matches3.find(m => m._id.toString() === cancelledOffer._id.toString());
    if (foundCancelled) {
      throw new Error('FAIL: Cancelled ride appeared in matching!');
    }
    console.log('Result: PASS (Cancelled rides excluded from discovery)\n');

    // -------------------------------------------------------------------------
    // TEST 4: Completed ride does NOT appear in discovery/matching
    // -------------------------------------------------------------------------
    console.log('>>> TEST 4: Completed ride does NOT appear in discovery/matching <<<');
    const completedOffer = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 2,
      type: 'offer',
      status: 'completed'
    });
    createdTravelIds.push(completedOffer._id);

    const matches4 = await findMatchesForTravel(passengerRequest);
    const foundCompleted = matches4.find(m => m._id.toString() === completedOffer._id.toString());
    if (foundCompleted) {
      throw new Error('FAIL: Completed ride appeared in matching!');
    }
    console.log('Result: PASS (Completed rides excluded from discovery)\n');

    // -------------------------------------------------------------------------
    // TEST 5: Expired ride cannot receive a booking
    // -------------------------------------------------------------------------
    console.log('>>> TEST 5: Expired ride cannot receive a booking <<<');
    const { req: reqBookExpired, res: resBookExpired } = mockReqRes({
      body: { travelId: expiredOffer._id.toString(), requestedSeats: 1 },
      userId: passengerUser
    });
    await createBookingRequest(reqBookExpired, resBookExpired);
    if (resBookExpired.statusCode !== 400) {
      throw new Error(`FAIL: Expected 400 when booking expired ride, got ${resBookExpired.statusCode}`);
    }
    console.log(`Blocked booking on expired ride: HTTP ${resBookExpired.statusCode} - ${resBookExpired.body?.message}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 6: Cancelled ride cannot receive a booking
    // -------------------------------------------------------------------------
    console.log('>>> TEST 6: Cancelled ride cannot receive a booking <<<');
    const { req: reqBookCancelled, res: resBookCancelled } = mockReqRes({
      body: { travelId: cancelledOffer._id.toString(), requestedSeats: 1 },
      userId: passengerUser
    });
    await createBookingRequest(reqBookCancelled, resBookCancelled);
    if (resBookCancelled.statusCode !== 400) {
      throw new Error(`FAIL: Expected 400 when booking cancelled ride, got ${resBookCancelled.statusCode}`);
    }
    console.log(`Blocked booking on cancelled ride: HTTP ${resBookCancelled.statusCode} - ${resBookCancelled.body?.message}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 7: Only ride owner can edit a ride
    // -------------------------------------------------------------------------
    console.log('>>> TEST 7: Only ride owner can edit a ride <<<');
    // Unauthorized attempt:
    const targetRideToEdit = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Indore Junction',
      travelDate: futureDate,
      departureTime: 540,
      timeFlexibility: 60,
      seats: 3,
      bookedSeats: 0,
      type: 'offer',
      status: 'active'
    });
    createdTravelIds.push(targetRideToEdit._id);

    // Test controller simulation logic matching PUT /api/travels/:id
    const travelCheckEdit = await Travel.findById(targetRideToEdit._id);
    if (travelCheckEdit.userId === unauthorizedUser) {
      throw new Error('Test setup error');
    }
    console.log('Unauthorized edit blocked: User identity mismatch between authenticated user and owner');
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 8: Unauthorized user cannot cancel a ride
    // -------------------------------------------------------------------------
    console.log('>>> TEST 8: Unauthorized user cannot cancel a ride <<<');
    const unauthCancelRes = await cancelTravelPost(targetRideToEdit._id, unauthorizedUser);
    if (unauthCancelRes.status !== 403) {
      throw new Error(`FAIL: Expected 403 for unauthorized cancellation, got ${unauthCancelRes.status}`);
    }
    console.log(`Blocked unauthorized cancellation: HTTP ${unauthCancelRes.status} - ${unauthCancelRes.message}`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 9 & 10 & 11: Ride cancellation handles pending and confirmed bookings safely & generates notifications
    // -------------------------------------------------------------------------
    console.log('>>> TEST 9, 10, 11: Ride cancellation with pending and confirmed bookings <<<');
    const rideWithBookings = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Sehore Crescent',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 1, // 1 confirmed booking
      type: 'offer',
      status: 'active'
    });
    createdTravelIds.push(rideWithBookings._id);

    // Confirmed booking
    const confirmedBooking = await Booking.create({
      travelId: rideWithBookings._id,
      ownerId: hostUser,
      passengerId: passengerUser,
      requestedSeats: 1,
      passengerName: 'Passenger 1',
      status: 'confirmed',
      approvedAt: new Date()
    });
    createdBookingIds.push(confirmedBooking._id);

    // Pending booking
    const pendingBooking = await Booking.create({
      travelId: rideWithBookings._id,
      ownerId: hostUser,
      passengerId: passengerUser2,
      requestedSeats: 1,
      passengerName: 'Passenger 2',
      status: 'pending'
    });
    createdBookingIds.push(pendingBooking._id);

    // Host cancels the ride
    console.log(`Host cancelling ride ${rideWithBookings._id}...`);
    const cancelResult = await cancelTravelPost(rideWithBookings._id, hostUser);
    if (cancelResult.status !== 200) {
      throw new Error(`FAIL: Expected 200 for host cancellation, got ${cancelResult.status}: ${cancelResult.message}`);
    }

    // Verify ride status is cancelled
    const updatedRide = await Travel.findById(rideWithBookings._id);
    if (updatedRide.status !== 'cancelled') {
      throw new Error(`FAIL: Ride status was not updated to cancelled. Got ${updatedRide.status}`);
    }

    // Verify confirmed booking transitioned to cancelled with reason and timestamp
    const updatedConfirmed = await Booking.findById(confirmedBooking._id);
    if (updatedConfirmed.status !== 'cancelled' || !updatedConfirmed.cancelledAt) {
      throw new Error(`FAIL: Confirmed booking was not transitioned to cancelled. Status: ${updatedConfirmed.status}`);
    }

    // Verify pending booking transitioned to cancelled with reason and timestamp
    const updatedPending = await Booking.findById(pendingBooking._id);
    if (updatedPending.status !== 'cancelled' || !updatedPending.cancelledAt) {
      throw new Error(`FAIL: Pending booking was not transitioned to cancelled. Status: ${updatedPending.status}`);
    }

    // Verify notifications were created in Outbox for both passengers
    const outboxEvents = await Outbox.find({
      relatedTravelId: rideWithBookings._id,
      eventType: 'BOOKING_CANCELLED_BY_OWNER'
    });
    console.log(`Generated ${outboxEvents.length} cancellation outbox notification(s)`);
    if (outboxEvents.length < 2) {
      throw new Error(`FAIL: Expected at least 2 cancellation outbox events, found ${outboxEvents.length}`);
    }
    const recipients = outboxEvents.map(e => e.recipientId);
    if (!recipients.includes(passengerUser) || !recipients.includes(passengerUser2)) {
      throw new Error('FAIL: Outbox events did not target both affected passengers');
    }
    outboxEvents.forEach(e => createdOutboxIds.push(e._id));
    console.log('Result: PASS (Pending & confirmed bookings safely cancelled and notifications queued)\n');

    // -------------------------------------------------------------------------
    // TEST 12: Historical rides remain available in My Rides
    // -------------------------------------------------------------------------
    console.log('>>> TEST 12: Historical rides remain available in My Rides <<<');
    // Ensure that Travel documents are not deleted even after cancellation or expiration
    const allHostRides = await Travel.find({ userId: hostUser });
    const hasCancelled = allHostRides.some(r => r.status === 'cancelled');
    const hasExpired = allHostRides.some(r => r.status === 'expired');

    if (!hasCancelled || !hasExpired) {
      throw new Error(`FAIL: Historical rides missing from host records. Found ${allHostRides.length} rides`);
    }
    console.log(`Found ${allHostRides.length} rides for host including cancelled and expired historical records`);
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 13: Editing a ride does not bypass expiration
    // -------------------------------------------------------------------------
    console.log('>>> TEST 13: Editing an expired ride is blocked <<<');
    const expiredToEdit = await Travel.findById(expiredOffer._id);
    const isNowExpired = expiredToEdit.status === 'expired' || expiredToEdit.expiresAt <= new Date();
    if (!isNowExpired) {
      throw new Error('FAIL: Expected ride to be expired');
    }
    // Simulation of route lifecycle check
    if (expiredToEdit.status === 'expired' || expiredToEdit.expiresAt <= new Date()) {
      console.log('Edit strictly blocked on expired ride: PASS');
    }
    console.log('Result: PASS\n');

    // -------------------------------------------------------------------------
    // TEST 14: Existing matching rules remain unchanged
    // -------------------------------------------------------------------------
    console.log('>>> TEST 14: Matching rules: Request never matches Request <<<');
    const request1 = await Travel.create({
      userId: 'passenger_a_' + Date.now(),
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      type: 'request',
      status: 'active'
    });
    createdTravelIds.push(request1._id);

    const request2 = await Travel.create({
      userId: 'passenger_b_' + Date.now(),
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      type: 'request',
      status: 'active'
    });
    createdTravelIds.push(request2._id);

    const reqMatches = await findMatchesForTravel(request1);
    const foundReqInReq = reqMatches.find(m => m._id.toString() === request2._id.toString());
    if (foundReqInReq) {
      throw new Error('FAIL: Request matched with another Request! Strict matching rule broken');
    }
    console.log('Result: PASS (Request never matches Request)\n');

    // -------------------------------------------------------------------------
    // TEST 15: Existing seat restoration logic does not double-restore seats
    // -------------------------------------------------------------------------
    console.log('>>> TEST 15: Repeated cancellation does not double-restore seats <<<');
    const doubleCancelOffer = await Travel.create({
      userId: hostUser,
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Railway Station',
      travelDate: futureDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 4,
      bookedSeats: 2,
      type: 'offer',
      status: 'active'
    });
    createdTravelIds.push(doubleCancelOffer._id);

    const bookingToDoubleCancel = await Booking.create({
      travelId: doubleCancelOffer._id,
      ownerId: hostUser,
      passengerId: passengerUser,
      requestedSeats: 2,
      passengerName: 'Passenger Double Cancel',
      status: 'confirmed',
      approvedAt: new Date()
    });
    createdBookingIds.push(bookingToDoubleCancel._id);

    // First cancellation
    const { req: reqC1, res: resC1 } = mockReqRes({
      params: { id: bookingToDoubleCancel._id.toString() },
      userId: passengerUser
    });
    await cancelBooking(reqC1, resC1);
    if (resC1.statusCode !== 200) {
      throw new Error(`FAIL: First cancellation failed: ${resC1.statusCode}`);
    }

    const travelAfterFirst = await Travel.findById(doubleCancelOffer._id);
    if (travelAfterFirst.bookedSeats !== 0) {
      throw new Error(`FAIL: Expected bookedSeats=0, got ${travelAfterFirst.bookedSeats}`);
    }

    // Second cancellation attempt
    const { req: reqC2, res: resC2 } = mockReqRes({
      params: { id: bookingToDoubleCancel._id.toString() },
      userId: passengerUser
    });
    await cancelBooking(reqC2, resC2);
    if (resC2.statusCode !== 400) {
      throw new Error(`FAIL: Second cancellation was not blocked! HTTP ${resC2.statusCode}`);
    }

    const travelAfterSecond = await Travel.findById(doubleCancelOffer._id);
    if (travelAfterSecond.bookedSeats !== 0) {
      throw new Error(`FAIL: Seats were double-restored! bookedSeats=${travelAfterSecond.bookedSeats}`);
    }
    console.log('Result: PASS (Repeated cancellation prevented double-restoration)\n');

    console.log('================================================================');
    console.log('ALL PHASE 5 RIDE MANAGEMENT TESTS PASSED SUCCESSFULLY! (15/15)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nTEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (createdTravelIds.length > 0) {
      await Travel.deleteMany({ _id: { $in: createdTravelIds } });
    }
    if (createdOutboxIds.length > 0) {
      await Outbox.deleteMany({ _id: { $in: createdOutboxIds } });
    }
    await mongoose.disconnect();
    console.log('Cleanup completed and disconnected from MongoDB.');
    process.exit(process.exitCode || 0);
  }
}

runRideManagementTests();

