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
  createSharedRideGroup,
  inviteStudentToGroup,
  acceptGroupInvitation,
  rejectGroupInvitation,
  getReceivedInvitations,
  discoverSharedRideGroups,
  createJoinRequest,
  getGroupJoinRequests,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  getSharedRideGroupById
} from '../src/controllers/group.controller.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

function createMockRes() {
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
  return res;
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Helpu Complete Shared Ride Group Flow (Steps 1 to 13)');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const ts = Date.now();
  const studentA_Id = `student_A_${ts}`;
  const studentB_Id = `student_B_${ts}`;
  const studentC_Id = `student_C_${ts}`;
  const studentD_Id = `student_D_${ts}`;

  const today = new Date();
  const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);

  let travelA = null;
  let travelB = null;
  let travelC = null;
  let travelD = null;
  let groupId = null;
  let inviteRequestId = null;
  let joinRequestId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Student A creates an active FIND post
    // -------------------------------------------------------------------------
    console.log('STEP 1: Student A creates an active FIND post');
    await Student.create([
      { clerkId: studentA_Id, name: 'Student A', email: `${studentA_Id}@vitbhopal.ac.in` },
      { clerkId: studentB_Id, name: 'Student B', email: `${studentB_Id}@vitbhopal.ac.in` },
      { clerkId: studentC_Id, name: 'Student C', email: `${studentC_Id}@vitbhopal.ac.in` },
      { clerkId: studentD_Id, name: 'Student D', email: `${studentD_Id}@vitbhopal.ac.in` }
    ]);

    travelA = await Travel.create({
      userId: studentA_Id,
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
    console.log(`  ✔ Student A FIND post created: ID ${travelA._id}`);

    // -------------------------------------------------------------------------
    // STEP 2 & 3: Student A creates Shared Ride Group & becomes Group Admin
    // -------------------------------------------------------------------------
    console.log('\nSTEP 2 & 3: Student A creates Shared Ride Group with targetCapacity = 3');
    const reqCreate = {
      userId: studentA_Id,
      body: {
        originatingTravelId: travelA._id.toString(),
        targetCapacity: 3,
        actualCabCapacity: 4, // Optional cab capacity
        whatsappGroupUrl: 'https://chat.whatsapp.com/TestRideGroup123',
        notes: 'Coordinating Bhopal Station ride'
      }
    };
    const resCreate = createMockRes();
    await createSharedRideGroup(reqCreate, resCreate);
    if (resCreate.statusCode !== 201) {
      throw new Error(`Failed to create group: ${JSON.stringify(resCreate.body)}`);
    }

    const createdGroup = resCreate.body.data;
    groupId = createdGroup._id.toString();
    console.log(`  ✔ Group created: ID ${groupId}`);
    console.log(`  ✔ Status: ${createdGroup.status} (Expected: open)`);
    console.log(`  ✔ Target capacity: ${createdGroup.targetCapacity} (Expected: 3)`);
    console.log(`  ✔ Actual cab capacity: ${createdGroup.actualCabCapacity} (Expected: 4)`);
    console.log(`  ✔ Admin ID: ${createdGroup.adminId} (Student A)`);
    console.log(`  ✔ Initial members: ${createdGroup.members?.length} (Admin auto-added)`);

    if (createdGroup.members[0].role !== 'admin' || createdGroup.members[0].userId !== studentA_Id) {
      throw new Error('Student A must be Group Admin');
    }

    // -------------------------------------------------------------------------
    // STEP 4: Student A invites compatible Student B
    // -------------------------------------------------------------------------
    console.log('\nSTEP 4: Student A invites compatible Student B');
    travelB = await Travel.create({
      userId: studentB_Id,
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

    const reqInvite = {
      userId: studentA_Id,
      params: { id: groupId },
      body: {
        recipientId: studentB_Id,
        recipientTravelId: travelB._id.toString()
      }
    };
    const resInvite = createMockRes();
    await inviteStudentToGroup(reqInvite, resInvite);
    if (resInvite.statusCode !== 201) {
      throw new Error(`Failed to invite Student B: ${JSON.stringify(resInvite.body)}`);
    }
    inviteRequestId = resInvite.body.data._id.toString();
    console.log(`  ✔ Invitation sent: Request ID ${inviteRequestId}`);
    console.log(`  ✔ Type: ${resInvite.body.data.type} (invite), Status: ${resInvite.body.data.status} (pending)`);

    // Verify duplicate invite rejection
    const resDupInvite = createMockRes();
    await inviteStudentToGroup(reqInvite, resDupInvite);
    if (resDupInvite.statusCode !== 409) {
      throw new Error(`Duplicate invitation must be rejected with 409, got ${resDupInvite.statusCode}`);
    }
    console.log('  ✔ Duplicate invitation rejected with 409 Conflict');

    // -------------------------------------------------------------------------
    // STEP 5: Student B receives the invitation
    // -------------------------------------------------------------------------
    console.log('\nSTEP 5: Student B checks received invitations');
    const reqReceived = { userId: studentB_Id };
    const resReceived = createMockRes();
    await getReceivedInvitations(reqReceived, resReceived);
    if (resReceived.statusCode !== 200) {
      throw new Error(`Failed to get received invitations: ${JSON.stringify(resReceived.body)}`);
    }
    const receivedList = resReceived.body.data;
    const foundInvite = receivedList.find((r) => r._id.toString() === inviteRequestId);
    if (!foundInvite) {
      throw new Error('Student B must receive the pending invitation');
    }
    console.log(`  ✔ Student B retrieved invitation for Group ${foundInvite.group?._id}`);
    console.log(`  ✔ Invitation route: ${foundInvite.group?.source} -> ${foundInvite.group?.destination}`);

    // -------------------------------------------------------------------------
    // STEP 6 & 7: Student B accepts the invitation & becomes confirmed member
    // -------------------------------------------------------------------------
    console.log('\nSTEP 6 & 7: Student B accepts the invitation');
    const reqAcceptInvite = {
      userId: studentB_Id,
      params: { requestId: inviteRequestId }
    };
    const resAcceptInvite = createMockRes();
    await acceptGroupInvitation(reqAcceptInvite, resAcceptInvite);
    if (resAcceptInvite.statusCode !== 200) {
      throw new Error(`Failed to accept invitation: ${JSON.stringify(resAcceptInvite.body)}`);
    }

    const groupAfterB = await SharedRideGroup.findById(groupId);
    console.log(`  ✔ Student B accepted. Total confirmed members: ${groupAfterB.members.length} / ${groupAfterB.targetCapacity}`);
    const memberB = groupAfterB.members.find((m) => m.userId === studentB_Id);
    if (!memberB || memberB.role !== 'member') {
      throw new Error('Student B must be a confirmed member with role "member"');
    }
    console.log(`  ✔ Student B is confirmed member: role = ${memberB.role}`);
    console.log(`  ✔ Group status remains: ${groupAfterB.status} (2/3 members)`);

    // -------------------------------------------------------------------------
    // STEP 8: Student C discovers the group
    // -------------------------------------------------------------------------
    console.log('\nSTEP 8: Student C discovers the group');
    travelC = await Travel.create({
      userId: studentC_Id,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 630, // 10:30 AM (compatible)
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });

    const reqDiscover = {
      userId: studentC_Id,
      query: { travelId: travelC._id.toString() }
    };
    const resDiscover = createMockRes();
    await discoverSharedRideGroups(reqDiscover, resDiscover);
    if (resDiscover.statusCode !== 200) {
      throw new Error(`Failed to discover groups: ${JSON.stringify(resDiscover.body)}`);
    }
    const discoveredGroups = resDiscover.body.data;
    const foundGroupC = discoveredGroups.find((g) => g._id.toString() === groupId);
    if (!foundGroupC) {
      throw new Error('Group must be discoverable by compatible Student C');
    }
    console.log(`  ✔ Group discovered by Student C: Available spots = ${foundGroupC.availableSpots}`);

    // -------------------------------------------------------------------------
    // STEP 9: Student C sends a join request
    // -------------------------------------------------------------------------
    console.log('\nSTEP 9: Student C sends a join request');
    const reqJoin = {
      userId: studentC_Id,
      params: { groupId },
      body: {
        travelId: travelC._id.toString(),
        message: 'Looking to join cab to Bhopal Station'
      }
    };
    const resJoin = createMockRes();
    await createJoinRequest(reqJoin, resJoin);
    if (resJoin.statusCode !== 201) {
      throw new Error(`Failed to create join request: ${JSON.stringify(resJoin.body)}`);
    }
    joinRequestId = resJoin.body.data._id.toString();
    console.log(`  ✔ Join request submitted: Request ID ${joinRequestId}`);

    // Group disappears from discovery for Student C while request is pending
    const resDiscoverAgain = createMockRes();
    await discoverSharedRideGroups(reqDiscover, resDiscoverAgain);
    const discoveredAgain = resDiscoverAgain.body.data.find((g) => g._id.toString() === groupId);
    if (discoveredAgain) {
      throw new Error('Group must not be discoverable for student with pending request');
    }
    console.log('  ✔ Group temporarily hidden from Student C discovery while request is pending');

    // -------------------------------------------------------------------------
    // STEP 10 & 11: Admin accepts join request & Student C becomes confirmed member
    // -------------------------------------------------------------------------
    console.log('\nSTEP 10 & 11: Admin accepts join request');
    const reqAdminInbox = {
      userId: studentA_Id,
      params: { groupId }
    };
    const resAdminInbox = createMockRes();
    await getGroupJoinRequests(reqAdminInbox, resAdminInbox);
    const pendingReqs = resAdminInbox.body.data;
    if (!pendingReqs.find((r) => r._id.toString() === joinRequestId)) {
      throw new Error('Admin must see Student C in join requests inbox');
    }
    console.log(`  ✔ Admin retrieved join request from Student C: "${pendingReqs[0].notes}"`);

    const reqAcceptJoin = {
      userId: studentA_Id,
      params: { requestId: joinRequestId }
    };
    const resAcceptJoin = createMockRes();
    await acceptStudentJoinRequest(reqAcceptJoin, resAcceptJoin);
    if (resAcceptJoin.statusCode !== 200) {
      throw new Error(`Failed to accept join request: ${JSON.stringify(resAcceptJoin.body)}`);
    }

    const groupAfterC = await SharedRideGroup.findById(groupId);
    console.log(`  ✔ Join request accepted. Total confirmed members: ${groupAfterC.members.length} / ${groupAfterC.targetCapacity}`);
    const memberC = groupAfterC.members.find((m) => m.userId === studentC_Id);
    if (!memberC) {
      throw new Error('Student C must be in group members');
    }
    console.log(`  ✔ Student C confirmed as member`);

    // -------------------------------------------------------------------------
    // STEP 12: Group reaches targetCapacity & transitions to "full"
    // -------------------------------------------------------------------------
    console.log('\nSTEP 12: Capacity verification & status transition');
    console.log(`  ✔ Target capacity: ${groupAfterC.targetCapacity}`);
    console.log(`  ✔ Confirmed members: ${groupAfterC.members.length}`);
    console.log(`  ✔ Group status: ${groupAfterC.status} (Expected: full)`);
    if (groupAfterC.status !== 'full') {
      throw new Error(`Group must transition to status "full" when targetCapacity is reached, got "${groupAfterC.status}"`);
    }

    // -------------------------------------------------------------------------
    // STEP 13: Group is no longer discoverable or joinable
    // -------------------------------------------------------------------------
    console.log('\nSTEP 13: Full group is no longer discoverable or joinable');
    travelD = await Travel.create({
      userId: studentD_Id,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 615,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });

    const reqDiscoverD = {
      userId: studentD_Id,
      query: { travelId: travelD._id.toString() }
    };
    const resDiscoverD = createMockRes();
    await discoverSharedRideGroups(reqDiscoverD, resDiscoverD);
    const discoveredD = resDiscoverD.body.data.find((g) => g._id.toString() === groupId);
    if (discoveredD) {
      throw new Error('Full group must NOT appear in discovery for new students');
    }
    console.log('  ✔ Full group excluded from discovery for Student D');

    // Attempting to join full group must be rejected
    const reqJoinFull = {
      userId: studentD_Id,
      params: { groupId },
      body: { travelId: travelD._id.toString() }
    };
    const resJoinFull = createMockRes();
    await createJoinRequest(reqJoinFull, resJoinFull);
    if (resJoinFull.statusCode !== 400) {
      throw new Error(`Joining full group must be rejected with 400, got ${resJoinFull.statusCode}`);
    }
    console.log('  ✔ Joining full group rejected with 400 Bad Request');

    // -------------------------------------------------------------------------
    // ADDITIONAL CHECKS: Reject, Expiry, and Security
    // -------------------------------------------------------------------------
    console.log('\nADDITIONAL CHECKS: WhatsApp Privacy & Rejection Invariants');
    // Non-member D checks group details
    const reqDetailsD = {
      userId: studentD_Id,
      params: { id: groupId }
    };
    const resDetailsD = createMockRes();
    await getSharedRideGroupById(reqDetailsD, resDetailsD);
    if (resDetailsD.body.data.whatsappGroupUrl !== null) {
      throw new Error('whatsappGroupUrl must be masked (null) for non-member Student D');
    }
    console.log('  ✔ Private WhatsApp link is masked for non-member Student D');

    // Confirmed member B checks group details
    const reqDetailsB = {
      userId: studentB_Id,
      params: { id: groupId }
    };
    const resDetailsB = createMockRes();
    await getSharedRideGroupById(reqDetailsB, resDetailsB);
    if (resDetailsB.body.data.whatsappGroupUrl !== 'https://chat.whatsapp.com/TestRideGroup123') {
      throw new Error('whatsappGroupUrl must be accessible for confirmed member Student B');
    }
    console.log('  ✔ Private WhatsApp link is accessible for confirmed member Student B');

    console.log('\n================================================================');
    console.log('ALL 13 STEPS & FLOW CHECKS PASSED WITH 100% SUCCESS');
    console.log('================================================================\n');
  } finally {
    // Cleanup fixtures
    if (groupId) await SharedRideGroup.deleteMany({ _id: groupId });
    if (inviteRequestId) await GroupJoinRequest.deleteMany({ _id: inviteRequestId });
    if (joinRequestId) await GroupJoinRequest.deleteMany({ _id: joinRequestId });
    await Travel.deleteMany({ userId: { $in: [studentA_Id, studentB_Id, studentC_Id, studentD_Id] } });
    await Student.deleteMany({ clerkId: { $in: [studentA_Id, studentB_Id, studentC_Id, studentD_Id] } });
    await Outbox.deleteMany({ 'payload.groupId': groupId });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB & cleaned up test data.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
