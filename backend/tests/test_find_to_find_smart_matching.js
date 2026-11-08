import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Travel, { calculateExpiresAt } from '../src/models/Travel.js';
import Student from '../src/models/Student.js';
import Outbox from '../src/models/Outbox.js';
import Notification from '../src/models/Notification.js';
import SharedRideGroup from '../src/models/SharedRideGroup.js';
import {
  areFindPostsCompatible,
  findCompatibleFindPosts,
  detectAndNotifyCompatibleFindPosts,
  findMatchesForTravel
} from '../src/services/matching.service.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Phase 1 Smart FIND-to-FIND Matching & Notifications');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const ts = Date.now();
  const studentA = `find_user_A_${ts}`;
  const studentB = `find_user_B_${ts}`;
  const studentC = `find_user_C_${ts}`;
  const studentD = `find_user_D_${ts}`;

  const today = new Date();
  const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4);
  const differentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

  const testTravelIds = [];
  const testStudentIds = [studentA, studentB, studentC, studentD];

  try {
    // Setup student profiles
    await Student.create([
      { clerkId: studentA, name: 'Alice Student', email: `${studentA}@vitbhopal.ac.in` },
      { clerkId: studentB, name: 'Bob Student', email: `${studentB}@vitbhopal.ac.in` },
      { clerkId: studentC, name: 'Charlie Student', email: `${studentC}@vitbhopal.ac.in` },
      { clerkId: studentD, name: 'Dave Student', email: `${studentD}@vitbhopal.ac.in` }
    ]);

    // -------------------------------------------------------------
    // TEST 1: Compatible FIND Posts Detect Each Other
    // -------------------------------------------------------------
    console.log('TEST 1: Compatible FIND Posts Detection');
    const findA = await Travel.create({
      userId: studentA,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 600, // 10:00 AM
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findA._id);

    const findB = await Travel.create({
      userId: studentB,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 660, // 11:00 AM (diff 60 mins <= 420 mins)
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findB._id);

    const isCompat1 = await areFindPostsCompatible(findA, findB);
    if (!isCompat1) throw new Error('findA and findB must be compatible');

    const discoveredForA = await findCompatibleFindPosts(findA);
    const discoveredIdsForA = discoveredForA.map((p) => p._id.toString());
    if (!discoveredIdsForA.includes(findB._id.toString())) {
      throw new Error('findCompatibleFindPosts for findA must include findB');
    }
    console.log('  ✔ Compatible FIND posts detect each other: PASS');

    // -------------------------------------------------------------
    // TEST 2: Different Routes Do Not Match
    // -------------------------------------------------------------
    console.log('\nTEST 2: Different Routes Rejection');
    const findDiffRoute = await Travel.create({
      userId: studentC,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Indore', // Different destination
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findDiffRoute._id);

    const isCompat2 = await areFindPostsCompatible(findA, findDiffRoute);
    if (isCompat2) throw new Error('Different routes must not match');
    console.log('  ✔ Different route correctly rejected: PASS');

    // Reverse direction check (Bhopal Station -> VIT)
    const findReverse = await Travel.create({
      userId: studentD,
      type: 'request',
      source: 'Bhopal Railway Station',
      destination: 'VIT Bhopal',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findReverse._id);
    const isCompatReverse = await areFindPostsCompatible(findA, findReverse);
    if (isCompatReverse) throw new Error('Reverse direction must not match');
    console.log('  ✔ Opposite direction correctly rejected: PASS');

    // -------------------------------------------------------------
    // TEST 3: Different Dates Do Not Match
    // -------------------------------------------------------------
    console.log('\nTEST 3: Different Dates Rejection');
    const findDiffDate = await Travel.create({
      userId: studentC,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: differentDate, // Different calendar date
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(differentDate)
    });
    testTravelIds.push(findDiffDate._id);

    const isCompat3 = await areFindPostsCompatible(findA, findDiffDate);
    if (isCompat3) throw new Error('Different travel dates must not match');
    console.log('  ✔ Different calendar day correctly rejected: PASS');

    // -------------------------------------------------------------
    // TEST 4 & 5: Departure Time Tolerance (420 Minutes Window)
    // -------------------------------------------------------------
    console.log('\nTEST 4 & 5: Departure Time 420-Minute Tolerance Check');
    // Exactly 420 mins difference (600 + 420 = 1020 mins)
    const findExact420 = await Travel.create({
      userId: studentC,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 1020, // 420 mins diff
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findExact420._id);

    const isCompatExact420 = await areFindPostsCompatible(findA, findExact420);
    if (!isCompatExact420) throw new Error('Exact 420 minutes diff must be compatible');
    console.log('  ✔ Time difference within 420 minutes matches: PASS');

    // 421 mins difference (outside tolerance)
    const find421 = await Travel.create({
      userId: studentD,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 1021, // 421 mins diff
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(find421._id);

    const isCompat421 = await areFindPostsCompatible(findA, find421);
    if (isCompat421) throw new Error('421 minutes diff must exceed tolerance and be rejected');
    console.log('  ✔ Time difference outside 420 minutes rejected: PASS');

    // -------------------------------------------------------------
    // TEST 6: Same Student Posts Do Not Match
    // -------------------------------------------------------------
    console.log('\nTEST 6: Same Student Exclusion');
    const findA2 = await Travel.create({
      userId: studentA, // Same user A
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 630,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findA2._id);

    const isCompatSameUser = await areFindPostsCompatible(findA, findA2);
    if (isCompatSameUser) throw new Error('Posts by the same student must not match');
    console.log('  ✔ Same student posts excluded from matching: PASS');

    // -------------------------------------------------------------
    // TEST 7: Inactive FIND Posts Are Ignored
    // -------------------------------------------------------------
    console.log('\nTEST 7: Inactive FIND Post Filtering');
    const findInactive = await Travel.create({
      userId: studentC,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      status: 'cancelled', // Inactive
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(findInactive._id);

    const isCompatInactive = await areFindPostsCompatible(findA, findInactive);
    if (isCompatInactive) throw new Error('Inactive FIND post must not match');
    console.log('  ✔ Inactive post ignored: PASS');

    // -------------------------------------------------------------
    // TEST 8: Expired FIND Posts Are Ignored
    // -------------------------------------------------------------
    console.log('\nTEST 8: Expired FIND Post Filtering');
    const pastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
    const findExpired = await Travel.create({
      userId: studentC,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: pastDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: pastDate // Expired
    });
    testTravelIds.push(findExpired._id);

    const isCompatExpired = await areFindPostsCompatible(findA, findExpired);
    if (isCompatExpired) throw new Error('Expired FIND post must not match');
    console.log('  ✔ Expired post ignored: PASS');

    // -------------------------------------------------------------
    // TEST 9 & 10: Wait For Offer Behavior & Both Students Receive Notifications
    // -------------------------------------------------------------
    console.log('\nTEST 9 & 10: Notification Generation for Both Students');
    // Student A's post is waiting for offers. When Student B creates findB,
    // detectAndNotifyCompatibleFindPosts triggers notifications for both A and B.
    const createdEvents = await detectAndNotifyCompatibleFindPosts(findB);
    console.log(`  - Events created: ${createdEvents.length}`);

    if (createdEvents.length < 2) {
      throw new Error(`Expected at least 2 events (one for Student A, one for Student B), got ${createdEvents.length}`);
    }

    // Verify Student A notification content
    const [id1, id2] = [findA._id.toString(), findB._id.toString()].sort();
    const pairKey = `${id1}_${id2}`;

    const evtA = await Outbox.findOne({ eventId: `find_pair_${pairKey}_${studentA}` });
    if (!evtA) throw new Error('Student A must receive notification in Outbox');
    console.log(`  ✔ Student A notification title: "${evtA.payload.title}"`);
    console.log(`  ✔ Student A notification message: "${evtA.payload.message}"`);
    if (evtA.payload.title !== 'Another student wants to travel on your route!') {
      throw new Error(`Student A title mismatch. Expected "Another student wants to travel on your route!", got "${evtA.payload.title}"`);
    }

    // Verify Student B notification content
    const evtB = await Outbox.findOne({ eventId: `find_pair_${pairKey}_${studentB}` });
    if (!evtB) throw new Error('Student B must receive notification in Outbox');
    console.log(`  ✔ Student B notification title: "${evtB.payload.title}"`);
    console.log(`  ✔ Student B notification message: "${evtB.payload.message}"`);
    if (evtB.payload.title !== 'A compatible student was found!') {
      throw new Error(`Student B title mismatch. Expected "A compatible student was found!", got "${evtB.payload.title}"`);
    }

    // Check privacy: Ensure no phone, email, clerkId, firebaseUid in public payload text
    const textToCheck = `${evtA.payload.title} ${evtA.payload.message} ${evtB.payload.title} ${evtB.payload.message}`;
    if (textToCheck.includes('@') || textToCheck.includes('+91') || textToCheck.includes('user_')) {
      throw new Error('Public notification text leaked private contact identifiers');
    }
    console.log('  ✔ Privacy preserved: Zero private phone numbers, emails, or account IDs in notification text');

    // -------------------------------------------------------------
    // TEST 11: Repeated Detection Does Not Duplicate Notifications
    // -------------------------------------------------------------
    console.log('\nTEST 11: Idempotency on Repeated Detection');
    const repeatEvents = await detectAndNotifyCompatibleFindPosts(findB);
    console.log(`  - Repeated detection returned events count: ${repeatEvents.length} (Expected: 0 new events)`);

    const allEventsForA = await Outbox.find({ recipientId: studentA, 'payload.pairKey': pairKey });
    const allEventsForB = await Outbox.find({ recipientId: studentB, 'payload.pairKey': pairKey });

    if (allEventsForA.length !== 1 || allEventsForB.length !== 1) {
      throw new Error(`Duplicate outbox events created on repeated detection (A: ${allEventsForA.length}, B: ${allEventsForB.length})`);
    }
    console.log('  ✔ Repeated detection did not produce duplicate outbox notifications: PASS');

    // -------------------------------------------------------------
    // TEST 12: Concurrent Creation Protection
    // -------------------------------------------------------------
    console.log('\nTEST 12: Concurrency & Race Condition Protection');
    // Simulate Student A and Student B triggering detection simultaneously
    const [concurrentResultA, concurrentResultB] = await Promise.all([
      detectAndNotifyCompatibleFindPosts(findA),
      detectAndNotifyCompatibleFindPosts(findB)
    ]);

    const totalEvtsForPair = await Outbox.find({ 'payload.pairKey': pairKey });
    console.log(`  - Total Outbox events for pair after concurrent execution: ${totalEvtsForPair.length} (Expected: exactly 2)`);
    if (totalEvtsForPair.length !== 2) {
      throw new Error(`Concurrent execution produced duplicate events: count = ${totalEvtsForPair.length}`);
    }
    console.log('  ✔ Simultaneous detection handled safely without duplicate events: PASS');

    // -------------------------------------------------------------
    // TEST 13: Normal OFFER/FIND Matching Remains Unchanged
    // -------------------------------------------------------------
    console.log('\nTEST 13: Existing OFFER/FIND Matching Verification');
    const offerForA = await Travel.create({
      userId: studentD,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 615,
      timeFlexibility: 30,
      seats: 3,
      pricePerSeat: 350,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    testTravelIds.push(offerForA._id);

    // Normal matching for findA: must match offerForA, but NOT findB
    const normalMatchesForA = await findMatchesForTravel(findA);
    const matchedOfferIds = normalMatchesForA.map((m) => m._id.toString());

    if (!matchedOfferIds.includes(offerForA._id.toString())) {
      throw new Error('Normal findMatchesForTravel must still match compatible OFFER');
    }
    if (matchedOfferIds.includes(findB._id.toString())) {
      throw new Error('Normal findMatchesForTravel must NEVER match a REQUEST with another REQUEST');
    }
    console.log('  ✔ Normal matching matches OFFER for REQUEST: PASS');
    console.log('  ✔ Normal matching strictly excludes REQUEST from REQUEST matches: PASS');

    // -------------------------------------------------------------
    // TEST 14: Confirmed Group Exclusion Rule
    // -------------------------------------------------------------
    console.log('\nTEST 14: Confirmed Shared Group Members Exclusion');
    // Create an active group where Student A and Student B are already members
    const testGroup = await SharedRideGroup.create({
      adminId: studentA,
      originatingTravelId: findA._id,
      source: findA.source,
      destination: findA.destination,
      travelDate: findA.travelDate,
      departureTime: findA.departureTime,
      targetCapacity: 3,
      members: [
        { userId: studentA, travelId: findA._id, role: 'admin' },
        { userId: studentB, travelId: findB._id, role: 'member' }
      ],
      status: 'open',
      expiresAt: calculateExpiresAt(travelDate)
    });

    const isCompatWhenAlreadyInGroup = await areFindPostsCompatible(findA, findB);
    if (isCompatWhenAlreadyInGroup) {
      throw new Error('Students already in the same confirmed group must NOT detect each other');
    }
    console.log('  ✔ Students already confirmed in the same group are correctly excluded from new group suggestion: PASS');

    await SharedRideGroup.deleteOne({ _id: testGroup._id });

    console.log('\n================================================================');
    console.log('ALL 14 PHASE 1 SMART MATCHING TEST CASES PASSED (100% SUCCESS)');
    console.log('================================================================\n');
  } finally {
    // Cleanup
    if (testTravelIds.length > 0) {
      await Travel.deleteMany({ _id: { $in: testTravelIds } });
    }
    if (testStudentIds.length > 0) {
      await Student.deleteMany({ clerkId: { $in: testStudentIds } });
    }
    await Outbox.deleteMany({ recipientId: { $in: testStudentIds } });
    await Notification.deleteMany({ recipientId: { $in: testStudentIds } });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB & cleaned up test fixtures.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
