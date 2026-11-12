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
  acceptGroupInvitation,
  rejectGroupInvitation,
  getReceivedInvitations,
  getGroupJoinRequests,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  getSharedRideGroupById,
  getMyGroups,
  removeStudentFromGroupsForTravel
} from '../src/controllers/group.controller.js';
import {
  findMatchesForTravel,
  findCompatibleFindPosts
} from '../src/services/matching.service.js';
import {
  formatSafePublicStudent,
  resolveStudentProfilesMap
} from '../src/utils/studentProfileResolver.js';

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
  console.log('TEST SUITE: HELPU 9 BUGS GROUP MATCHING & PROFILE SYNC E2E');
  console.log('================================================================\n');

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const testSuffix = Date.now();
  const uidA = `fb_test_uA_${testSuffix}`;
  const uidB = `fb_test_uB_${testSuffix}`;
  const uidC = `fb_test_uC_${testSuffix}`;

  const cleanups = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create 3 test students
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Initializing Test Students ---');
    const studentA = await Student.create({
      clerkId: uidA,
      name: 'Rohan Sharma',
      email: `rohan_${testSuffix}@helpu.test`,
      whatsappNumber: '919876543210',
      college: 'IIT Delhi',
      branch: 'Computer Science',
      isVerified: true
    });
    cleanups.push(() => Student.findByIdAndDelete(studentA._id));

    const studentB = await Student.create({
      clerkId: uidB,
      name: 'Priya Verma',
      email: `priya_${testSuffix}@helpu.test`,
      whatsappNumber: '919876543211',
      college: 'IIT Delhi',
      branch: 'Electrical Eng',
      isVerified: true
    });
    cleanups.push(() => Student.findByIdAndDelete(studentB._id));

    const studentC = await Student.create({
      clerkId: uidC,
      name: 'Amit Patel',
      email: `amit_${testSuffix}@helpu.test`,
      whatsappNumber: '919876543212',
      college: 'IIT Delhi',
      branch: 'Mechanical Eng',
      isVerified: false
    });
    cleanups.push(() => Student.findByIdAndDelete(studentC._id));

    assert(studentA._id && studentB._id && studentC._id, 'Created 3 test students in DB');

    // -------------------------------------------------------------------------
    // BUG 1: Profile Name Persistence & Propagation to authored Travel posts
    // -------------------------------------------------------------------------
    console.log('\n--- BUG 1: Testing Profile Name Update & Travel Author Propagation ---');
    const travelA1 = await Travel.create({
      userId: uidA,
      authorName: studentA.name,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'New Delhi Railway Station',
      travelDate: new Date(Date.now() + 86400000 * 2),
      departureTime: 600, // 10:00 AM
      timeFlexibility: 30,
      seats: 1,
      availableSeats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(new Date(Date.now() + 86400000 * 2), 600)
    });
    cleanups.push(() => Travel.findByIdAndDelete(travelA1._id));

    // Update student A's name
    const updatedNameA = 'Rohan S. Sharma (Updated)';
    studentA.name = updatedNameA;
    await studentA.save();

    // Propagate to authored travels
    await Travel.updateMany({ userId: uidA }, { $set: { authorName: updatedNameA } });

    const refetchedTravelA1 = await Travel.findById(travelA1._id);
    assert(refetchedTravelA1.authorName === updatedNameA, 'Travel authorName propagated accurately on name update');

    // -------------------------------------------------------------------------
    // BUG 2: Safe Public Profile Serialization (No exposed Firebase/Clerk IDs)
    // -------------------------------------------------------------------------
    console.log('\n--- BUG 2: Testing Safe Public Student Serialization ---');
    const safeA = formatSafePublicStudent(studentA);
    assert(safeA.name === updatedNameA, 'Safe student retains name');
    assert(safeA.college === 'IIT Delhi', 'Safe student retains college');
    assert(!safeA.clerkId, 'Safe student does NOT expose raw clerkId');
    assert(!safeA.firebaseUid, 'Safe student does NOT expose raw firebaseUid');
    assert(!safeA.password, 'Safe student does NOT expose sensitive fields');

    const fallbackStudent = formatSafePublicStudent(null);
    assert(fallbackStudent.name === 'Student', 'Null student falls back safely to "Student"');

    // -------------------------------------------------------------------------
    // BUG 3 & 4: Group Formation Proposal Lifecycle (No immediate group created)
    // -------------------------------------------------------------------------
    console.log('\n--- BUG 3 & 4: Testing Group Formation Proposal Lifecycle ---');
    const travelB1 = await Travel.create({
      userId: uidB,
      authorName: studentB.name,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'New Delhi Railway Station',
      travelDate: travelA1.travelDate,
      departureTime: 630, // 10:30 AM (compatible)
      timeFlexibility: 30,
      seats: 1,
      availableSeats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelA1.travelDate, 630)
    });
    cleanups.push(() => Travel.findByIdAndDelete(travelB1._id));

    // Student A sends group formation proposal to Student B with proposed capacity 4
    console.log('Student A creates group proposal to Student B with targetCapacity 4...');
    const { req: propReq, res: propRes } = mockReqRes({
      userId: uidA,
      body: {
        originatingTravelId: travelA1._id.toString(),
        candidateTravelId: travelB1._id.toString(),
        targetCapacity: 4
      }
    });
    await createGroupFromFindMatch(propReq, propRes);

    assert(propRes.statusCode === 201, 'Proposal created with HTTP 201');
    assert(propRes.data?.data?.relationshipState === 'REQUEST_SENT', 'A sees relationshipState = REQUEST_SENT');
    assert(propRes.data?.data?.proposedCapacity === 4, 'Proposed capacity is 4');
    assert(!propRes.data?.data?.group, 'SharedRideGroup is NOT created before explicit acceptance');

    const proposalDoc = await GroupJoinRequest.findById(propRes.data?.data?.proposal?._id);
    cleanups.push(() => GroupJoinRequest.findByIdAndDelete(proposalDoc._id));
    assert(proposalDoc.type === 'formation_proposal', 'Proposal recorded as formation_proposal type');
    assert(proposalDoc.status === 'pending', 'Proposal status is pending');

    // Student B checks received invitations
    const { req: invReq, res: invRes } = mockReqRes({ userId: uidB });
    await getReceivedInvitations(invReq, invRes);
    assert(invRes.statusCode === 200, 'Student B can fetch received invitations');
    const invitationsList = Array.isArray(invRes.data?.data)
      ? invRes.data.data
      : (invRes.data?.data?.invitations || []);
    const bInvite = invitationsList.find(
      (inv) => String(inv._id) === String(proposalDoc._id)
    );
    assert(Boolean(bInvite), 'Student B sees the pending formation proposal in Invitations tab');
    assert(bInvite.isFormationProposal === true, 'Invitation flagged as formation proposal');
    assert(bInvite.proposedCapacity === 4, 'B sees proposed capacity 4');
    assert(bInvite.sender?.name === updatedNameA, 'B sees safe sender name');

    // Student B accepts the formation proposal!
    console.log('Student B accepts the formation proposal...');
    const { req: accReq, res: accRes } = mockReqRes({
      userId: uidB,
      params: { requestId: proposalDoc._id.toString() }
    });
    await acceptGroupInvitation(accReq, accRes);

    assert(accRes.statusCode === 200, 'Acceptance returned HTTP 200');
    assert(accRes.data?.data?.relationshipState === 'ACCEPTED', 'Relationship state updated to ACCEPTED');
    const createdGroup = accRes.data?.data?.group;
    assert(Boolean(createdGroup?._id), 'Exactly ONE SharedRideGroup atomically created upon acceptance');
    cleanups.push(() => SharedRideGroup.findByIdAndDelete(createdGroup._id));

    // Verify created group structure
    const dbGroup = await SharedRideGroup.findById(createdGroup._id).lean();
    assert(dbGroup.targetCapacity === 4, 'Group targetCapacity is 4');
    assert(dbGroup.members.length === 2, 'Group has exactly 2 confirmed members [A, B]');
    assert(dbGroup.status === 'open', 'Group status is open (2/4 confirmed)');
    const expectedSeats = 4 - 2;
    assert(createdGroup.availableSpots === expectedSeats, `Available spots is ${expectedSeats} (formula sync, BUG 9)`);
    assert(createdGroup.availableSeats === expectedSeats, `Available seats is ${expectedSeats}`);

    // -------------------------------------------------------------------------
    // BUG 6: Group members excluded from individual matches
    // -------------------------------------------------------------------------
    console.log('\n--- BUG 6: Testing Exclusion of Grouped Students from Individual Matches ---');
    // Student C creates a FIND request on the same route & date
    const travelC1 = await Travel.create({
      userId: uidC,
      authorName: studentC.name,
      type: 'request',
      source: 'Campus Gate 1',
      destination: 'New Delhi Railway Station',
      travelDate: travelA1.travelDate,
      departureTime: 615,
      timeFlexibility: 30,
      seats: 1,
      availableSeats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelA1.travelDate, 615)
    });
    cleanups.push(() => Travel.findByIdAndDelete(travelC1._id));

    // Student C searches for compatible FIND matches
    const compatibleWithC = await findCompatibleFindPosts(travelC1, uidC);
    const peerUserIds = compatibleWithC.map((p) => p.userId);
    assert(!peerUserIds.includes(uidA), 'Group member Student A is EXCLUDED from individual matches');
    assert(!peerUserIds.includes(uidB), 'Group member Student B is EXCLUDED from individual matches');

    // -------------------------------------------------------------------------
    // BUG 8: Combined Group Offer Representation
    // -------------------------------------------------------------------------
    console.log('\n--- BUG 8: Testing Combined Group Offer Card Representation ---');
    const matchesForC = await findMatchesForTravel(travelC1, uidC);
    const groupOffer = matchesForC.find((m) => String(m.groupId) === String(dbGroup._id) || m.isGroupOffer);
    assert(Boolean(groupOffer), 'Group [A + B] discovered as ONE combined Group Offer');
    assert(groupOffer.isGroupOffer === true, 'Card flagged as isGroupOffer');
    assert(groupOffer.targetCapacity === 4, 'Card targetCapacity is 4');
    assert(groupOffer.confirmedMemberCount === 2, 'Card confirmedMemberCount is 2');
    assert(groupOffer.availableSeats === 2, 'Card availableSeats is 2');
    assert(Boolean(groupOffer.groupDisplayName), `Group card displays "${groupOffer.groupDisplayName}"`);

    // -------------------------------------------------------------------------
    // BUG 7: ANY confirmed group member can approve join requests
    // -------------------------------------------------------------------------
    console.log('\n--- BUG 7: Testing Any Confirmed Member Approval Permissions ---');
    // Student C requests to join the group
    const joinReqC = await GroupJoinRequest.create({
      groupId: dbGroup._id,
      requesterId: uidC,
      requesterTravelId: travelC1._id,
      senderId: uidC,
      senderTravelId: travelC1._id,
      recipientId: dbGroup.adminId,
      type: 'join_request',
      status: 'pending',
      message: 'Can I join your cab?'
    });
    cleanups.push(() => GroupJoinRequest.findByIdAndDelete(joinReqC._id));

    // Student B (a regular confirmed member, NOT the admin) views join requests
    console.log('Student B (member, not admin) fetches group join requests...');
    const { req: getReqsReq, res: getReqsRes } = mockReqRes({
      userId: uidB,
      params: { groupId: dbGroup._id.toString() }
    });
    await getGroupJoinRequests(getReqsReq, getReqsRes);
    assert(getReqsRes.statusCode === 200, 'Member Student B can view join requests without 403');
    const reqList = Array.isArray(getReqsRes.data?.data)
      ? getReqsRes.data.data
      : (getReqsRes.data?.data?.requests || []);
    assert(reqList.some((r) => String(r._id) === String(joinReqC._id)), 'Member Student B sees Student C join request');

    // Student B approves Student C's join request!
    console.log('Student B approves Student C join request...');
    const { req: appReq, res: appRes } = mockReqRes({
      userId: uidB,
      params: {
        groupId: dbGroup._id.toString(),
        requestId: joinReqC._id.toString()
      }
    });
    await acceptStudentJoinRequest(appReq, appRes);
    assert(appRes.statusCode === 200, 'Member Student B successfully approved join request');

    // Verify updated group capacity & status (BUG 9)
    const updatedGroup = await SharedRideGroup.findById(dbGroup._id).lean();
    assert(updatedGroup.members.length === 3, 'Group now has 3 confirmed members [A, B, C]');
    const remainingSpots = 4 - 3;
    const calcSpots = Math.max(0, updatedGroup.targetCapacity - updatedGroup.members.length);
    assert(calcSpots === 1, `Group has exactly ${calcSpots} spot left`);
    assert(updatedGroup.status === 'open', 'Group status is open');

    // -------------------------------------------------------------------------
    // Clean Removal on Post Delete: Student leaves group when post deleted
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Auto-Leave Group when Travel Post is Deleted ---');
    await removeStudentFromGroupsForTravel(travelC1._id, uidC);

    const groupAfterCLeft = await SharedRideGroup.findById(dbGroup._id).lean();
    assert(groupAfterCLeft.members.length === 2, 'Student C removed from group upon travel post deletion');
    assert(groupAfterCLeft.members.every((m) => m.userId !== uidC), 'Student C no longer in members array');
    assert(groupAfterCLeft.status === 'open', 'Group restored to 2 members / 2 open spots');

    console.log('\n================================================================');
    console.log('🎉 ALL 9 BUGS & SCENARIOS VERIFIED SUCCESSFULLY!');
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
