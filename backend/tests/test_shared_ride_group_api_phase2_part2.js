import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import Travel from '../src/models/Travel.js';
import Student from '../src/models/Student.js';
import Outbox from '../src/models/Outbox.js';
import {
  createSharedRideGroup,
  discoverSharedRideGroups,
  createJoinRequest,
  getGroupJoinRequests,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  inviteStudentToGroup
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
  console.log('TEST SUITE: Shared Ride Group API Phase 2 Part 2 (Discovery & Join Requests)');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  await Promise.all([
    SharedRideGroup.init(),
    GroupJoinRequest.init(),
    Travel.init(),
    Student.init(),
    Outbox.init()
  ]);
  console.log('Indexes initialized on MongoDB.\n');

  const ts = Date.now();
  const adminId = `admin_p2_${ts}`;
  const studentA = `studentA_p2_${ts}`;
  const studentB = `studentB_p2_${ts}`;
  const studentC = `studentC_p2_${ts}`;
  const intruderId = `intruder_p2_${ts}`;

  const createdGroupIds = [];
  const createdTravelIds = [];
  const createdStudentIds = [adminId, studentA, studentB, studentC, intruderId];

  try {
    // 0. Setup Students
    await Student.create([
      { clerkId: adminId, name: 'Admin Student', email: `admin_${ts}@vitbhopal.ac.in`, phone: '+919999900001', college: 'VIT Bhopal', isVerified: true },
      { clerkId: studentA, name: 'Alice Student', email: `alice_${ts}@vitbhopal.ac.in`, phone: '+919999900002', college: 'VIT Bhopal', isVerified: true },
      { clerkId: studentB, name: 'Bob Student', email: `bob_${ts}@vitbhopal.ac.in`, phone: '+919999900003', college: 'VIT Bhopal', isVerified: true },
      { clerkId: studentC, name: 'Charlie Student', email: `charlie_${ts}@vitbhopal.ac.in`, phone: '+919999900004', college: 'VIT Bhopal', isVerified: true },
      { clerkId: intruderId, name: 'Intruder Student', email: `intruder_${ts}@vitbhopal.ac.in`, phone: '+919999900005', college: 'VIT Bhopal', isVerified: true }
    ]);

    const today = new Date();
    const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);

    // Setup Originating Travel for Admin
    const adminFind = await Travel.create({
      userId: adminId,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 600, // 10:00 AM
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(adminFind._id);

    // Admin creates open SharedRideGroup (capacity: 3, currently 1 member: Admin)
    const groupReq = {
      userId: adminId,
      body: {
        originatingTravelId: adminFind._id.toString(),
        targetCapacity: 3,
        notes: 'Secret coordination notes',
        whatsappGroupUrl: 'https://chat.whatsapp.com/SecretGroupCode123'
      }
    };
    const groupRes = createMockRes();
    await createSharedRideGroup(groupReq, groupRes);
    const openGroup = groupRes.body.data;
    createdGroupIds.push(openGroup._id);

    // Setup Travel posts for Candidate Students
    // 1. Compatible FIND post for studentA (VIT, Bhopal -> Bhopal Railway Station, 10:45 AM)
    const travelA = await Travel.create({
      userId: studentA,
      type: 'request',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 645,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(travelA._id);

    // 2. Incompatible route (opposite direction) for studentB
    const travelBWrongRoute = await Travel.create({
      userId: studentB,
      type: 'request',
      source: 'Bhopal Junction',
      destination: 'VIT Bhopal',
      travelDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(travelBWrongRoute._id);

    // 3. Incompatible date (next week) for studentB
    const travelBWrongDate = await Travel.create({
      userId: studentB,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(travelBWrongDate._id);

    // 4. Incompatible time (500 mins diff > 420 mins) for studentB
    const travelBWrongTime = await Travel.create({
      userId: studentB,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 50,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(travelBWrongTime._id);

    // 5. OFFER post for studentB (non-FIND)
    const travelBOffer = await Travel.create({
      userId: studentB,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 3,
      status: 'active'
    });
    createdTravelIds.push(travelBOffer._id);

    // 6. Compatible FIND post for studentB
    const travelB = await Travel.create({
      userId: studentB,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 615,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(travelB._id);

    // 7. Compatible FIND post for studentC
    const travelC = await Travel.create({
      userId: studentC,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 620,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(travelC._id);

    console.log('Test fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Group Discovery API Validations
    // -------------------------------------------------------------
    console.log('TEST 1: Group Discovery API Validations');

    // 1A: Reject non-existent or unauthorized Travel ID
    {
      const req = { userId: studentA, query: { travelId: new mongoose.Types.ObjectId().toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      if (res.statusCode !== 404) throw new Error(`Expected 404 for non-existent travel, got ${res.statusCode}`);
    }
    {
      const req = { userId: intruderId, query: { travelId: travelA._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      if (res.statusCode !== 403) throw new Error(`Expected 403 for unauthorized travel, got ${res.statusCode}`);
      console.log('  ✔ Non-existent (404) and unauthorized (403) travel post discovery rejected');
    }

    // 1B: Reject non-FIND (OFFER) travel post
    {
      const req = { userId: studentB, query: { travelId: travelBOffer._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      if (res.statusCode !== 400) throw new Error(`Expected 400 for OFFER post discovery, got ${res.statusCode}`);
      console.log('  ✔ Non-FIND (OFFER) post discovery rejected with 400');
    }

    // 1C: Compatible group appears for studentA
    {
      const req = { userId: studentA, query: { travelId: travelA._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      if (res.statusCode !== 200 || !Array.isArray(res.body.data)) {
        throw new Error(`Expected 200 array from discovery, got ${res.statusCode}`);
      }
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (!match) throw new Error('Compatible open group did not appear in discovery');
      if (match.availableSpots !== 2 || match.confirmedMemberCount !== 1) {
        throw new Error('Capacity metrics in discovery match are incorrect');
      }
      // Verify safe privacy projections (NO clerkId, NO firebaseUid, NO phone, NO email, NO whatsapp, NO notes)
      if (
        'clerkId' in (match.admin || {}) ||
        match.admin?.clerkId ||
        match.admin?.firebaseUid ||
        match.admin?.phone ||
        match.admin?.email ||
        match.whatsappGroupUrl ||
        match.notes ||
        'adminId' in match
      ) {
        throw new Error('Privacy breach: clerkId, firebaseUid, phone, email, whatsapp, notes or adminId exposed in discovery');
      }
      console.log('  ✔ Compatible open group successfully discovered with safe public attributes');
      console.log('  ✔ Discovery strictly omits clerkId, firebaseUid, phone, email, WhatsApp, and private notes');
    }

    // 1D: Incompatible route excluded
    {
      const req = { userId: studentB, query: { travelId: travelBWrongRoute._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Incompatible route should be excluded from discovery');
      console.log('  ✔ Incompatible route excluded from discovery');
    }

    // 1E: Incompatible date excluded
    {
      const req = { userId: studentB, query: { travelId: travelBWrongDate._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Incompatible date should be excluded from discovery');
      console.log('  ✔ Incompatible date excluded from discovery');
    }

    // 1F: Time difference > 420 mins excluded
    {
      const req = { userId: studentB, query: { travelId: travelBWrongTime._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Time diff > 420 mins should be excluded from discovery');
      console.log('  ✔ Departure time difference > 420 mins excluded from discovery');
    }

    // 1G: Admin cannot discover their own group
    {
      const req = { userId: adminId, query: { travelId: adminFind._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Group admin should not discover their own group');
      console.log('  ✔ Admin excluded from discovering their own group');
    }

    // 1H: Group disappears from discovery after pending join request is created (FIX 3)
    let testJoinReqId = null;
    {
      const joinReq = await GroupJoinRequest.create({
        groupId: openGroup._id,
        requesterId: studentA,
        requesterTravelId: travelA._id,
        senderId: studentA,
        recipientId: adminId,
        type: 'join_request',
        status: 'pending'
      });
      testJoinReqId = joinReq._id;

      const req = { userId: studentA, query: { travelId: travelA._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Group with pending join request should be hidden from discovery');
      console.log('  ✔ Group disappears from discovery after pending join request is created');
    }

    // 1I: Group reappears in discovery after request is rejected, cancelled or expired (FIX 3)
    {
      await GroupJoinRequest.updateOne({ _id: testJoinReqId }, { $set: { status: 'rejected' } });
      const req = { userId: studentA, query: { travelId: travelA._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (!match) throw new Error('Group should reappear in discovery after join request is rejected');
      console.log('  ✔ Group reappears in discovery after join request is rejected');

      // Test cancelled/expired
      await GroupJoinRequest.updateOne({ _id: testJoinReqId }, { $set: { status: 'cancelled' } });
      const res2 = createMockRes();
      await discoverSharedRideGroups(req, res2);
      if (!res2.body.data.some((g) => g._id.toString() === openGroup._id.toString())) {
        throw new Error('Group should remain visible after request cancellation');
      }
      console.log('  ✔ Group remains discoverable when prior request is cancelled or resolved');

      // Clean up test request
      await GroupJoinRequest.deleteOne({ _id: testJoinReqId });

      // Test real expired pending request does not hide group from discovery
      const expiredReq = await GroupJoinRequest.create({
        groupId: openGroup._id,
        requesterId: studentA,
        requesterTravelId: travelA._id,
        senderId: studentA,
        recipientId: adminId,
        type: 'join_request',
        status: 'pending',
        expiresAt: new Date(Date.now() - 3600000)
      });
      const resExp = createMockRes();
      await discoverSharedRideGroups(req, resExp);
      const matchExp = resExp.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (!matchExp) throw new Error('Expired request should not hide group from discovery');
      console.log('  ✔ Expired pending request does not hide group from discovery');

      // Wait 50ms for lazy reconciliation update to settle
      await new Promise((r) => setTimeout(r, 50));
      const reconciled = await GroupJoinRequest.findById(expiredReq._id);
      if (reconciled.status !== 'expired') {
        throw new Error(`Expected request status to be 'expired', got: ${reconciled.status}`);
      }
      console.log('  ✔ Expired request is lazily reconciled to status "expired" in database');
      await GroupJoinRequest.deleteOne({ _id: expiredReq._id });
    }

    // 1J: Group disappears from discovery when pending invitation exists for student (FIX 3)
    {
      const testInvite = await GroupJoinRequest.create({
        groupId: openGroup._id,
        requesterId: studentA,
        requesterTravelId: travelA._id,
        senderId: adminId,
        recipientId: studentA,
        type: 'invite',
        status: 'pending'
      });

      const req = { userId: studentA, query: { travelId: travelA._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Group with pending invitation should be hidden from discovery');
      console.log('  ✔ Group disappears from discovery when an outstanding invitation exists');

      // Clean up test invite
      await GroupJoinRequest.deleteOne({ _id: testInvite._id });
    }

    // -------------------------------------------------------------
    // TEST 2: Student Join Request API Validations
    // -------------------------------------------------------------
    console.log('\nTEST 2: Student Join Request API Validations');

    const groupIdStr = openGroup._id.toString();

    // 2A: Reject non-existent group
    {
      const req = {
        userId: studentA,
        params: { groupId: new mongoose.Types.ObjectId().toString() },
        body: { travelId: travelA._id.toString() }
      };
      const res = createMockRes();
      await createJoinRequest(req, res);
      if (res.statusCode !== 404) throw new Error(`Expected 404 for non-existent group, got ${res.statusCode}`);
      console.log('  ✔ Non-existent group join request rejected with 404');
    }

    // 2B: Reject admin requesting to join own group
    {
      const req = {
        userId: adminId,
        params: { groupId: groupIdStr },
        body: { travelId: adminFind._id.toString() }
      };
      const res = createMockRes();
      await createJoinRequest(req, res);
      if (res.statusCode !== 400) throw new Error(`Expected 400 for admin join request, got ${res.statusCode}`);
      console.log('  ✔ Admin requesting to join own group rejected with 400');
    }

    // 2C: Reject incompatible route/date/time join request
    {
      const req = {
        userId: studentB,
        params: { groupId: groupIdStr },
        body: { travelId: travelBWrongRoute._id.toString() }
      };
      const res = createMockRes();
      await createJoinRequest(req, res);
      if (res.statusCode !== 400) throw new Error(`Expected 400 for incompatible route join request, got ${res.statusCode}`);
      console.log('  ✔ Incompatible travel post join request rejected with 400');
    }

    // 2D: Valid join request created by studentA
    let joinRequestA = null;
    {
      const req = {
        userId: studentA,
        params: { groupId: groupIdStr },
        body: {
          travelId: travelA._id.toString(),
          message: 'Can I join your cab to Bhopal junction?'
        }
      };
      const res = createMockRes();
      await createJoinRequest(req, res);
      if (res.statusCode !== 201) {
        throw new Error(`Expected 201 for valid join request, got ${res.statusCode}: ${res.body?.message}`);
      }
      joinRequestA = res.body.data;
      if (joinRequestA.type !== 'join_request' || joinRequestA.status !== 'pending') {
        throw new Error('Join request type or status is invalid');
      }
      if (joinRequestA.requesterId !== studentA || joinRequestA.recipientId !== adminId) {
        throw new Error('Requester or recipient ID mismatch in join request');
      }

      // Verify studentA was NOT automatically added to group.members
      const freshGroup = await SharedRideGroup.findById(openGroup._id);
      if (freshGroup.members.length !== 1) {
        throw new Error('Student was prematurely added to group members before admin acceptance');
      }

      // Verify outbox notification event GROUP_JOIN_REQUEST_RECEIVED created for admin
      const notif = await Outbox.findOne({
        eventType: 'GROUP_JOIN_REQUEST_RECEIVED',
        recipientId: adminId,
        'payload.groupId': openGroup._id
      });
      if (!notif) throw new Error('Outbox event GROUP_JOIN_REQUEST_RECEIVED was not created for admin');

      console.log('  ✔ Valid join request created with 201 (type: join_request, status: pending)');
      console.log('  ✔ Student NOT added to members; admin Outbox event GROUP_JOIN_REQUEST_RECEIVED created');
    }

    // 2E: Duplicate pending join request rejected (409 Conflict)
    {
      const req = {
        userId: studentA,
        params: { groupId: groupIdStr },
        body: { travelId: travelA._id.toString() }
      };
      const res = createMockRes();
      await createJoinRequest(req, res);
      if (res.statusCode !== 409) throw new Error(`Expected 409 for duplicate join request, got ${res.statusCode}`);
      console.log('  ✔ Duplicate pending join request rejected with 409 Conflict');
    }

    // -------------------------------------------------------------
    // TEST 3: Admin Join Request Inbox (GET /api/groups/:groupId/join-requests)
    // -------------------------------------------------------------
    console.log('\nTEST 3: Admin Join Request Inbox');

    // 3A: Non-admin rejected (403 Forbidden)
    {
      const req = { userId: studentA, params: { groupId: groupIdStr } };
      const res = createMockRes();
      await getGroupJoinRequests(req, res);
      if (res.statusCode !== 403) throw new Error(`Expected 403 for non-admin inbox access, got ${res.statusCode}`);
      console.log('  ✔ Non-admin accessing join requests inbox rejected with 403');
    }

    // 3B: Admin retrieves join requests inbox with safe requester profile
    {
      const req = { userId: adminId, params: { groupId: groupIdStr } };
      const res = createMockRes();
      await getGroupJoinRequests(req, res);
      if (res.statusCode !== 200 || !Array.isArray(res.body.data)) {
        throw new Error(`Expected 200 array from inbox, got ${res.statusCode}`);
      }
      if (res.body.data.length < 1) throw new Error('Created join request not found in admin inbox');
      const item = res.body.data[0];
      if (item.type !== 'join_request') throw new Error('Inbox mixed invitations with join requests');
      if (item.requester?.name !== 'Alice Student') throw new Error('Requester profile enrichment failed');
      if (item.requester?.phone || item.requester?.email) {
        throw new Error('Privacy breach: Sensitive student info leaked in inbox');
      }
      console.log('  ✔ Admin retrieved join requests inbox with enriched, safe student profiles');
    }

    // -------------------------------------------------------------
    // TEST 4: Admin Accept Join Request Validations
    // -------------------------------------------------------------
    console.log('\nTEST 4: Admin Accept Join Request Validations');

    const reqAIdStr = joinRequestA._id.toString();

    // 4A: Non-admin cannot accept (403)
    {
      const req = { userId: studentB, params: { requestId: reqAIdStr } };
      const res = createMockRes();
      await acceptStudentJoinRequest(req, res);
      if (res.statusCode !== 403) throw new Error(`Expected 403 when non-admin accepts, got ${res.statusCode}`);
      console.log('  ✔ Non-admin accepting join request rejected with 403 Forbidden');
    }

    // 4B: Admin accepts join request successfully (200)
    {
      const req = { userId: adminId, params: { requestId: reqAIdStr } };
      const res = createMockRes();
      await acceptStudentJoinRequest(req, res);
      if (res.statusCode !== 200) {
        throw new Error(`Expected 200 on accept, got ${res.statusCode}: ${res.body?.message}`);
      }
      const data = res.body.data;
      if (data.joinRequest.status !== 'accepted' || data.joinRequest.respondedBy !== adminId) {
        throw new Error('Join request status or respondedBy not updated');
      }

      // Verify studentA was added to group.members with role 'member'
      const freshGroup = await SharedRideGroup.findById(openGroup._id);
      if (freshGroup.members.length !== 2) {
        throw new Error(`Expected 2 members after acceptance, found ${freshGroup.members.length}`);
      }
      const memberA = freshGroup.members.find((m) => m.userId === studentA);
      if (!memberA || memberA.role !== 'member') {
        throw new Error('Accepted student was not added as role "member"');
      }

      // Verify requester notification GROUP_JOIN_REQUEST_ACCEPTED created
      const notif = await Outbox.findOne({
        eventType: 'GROUP_JOIN_REQUEST_ACCEPTED',
        recipientId: studentA,
        'payload.groupId': openGroup._id
      });
      if (!notif) throw new Error('Outbox event GROUP_JOIN_REQUEST_ACCEPTED was not created for requester');

      console.log('  ✔ Admin accepted join request (200); added student to group.members (role: member)');
      console.log('  ✔ Requester Outbox notification GROUP_JOIN_REQUEST_ACCEPTED generated');
    }

    // 4C: Cannot accept already-accepted join request (400)
    {
      const req = { userId: adminId, params: { requestId: reqAIdStr } };
      const res = createMockRes();
      await acceptStudentJoinRequest(req, res);
      if (res.statusCode !== 400) throw new Error(`Expected 400 for repeated accept, got ${res.statusCode}`);
      console.log('  ✔ Already accepted join request rejected from repeated acceptance with 400');
    }

    // -------------------------------------------------------------
    // TEST 5: Admin Reject Join Request Validations
    // -------------------------------------------------------------
    console.log('\nTEST 5: Admin Reject Join Request Validations');

    // Create a join request from studentB to test rejection
    const joinReqB = await GroupJoinRequest.create({
      groupId: openGroup._id,
      requesterId: studentB,
      requesterTravelId: travelB._id,
      senderId: studentB,
      recipientId: adminId,
      type: 'join_request',
      status: 'pending'
    });
    const reqBIdStr = joinReqB._id.toString();

    // 5A: Non-admin cannot reject (403)
    {
      const req = { userId: studentA, params: { requestId: reqBIdStr } };
      const res = createMockRes();
      await rejectStudentJoinRequest(req, res);
      if (res.statusCode !== 403) throw new Error(`Expected 403 when non-admin rejects, got ${res.statusCode}`);
      console.log('  ✔ Non-admin rejecting join request rejected with 403');
    }

    // 5B: Admin rejects successfully (200)
    {
      const req = { userId: adminId, params: { requestId: reqBIdStr } };
      const res = createMockRes();
      await rejectStudentJoinRequest(req, res);
      if (res.statusCode !== 200) {
        throw new Error(`Expected 200 on reject, got ${res.statusCode}: ${res.body?.message}`);
      }
      const data = res.body.data;
      if (data.status !== 'rejected' || data.respondedBy !== adminId) {
        throw new Error('Join request status or respondedBy not updated on reject');
      }

      // Verify studentB was NOT added to members
      const freshGroup = await SharedRideGroup.findById(openGroup._id);
      if (freshGroup.members.some((m) => m.userId === studentB)) {
        throw new Error('Rejected student was incorrectly added to members');
      }

      // Verify requester notification GROUP_JOIN_REQUEST_REJECTED created
      const notif = await Outbox.findOne({
        eventType: 'GROUP_JOIN_REQUEST_REJECTED',
        recipientId: studentB,
        'payload.groupId': openGroup._id
      });
      if (!notif) throw new Error('Outbox event GROUP_JOIN_REQUEST_REJECTED was not created for requester');

      console.log('  ✔ Admin rejected join request (200); student NOT added to members');
      console.log('  ✔ Requester Outbox notification GROUP_JOIN_REQUEST_REJECTED generated');
    }

    // 5C: Rejected join request cannot be accepted (400)
    {
      const req = { userId: adminId, params: { requestId: reqBIdStr } };
      const res = createMockRes();
      await acceptStudentJoinRequest(req, res);
      if (res.statusCode !== 400) throw new Error(`Expected 400 when accepting rejected request, got ${res.statusCode}`);
      console.log('  ✔ Rejected join request cannot be accepted (400 Bad Request)');
    }

    // -------------------------------------------------------------
    // TEST 6: Capacity Transition & Concurrency Guard
    // -------------------------------------------------------------
    console.log('\nTEST 6: Capacity Transition & Concurrency Protection');

    // Group currently has 2 members (Admin + Alice), targetCapacity is 3. Exactly 1 spot remaining!
    // Student B and Student C both request to join concurrently.
    const joinReqB2 = await GroupJoinRequest.create({
      groupId: openGroup._id,
      requesterId: studentB,
      requesterTravelId: travelB._id,
      senderId: studentB,
      recipientId: adminId,
      type: 'join_request',
      status: 'pending'
    });
    const joinReqC = await GroupJoinRequest.create({
      groupId: openGroup._id,
      requesterId: studentC,
      requesterTravelId: travelC._id,
      senderId: studentC,
      recipientId: adminId,
      type: 'join_request',
      status: 'pending'
    });

    // Attempt concurrent acceptances for the last spot
    const resAcceptB = createMockRes();
    const resAcceptC = createMockRes();

    await Promise.all([
      acceptStudentJoinRequest({ userId: adminId, params: { requestId: joinReqB2._id.toString() } }, resAcceptB),
      acceptStudentJoinRequest({ userId: adminId, params: { requestId: joinReqC._id.toString() } }, resAcceptC)
    ]);

    const statusCodes = [resAcceptB.statusCode, resAcceptC.statusCode];
    const successCount = statusCodes.filter((c) => c === 200).length;
    const rejectCount = statusCodes.filter((c) => c === 400).length;

    if (successCount !== 1 || rejectCount !== 1) {
      throw new Error(`Concurrency violation! Expected 1 success (200) and 1 rejection (400), got: ${statusCodes}`);
    }

    // Verify group transitioned to 'full' and capacity was never exceeded (exactly 3 members)
    const finalGroup = await SharedRideGroup.findById(openGroup._id);
    if (finalGroup.members.length !== 3) {
      throw new Error(`Expected exactly 3 members at capacity, found ${finalGroup.members.length}`);
    }
    if (finalGroup.status !== 'full') {
      throw new Error(`Expected group status to become "full", got "${finalGroup.status}"`);
    }
    console.log('  ✔ Concurrent acceptances handled atomically: exactly 1 succeeded, 1 rejected');
    console.log('  ✔ Group status automatically transitioned to "full" (targetCapacity = 3 reached)');

    // Verify full group no longer appears in discovery
    {
      const req = { userId: studentC, query: { travelId: travelC._id.toString() } };
      const res = createMockRes();
      await discoverSharedRideGroups(req, res);
      const match = res.body.data.find((g) => g._id.toString() === openGroup._id.toString());
      if (match) throw new Error('Full group should not appear in discovery');
      console.log('  ✔ Full group automatically excluded from discovery results');
    }

    // -------------------------------------------------------------
    // TEST 7: Expired GroupJoinRequest Cleanup & Concurrency Race (CHECK 1)
    // -------------------------------------------------------------
    console.log('\nTEST 7: Expired GroupJoinRequest Cleanup & Concurrency Race (CHECK 1)');
    {
      // 7A: Create a separate open group for testing expired cleanup
      const expTestGroup = await SharedRideGroup.create({
        adminId: studentA,
        originatingTravelId: travelA._id,
        source: 'VIT Bhopal',
        destination: 'Bhopal Junction',
        travelDate,
        departureTime: 600,
        targetCapacity: 4,
        status: 'open',
        expiresAt: new Date(Date.now() + 24 * 3600000),
        members: [
          {
            userId: studentA,
            travelId: travelA._id,
            role: 'admin',
            joinedAt: new Date()
          }
        ]
      });
      createdGroupIds.push(expTestGroup._id);

      // Pre-seed an expired pending join request for studentB (expiresAt in the past, status: 'pending')
      const expiredPendingReq = await GroupJoinRequest.create({
        groupId: expTestGroup._id,
        requesterId: studentB,
        requesterTravelId: travelB._id,
        senderId: studentB,
        recipientId: studentA,
        type: 'join_request',
        status: 'pending',
        expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
      });

      // Student B attempts to create a new join request for expTestGroup
      const resCreate = createMockRes();
      await createJoinRequest(
        {
          userId: studentB,
          params: { groupId: expTestGroup._id.toString() },
          body: { travelId: travelB._id.toString(), message: 'New fresh request after previous expired' }
        },
        resCreate
      );

      if (resCreate.statusCode !== 201) {
        throw new Error(`Expected 201 Created for new request after expired one, got ${resCreate.statusCode}: ${JSON.stringify(resCreate.body)}`);
      }

      // Verify the old pending record was updated to 'expired'
      const refreshedOldReq = await GroupJoinRequest.findById(expiredPendingReq._id);
      if (refreshedOldReq.status !== 'expired') {
        throw new Error(`Expected old pending request status to transition to 'expired', got '${refreshedOldReq.status}'`);
      }

      // Verify the new request exists with status 'pending'
      const newReqId = resCreate.body?.data?._id;
      const refreshedNewReq = await GroupJoinRequest.findById(newReqId);
      if (!refreshedNewReq || refreshedNewReq.status !== 'pending') {
        throw new Error('New request was not created with status "pending"');
      }

      console.log('  ✔ Expired pending join request does not block new request (201 Created, NO false 409)');
      console.log('  ✔ Old expired pending request atomically reconciled to status "expired"');
      console.log('  ✔ Partial unique index freed cleanly without E11000 duplicate key error');

      // 7B: Verify unexpired active pending request is STILL protected against duplicate creation (409 Conflict)
      const resDup = createMockRes();
      await createJoinRequest(
        {
          userId: studentB,
          params: { groupId: expTestGroup._id.toString() },
          body: { travelId: travelB._id.toString(), message: 'Duplicate while previous is still pending' }
        },
        resDup
      );

      if (resDup.statusCode !== 409) {
        throw new Error(`Expected 409 Conflict for active unexpired pending request, got ${resDup.statusCode}`);
      }
      if (String(resDup.body?.data?.existingRequestId) !== String(newReqId)) {
        throw new Error(`Expected 409 response to return existing unexpired request ID: ${newReqId}, got: ${resDup.body?.data?.existingRequestId}`);
      }
      console.log('  ✔ Active unexpired request still correctly triggers 409 Conflict (partial unique index preserved)');

      // 7C: Test the same expired cleanup for inviteStudentToGroup
      // Pre-seed an expired pending invitation for studentC
      const expiredPendingInvite = await GroupJoinRequest.create({
        groupId: expTestGroup._id,
        requesterId: studentC,
        requesterTravelId: travelC._id,
        senderId: studentA,
        recipientId: studentC,
        type: 'invite',
        status: 'pending',
        expiresAt: new Date(Date.now() - 3600000)
      });

      const resInvite = createMockRes();
      await inviteStudentToGroup(
        {
          userId: studentA,
          params: { groupId: expTestGroup._id.toString() },
          body: { travelId: travelC._id.toString(), message: 'New invite after previous expired' }
        },
        resInvite
      );

      if (resInvite.statusCode !== 201) {
        throw new Error(`Expected 201 Created for new invitation after expired one, got ${resInvite.statusCode}: ${JSON.stringify(resInvite.body)}`);
      }

      const refreshedOldInvite = await GroupJoinRequest.findById(expiredPendingInvite._id);
      if (refreshedOldInvite.status !== 'expired') {
        throw new Error(`Expected old pending invite status to transition to 'expired', got '${refreshedOldInvite.status}'`);
      }
      console.log('  ✔ Expired pending invitation reconciled atomically and does not block new invitation (201 Created)');
    }

    console.log('\n================================================================');
    console.log('ALL PHASE 2 PART 2 TESTS PASSED SUCCESSFULLY (100% SUCCESS)');
    console.log('================================================================');
  } finally {
    // Cleanup test fixtures
    try {
      if (createdGroupIds.length > 0) {
        await GroupJoinRequest.deleteMany({ groupId: { $in: createdGroupIds } });
        await SharedRideGroup.deleteMany({ _id: { $in: createdGroupIds } });
      }
      if (createdTravelIds.length > 0) {
        await Travel.deleteMany({ _id: { $in: createdTravelIds } });
      }
      await Student.deleteMany({ clerkId: { $in: createdStudentIds } });
      await Outbox.deleteMany({ recipientId: { $in: createdStudentIds } });
      await mongoose.disconnect();
      console.log('\nDisconnected from MongoDB & cleaned up test data.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  });

