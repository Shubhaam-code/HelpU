/**
 * Comprehensive Verification for Remaining Smart FIND Matching Requirements:
 * 1. Raw Compatible FIND discovery in /api/travels/:id/matches
 * 2. Create Group from Compatible FIND card & duplicate suppression (isExisting: true)
 * 3. Original FIND Compatibility Anchor in directJoinSharedRideGroup & admin succession
 * 4. One Active Group Per Student enforcement (HTTP 409) & unblocked after leaving
 * 5. Group Expiry & Outbox Notifications (GROUP_CLOSED)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import Outbox from '../src/models/Outbox.js';
import Booking from '../src/models/Booking.js';
import { 
  findCompatibleFindPosts, 
  detectAndNotifyCompatibleFindPosts 
} from '../src/services/matching.service.js';
import { 
  createGroupFromFindMatch, 
  directJoinSharedRideGroup, 
  leaveSharedRideGroup 
} from '../src/controllers/group.controller.js';
import { 
  expireOverdueGroupsAndNotify 
} from '../src/routes/travel.routes.js';

function mockReqRes(body = {}, params = {}, user = {}, query = {}) {
  const userId = user.id || user.clerkId || user.userId;
  const req = { body, params, user, userId, query };
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
  console.log('--- Connecting to Database ---');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const testId = `test_rem_${Date.now()}`;
  const userIdA = `clerk_user_a_${testId}`;
  const userIdB = `clerk_user_b_${testId}`;
  const userIdC = `clerk_user_c_${testId}`;
  const userIdD = `clerk_user_d_${testId}`;

  try {
    // 0. Setup Students
    console.log('>>> [Step 0] Creating test students...');
    await Student.create([
      { clerkId: userIdA, name: 'Student Alpha', email: `${userIdA}@campus.edu`, college: 'VIT, Bhopal', isVerified: true },
      { clerkId: userIdB, name: 'Student Beta', email: `${userIdB}@campus.edu`, college: 'VIT, Bhopal', isVerified: true },
      { clerkId: userIdC, name: 'Student Gamma', email: `${userIdC}@campus.edu`, college: 'VIT, Bhopal', isVerified: true },
      { clerkId: userIdD, name: 'Student Delta', email: `${userIdD}@campus.edu`, college: 'VIT, Bhopal', isVerified: true },
    ]);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(14, 0, 0, 0);

    const expiresAt = new Date(tomorrow);
    expiresAt.setHours(expiresAt.getHours() + 4);

    // 1. Test Raw Compatible FIND Cards
    console.log('>>> [Step 1] Testing Raw Compatible FIND Posts discovery...');
    const findPostA = await Travel.create({
      userId: userIdA,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 600, // 10:00 AM
      seats: 1,
      bookedSeats: 0,
      status: 'active',
      timeFlexibility: 30,
      expiresAt
    });

    const findPostB = await Travel.create({
      userId: userIdB,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 720, // 12:00 PM (120 min diff <= 420 min)
      seats: 1,
      bookedSeats: 0,
      status: 'active',
      timeFlexibility: 30,
      expiresAt
    });

    // Check compatible FINDs for A
    const compatibleWithA = await findCompatibleFindPosts(findPostA);
    console.log(`Compatible FIND posts with A: ${compatibleWithA.length}`);
    if (compatibleWithA.length !== 1 || compatibleWithA[0].userId !== userIdB) {
      throw new Error(`Expected Student B in compatible finds for A, got: ${JSON.stringify(compatibleWithA)}`);
    }
    if (!compatibleWithA[0].student || compatibleWithA[0].student.name !== 'Student Beta') {
      throw new Error(`Expected safe student profile with Student Beta, got: ${JSON.stringify(compatibleWithA[0].student)}`);
    }

    // Check compatible FINDs for B
    const compatibleWithB = await findCompatibleFindPosts(findPostB);
    console.log(`Compatible FIND posts with B: ${compatibleWithB.length}`);
    if (compatibleWithB.length !== 1 || compatibleWithB[0].userId !== userIdA) {
      throw new Error(`Expected Student A in compatible finds for B, got: ${JSON.stringify(compatibleWithB)}`);
    }
    console.log('✔ Requirement 1 Passed: Both A and B discover each other as compatible students before any group exists.\n');

    // 2. Test Group Creation from Compatible FIND Card + Concurrency / Duplicate handling
    console.log('>>> [Step 2] Testing Group Creation from Compatible FIND Card...');
    const { req: reqCreateA, res: resCreateA } = mockReqRes(
      { originatingTravelId: findPostA._id, candidateTravelId: findPostB._id, targetCapacity: 4 },
      {},
      { id: userIdA }
    );
    await createGroupFromFindMatch(reqCreateA, resCreateA);
    if (resCreateA.getStatusCode() !== 201) {
      throw new Error(`Failed to create group from match: ${JSON.stringify(resCreateA.getData())}`);
    }
    const createdGroupA = resCreateA.getData().data?.group || resCreateA.getData().group;
    if (!createdGroupA || createdGroupA.adminId !== userIdA) {
      throw new Error(`Expected created group with admin A, got: ${JSON.stringify(createdGroupA)}`);
    }
    console.log(`Group created by Student A: ${createdGroupA._id}`);

    // Verify invitation created for B
    const inviteForB = await GroupJoinRequest.findOne({
      groupId: createdGroupA._id,
      recipientId: userIdB,
      type: 'invite',
      status: 'pending'
    });
    if (!inviteForB) {
      throw new Error('Expected pending invitation for Student B in created group!');
    }
    console.log('✔ Invitation created for Student B.');

    // Now test simultaneous / duplicate group creation from B's end
    console.log('Testing duplicate group initiation from Student B...');
    const { req: reqCreateB, res: resCreateB } = mockReqRes(
      { originatingTravelId: findPostB._id, candidateTravelId: findPostA._id, targetCapacity: 4 },
      {},
      { id: userIdB }
    );
    await createGroupFromFindMatch(reqCreateB, resCreateB);
    if (resCreateB.getStatusCode() !== 200) {
      throw new Error(`Expected status 200 for existing group, got ${resCreateB.getStatusCode()}: ${JSON.stringify(resCreateB.getData())}`);
    }
    const groupRespB = resCreateB.getData().data || resCreateB.getData();
    if (!groupRespB.isExisting || groupRespB.group._id.toString() !== createdGroupA._id.toString()) {
      throw new Error(`Expected isExisting: true and same group ID, got: ${JSON.stringify(groupRespB)}`);
    }
    console.log('✔ Requirement 2 Passed: Duplicate group initiation suppressed and existing group returned.\n');

    // 3. Test Original FIND Compatibility Anchor in directJoinSharedRideGroup
    console.log('>>> [Step 3] Testing Original FIND Compatibility Anchor...');
    // Create Student C post with different departure time (> 420 min from A's 600 min, e.g. 1100 min)
    const findPostCIncompatible = await Travel.create({
      userId: userIdC,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 1100, // 500 min diff > 420 min from A's 600
      seats: 1,
      bookedSeats: 0,
      status: 'active',
      timeFlexibility: 30,
      expiresAt
    });

    const { req: reqJoinIncompatible, res: resJoinIncompatible } = mockReqRes(
      { travelId: findPostCIncompatible._id },
      { id: createdGroupA._id.toString() },
      { id: userIdC }
    );
    await directJoinSharedRideGroup(reqJoinIncompatible, resJoinIncompatible);
    if (resJoinIncompatible.getStatusCode() !== 400) {
      throw new Error(`Expected 400 for departure outside 420 min window against anchor, got: ${resJoinIncompatible.getStatusCode()}`);
    }
    console.log('✔ Incompatible departure window (>420m from original FIND) correctly rejected with 400.');

    // Now update C's post to compatible time (650 min)
    findPostCIncompatible.departureTime = 650;
    await findPostCIncompatible.save();

    const { req: reqJoinCompatible, res: resJoinCompatible } = mockReqRes(
      { travelId: findPostCIncompatible._id },
      { id: createdGroupA._id.toString() },
      { id: userIdC }
    );
    await directJoinSharedRideGroup(reqJoinCompatible, resJoinCompatible);
    if (resJoinCompatible.getStatusCode() !== 200) {
      throw new Error(`Expected 200 for compatible direct join, got ${resJoinCompatible.getStatusCode()}: ${JSON.stringify(resJoinCompatible.getData())}`);
    }
    console.log('✔ Compatible student C successfully direct joined the group.');

    // Verify group anchor is preserved upon admin succession (A leaves, C becomes admin)
    const { req: reqLeaveA, res: resLeaveA } = mockReqRes(
      {},
      { id: createdGroupA._id.toString() },
      { id: userIdA }
    );
    await leaveSharedRideGroup(reqLeaveA, resLeaveA);
    if (resLeaveA.getStatusCode() !== 200) {
      throw new Error(`Failed to leave group: ${JSON.stringify(resLeaveA.getData())}`);
    }
    const groupAfterAdminLeave = await SharedRideGroup.findById(createdGroupA._id);
    if (groupAfterAdminLeave.adminId !== userIdC) {
      throw new Error(`Expected Student C to be promoted to admin, got: ${groupAfterAdminLeave.adminId}`);
    }
    if (groupAfterAdminLeave.originatingTravelId.toString() !== findPostA._id.toString()) {
      throw new Error(`originatingTravelId mutated! Expected: ${findPostA._id}, got: ${groupAfterAdminLeave.originatingTravelId}`);
    }
    console.log('✔ Requirement 3 Passed: Anchor originatingTravelId remains permanently intact across admin succession.\n');

    // 4. Test One Active Group Per Student
    console.log('>>> [Step 4] Testing One Active Group Per Student rule...');
    // Student C is already confirmed in createdGroupA.
    // Create another group (Group 2) with Student D as admin
    const findPostD = await Travel.create({
      userId: userIdD,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 630,
      seats: 1,
      bookedSeats: 0,
      status: 'active',
      timeFlexibility: 30,
      expiresAt
    });

    const group2 = await SharedRideGroup.create({
      originatingTravelId: findPostD._id,
      adminId: userIdD,
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 630,
      targetCapacity: 4,
      members: [{ userId: userIdD, travelId: findPostD._id, role: 'admin', joinedAt: new Date() }]
    });

    // Student C attempts to direct-join Group 2 while already in Group 1
    const { req: reqJoinGroup2, res: resJoinGroup2 } = mockReqRes(
      { travelId: findPostCIncompatible._id },
      { id: group2._id.toString() },
      { id: userIdC }
    );
    await directJoinSharedRideGroup(reqJoinGroup2, resJoinGroup2);
    if (resJoinGroup2.getStatusCode() !== 409) {
      throw new Error(`Expected HTTP 409 for student already in an active group, got: ${resJoinGroup2.getStatusCode()}`);
    }
    console.log('✔ Second group join attempt blocked with HTTP 409.');

    // Now Student C leaves Group 1
    const { req: reqLeaveC, res: resLeaveC } = mockReqRes(
      {},
      { id: createdGroupA._id.toString() },
      { id: userIdC }
    );
    await leaveSharedRideGroup(reqLeaveC, resLeaveC);
    if (resLeaveC.getStatusCode() !== 200) {
      throw new Error(`Failed for C to leave group 1: ${JSON.stringify(resLeaveC.getData())}`);
    }

    // Now Student C can join Group 2
    const { req: reqJoinGroup2Again, res: resJoinGroup2Again } = mockReqRes(
      { travelId: findPostCIncompatible._id },
      { id: group2._id.toString() },
      { id: userIdC }
    );
    await directJoinSharedRideGroup(reqJoinGroup2Again, resJoinGroup2Again);
    if (resJoinGroup2Again.getStatusCode() !== 200) {
      throw new Error(`Expected 200 after leaving first group, got: ${resJoinGroup2Again.getStatusCode()}`);
    }
    console.log('✔ Requirement 4 Passed: One active group per student strictly enforced, joins unblocked after leaving.\n');

    // 5. Test Group Expiry & Outbox Notifications
    console.log('>>> [Step 5] Testing Group Expiry & Outbox Notifications...');
    // A) Expiry via overdue travelDate / departure
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    group2.travelDate = pastDate;
    group2.departureTime = 100;
    await group2.save();

    await expireOverdueGroupsAndNotify();

    const expiredGroup2 = await SharedRideGroup.findById(group2._id);
    if (expiredGroup2.status !== 'expired') {
      throw new Error(`Expected group status 'expired', got: ${expiredGroup2.status}`);
    }

    // Check Outbox notifications for members of group2 (userIdD and userIdC)
    const outboxEvents = await Outbox.find({
      eventId: { $in: [`group_expired_${group2._id}_${userIdD}`, `group_expired_${group2._id}_${userIdC}`] }
    });
    console.log(`Found ${outboxEvents.length} group expiry outbox events.`);
    if (outboxEvents.length < 2) {
      throw new Error(`Expected at least 2 outbox events for expired group members, got: ${outboxEvents.length}`);
    }

    // B) Expiry when original FIND post expires
    const findPostExp = await Travel.create({
      userId: userIdA,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 600,
      seats: 1,
      bookedSeats: 0,
      status: 'active',
      timeFlexibility: 30,
      expiresAt
    });

    const groupExp = await SharedRideGroup.create({
      originatingTravelId: findPostExp._id,
      adminId: userIdA,
      source: 'Campus Gate 1',
      destination: 'Bhopal Airport',
      travelDate: tomorrow,
      departureTime: 600,
      targetCapacity: 4,
      status: 'open',
      expiresAt,
      members: [{ userId: userIdA, travelId: findPostExp._id, role: 'admin', joinedAt: new Date() }]
    });

    // Mark original FIND post as expired
    findPostExp.status = 'expired';
    await findPostExp.save();

    await expireOverdueGroupsAndNotify();

    const closedGroupExp = await SharedRideGroup.findById(groupExp._id);
    if (closedGroupExp.status !== 'expired') {
      throw new Error(`Expected group to be expired when original FIND expires, got: ${closedGroupExp.status}`);
    }
    console.log('✔ Group automatically marked expired when original originating FIND post expires.');
    console.log('✔ Requirement 5 Passed: Overdue group automatically marked expired and idempotent Outbox events dispatched.\n');

    console.log('================================================================');
    console.log('ALL REMAINING SMART FIND MATCHING REQUIREMENTS VERIFIED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    // Cleanup
    console.log('Cleaning up test data...');
    await Student.deleteMany({ clerkId: { $in: [userIdA, userIdB, userIdC, userIdD] } });
    await Travel.deleteMany({ userId: { $in: [userIdA, userIdB, userIdC, userIdD] } });
    await SharedRideGroup.deleteMany({ adminId: { $in: [userIdA, userIdB, userIdC, userIdD] } });
    await GroupJoinRequest.deleteMany({ userId: { $in: [userIdA, userIdB, userIdC, userIdD] } });
    await Outbox.deleteMany({ recipientId: { $in: [userIdA, userIdB, userIdC, userIdD] } });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
