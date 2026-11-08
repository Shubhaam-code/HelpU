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
  inviteStudentToGroup,
  acceptGroupInvitation,
  rejectGroupInvitation,
  getSharedRideGroupById,
  getMyGroups,
  getGroupInvites,
  runInTransaction
} from '../src/controllers/group.controller.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Mock Response Helper
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
  console.log('TEST SUITE: Shared Ride Group API Phase 2 Part 1 Complete');
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
  const adminId = `admin_student_${ts}`;
  const inviteeId = `invitee_student_${ts}`;
  const otherUserId = `other_student_${ts}`;
  const thirdStudentId = `third_student_${ts}`;

  let adminStudent = null;
  let inviteeStudent = null;
  let otherStudent = null;
  let thirdStudent = null;

  let adminFindPost = null;
  let adminOfferPost = null;
  let inviteeFindPost = null;
  let thirdFindPost = null;
  let incompatibleRoutePost = null;
  let incompatibleDatePost = null;
  let incompatibleTimePost = null;
  let createdGroup = null;

  const createdGroupIds = [];
  const createdTravelIds = [];
  const createdStudentIds = [adminId, inviteeId, otherUserId, thirdStudentId];

  try {
    // 0. Setup Students
    adminStudent = await Student.create({
      clerkId: adminId,
      name: 'Admin Test Student',
      email: `admin_${ts}@vitbhopal.ac.in`,
      phone: '+919999999991',
      college: 'VIT Bhopal',
      isVerified: true
    });

    inviteeStudent = await Student.create({
      clerkId: inviteeId,
      name: 'Invitee Test Student',
      email: `invitee_${ts}@vitbhopal.ac.in`,
      phone: '+919999999992',
      college: 'VIT Bhopal',
      isVerified: true
    });

    otherStudent = await Student.create({
      clerkId: otherUserId,
      name: 'Other Test Student',
      email: `other_${ts}@vitbhopal.ac.in`,
      phone: '+919999999993',
      college: 'VIT Bhopal',
      isVerified: true
    });

    thirdStudent = await Student.create({
      clerkId: thirdStudentId,
      name: 'Third Test Student',
      email: `third_${ts}@vitbhopal.ac.in`,
      phone: '+919999999994',
      college: 'VIT Bhopal',
      isVerified: true
    });

    const today = new Date();
    const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    // Setup Travel posts
    adminFindPost = await Travel.create({
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
    createdTravelIds.push(adminFindPost._id);

    adminOfferPost = await Travel.create({
      userId: adminId,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 3,
      status: 'active'
    });
    createdTravelIds.push(adminOfferPost._id);

    inviteeFindPost = await Travel.create({
      userId: inviteeId,
      type: 'request',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 660, // 11:00 AM (diff 60 mins <= 420 mins)
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(inviteeFindPost._id);

    thirdFindPost = await Travel.create({
      userId: thirdStudentId,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 630, // 10:30 AM
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(thirdFindPost._id);

    incompatibleRoutePost = await Travel.create({
      userId: otherUserId,
      type: 'request',
      source: 'Bhopal Junction',
      destination: 'VIT Bhopal', // Opposite direction
      travelDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(incompatibleRoutePost._id);

    const nextWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9);
    incompatibleDatePost = await Travel.create({
      userId: otherUserId,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate: nextWeekDate, // Different calendar date
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(incompatibleDatePost._id);

    incompatibleTimePost = await Travel.create({
      userId: otherUserId,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 50, // 10:00 AM (600) - 50 = 550 mins diff > 420 mins
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(incompatibleTimePost._id);

    console.log('Test fixtures created successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: API A — Create Shared Ride Group Validations
    // -------------------------------------------------------------
    console.log('TEST 1: API A — Create Shared Ride Group Validations');

    // 1A: Reject missing/invalid targetCapacity
    for (const invalidCap of [0, -1, 3.5, null, undefined, 'abc']) {
      const req = {
        userId: adminId,
        body: { originatingTravelId: adminFindPost._id.toString(), targetCapacity: invalidCap }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for invalid targetCapacity (${invalidCap}), got ${res.statusCode}`);
      }
    }
    console.log('  ✔ Invalid targetCapacity (0, -1, 3.5, null, "abc") rejected with 400');

    // 1B: Reject non-existent travel post
    {
      const req = {
        userId: adminId,
        body: { originatingTravelId: new mongoose.Types.ObjectId().toString(), targetCapacity: 4 }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 404) {
        throw new Error(`Expected status 404 for non-existent post, got ${res.statusCode}`);
      }
      console.log('  ✔ Non-existent travel post rejected with 404');
    }

    // 1C: Reject travel post belonging to another student
    {
      const req = {
        userId: adminId,
        body: { originatingTravelId: inviteeFindPost._id.toString(), targetCapacity: 4 }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 403) {
        throw new Error(`Expected status 403 for post owned by another student, got ${res.statusCode}`);
      }
      console.log('  ✔ Post owned by another student rejected with 403');
    }

    // 1D: Reject OFFER posts (only FIND/request allowed)
    {
      const req = {
        userId: adminId,
        body: { originatingTravelId: adminOfferPost._id.toString(), targetCapacity: 4 }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for OFFER post, got ${res.statusCode}`);
      }
      console.log('  ✔ OFFER post creation rejected with 400 (only FIND allowed)');
    }

    // 1E: Reject invalid WhatsApp URL format
    {
      const req = {
        userId: adminId,
        body: {
          originatingTravelId: adminFindPost._id.toString(),
          targetCapacity: 4,
          whatsappGroupUrl: 'https://malicious-site.com/group'
        }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for invalid WhatsApp URL, got ${res.statusCode}`);
      }
      console.log('  ✔ Invalid WhatsApp URL rejected with 400');
    }

    // 1F: Success creation with valid inputs
    {
      const req = {
        userId: adminId,
        body: {
          originatingTravelId: adminFindPost._id.toString(),
          targetCapacity: 4,
          actualCabCapacity: 6,
          notes: 'Private coordination notes for station trip',
          whatsappGroupUrl: 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOp'
        }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 201) {
        throw new Error(`Expected status 201 for valid group creation, got ${res.statusCode}: ${res.body?.message}`);
      }
      createdGroup = res.body.data;
      createdGroupIds.push(createdGroup._id);
      if (!createdGroup || createdGroup.adminId !== adminId) {
        throw new Error('Created group adminId does not match authenticated user');
      }
      if (createdGroup.members.length !== 1 || createdGroup.members[0].role !== 'admin') {
        throw new Error('Creator was not auto-initialized as admin in members list');
      }
      if (createdGroup.status !== 'open') {
        throw new Error(`Group status must be "open", got ${createdGroup.status}`);
      }
      console.log('  ✔ Valid SharedRideGroup created with 201 (admin initialized, status open)');
    }

    // 1G: Duplicate active group prevention (409 Conflict)
    {
      const req = {
        userId: adminId,
        body: {
          originatingTravelId: adminFindPost._id.toString(),
          targetCapacity: 3
        }
      };
      const res = createMockRes();
      await createSharedRideGroup(req, res);
      if (res.statusCode !== 409) {
        throw new Error(`Expected status 409 for duplicate group creation, got ${res.statusCode}`);
      }
      console.log('  ✔ Duplicate active group for same FIND post rejected with 409 Conflict');
    }

    // -------------------------------------------------------------
    // TEST 2: API B — Invite Compatible FIND Student Validations
    // -------------------------------------------------------------
    console.log('\nTEST 2: API B — Invite Compatible FIND Student Validations');

    const groupIdStr = createdGroup._id.toString();

    // 2A: Reject non-admin inviting
    {
      const req = {
        userId: inviteeId,
        params: { id: groupIdStr },
        body: { candidateTravelId: inviteeFindPost._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 403) {
        throw new Error(`Expected status 403 when non-admin invites, got ${res.statusCode}`);
      }
      console.log('  ✔ Non-admin invite attempt rejected with 403');
    }

    // 2B: Reject inviting own post
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: { candidateTravelId: adminFindPost._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for inviting own post, got ${res.statusCode}`);
      }
      console.log('  ✔ Inviting own post rejected with 400');
    }

    // 2C: Reject candidate user ID mismatch
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: {
          candidateTravelId: inviteeFindPost._id.toString(),
          candidateUserId: otherUserId
        }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for user ID mismatch, got ${res.statusCode}`);
      }
      console.log('  ✔ Candidate user ID mismatch rejected with 400');
    }

    // 2D: Reject OFFER candidate posts
    {
      const candidateOffer = await Travel.create({
        userId: otherUserId,
        type: 'offer',
        source: 'VIT Bhopal',
        destination: 'Bhopal Junction',
        travelDate,
        departureTime: 600,
        timeFlexibility: 60,
        seats: 2,
        status: 'active'
      });
      createdTravelIds.push(candidateOffer._id);
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: { candidateTravelId: candidateOffer._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 when inviting OFFER post, got ${res.statusCode}`);
      }
      console.log('  ✔ Inviting OFFER post rejected with 400 (only FIND allowed)');
    }

    // 2E: Reject incompatible route (opposite direction)
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: { candidateTravelId: incompatibleRoutePost._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for incompatible route, got ${res.statusCode}`);
      }
      console.log('  ✔ Incompatible route rejected with 400');
    }

    // 2F: Reject different calendar date
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: { candidateTravelId: incompatibleDatePost._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for different calendar date, got ${res.statusCode}`);
      }
      console.log('  ✔ Different calendar date rejected with 400');
    }

    // 2G: Reject departure time diff > 420 minutes
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: { candidateTravelId: incompatibleTimePost._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for time difference > 420 mins, got ${res.statusCode}`);
      }
      console.log('  ✔ Departure time diff > 420 mins rejected with 400');
    }

    // 2H: Successful invitation of compatible FIND student
    let sentInvite = null;
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: {
          candidateTravelId: inviteeFindPost._id.toString(),
          candidateUserId: inviteeId,
          message: 'Hey, saw you are traveling to Bhopal station. Join our group!'
        }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 201) {
        throw new Error(`Expected status 201 for successful invitation, got ${res.statusCode}: ${res.body?.message}`);
      }
      sentInvite = res.body.data;
      if (!sentInvite || sentInvite.type !== 'invite' || sentInvite.status !== 'pending') {
        throw new Error('Created invitation has invalid type or status');
      }
      console.log('  ✔ Compatible FIND student invited with 201 (type: invite, status: pending)');
    }

    // 2I: Duplicate pending invitation prevention (409 Conflict)
    {
      const req = {
        userId: adminId,
        params: { id: groupIdStr },
        body: { candidateTravelId: inviteeFindPost._id.toString() }
      };
      const res = createMockRes();
      await inviteStudentToGroup(req, res);
      if (res.statusCode !== 409) {
        throw new Error(`Expected status 409 for duplicate pending invitation, got ${res.statusCode}`);
      }
      console.log('  ✔ Duplicate pending invitation rejected with 409 Conflict');
    }

    // -------------------------------------------------------------
    // TEST 3: Group Details Privacy Review (GET /api/groups/:id)
    // -------------------------------------------------------------
    console.log('\nTEST 3: Group Details Privacy Review');

    // 3A: Unrelated user cannot see WhatsApp link or private coordination notes
    {
      const req = { userId: otherUserId, params: { id: groupIdStr } };
      const res = createMockRes();
      await getSharedRideGroupById(req, res);
      if (res.statusCode !== 200 || !res.body.data) {
        throw new Error(`Expected 200 from getSharedRideGroupById, got ${res.statusCode}`);
      }
      const data = res.body.data;
      if (data.whatsappGroupUrl !== null) {
        throw new Error('Privacy breach: WhatsApp URL is visible to non-member');
      }
      if (data.notes !== '') {
        throw new Error('Privacy breach: Notes are visible to non-member');
      }
      console.log('  ✔ WhatsApp URL and notes masked for unauthorized/unrelated student');
    }

    // 3B: Member student profiles strictly omit private phone, email, etc.
    {
      const req = { userId: otherUserId, params: { id: groupIdStr } };
      const res = createMockRes();
      await getSharedRideGroupById(req, res);
      const member = res.body.data.members[0];
      if (member.student?.phone || member.student?.email) {
        throw new Error('Privacy breach: Private phone/email exposed in member profiles');
      }
      console.log('  ✔ Member profiles strictly omit private phone and email');
    }

    // 3C: Group Admin CAN see WhatsApp link and notes
    {
      const req = { userId: adminId, params: { id: groupIdStr } };
      const res = createMockRes();
      await getSharedRideGroupById(req, res);
      const data = res.body.data;
      if (!data.whatsappGroupUrl || !data.notes) {
        throw new Error('Group admin should be able to view WhatsApp URL and notes');
      }
      console.log('  ✔ Group Admin has full authorized access to WhatsApp link and notes');
    }

    // -------------------------------------------------------------
    // TEST 4: Accept Group Invitation Validations
    // -------------------------------------------------------------
    console.log('\nTEST 4: Accept Group Invitation Validations');

    const inviteIdStr = sentInvite._id.toString();

    // 4A: Wrong user cannot accept (403)
    {
      const req = { userId: otherUserId, params: { requestId: inviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 403) {
        throw new Error(`Expected status 403 when wrong user accepts, got ${res.statusCode}`);
      }
      console.log('  ✔ Wrong user cannot accept invitation (403 Forbidden)');
    }

    // 4B: Wrong request type cannot be accepted (400)
    {
      const fakeJoinReq = await GroupJoinRequest.create({
        groupId: createdGroup._id,
        requesterId: thirdStudentId,
        requesterTravelId: thirdFindPost._id,
        senderId: thirdStudentId,
        recipientId: adminId,
        type: 'join_request', // Not an invite
        status: 'pending'
      });
      const req = { userId: adminId, params: { requestId: fakeJoinReq._id.toString() } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for non-invite request type, got ${res.statusCode}`);
      }
      await GroupJoinRequest.deleteOne({ _id: fakeJoinReq._id });
      console.log('  ✔ Non-invite request type rejected with 400');
    }

    // 4C: Inactive or expired FIND post cannot accept (400)
    {
      // Temporarily mark invitee travel inactive
      await Travel.updateOne({ _id: inviteeFindPost._id }, { $set: { status: 'inactive' } });
      const req = { userId: inviteeId, params: { requestId: inviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for inactive travel post, got ${res.statusCode}`);
      }
      // Restore active status
      await Travel.updateOne({ _id: inviteeFindPost._id }, { $set: { status: 'active' } });
      console.log('  ✔ Inactive FIND post rejected from acceptance with 400');
    }

    // 4D: Closed group cannot accept invitations (400)
    {
      await SharedRideGroup.updateOne({ _id: createdGroup._id }, { $set: { status: 'cancelled' } });
      const req = { userId: inviteeId, params: { requestId: inviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for cancelled group, got ${res.statusCode}`);
      }
      await SharedRideGroup.updateOne({ _id: createdGroup._id }, { $set: { status: 'open' } });
      console.log('  ✔ Non-open group cannot accept invitations (400 Bad Request)');
    }

    // 4D-2: Expired group invitation cannot be accepted (400)
    {
      const originalExpiresAt = createdGroup.expiresAt;
      const pastExpiry = new Date(Date.now() - 3600000); // 1 hour ago
      await SharedRideGroup.updateOne({ _id: createdGroup._id }, { $set: { expiresAt: pastExpiry } });

      const req = { userId: inviteeId, params: { requestId: inviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);

      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 for expired group invitation, got ${res.statusCode}`);
      }
      if (res.body?.message !== 'Cannot accept invitation for an expired group') {
        throw new Error(`Expected 'Cannot accept invitation for an expired group', got: ${res.body?.message}`);
      }

      // Verify invitation in DB remains pending
      const unacceptedInvite = await GroupJoinRequest.findById(inviteIdStr);
      if (unacceptedInvite.status !== 'pending') {
        throw new Error(`Invitation status changed despite expired group! Status: ${unacceptedInvite.status}`);
      }

      // Verify group membership was NOT modified
      const unacceptedGroup = await SharedRideGroup.findById(createdGroup._id);
      if (unacceptedGroup.members.length !== 1) {
        throw new Error(`Group membership modified despite expired group! Member count: ${unacceptedGroup.members.length}`);
      }

      // Restore original valid expiry
      await SharedRideGroup.updateOne({ _id: createdGroup._id }, { $set: { expiresAt: originalExpiresAt } });
      console.log('  ✔ Expired group invitation cannot be accepted (400 Bad Request)');
      console.log('  ✔ Expired group invitation remains pending and unaccepted');
      console.log('  ✔ Expired group membership is not modified');
    }

    // 4E: Correct recipient accepts successfully (200)
    {
      const req = { userId: inviteeId, params: { requestId: inviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 200) {
        throw new Error(`Expected status 200 for successful acceptance, got ${res.statusCode}: ${res.body?.message}`);
      }
      const data = res.body.data;
      if (data.invitation.status !== 'accepted' || data.invitation.respondedBy !== inviteeId) {
        throw new Error('Invitation status or respondedBy not updated properly');
      }

      // Verify group members now has exactly 2 members
      const freshGroup = await SharedRideGroup.findById(createdGroup._id);
      if (freshGroup.members.length !== 2) {
        throw new Error(`Expected 2 members after acceptance, found ${freshGroup.members.length}`);
      }
      const newMember = freshGroup.members.find((m) => m.userId === inviteeId);
      if (!newMember || newMember.role !== 'member') {
        throw new Error('Invitee was not added as role "member" to group');
      }

      // Verify Outbox event was created for the group admin
      const acceptNotif = await Outbox.findOne({
        eventType: 'GROUP_INVITATION_ACCEPTED',
        recipientId: adminId,
        'payload.groupId': createdGroup._id
      });
      if (!acceptNotif) {
        throw new Error('Outbox event GROUP_INVITATION_ACCEPTED was not created for admin');
      }

      console.log('  ✔ Correct recipient accepted with 200; added exactly one member (role: member)');
      console.log('  ✔ Outbox event GROUP_INVITATION_ACCEPTED generated for group admin');
    }

    // 4F: Already accepted invitation cannot be accepted twice (400)
    {
      const req = { userId: inviteeId, params: { requestId: inviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 when accepting already accepted invitation, got ${res.statusCode}`);
      }
      console.log('  ✔ Already accepted invitation cannot be accepted again (400)');
    }

    // 4G: Target Capacity Transition to 'full'
    {
      // Create a 2-person group (Admin + 1 spot)
      const smallGroupPost = await Travel.create({
        userId: adminId,
        type: 'request',
        source: 'VIT Bhopal',
        destination: 'Bhopal Junction',
        travelDate,
        departureTime: 600,
        timeFlexibility: 60,
        seats: 1,
        status: 'active'
      });
      createdTravelIds.push(smallGroupPost._id);

      const smallGroupReq = {
        userId: adminId,
        body: { originatingTravelId: smallGroupPost._id.toString(), targetCapacity: 2 }
      };
      const smallGroupRes = createMockRes();
      await createSharedRideGroup(smallGroupReq, smallGroupRes);
      const smallGroup = smallGroupRes.body.data;
      createdGroupIds.push(smallGroup._id);

      // Invite third student
      const inviteReq = {
        userId: adminId,
        params: { id: smallGroup._id.toString() },
        body: { candidateTravelId: thirdFindPost._id.toString() }
      };
      const inviteRes = createMockRes();
      await inviteStudentToGroup(inviteReq, inviteRes);
      const thirdInvite = inviteRes.body.data;

      // Third student accepts
      const acceptReq = { userId: thirdStudentId, params: { requestId: thirdInvite._id.toString() } };
      const acceptRes = createMockRes();
      await acceptGroupInvitation(acceptReq, acceptRes);
      if (acceptRes.statusCode !== 200) {
        throw new Error(`Expected 200 on third student acceptance, got ${acceptRes.statusCode}`);
      }

      // Verify small group transitioned to 'full'
      const freshSmallGroup = await SharedRideGroup.findById(smallGroup._id);
      if (freshSmallGroup.status !== 'full') {
        throw new Error(`Expected group status to become "full", got "${freshSmallGroup.status}"`);
      }
      console.log('  ✔ Group status automatically transitions to "full" when targetCapacity is reached');

      // 4H: Full group cannot accept invitations (400)
      const anotherInviteReq = {
        userId: adminId,
        params: { id: smallGroup._id.toString() },
        body: { candidateTravelId: inviteeFindPost._id.toString() }
      };
      const anotherInviteRes = createMockRes();
      await inviteStudentToGroup(anotherInviteReq, anotherInviteRes);
      if (anotherInviteRes.statusCode !== 400) {
        throw new Error(`Expected status 400 when inviting to a full group, got ${anotherInviteRes.statusCode}`);
      }
      console.log('  ✔ Full group cannot send or accept further invitations (400 Bad Request)');
    }

    // 4I: Concurrent Acceptances Concurrency Guard
    {
      // Create a 2-person group with 1 available spot
      const capGroupPost = await Travel.create({
        userId: adminId,
        type: 'request',
        source: 'VIT Bhopal',
        destination: 'Bhopal Junction',
        travelDate,
        departureTime: 600,
        timeFlexibility: 60,
        seats: 1,
        status: 'active'
      });
      createdTravelIds.push(capGroupPost._id);

      const capGroupReq = {
        userId: adminId,
        body: { originatingTravelId: capGroupPost._id.toString(), targetCapacity: 2 }
      };
      const capGroupRes = createMockRes();
      await createSharedRideGroup(capGroupReq, capGroupRes);
      const capGroup = capGroupRes.body.data;
      createdGroupIds.push(capGroup._id);

      // Create two separate travel posts and invite both
      const candA = await Travel.create({
        userId: inviteeId,
        type: 'request',
        source: 'VIT Bhopal',
        destination: 'Bhopal Junction',
        travelDate,
        departureTime: 600,
        timeFlexibility: 60,
        seats: 1,
        status: 'active'
      });
      const candB = await Travel.create({
        userId: otherUserId,
        type: 'request',
        source: 'VIT Bhopal',
        destination: 'Bhopal Junction',
        travelDate,
        departureTime: 600,
        timeFlexibility: 60,
        seats: 1,
        status: 'active'
      });
      createdTravelIds.push(candA._id, candB._id);

      // Create invites
      const invA = await GroupJoinRequest.create({
        groupId: capGroup._id,
        requesterId: inviteeId,
        requesterTravelId: candA._id,
        senderId: adminId,
        recipientId: inviteeId,
        type: 'invite',
        status: 'pending'
      });
      const invB = await GroupJoinRequest.create({
        groupId: capGroup._id,
        requesterId: otherUserId,
        requesterTravelId: candB._id,
        senderId: adminId,
        recipientId: otherUserId,
        type: 'invite',
        status: 'pending'
      });

      // Simulate simultaneous acceptance
      const resA = createMockRes();
      const resB = createMockRes();
      await Promise.all([
        acceptGroupInvitation({ userId: inviteeId, params: { requestId: invA._id.toString() } }, resA),
        acceptGroupInvitation({ userId: otherUserId, params: { requestId: invB._id.toString() } }, resB)
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode];
      const successCount = statusCodes.filter((c) => c === 200).length;
      const rejectCount = statusCodes.filter((c) => c === 400).length;

      if (successCount !== 1 || rejectCount !== 1) {
        throw new Error(`Concurrency violation! Expected exactly 1 success (200) and 1 rejection (400), got: ${statusCodes}`);
      }

      const finalCapGroup = await SharedRideGroup.findById(capGroup._id);
      if (finalCapGroup.members.length > 2) {
        throw new Error(`Group exceeded capacity! Members: ${finalCapGroup.members.length}, Target: 2`);
      }
      console.log('  ✔ Concurrent acceptances handled atomically: exactly 1 succeeded, 1 rejected, capacity never exceeded');
    }

    // -------------------------------------------------------------
    // TEST 5: Reject Group Invitation Validations
    // -------------------------------------------------------------
    console.log('\nTEST 5: Reject Group Invitation Validations');

    // Create a new invite to test rejection
    const rejectTestPost = await Travel.create({
      userId: otherUserId,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });
    createdTravelIds.push(rejectTestPost._id);

    const rejectInvite = await GroupJoinRequest.create({
      groupId: createdGroup._id,
      requesterId: otherUserId,
      requesterTravelId: rejectTestPost._id,
      senderId: adminId,
      recipientId: otherUserId,
      type: 'invite',
      status: 'pending'
    });

    const rejectInviteIdStr = rejectInvite._id.toString();

    // 5A: Wrong user cannot reject (403)
    {
      const req = { userId: inviteeId, params: { requestId: rejectInviteIdStr } };
      const res = createMockRes();
      await rejectGroupInvitation(req, res);
      if (res.statusCode !== 403) {
        throw new Error(`Expected status 403 when wrong user rejects, got ${res.statusCode}`);
      }
      console.log('  ✔ Wrong user cannot reject invitation (403 Forbidden)');
    }

    // 5B: Correct recipient can reject (200)
    {
      const req = { userId: otherUserId, params: { requestId: rejectInviteIdStr } };
      const res = createMockRes();
      await rejectGroupInvitation(req, res);
      if (res.statusCode !== 200) {
        throw new Error(`Expected status 200 for successful rejection, got ${res.statusCode}: ${res.body?.message}`);
      }
      const data = res.body.data;
      if (data.status !== 'rejected' || data.respondedBy !== otherUserId) {
        throw new Error('Rejected request status or respondedBy not set correctly');
      }

      // Verify Outbox event GROUP_INVITATION_REJECTED was created for admin
      const rejectNotif = await Outbox.findOne({
        eventType: 'GROUP_INVITATION_REJECTED',
        recipientId: adminId,
        'payload.requestId': rejectInvite._id
      });
      if (!rejectNotif) {
        throw new Error('Outbox event GROUP_INVITATION_REJECTED was not created for admin');
      }
      if (rejectNotif.payload.memberId !== otherUserId || rejectNotif.payload.groupId.toString() !== createdGroup._id.toString()) {
        throw new Error('Outbox rejection event payload has invalid memberId or groupId');
      }

      console.log('  ✔ Correct recipient rejected with 200; status set to "rejected"');
      console.log('  ✔ Outbox event GROUP_INVITATION_REJECTED generated for group admin with valid payload');
    }

    // 5C: Rejected invitation does not add a member
    {
      const freshGroup = await SharedRideGroup.findById(createdGroup._id);
      const isMember = freshGroup.members.some((m) => m.userId === otherUserId);
      if (isMember) {
        throw new Error('Rejected user was incorrectly added to group members');
      }
      console.log('  ✔ Rejected invitation did not add any member to the group');
    }

    // 5D: Repeated rejection is prevented (400) and does not duplicate notification
    {
      const req = { userId: otherUserId, params: { requestId: rejectInviteIdStr } };
      const res = createMockRes();
      await rejectGroupInvitation(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 on repeated rejection, got ${res.statusCode}`);
      }

      const rejectNotifsCount = await Outbox.countDocuments({
        eventType: 'GROUP_INVITATION_REJECTED',
        recipientId: adminId,
        'payload.requestId': rejectInvite._id
      });
      if (rejectNotifsCount !== 1) {
        throw new Error(`Expected exactly 1 rejection notification, found ${rejectNotifsCount}`);
      }
      console.log('  ✔ Repeated rejection rejected with 400 (Cannot reject already rejected)');
      console.log('  ✔ Repeated rejection did not duplicate outbox notification');
    }

    // 5E: Rejected invitation cannot be accepted (400)
    {
      const req = { userId: otherUserId, params: { requestId: rejectInviteIdStr } };
      const res = createMockRes();
      await acceptGroupInvitation(req, res);
      if (res.statusCode !== 400) {
        throw new Error(`Expected status 400 when accepting a rejected invitation, got ${res.statusCode}`);
      }
      console.log('  ✔ Rejected invitation cannot be accepted (400 Bad Request)');
    }

    // -------------------------------------------------------------
    // TEST 6: Transaction Unavailable Fallback Safety
    // -------------------------------------------------------------
    console.log('\nTEST 6: Transaction Unavailable Fallback Safety');
    {
      const origStartSession = mongoose.startSession;
      try {
        // Mock startSession failure (simulating standalone MongoDB without replica set)
        mongoose.startSession = async () => {
          throw new Error('Standalone MongoDB does not support multi-document transactions');
        };

        // Create a test invitation
        const txFailInvite = await GroupJoinRequest.create({
          groupId: createdGroup._id,
          requesterId: otherUserId,
          requesterTravelId: rejectTestPost._id,
          senderId: adminId,
          recipientId: otherUserId,
          type: 'invite',
          status: 'pending'
        });

        const req = { userId: otherUserId, params: { requestId: txFailInvite._id.toString() } };
        const res = createMockRes();
        await acceptGroupInvitation(req, res);

        if (res.statusCode !== 500) {
          throw new Error(`Expected 500 when transaction cannot start, got ${res.statusCode}`);
        }
        if (!res.body.message.includes('Transactions are required for multi-document operations')) {
          throw new Error(`Expected clear transaction error message, got: ${res.body.message}`);
        }

        // Verify request remains pending and no member added
        const unchangedInvite = await GroupJoinRequest.findById(txFailInvite._id);
        if (unchangedInvite.status !== 'pending') {
          throw new Error('Join request was partially updated despite transaction failure');
        }

        const freshGroup = await SharedRideGroup.findById(createdGroup._id);
        const hasMember = freshGroup.members.some((m) => m.userId === otherUserId);
        if (hasMember) {
          throw new Error('Group member was partially added despite transaction failure');
        }

        console.log('  ✔ Fails safely with 500 when transactions are unavailable (no silent downgrade)');
        console.log('  ✔ Multi-document consistency preserved: 0 partial updates, 0 orphan memberships');
      } finally {
        mongoose.startSession = origStartSession;
      }
    }

    // -------------------------------------------------------------
    // TEST 7: MongoDB Transaction Commit Failure & Retry Handling (CHECK 2)
    // -------------------------------------------------------------
    console.log('\nTEST 7: MongoDB Transaction Commit Failure & Retry Handling (CHECK 2)');

    // 7A: UnknownTransactionCommitResult commit retry without re-executing callback (Mocked)
    {
      const origStartSession = mongoose.startSession;
      let callbackExecutionCount = 0;
      let commitAttemptCount = 0;
      let sessionEnded = false;

      try {
        mongoose.startSession = async () => {
          return {
            startTransaction: () => {},
            commitTransaction: async () => {
              commitAttemptCount++;
              if (commitAttemptCount === 1) {
                const err = new Error('Primary network blip during commit');
                err.errorLabels = ['UnknownTransactionCommitResult'];
                err.hasErrorLabel = (label) => label === 'UnknownTransactionCommitResult';
                throw err;
              }
              // Succeeds on 2nd attempt
            },
            abortTransaction: async () => {},
            endSession: async () => {
              sessionEnded = true;
            }
          };
        };

        const result = await runInTransaction(async (session) => {
          callbackExecutionCount++;
          return 'success_payload';
        });

        if (result !== 'success_payload') {
          throw new Error(`Expected success_payload, got ${result}`);
        }
        if (callbackExecutionCount !== 1) {
          throw new Error(`Callback was executed ${callbackExecutionCount} times! Expected exactly 1 to avoid duplicate writes`);
        }
        if (commitAttemptCount !== 2) {
          throw new Error(`Commit was attempted ${commitAttemptCount} times! Expected 2 (1 failure + 1 retry)`);
        }
        if (!sessionEnded) {
          throw new Error('Session was not ended after commit retry');
        }

        console.log('  ✔ [Mocked] UnknownTransactionCommitResult retried commit on same session without re-executing callback');
        console.log('  ✔ [Mocked] Zero duplicate writes / array pushes / Outbox events on commit retry');
      } finally {
        mongoose.startSession = origStartSession;
      }
    }

    // 7B: TransientTransactionError statement failure retries full outer loop (Mocked)
    {
      const origStartSession = mongoose.startSession;
      let sessionCount = 0;
      let callbackExecutionCount = 0;
      let endedSessionCount = 0;

      try {
        mongoose.startSession = async () => {
          sessionCount++;
          return {
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {
              endedSessionCount++;
            }
          };
        };

        const result = await runInTransaction(async (session) => {
          callbackExecutionCount++;
          if (callbackExecutionCount === 1) {
            const transientErr = new Error('WriteConflict on primary');
            transientErr.errorLabels = ['TransientTransactionError'];
            transientErr.hasErrorLabel = (label) => label === 'TransientTransactionError';
            transientErr.code = 112;
            throw transientErr;
          }
          return 'retry_succeeded';
        });

        if (result !== 'retry_succeeded') {
          throw new Error(`Expected retry_succeeded, got ${result}`);
        }
        if (callbackExecutionCount !== 2) {
          throw new Error(`Expected callback to be executed twice for transient error, got ${callbackExecutionCount}`);
        }
        if (sessionCount !== 2) {
          throw new Error(`Expected 2 distinct sessions across transient retries, got ${sessionCount}`);
        }
        if (endedSessionCount !== 2) {
          throw new Error(`Expected all sessions to be cleanly ended in finally, got ${endedSessionCount}`);
        }

        console.log('  ✔ [Mocked] TransientTransactionError (WriteConflict) cleanly retried outer loop with new session');
        console.log('  ✔ [Mocked] All sessions properly closed via finally block');
      } finally {
        mongoose.startSession = origStartSession;
      }
    }

    console.log('\n================================================================');
    console.log('ALL PHASE 2 PART 1 TESTS PASSED SUCCESSFULLY (100% SUCCESS)');
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
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  });
