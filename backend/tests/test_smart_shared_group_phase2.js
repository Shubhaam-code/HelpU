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
import {
  createGroupFromFindMatch,
  acceptGroupInvitation,
  rejectGroupInvitation,
  getReceivedInvitations
} from '../src/controllers/group.controller.js';
import { formatNotificationContent, NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

/**
 * Mock Express Request & Response helper
 */
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
  console.log('================================================================');
  console.log('TEST SUITE: Helpu Phase 2 — Smart Shared Group Creation & Invites');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas.\n');

  const ts = Date.now();
  const studentA = `user_phase2_A_${ts}`;
  const studentB = `user_phase2_B_${ts}`;
  const studentC = `user_phase2_C_${ts}`;
  const studentD = `user_phase2_D_${ts}`;
  const studentX = `user_phase2_X_${ts}`; // unauthorized user

  const today = new Date();
  const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const differentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8);

  const testStudentIds = [studentA, studentB, studentC, studentD, studentX];
  let createdGroupIds = [];

  try {
    // Setup test student profiles
    await Student.create([
      { clerkId: studentA, name: 'Alice Phase2', email: `${studentA}@vitbhopal.ac.in` },
      { clerkId: studentB, name: 'Bob Phase2', email: `${studentB}@vitbhopal.ac.in` },
      { clerkId: studentC, name: 'Charlie Phase2', email: `${studentC}@vitbhopal.ac.in` },
      { clerkId: studentD, name: 'Dave Phase2', email: `${studentD}@vitbhopal.ac.in` },
      { clerkId: studentX, name: 'Eve Phase2', email: `${studentX}@vitbhopal.ac.in` }
    ]);

    // Setup active compatible FIND posts for A and B
    const postA = await Travel.create({
      userId: studentA,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 600, // 10:00 AM
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const postB = await Travel.create({
      userId: studentB,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 720, // 12:00 PM (120 mins diff <= 420 mins)
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    // -------------------------------------------------------------
    // SCENARIO 1: Student A creates group and invites B
    // -------------------------------------------------------------
    console.log('SCENARIO 1: Student A creates group and invites B');
    const { req: req1, res: res1 } = createMockReqRes({
      userId: studentA,
      body: {
        originatingTravelId: postA._id,
        candidateTravelId: postB._id,
        targetCapacity: 2
      }
    });

    await createGroupFromFindMatch(req1, res1);
    console.log(`  Response Status: ${res1.getStatusCode()}`);
    const data1 = res1.getData();
    if (res1.getStatusCode() !== 201 || !data1.success || !data1.data?.group || !data1.data?.invitation) {
      throw new Error(`Scenario 1 failed: ${JSON.stringify(data1)}`);
    }

    const group1 = data1.data.group;
    const invite1 = data1.data.invitation;
    createdGroupIds.push(group1._id);

    if (group1.adminId !== studentA) throw new Error('Creator should be admin');
    if (group1.members.length !== 1 || group1.members[0].userId !== studentA) {
      throw new Error('Creator should be the first confirmed member');
    }
    if (invite1.recipientId !== studentB || invite1.type !== 'invite' || invite1.status !== 'pending') {
      throw new Error('Pending invitation for student B not created properly');
    }

    // Verify Outbox Notification content
    const outbox1 = await Outbox.findOne({ recipientId: studentB, eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_RECEIVED });
    if (!outbox1) throw new Error('Outbox event for invited student B not found');
    const formattedNotif = formatNotificationContent(outbox1.eventType, outbox1.payload);
    if (formattedNotif.title !== 'You have a Shared Group invitation!') {
      throw new Error(`Notification title mismatch: got "${formattedNotif.title}"`);
    }
    if (!formattedNotif.message.includes('Review and accept the invitation to join.')) {
      throw new Error(`Notification message mismatch: got "${formattedNotif.message}"`);
    }
    console.log('  ✔ Student A created group, became admin, and pending invite sent to B with exact notification format\n');

    // -------------------------------------------------------------
    // SCENARIO 2: Student B creates group and invites A (mirror flow on C & D)
    // -------------------------------------------------------------
    console.log('SCENARIO 2: Student B/D creates group and invites peer (C & D pair)');
    const postC = await Travel.create({
      userId: studentC,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Indore Airport',
      travelDate,
      departureTime: 500,
      seats: 1,
      price: 300,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const postD = await Travel.create({
      userId: studentD,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Indore Airport',
      travelDate,
      departureTime: 620,
      seats: 1,
      price: 300,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const { req: req2, res: res2 } = createMockReqRes({
      userId: studentD,
      body: {
        originatingTravelId: postD._id,
        candidateTravelId: postC._id,
        targetCapacity: 3
      }
    });

    await createGroupFromFindMatch(req2, res2);
    if (res2.getStatusCode() !== 201) throw new Error(`Scenario 2 failed: ${JSON.stringify(res2.getData())}`);
    const group2 = res2.getData().data.group;
    createdGroupIds.push(group2._id);
    if (group2.adminId !== studentD) throw new Error('Creator student D should be admin');
    console.log('  ✔ Student D initiated group, became admin, and sent pending invite to C\n');

    // -------------------------------------------------------------
    // SCENARIO 3: Invitation received by the other student
    // -------------------------------------------------------------
    console.log('SCENARIO 3: Invitation received by the other student');
    const { req: req3, res: res3 } = createMockReqRes({ userId: studentB });
    await getReceivedInvitations(req3, res3);
    const data3 = res3.getData();
    if (res3.getStatusCode() !== 200 || !data3.data.some((inv) => String(inv._id) === String(invite1._id))) {
      throw new Error(`Scenario 3 failed: invitation ${invite1._id} not listed in received invitations`);
    }
    console.log('  ✔ Student B retrieved pending invitation in received invitations list\n');

    // -------------------------------------------------------------
    // SCENARIO 4: Invitation acceptance creates confirmed membership
    // -------------------------------------------------------------
    console.log('SCENARIO 4: Invitation acceptance creates confirmed membership');
    const { req: req4, res: res4 } = createMockReqRes({
      userId: studentB,
      params: { requestId: invite1._id }
    });
    await acceptGroupInvitation(req4, res4);
    if (res4.getStatusCode() !== 200) {
      throw new Error(`Scenario 4 failed: ${JSON.stringify(res4.getData())}`);
    }

    const updatedGroup1 = await SharedRideGroup.findById(group1._id);
    const updatedInvite1 = await GroupJoinRequest.findById(invite1._id);
    if (updatedInvite1.status !== 'accepted') throw new Error('Invitation status should be accepted');
    if (updatedGroup1.members.length !== 2) throw new Error('Group should now have 2 members');
    if (!updatedGroup1.members.some((m) => m.userId === studentB && m.role === 'member')) {
      throw new Error('Student B should be confirmed member with role member');
    }
    if (updatedGroup1.status !== 'full') {
      throw new Error('Group status should transition to full when targetCapacity (2) is reached');
    }

    const acceptOutbox = await Outbox.findOne({ recipientId: studentA, eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_ACCEPTED });
    if (!acceptOutbox) throw new Error('Admin not notified of accepted invitation');
    console.log('  ✔ Invitation accepted atomically, member confirmed, group transitioned to full, admin notified\n');

    // -------------------------------------------------------------
    // SCENARIO 5: Invitation rejection does not create membership
    // -------------------------------------------------------------
    console.log('SCENARIO 5: Invitation rejection does not create membership');
    const inviteC = await GroupJoinRequest.findOne({ groupId: group2._id, recipientId: studentC, status: 'pending' });
    if (!inviteC) throw new Error('Invitation for student C not found');

    const { req: req5, res: res5 } = createMockReqRes({
      userId: studentC,
      params: { requestId: inviteC._id }
    });
    await rejectGroupInvitation(req5, res5);
    if (res5.getStatusCode() !== 200) throw new Error(`Scenario 5 failed: ${JSON.stringify(res5.getData())}`);

    const group2AfterReject = await SharedRideGroup.findById(group2._id);
    const inviteCAfterReject = await GroupJoinRequest.findById(inviteC._id);
    if (inviteCAfterReject.status !== 'rejected') throw new Error('Invitation status should be rejected');
    if (group2AfterReject.members.some((m) => m.userId === studentC)) {
      throw new Error('Student C should NOT be added to group members on rejection');
    }

    // Verify both original FIND posts remain intact
    const livePostC = await Travel.findById(postC._id);
    const livePostD = await Travel.findById(postD._id);
    if (livePostC.status !== 'active' || livePostD.status !== 'active') {
      throw new Error('Original FIND posts must remain active upon invitation rejection');
    }
    console.log('  ✔ Invitation rejected, member NOT added, FIND posts remain active\n');

    // -------------------------------------------------------------
    // SCENARIO 6: Non-recipient cannot accept/reject
    // -------------------------------------------------------------
    console.log('SCENARIO 6: Non-recipient cannot accept/reject');
    // Create new proposal between fresh posts for unauthorized check
    const postPair1 = await Travel.create({
      userId: studentA,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Airport',
      travelDate,
      departureTime: 300,
      seats: 1,
      price: 200,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });
    const postPair2 = await Travel.create({
      userId: studentB,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Airport',
      travelDate,
      departureTime: 360,
      seats: 1,
      price: 200,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const { req: reqInit, res: resInit } = createMockReqRes({
      userId: studentA,
      body: { originatingTravelId: postPair1._id, candidateTravelId: postPair2._id }
    });
    await createGroupFromFindMatch(reqInit, resInit);
    const unauthInvite = resInit.getData().data.invitation;
    createdGroupIds.push(resInit.getData().data.group._id);

    // Student X tries to accept Student B's invite
    const { req: req6Accept, res: res6Accept } = createMockReqRes({
      userId: studentX,
      params: { requestId: unauthInvite._id }
    });
    await acceptGroupInvitation(req6Accept, res6Accept);
    if (res6Accept.getStatusCode() !== 403) {
      throw new Error(`Expected 403 for unauthorized accept, got ${res6Accept.getStatusCode()}`);
    }

    // Student X tries to reject Student B's invite
    const { req: req6Reject, res: res6Reject } = createMockReqRes({
      userId: studentX,
      params: { requestId: unauthInvite._id }
    });
    await rejectGroupInvitation(req6Reject, res6Reject);
    if (res6Reject.getStatusCode() !== 403) {
      throw new Error(`Expected 403 for unauthorized reject, got ${res6Reject.getStatusCode()}`);
    }
    console.log('  ✔ Non-recipient blocked with 403 Forbidden on both accept and reject\n');

    // -------------------------------------------------------------
    // SCENARIO 7: Expired invitation cannot be accepted
    // -------------------------------------------------------------
    console.log('SCENARIO 7: Expired invitation cannot be accepted');
    // Set invitation expiresAt to the past
    await GroupJoinRequest.updateOne({ _id: unauthInvite._id }, { $set: { expiresAt: new Date(Date.now() - 60000) } });
    const { req: req7, res: res7 } = createMockReqRes({
      userId: studentB,
      params: { requestId: unauthInvite._id }
    });
    await acceptGroupInvitation(req7, res7);
    if (res7.getStatusCode() !== 400 || !res7.getData().message.includes('expired')) {
      throw new Error(`Expected 400 expired error, got status ${res7.getStatusCode()}: ${JSON.stringify(res7.getData())}`);
    }
    console.log('  ✔ Expired invitation correctly rejected with 400 error\n');

    // -------------------------------------------------------------
    // SCENARIO 8: Inactive FIND cannot create a group proposal
    // -------------------------------------------------------------
    console.log('SCENARIO 8: Inactive FIND cannot create a group proposal');
    const inactivePost = await Travel.create({
      userId: studentC,
      type: 'request',
      status: 'cancelled',
      source: 'VIT, Bhopal',
      destination: 'Lalghati, Bhopal',
      travelDate,
      departureTime: 400,
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });
    const activePeer = await Travel.create({
      userId: studentD,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Lalghati, Bhopal',
      travelDate,
      departureTime: 420,
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const { req: req8, res: res8 } = createMockReqRes({
      userId: studentC,
      body: { originatingTravelId: inactivePost._id, candidateTravelId: activePeer._id }
    });
    await createGroupFromFindMatch(req8, res8);
    if (res8.getStatusCode() !== 400) {
      throw new Error(`Expected 400 for inactive FIND, got ${res8.getStatusCode()}`);
    }
    console.log('  ✔ Inactive FIND post blocked from initiating group\n');

    // -------------------------------------------------------------
    // SCENARIO 9: Incompatible FIND posts cannot create a group
    // -------------------------------------------------------------
    console.log('SCENARIO 9: Incompatible FIND posts cannot create a group');
    // Different routes
    const postRoute1 = await Travel.create({
      userId: studentA,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 500,
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });
    const postRoute2 = await Travel.create({
      userId: studentB,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Indore Airport', // Incompatible destination
      travelDate,
      departureTime: 500,
      seats: 1,
      price: 300,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const { req: req9a, res: res9a } = createMockReqRes({
      userId: studentA,
      body: { originatingTravelId: postRoute1._id, candidateTravelId: postRoute2._id }
    });
    await createGroupFromFindMatch(req9a, res9a);
    if (res9a.getStatusCode() !== 400) {
      throw new Error(`Expected 400 for route incompatibility, got ${res9a.getStatusCode()}`);
    }

    // Departure time difference > 420 mins
    const postTimeFar = await Travel.create({
      userId: studentB,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 1200, // 20:00 vs 08:20 (diff: 700 mins > 420 mins)
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    const { req: req9b, res: res9b } = createMockReqRes({
      userId: studentA,
      body: { originatingTravelId: postRoute1._id, candidateTravelId: postTimeFar._id }
    });
    await createGroupFromFindMatch(req9b, res9b);
    if (res9b.getStatusCode() !== 400) {
      throw new Error(`Expected 400 for time window > 420 mins, got ${res9b.getStatusCode()}`);
    }
    console.log('  ✔ Incompatible route and departure window > 420 mins both rejected with 400\n');

    // -------------------------------------------------------------
    // SCENARIO 10: Duplicate group creation is prevented
    // -------------------------------------------------------------
    console.log('SCENARIO 10: Duplicate group creation is prevented');
    // Create new pair
    const pA1 = await Travel.create({
      userId: studentA,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Rani Kamlapati Station',
      travelDate,
      departureTime: 400,
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });
    const pB1 = await Travel.create({
      userId: studentB,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Rani Kamlapati Station',
      travelDate,
      departureTime: 450,
      seats: 1,
      price: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    // First creation call
    const { req: req10a, res: res10a } = createMockReqRes({
      userId: studentA,
      body: { originatingTravelId: pA1._id, candidateTravelId: pB1._id }
    });
    await createGroupFromFindMatch(req10a, res10a);
    if (res10a.getStatusCode() !== 201) throw new Error('Initial creation should succeed with 201');
    const firstGroupId = res10a.getData().data.group._id;
    createdGroupIds.push(firstGroupId);

    // Duplicate creation call with same student A
    const { req: req10b, res: res10b } = createMockReqRes({
      userId: studentA,
      body: { originatingTravelId: pA1._id, candidateTravelId: pB1._id }
    });
    await createGroupFromFindMatch(req10b, res10b);
    if (res10b.getStatusCode() !== 200 || !res10b.getData().data.isExisting) {
      throw new Error(`Expected 200 with isExisting: true, got ${res10b.getStatusCode()}`);
    }
    if (String(res10b.getData().data.group._id) !== String(firstGroupId)) {
      throw new Error('Returned group ID does not match original group ID');
    }

    // Verify only ONE group exists in database for this pair
    const proposalKey10 = [String(pA1._id), String(pB1._id)].sort().join(':');
    const groupCount10 = await SharedRideGroup.countDocuments({ proposalKey: proposalKey10 });
    if (groupCount10 !== 1) throw new Error(`Expected 1 group document, found ${groupCount10}`);
    console.log('  ✔ Duplicate group creation prevented; existing group returned with isExisting: true\n');

    // -------------------------------------------------------------
    // SCENARIO 11: Simultaneous A/B group creation does not create duplicate groups
    // -------------------------------------------------------------
    console.log('SCENARIO 11: Simultaneous A/B group creation does not create duplicate groups');
    const pSimA = await Travel.create({
      userId: studentC,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Nadra Bus Stand',
      travelDate,
      departureTime: 300,
      seats: 1,
      price: 120,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });
    const pSimB = await Travel.create({
      userId: studentD,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Nadra Bus Stand',
      travelDate,
      departureTime: 320,
      seats: 1,
      price: 120,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });

    // Execute both calls concurrently at the exact same millisecond
    const { req: reqSim1, res: resSim1 } = createMockReqRes({
      userId: studentC,
      body: { originatingTravelId: pSimA._id, candidateTravelId: pSimB._id }
    });
    const { req: reqSim2, res: resSim2 } = createMockReqRes({
      userId: studentD,
      body: { originatingTravelId: pSimB._id, candidateTravelId: pSimA._id }
    });

    await Promise.all([
      createGroupFromFindMatch(reqSim1, resSim1),
      createGroupFromFindMatch(reqSim2, resSim2)
    ]);

    console.log(`  Simultaneous Call 1 Status: ${resSim1.getStatusCode()}`);
    console.log(`  Simultaneous Call 2 Status: ${resSim2.getStatusCode()}`);

    const simGroup1 = resSim1.getData()?.data?.group;
    const simGroup2 = resSim2.getData()?.data?.group;
    if (!simGroup1?._id || !simGroup2?._id) {
      throw new Error('Both simultaneous calls must return group data');
    }
    if (String(simGroup1._id) !== String(simGroup2._id)) {
      throw new Error(`Duplicate groups created! Group1: ${simGroup1._id}, Group2: ${simGroup2._id}`);
    }

    const proposalKeySim = [String(pSimA._id), String(pSimB._id)].sort().join(':');
    const simDocCount = await SharedRideGroup.countDocuments({ proposalKey: proposalKeySim });
    if (simDocCount !== 1) {
      throw new Error(`Database contains ${simDocCount} groups for simultaneous pair (expected exactly 1)`);
    }

    const simInviteCount = await GroupJoinRequest.countDocuments({ groupId: simGroup1._id, type: 'invite', status: 'pending' });
    if (simInviteCount !== 1) {
      throw new Error(`Expected exactly 1 pending invite, found ${simInviteCount}`);
    }
    createdGroupIds.push(simGroup1._id);
    console.log('  ✔ Concurrent race safely handled: exactly 1 group created, both calls return same group ID, exactly 1 invite\n');

    // -------------------------------------------------------------
    // SCENARIO 12: Duplicate invitations are prevented
    // -------------------------------------------------------------
    console.log('SCENARIO 12: Duplicate invitations are prevented');
    // Try creating duplicate invite directly on simGroup1 for the candidate
    const existingInviteSim = await GroupJoinRequest.findOne({ groupId: simGroup1._id, type: 'invite', status: 'pending' });
    let duplicateInviteBlocked = false;
    try {
      await GroupJoinRequest.create({
        groupId: simGroup1._id,
        requesterId: existingInviteSim.requesterId,
        requesterTravelId: existingInviteSim.requesterTravelId,
        senderId: existingInviteSim.senderId,
        recipientId: existingInviteSim.recipientId,
        type: 'invite',
        status: 'pending'
      });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        duplicateInviteBlocked = true;
      }
    }
    if (!duplicateInviteBlocked) {
      throw new Error('Database unique constraint failed to block duplicate pending invite');
    }
    console.log('  ✔ Compound unique index on { groupId, requesterId, status: "pending" } blocks duplicate invites\n');

    // -------------------------------------------------------------
    // SCENARIO 13: Capacity checks remain atomic
    // -------------------------------------------------------------
    console.log('SCENARIO 13: Capacity checks remain atomic');
    // On group1 (which has targetCapacity: 2 and is full from Scenario 4)
    // Create an artificial pending invite to test capacity rejection
    const mockPendingInvite = await GroupJoinRequest.create({
      groupId: group1._id,
      requesterId: studentX,
      requesterTravelId: postRoute1._id,
      senderId: studentA,
      recipientId: studentX,
      type: 'invite',
      status: 'pending'
    });

    const { req: req13, res: res13 } = createMockReqRes({
      userId: studentX,
      params: { requestId: mockPendingInvite._id }
    });
    await acceptGroupInvitation(req13, res13);
    if (res13.getStatusCode() !== 400 || (!res13.getData().message.includes('target capacity') && !res13.getData().message.includes('full'))) {
      throw new Error(`Expected 400 capacity/full error, got status ${res13.getStatusCode()}: ${JSON.stringify(res13.getData())}`);
    }
    console.log('  ✔ Full group rejects further member acceptance atomically\n');

    console.log('================================================================');
    console.log('ALL PHASE 2 UNIT & INTEGRATION SCENARIOS (1-13) PASSED (100% SUCCESS)');
    console.log('================================================================\n');
  } finally {
    // Clean up test data
    try {
      await Travel.deleteMany({ userId: { $in: testStudentIds } });
      await Student.deleteMany({ clerkId: { $in: testStudentIds } });
      if (createdGroupIds.length > 0) {
        await SharedRideGroup.deleteMany({ _id: { $in: createdGroupIds } });
        await GroupJoinRequest.deleteMany({ groupId: { $in: createdGroupIds } });
        await Outbox.deleteMany({ recipientId: { $in: testStudentIds } });
        await Notification.deleteMany({ recipientId: { $in: testStudentIds } });
      }
      console.log('Cleaned up test data.\n');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
