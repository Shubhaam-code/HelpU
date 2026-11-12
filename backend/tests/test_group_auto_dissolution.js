import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import Travel, { calculateExpiresAt } from '../src/models/Travel.js';
import Student from '../src/models/Student.js';
import Outbox from '../src/models/Outbox.js';
import {
  createGroupFromFindMatch,
  leaveSharedRideGroup,
  getSharedRideGroupById
} from '../src/controllers/group.controller.js';
import { getActiveGroupedUserIds } from '../src/services/matching.service.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

function mockReqRes({ params = {}, body = {}, query = {}, userId = 'test_user_id' } = {}) {
  const req = {
    params,
    body,
    query,
    userId,
    headers: {}
  };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return { req, res };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('\n================================================================');
  console.log('TEST: GROUP AUTO-DISSOLUTION WHEN ONLY 1 MEMBER REMAINS');
  console.log('================================================================\n');

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const testSuffix = Date.now();
  const uidA = `fb_test_auto_diss_A_${testSuffix}`;
  const uidB = `fb_test_auto_diss_B_${testSuffix}`;
  const uidC = `fb_test_auto_diss_C_${testSuffix}`;

  const cleanups = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create 3 test students
    // -------------------------------------------------------------------------
    console.log('--- Setup: Creating Test Students ---');
    const studentA = await Student.create({
      clerkId: uidA,
      name: 'Alice Auto-Test',
      email: `alice_${testSuffix}@test.com`,
      whatsappNumber: '919876543210',
      college: 'Test College',
      isVerified: true
    });
    cleanups.push(() => Student.findByIdAndDelete(studentA._id));

    const studentB = await Student.create({
      clerkId: uidB,
      name: 'Bob Auto-Test',
      email: `bob_${testSuffix}@test.com`,
      whatsappNumber: '919876543211',
      college: 'Test College',
      isVerified: true
    });
    cleanups.push(() => Student.findByIdAndDelete(studentB._id));

    const studentC = await Student.create({
      clerkId: uidC,
      name: 'Charlie Auto-Test',
      email: `charlie_${testSuffix}@test.com`,
      whatsappNumber: '919876543212',
      college: 'Test College',
      isVerified: true
    });
    cleanups.push(() => Student.findByIdAndDelete(studentC._id));

    console.log('  ✓ Created 3 test students\n');

    // -------------------------------------------------------------------------
    // STEP 1: Create travel posts for all 3 students
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Create Travel Posts ---');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const travelA = await Travel.create({
      userId: uidA,
      authorName: studentA.name,
      type: 'request',
      source: 'Campus Main Gate',
      destination: 'City Center',
      travelDate: tomorrow,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      availableSeats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(tomorrow, 600)
    });
    cleanups.push(() => Travel.findByIdAndDelete(travelA._id));

    const travelB = await Travel.create({
      userId: uidB,
      authorName: studentB.name,
      type: 'request',
      source: 'Campus Main Gate',
      destination: 'City Center',
      travelDate: tomorrow,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      availableSeats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(tomorrow, 600)
    });
    cleanups.push(() => Travel.findByIdAndDelete(travelB._id));

    const travelC = await Travel.create({
      userId: uidC,
      authorName: studentC.name,
      type: 'request',
      source: 'Campus Main Gate',
      destination: 'City Center',
      travelDate: tomorrow,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      availableSeats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(tomorrow, 600)
    });
    cleanups.push(() => Travel.findByIdAndDelete(travelC._id));

    console.log('  ✓ Created 3 travel posts\n');

    // -------------------------------------------------------------------------
    // STEP 2: Create 3-member group (A + B + C)
    // -------------------------------------------------------------------------
    console.log('--- Step 2: Create 3-Member Group ---');
    const { req: createReq, res: createRes } = mockReqRes({
      userId: uidA,
      body: {
        originatingTravelId: travelA._id,
        candidateTravelId: travelB._id,
        targetCapacity: 4
      }
    });
    await createGroupFromFindMatch(createReq, createRes);
    assert(createRes.statusCode === 201, 'Group proposal created');

    const proposalId = createRes.data?.data?.proposal?._id;
    cleanups.push(() => GroupJoinRequest.findByIdAndDelete(proposalId));

    // B accepts proposal
    const { req: acceptReq, res: acceptRes } = mockReqRes({
      userId: uidB,
      params: { requestId: proposalId.toString() }
    });
    const acceptGroupInvitation = (await import('../src/controllers/group.controller.js')).acceptGroupInvitation;
    await acceptGroupInvitation(acceptReq, acceptRes);
    
    const groupId = acceptRes.data?.data?.group?._id;
    assert(groupId, 'Group created');
    cleanups.push(() => SharedRideGroup.findByIdAndDelete(groupId));

    // C joins the group
    const joinReqC = await GroupJoinRequest.create({
      groupId,
      requesterId: uidC,
      requesterTravelId: travelC._id,
      senderId: uidC,
      senderTravelId: travelC._id,
      recipientId: uidA,
      type: 'join_request',
      status: 'pending',
      message: 'Let me join!'
    });
    cleanups.push(() => GroupJoinRequest.findByIdAndDelete(joinReqC._id));

    const { req: approveReq, res: approveRes } = mockReqRes({
      userId: uidA,
      params: { groupId: groupId.toString(), requestId: joinReqC._id.toString() }
    });
    const acceptStudentJoinRequest = (await import('../src/controllers/group.controller.js')).acceptStudentJoinRequest;
    await acceptStudentJoinRequest(approveReq, approveRes);

    // Verify 3 members
    const group3 = await SharedRideGroup.findById(groupId);
    assert(group3.members.length === 3, 'Group has 3 members');
    assert(group3.status === 'open', 'Group status is open');
    console.log('  ✓ 3-member group created successfully\n');

    // -------------------------------------------------------------------------
    // TEST CASE 1: 3 → 2 members (group stays active)
    // -------------------------------------------------------------------------
    console.log('--- Test Case 1: One Member Leaves (3 → 2) ---');
    const { req: leaveCReq, res: leaveCRes } = mockReqRes({
      userId: uidC,
      params: { groupId: groupId.toString() }
    });
    await leaveSharedRideGroup(leaveCReq, leaveCRes);
    
    assert(leaveCRes.statusCode === 200, 'C left successfully');
    const group2 = await SharedRideGroup.findById(groupId);
    assert(group2.members.length === 2, 'Group now has 2 members');
    assert(group2.status === 'open', 'Group status still open (2 members)');
    console.log('  ✓ Group remains active with 2 members\n');

    // -------------------------------------------------------------------------
    // TEST CASE 2: 2 → 1 member (AUTO-DISSOLUTION)
    // -------------------------------------------------------------------------
    console.log('--- Test Case 2: One More Leaves (2 → 1 = AUTO-DISSOLVE) ---');
    const { req: leaveBReq, res: leaveBRes } = mockReqRes({
      userId: uidB,
      params: { groupId: groupId.toString() }
    });
    await leaveSharedRideGroup(leaveBReq, leaveBRes);
    
    assert(leaveBRes.statusCode === 200, 'B left successfully');
    const group1 = await SharedRideGroup.findById(groupId);
    assert(group1.members.length === 1, 'Group now has 1 member');
    assert(group1.status === 'empty', 'Group automatically dissolved (status=empty)!');
    console.log('  ✓ Group automatically dissolved when 1 member remained\n');

    // -------------------------------------------------------------------------
    // TEST CASE 3: Verify dissolution notification was created
    // -------------------------------------------------------------------------
    console.log('--- Test Case 3: Verify Dissolution Notification ---');
    const notification = await Outbox.findOne({
      eventType: 'GROUP_CLOSED',
      recipientId: uidA,
      'payload.reason': 'auto_dissolution'
    }).lean();
    
    assert(notification, 'Dissolution notification created');
    assert(notification.payload.message.includes('ended because all other members have left'), 'Notification has correct message');
    cleanups.push(() => Outbox.findByIdAndDelete(notification._id));
    console.log('  ✓ Notification sent to remaining member\n');

    // -------------------------------------------------------------------------
    // TEST CASE 4: Verify dissolved group excluded from active queries
    // -------------------------------------------------------------------------
    console.log('--- Test Case 4: Verify Matching Eligibility Restored ---');
    const activeGroupedUsers = await getActiveGroupedUserIds();
    assert(!activeGroupedUsers.has(uidA), 'User A no longer in active groups');
    assert(!activeGroupedUsers.has(uidB), 'User B no longer in active groups');
    assert(!activeGroupedUsers.has(uidC), 'User C no longer in active groups');
    console.log('  ✓ All users can now match individually again\n');

    // -------------------------------------------------------------------------
    // TEST CASE 5: Verify group not visible to members
    // -------------------------------------------------------------------------
    console.log('--- Test Case 5: Verify Dissolved Group Not Active ---');
    const { req: getGroupReq, res: getGroupRes } = mockReqRes({
      userId: uidA,
      params: { id: groupId.toString() }
    });
    await getSharedRideGroupById(getGroupReq, getGroupRes);
    
    const groupData = getGroupRes.data?.data;
    assert(groupData.status === 'empty', 'Group status is empty (dissolved)');
    console.log('  ✓ Group details show empty/dissolved status\n');

    // -------------------------------------------------------------------------
    // TEST CASE 6: Verify historical data preserved
    // -------------------------------------------------------------------------
    console.log('--- Test Case 6: Verify Historical Data Preserved ---');
    assert(group1._id.equals(groupId), 'Group document still exists');
    assert(group1.source === 'Campus Main Gate', 'Group route preserved');
    assert(group1.destination === 'City Center', 'Group destination preserved');
    console.log('  ✓ Historical group data preserved\n');

    console.log('================================================================');
    console.log('🎉 ALL AUTO-DISSOLUTION TESTS PASSED!');
    console.log('================================================================\n');

  } finally {
    console.log('Cleaning up test documents...');
    for (const clean of cleanups) {
      try {
        await clean();
      } catch (err) {
        // ignore cleanup errors
      }
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
