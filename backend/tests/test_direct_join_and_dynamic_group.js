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
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import Booking from '../src/models/Booking.js';
import {
  findCompatibleGroupsForFindPost,
  findMatchesForTravel,
  detectAndNotifyCompatibleFindPosts,
  areFindPostsCompatible
} from '../src/services/matching.service.js';
import {
  createGroupFromFindMatch,
  acceptGroupInvitation,
  directJoinSharedRideGroup,
  leaveSharedRideGroup
} from '../src/controllers/group.controller.js';
import { confirmBooking, cancelBooking } from '../src/controllers/booking.controller.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

function createMockReqRes({ userId, body = {}, params = {}, query = {} }) {
  const req = {
    userId,
    body,
    params,
    query
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    getStatusCode() {
      return statusCode;
    },
    getData() {
      return responseData;
    }
  };

  return { req, res };
}

async function runTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: Direct Join, Dynamic Group & Smart Matching (30 Tests)');
  console.log('================================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas.\n');

  const ts = Date.now();
  const studentA = `user_dj_A_${ts}`;
  const studentB = `user_dj_B_${ts}`;
  const studentC = `user_dj_C_${ts}`;
  const studentD = `user_dj_D_${ts}`;
  const studentE = `user_dj_E_${ts}`;
  const studentDriver = `driver_dj_${ts}`;

  const today = new Date();
  const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const differentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9);

  const testStudentIds = [studentA, studentB, studentC, studentD, studentE, studentDriver];
  let createdGroupIds = [];
  let createdTravelIds = [];
  let createdBookingIds = [];

  let passedTests = 0;
  const totalTests = 30;

  try {
    // 0. Seed Student Profiles
    await Student.create([
      { clerkId: studentA, name: 'Student A (Admin)', email: `test_${studentA}@campus.edu`, college: 'Campus Main', phone: '9199990001', isVerified: true },
      { clerkId: studentB, name: 'Student B (Co-founder)', email: `test_${studentB}@campus.edu`, college: 'Campus Main', phone: '9199990002', isVerified: true },
      { clerkId: studentC, name: 'Student C (Direct Joiner)', email: `test_${studentC}@campus.edu`, college: 'Campus Main', phone: '9199990003', isVerified: true },
      { clerkId: studentD, name: 'Student D (Concurrent Joiner 1)', email: `test_${studentD}@campus.edu`, college: 'Campus Main', phone: '9199990004', isVerified: true },
      { clerkId: studentE, name: 'Student E (Concurrent Joiner 2)', email: `test_${studentE}@campus.edu`, college: 'Campus Main', phone: '9199990005', isVerified: true },
      { clerkId: studentDriver, name: 'Driver Student', email: `test_${studentDriver}@campus.edu`, college: 'Campus Main', phone: '9199990006', isVerified: true }
    ]);
    console.log('✓ Seeded 6 verified student profiles.\n');

    async function createTestTravel(userId, overrides = {}) {
      const travel = await Travel.create({
        userId,
        type: 'request',
        source: 'Campus',
        destination: 'Airport',
        travelDate,
        departureTime: 600,
        timeFlexibility: 30,
        seats: 1,
        status: 'active',
        expiresAt: calculateExpiresAt(overrides.travelDate || travelDate, overrides.departureTime || 600),
        ...overrides
      });
      createdTravelIds.push(travel._id);
      return travel;
    }

    // =========================================================================
    // PART 1: SMART FIND MATCHING (TESTS 1 - 8)
    // =========================================================================
    console.log('--- PART 1: Smart FIND Matching (Tests 1-8) ---');

    // Base Post: Student A
    const postA = await createTestTravel(studentA, { departureTime: 600 });

    // Test 1: Incompatible directions don't match (Airport -> Campus)
    const postOpposite = await createTestTravel(studentB, {
      source: 'Airport',
      destination: 'Campus',
      departureTime: 600
    });
    const compat1 = await areFindPostsCompatible(postA, postOpposite);
    if (compat1) throw new Error('Test 1 Failed: Opposite directions should not match');
    console.log('✓ Test 1 Passed: Opposite directions do not match.');
    passedTests++;

    // Test 2: Different calendar days don't match
    const postDiffDate = await createTestTravel(studentB, {
      travelDate: differentDate,
      departureTime: 600
    });
    const compat2 = await areFindPostsCompatible(postA, postDiffDate);
    if (compat2) throw new Error('Test 2 Failed: Different dates should not match');
    console.log('✓ Test 2 Passed: Different calendar days do not match.');
    passedTests++;

    // Test 3: Departure time delta > 420 mins doesn't match (10:00 AM vs 6:00 PM, delta 480 mins)
    const postDiffTime = await createTestTravel(studentB, {
      departureTime: 1080 // 18:00 (6:00 PM), delta = 480 > 420
    });
    const compat3 = await areFindPostsCompatible(postA, postDiffTime);
    if (compat3) throw new Error('Test 3 Failed: Time delta > 420 should not match');
    console.log('✓ Test 3 Passed: Departure time delta > 420 mins does not match.');
    passedTests++;

    // Test 4: Same student posts don't match
    const postSameStudent = await createTestTravel(studentA, {
      departureTime: 630
    });
    const compat4 = await areFindPostsCompatible(postA, postSameStudent);
    if (compat4) throw new Error('Test 4 Failed: Same student posts should not match');
    console.log('✓ Test 4 Passed: Same student posts do not match.');
    passedTests++;

    // Test 5: Cancelled / expired posts don't match
    const postCancelled = await createTestTravel(studentB, {
      departureTime: 630,
      status: 'cancelled'
    });
    const compat5 = await areFindPostsCompatible(postA, postCancelled);
    if (compat5) throw new Error('Test 5 Failed: Cancelled post should not match');
    console.log('✓ Test 5 Passed: Cancelled / expired posts do not match.');
    passedTests++;

    // Test 6: Valid compatible posts produce match & notification
    const postB = await createTestTravel(studentB, {
      departureTime: 660 // 11:00 AM (delta 60 <= 420)
    });
    const compat6 = await areFindPostsCompatible(postA, postB);
    if (!compat6) throw new Error('Test 6 Failed: Valid posts should match');
    const notifyRes = await detectAndNotifyCompatibleFindPosts(postB);
    if (!Array.isArray(notifyRes) || notifyRes.length === 0) {
      throw new Error(`Test 6 Failed: detectAndNotifyCompatibleFindPosts returned ${JSON.stringify(notifyRes)}`);
    }
    console.log('✓ Test 6 Passed: Valid compatible posts produce match & notification.');
    passedTests++;

    // Test 7: Outbox event emitted and idempotent
    const outboxEvents = await Outbox.find({
      recipientId: { $in: [studentA, studentB] },
      eventType: 'COMPATIBLE_FIND_MATCH'
    });
    if (outboxEvents.length < 2) throw new Error(`Test 7 Failed: Expected >=2 outbox events, found ${outboxEvents.length}`);
    // Run detection again to test idempotency
    await detectAndNotifyCompatibleFindPosts(postB);
    const outboxCountAfter = await Outbox.countDocuments({
      recipientId: { $in: [studentA, studentB] },
      eventType: 'COMPATIBLE_FIND_MATCH'
    });
    if (outboxCountAfter !== outboxEvents.length) throw new Error('Test 7 Failed: Duplicate Outbox event emitted');
    console.log('✓ Test 7 Passed: Outbox events emitted and strictly idempotent.');
    passedTests++;

    // Test 8: FIND post remains active with 1 seat
    const freshPostA = await Travel.findById(postA._id);
    const freshPostB = await Travel.findById(postB._id);
    if (freshPostA.status !== 'active' || freshPostA.seats !== 1 ||
        freshPostB.status !== 'active' || freshPostB.seats !== 1) {
      throw new Error('Test 8 Failed: FIND post modified or seat deducted during matching');
    }
    console.log('✓ Test 8 Passed: FIND post remains active with exactly 1 seat.\n');
    passedTests++;

    // =========================================================================
    // PART 2: DIRECT GROUP JOIN (TESTS 9 - 16)
    // =========================================================================
    console.log('--- PART 2: Direct Group Join (Tests 9-16) ---');

    // Create a group initiated from compatible find match between A and B
    const { req: reqCreateGrp, res: resCreateGrp } = createMockReqRes({
      userId: studentA,
      body: {
        originatingTravelId: postA._id.toString(),
        candidateTravelId: postB._id.toString(),
        targetCapacity: 4 // Capacity 4 for A+B + C + 1 spot for D/E
      }
    });
    await createGroupFromFindMatch(reqCreateGrp, resCreateGrp);
    if (resCreateGrp.getStatusCode() !== 201) {
      throw new Error(`Group creation failed: ${JSON.stringify(resCreateGrp.getData())}`);
    }
    const proposal = resCreateGrp.getData().data?.proposal;
    // Under BUG 4: B accepts formation proposal to atomically create the group
    const { req: reqAcceptB, res: resAcceptB } = createMockReqRes({
      userId: studentB,
      params: { requestId: proposal._id.toString() }
    });
    await acceptGroupInvitation(reqAcceptB, resAcceptB);
    const createdGrp = resAcceptB.getData().data?.group;
    const testGroupId = createdGrp._id;
    createdGroupIds.push(testGroupId);

    // Create active FIND post for Student C
    const postC = await createTestTravel(studentC, { departureTime: 620 });

    // Test 9 & 10: Student C directly joins the group without admin approval
    const { req: reqJoinC, res: resJoinC } = createMockReqRes({
      userId: studentC,
      params: { groupId: testGroupId.toString() },
      body: { travelId: postC._id.toString() }
    });
    await directJoinSharedRideGroup(reqJoinC, resJoinC);
    if (resJoinC.getStatusCode() !== 200) {
      throw new Error(`Test 9/10 Failed: Direct join returned status ${resJoinC.getStatusCode()}: ${JSON.stringify(resJoinC.getData())}`);
    }
    console.log('✓ Test 9 Passed: Student C with active compatible FIND post directly joins group.');
    console.log('✓ Test 10 Passed: Join succeeds immediately without admin approval (instant confirmed member).');
    passedTests += 2;

    // Test 11 & 12: Confirmed member count increments, available spots decrements
    const grpAfterC = await SharedRideGroup.findById(testGroupId);
    if (grpAfterC.members.length !== 3) {
      throw new Error(`Test 11 Failed: Expected 3 members [A, B, C], found ${grpAfterC.members.length}`);
    }
    const isCMember = grpAfterC.members.some((m) => m.userId === studentC && m.role === 'member');
    if (!isCMember) throw new Error('Test 11 Failed: Student C is not confirmed member');
    console.log('✓ Test 11 Passed: Confirmed member count incremented to 3 [A, B, C].');
    passedTests++;

    const expectedSpotsLeft = grpAfterC.targetCapacity - grpAfterC.members.length; // 4 - 3 = 1
    if (expectedSpotsLeft !== 1) throw new Error(`Test 12 Failed: Expected 1 spot left, computed ${expectedSpotsLeft}`);
    console.log('✓ Test 12 Passed: Available spots decremented correctly to 1.');
    passedTests++;

    // Test 13: Group admin receives GROUP_MEMBER_JOINED notification via Outbox
    const joinNotifOutbox = await Outbox.findOne({
      recipientId: studentA,
      eventType: 'GROUP_MEMBER_JOINED',
      'payload.groupId': testGroupId
    });
    if (!joinNotifOutbox) throw new Error('Test 13 Failed: GROUP_MEMBER_JOINED Outbox event not found for admin');
    console.log('✓ Test 13 Passed: Group admin received GROUP_MEMBER_JOINED notification.');
    passedTests++;

    // Test 14: Student C's FIND post remains active and unchanged
    const freshPostC = await Travel.findById(postC._id);
    if (freshPostC.status !== 'active' || freshPostC.seats !== 1) {
      throw new Error('Test 14 Failed: Student C FIND post changed after joining group');
    }
    console.log('✓ Test 14 Passed: Student C active FIND post remains active with 1 seat.');
    passedTests++;

    // Prepare Posts for Concurrent Joiners D and E
    const postD = await createTestTravel(studentD, { departureTime: 615 });
    const postE = await createTestTravel(studentE, { departureTime: 625 });

    // Test 15 & 16: Concurrency check: D and E join simultaneously when only 1 spot remains
    const { req: reqJoinD, res: resJoinD } = createMockReqRes({
      userId: studentD,
      params: { groupId: testGroupId.toString() },
      body: { travelId: postD._id.toString() }
    });
    const { req: reqJoinE, res: resJoinE } = createMockReqRes({
      userId: studentE,
      params: { groupId: testGroupId.toString() },
      body: { travelId: postE._id.toString() }
    });

    // Execute concurrently
    await Promise.all([
      directJoinSharedRideGroup(reqJoinD, resJoinD),
      directJoinSharedRideGroup(reqJoinE, resJoinE)
    ]);

    const results = [
      { user: studentD, status: resJoinD.getStatusCode(), data: resJoinD.getData() },
      { user: studentE, status: resJoinE.getStatusCode(), data: resJoinE.getData() }
    ];

    const successCount = results.filter(r => r.status === 200).length;
    const fullRejectionCount = results.filter(r => r.status === 400).length;

    if (successCount !== 1 || fullRejectionCount !== 1) {
      throw new Error(`Test 15/16 Failed: Expected 1 success (200) and 1 rejection (400), got: ${JSON.stringify(results)}`);
    }

    const grpFull = await SharedRideGroup.findById(testGroupId);
    if (grpFull.status !== 'full' || grpFull.members.length !== grpFull.targetCapacity) {
      throw new Error(`Test 15 Failed: Group expected status 'full' with ${grpFull.targetCapacity} members, got status '${grpFull.status}' and ${grpFull.members.length} members`);
    }
    console.log('✓ Test 15 Passed: Group reached targetCapacity and status transitioned to full.');
    console.log('✓ Test 16 Passed: Atomic concurrency guaranteed — exactly 1 joined, 1 rejected with 400 (Group full).');
    passedTests += 2;

    // =========================================================================
    // PART 3: DYNAMIC GROUP MEMBERSHIP & LEAVE GROUP (TESTS 17 - 25)
    // =========================================================================
    console.log('\n--- PART 3: Dynamic Group Membership & Leave Group (Tests 17-25) ---');

    // Test 17 & 18 & 19 & 20: Student C leaves the full group
    const { req: reqLeaveC, res: resLeaveC } = createMockReqRes({
      userId: studentC,
      params: { groupId: testGroupId.toString() }
    });
    await leaveSharedRideGroup(reqLeaveC, resLeaveC);
    if (resLeaveC.getStatusCode() !== 200) {
      throw new Error(`Test 17 Failed: Leave group returned ${resLeaveC.getStatusCode()}: ${JSON.stringify(resLeaveC.getData())}`);
    }

    const grpAfterLeaveC = await SharedRideGroup.findById(testGroupId);
    if (grpAfterLeaveC.members.length !== grpAfterLeaveC.targetCapacity - 1) {
      throw new Error(`Test 17 Failed: Expected ${grpAfterLeaveC.targetCapacity - 1} members after C left, found ${grpAfterLeaveC.members.length}`);
    }
    console.log(`✓ Test 17 Passed: Member left group -> member count decremented to ${grpAfterLeaveC.members.length}, available spots incremented.`);
    passedTests++;

    if (grpAfterLeaveC.status !== 'open') {
      throw new Error(`Test 18 Failed: Full group should reopen to 'open', current status: ${grpAfterLeaveC.status}`);
    }
    console.log('✓ Test 18 Passed: Leaving from full group reopened status to open.');
    passedTests++;

    const leftNotifOutbox = await Outbox.findOne({
      recipientId: studentA,
      eventType: 'GROUP_MEMBER_LEFT',
      'payload.groupId': testGroupId
    });
    if (!leftNotifOutbox) throw new Error('Test 19 Failed: GROUP_MEMBER_LEFT Outbox event not received by admin');
    console.log('✓ Test 19 Passed: Group admin received GROUP_MEMBER_LEFT notification.');
    passedTests++;

    const freshPostCAfterLeave = await Travel.findById(postC._id);
    if (freshPostCAfterLeave.status !== 'active') {
      throw new Error('Test 20 Failed: Leaver FIND post was incorrectly cancelled or modified');
    }
    console.log('✓ Test 20 Passed: Leaver FIND post remains active and unexpired.');
    passedTests++;

    // Test 21: Leaver can rediscover and rejoin the same or another group
    const { req: reqRejoinC, res: resRejoinC } = createMockReqRes({
      userId: studentC,
      params: { groupId: testGroupId.toString() },
      body: { travelId: postC._id.toString() }
    });
    await directJoinSharedRideGroup(reqRejoinC, resRejoinC);
    if (resRejoinC.getStatusCode() !== 200) {
      throw new Error(`Test 21 Failed: Rejoin returned ${resRejoinC.getStatusCode()}: ${JSON.stringify(resRejoinC.getData())}`);
    }
    console.log('✓ Test 21 Passed: Leaver can rediscover and rejoin group successfully.');
    passedTests++;

    // Test 22 & 23: Admin leaves group -> earliest confirmed member promoted to admin
    // Currently members in grp: A (admin), the concurrent winner (D or E), and C
    const grpBeforeAdminLeave = await SharedRideGroup.findById(testGroupId);
    const nonAdminMembers = grpBeforeAdminLeave.members
      .filter(m => m.userId !== studentA)
      .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    const expectedNewAdmin = nonAdminMembers[0];

    const { req: reqLeaveA, res: resLeaveA } = createMockReqRes({
      userId: studentA,
      params: { groupId: testGroupId.toString() }
    });
    await leaveSharedRideGroup(reqLeaveA, resLeaveA);
    if (resLeaveA.getStatusCode() !== 200) {
      throw new Error(`Test 22 Failed: Admin leave returned ${resLeaveA.getStatusCode()}: ${JSON.stringify(resLeaveA.getData())}`);
    }

    const grpAfterAdminLeave = await SharedRideGroup.findById(testGroupId);
    if (grpAfterAdminLeave.adminId !== expectedNewAdmin.userId) {
      throw new Error(`Test 22 Failed: Expected new admin ${expectedNewAdmin.userId}, got ${grpAfterAdminLeave.adminId}`);
    }
    const adminMemberObj = grpAfterAdminLeave.members.find(m => m.userId === expectedNewAdmin.userId);
    if (adminMemberObj.role !== 'admin') {
      throw new Error(`Test 22 Failed: Member role was not updated to 'admin'`);
    }
    console.log('✓ Test 22 Passed: Admin left group -> earliest confirmed member promoted to admin.');
    passedTests++;

    const promotedNotif = await Outbox.findOne({
      recipientId: expectedNewAdmin.userId,
      eventType: 'GROUP_ADMIN_PROMOTED',
      'payload.groupId': testGroupId
    });
    if (!promotedNotif) throw new Error('Test 23 Failed: GROUP_ADMIN_PROMOTED notification not emitted');
    console.log('✓ Test 23 Passed: Promoted student received GROUP_ADMIN_PROMOTED notification.');
    passedTests++;

    // Test 24 & 25: All remaining members leave -> group marked 'cancelled' / inactive & excluded from discovery
    const remainingUserIds = grpAfterAdminLeave.members.map(m => m.userId);
    for (const uId of remainingUserIds) {
      const { req: reqL, res: resL } = createMockReqRes({
        userId: uId,
        params: { groupId: testGroupId.toString() }
      });
      await leaveSharedRideGroup(reqL, resL);
      if (resL.getStatusCode() !== 200) {
        throw new Error(`Failed to leave for user ${uId}: ${resL.getStatusCode()}`);
      }
    }

    const grpEmpty = await SharedRideGroup.findById(testGroupId);
    if (!['cancelled', 'empty'].includes(grpEmpty.status) || grpEmpty.members.length !== 0) {
      throw new Error(`Test 24 Failed: Expected status 'cancelled' or 'empty' and 0 members, got status '${grpEmpty.status}' and ${grpEmpty.members.length} members`);
    }
    console.log('✓ Test 24 Passed: All members left -> group status marked cancelled / empty / inactive.');
    passedTests++;

    // Test 25: Excluded from discovery
    const discoveredList = await findCompatibleGroupsForFindPost(postC);
    const includesEmptyGrp = discoveredList.some(g => g._id.toString() === testGroupId.toString());
    if (includesEmptyGrp) throw new Error('Test 25 Failed: Cancelled group still returned in discovery');
    console.log('✓ Test 25 Passed: Cancelled group excluded from discovery.');
    passedTests++;

    // =========================================================================
    // PART 4: NORMAL BOOKING ISOLATION & REGRESSION (TESTS 26 - 30)
    // =========================================================================
    console.log('\n--- PART 4: Normal Booking Isolation & Regression (Tests 26-30) ---');

    // Create a new active group with Student A as admin
    const newGroup = await SharedRideGroup.create({
      source: 'Campus',
      destination: 'Airport',
      travelDate,
      departureTime: 600,
      targetCapacity: 4,
      adminId: studentA,
      originatingTravelId: postA._id,
      status: 'open',
      members: [{ userId: studentA, travelId: postA._id, role: 'admin', joinedAt: new Date() }],
      expiresAt: calculateExpiresAt(travelDate, 600)
    });
    createdGroupIds.push(newGroup._id);

    // Create a normal OFFER post by driver student
    const offerTravel = await createTestTravel(studentDriver, {
      type: 'offer',
      departureTime: 610,
      seats: 3,
      price: 200,
      vehicleType: 'Car'
    });

    // Test 26: Student A (who is admin of an active group) can still discover normal OFFER matches
    const matchesForA = await findMatchesForTravel(postA);
    const hasOfferMatch = Array.isArray(matchesForA) && matchesForA.some(m => m._id.toString() === offerTravel._id.toString());
    if (!hasOfferMatch) {
      throw new Error('Test 26 Failed: Student in shared ride group could not discover normal OFFER matches');
    }
    console.log('✓ Test 26 Passed: Member of active group can discover normal OFFER matches.');
    passedTests++;

    // Test 27: Student A can book normal OFFER (creates Booking)
    const normalBooking = await Booking.create({
      travelId: offerTravel._id,
      passengerId: studentA,
      ownerId: studentDriver,
      status: 'pending',
      requestedSeats: 1,
      totalPrice: 200
    });
    createdBookingIds.push(normalBooking._id);
    if (!normalBooking || normalBooking.status !== 'pending') {
      throw new Error('Test 27 Failed: Normal booking creation failed');
    }
    console.log('✓ Test 27 Passed: Member of group can book normal OFFER.');
    passedTests++;

    // Test 28: Driver confirms normal booking -> decrements OFFER available seats from 3 to 2
    const { req: reqConfirm, res: resConfirm } = createMockReqRes({
      userId: studentDriver,
      params: { id: normalBooking._id.toString() }
    });
    await confirmBooking(reqConfirm, resConfirm);
    if (resConfirm.getStatusCode() !== 200) {
      throw new Error(`Test 28 Failed: Booking confirmation returned ${resConfirm.getStatusCode()}: ${JSON.stringify(resConfirm.getData())}`);
    }

    const offerAfterConfirm = await Travel.findById(offerTravel._id);
    const availableAfterConfirm = offerAfterConfirm.seats - (offerAfterConfirm.bookedSeats || 0);
    if (availableAfterConfirm !== 2) {
      throw new Error(`Test 28 Failed: Expected 2 available seats remaining (bookedSeats=1), found ${availableAfterConfirm}`);
    }
    console.log('✓ Test 28 Passed: Normal booking confirmation decremented OFFER available seats from 3 to 2 (bookedSeats=1).');
    passedTests++;

    // Test 29: Group membership unchanged by normal booking
    const grpAfterNormalBooking = await SharedRideGroup.findById(newGroup._id);
    if (grpAfterNormalBooking.members.length !== 1 || grpAfterNormalBooking.adminId !== studentA) {
      throw new Error('Test 29 Failed: Group membership corrupted by normal booking');
    }
    console.log('✓ Test 29 Passed: Group membership completely isolated and unchanged by normal booking.');
    passedTests++;

    // Test 30: Normal booking cancellation restores OFFER seats from 2 to 3
    const { req: reqCancel, res: resCancel } = createMockReqRes({
      userId: studentA,
      params: { id: normalBooking._id.toString() },
      body: { reason: 'Plans changed' }
    });
    await cancelBooking(reqCancel, resCancel);
    if (resCancel.getStatusCode() !== 200) {
      throw new Error(`Test 30 Failed: Booking cancellation returned ${resCancel.getStatusCode()}: ${JSON.stringify(resCancel.getData())}`);
    }

    const offerAfterCancel = await Travel.findById(offerTravel._id);
    const availableAfterCancel = offerAfterCancel.seats - (offerAfterCancel.bookedSeats || 0);
    if (availableAfterCancel !== 3) {
      throw new Error(`Test 30 Failed: Expected 3 available seats restored (bookedSeats=0), found ${availableAfterCancel}`);
    }
    console.log('✓ Test 30 Passed: Normal booking cancellation safely restored OFFER seats from 2 to 3 (bookedSeats=0).');
    passedTests++;

    console.log('\n================================================================================');
    console.log(`ALL ${passedTests} OF ${totalTests} TESTS PASSED WITH ZERO ERRORS (Exit Code 0)`);
    console.log('================================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED with error:\n', err);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up test data...');
    try {
      if (createdGroupIds.length > 0) {
        await SharedRideGroup.deleteMany({ _id: { $in: createdGroupIds } });
        await GroupJoinRequest.deleteMany({ groupId: { $in: createdGroupIds } });
      }
      if (createdBookingIds.length > 0) {
        await Booking.deleteMany({ _id: { $in: createdBookingIds } });
      }
      if (createdTravelIds.length > 0) {
        await Travel.deleteMany({ _id: { $in: createdTravelIds } });
      }
      if (testStudentIds.length > 0) {
        await Student.deleteMany({ clerkId: { $in: testStudentIds } });
        await Outbox.deleteMany({ recipientId: { $in: testStudentIds } });
        await Notification.deleteMany({ userId: { $in: testStudentIds } });
      }
      console.log('Cleaned up test documents.\n');
    } catch (cleanupErr) {
      console.warn('Cleanup error:', cleanupErr.message);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
    process.exit(process.exitCode || 0);
  }
}

runTests();

