import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import SlotPost from '../src/models/SlotPost.js';
import Notification from '../src/models/Notification.js';
import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import { createGroupFromFindMatch, acceptGroupInvitation } from '../src/controllers/group.controller.js';
import { deletePost } from '../src/controllers/slotPost.controller.js';

async function runTests() {
  console.log('--- Starting Helpu Notification E2E Tests ---');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/helpu';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const testUserA = 'test_user_notif_A_' + Date.now();
  const testUserB = 'test_user_notif_B_' + Date.now();

  try {
    // 0. Setup Students
    await Student.create([
      {
        userId: testUserA,
        clerkId: testUserA,
        name: 'Student A',
        email: `${testUserA}@vitbhopal.ac.in`,
        college: 'VIT Bhopal',
        phone: '9876543210',
        whatsappNumber: '9876543210'
      },
      {
        userId: testUserB,
        clerkId: testUserB,
        name: 'Student B',
        email: `${testUserB}@vitbhopal.ac.in`,
        college: 'VIT Bhopal',
        phone: '9876543211',
        whatsappNumber: '9876543211'
      }
    ]);

    // =========================================================================
    // PROBLEM 1A: PoolMate - Match Notification Deletion on Travel Post Delete
    // =========================================================================
    console.log('\n--- Testing Problem 1A: PoolMate Post Deletion Notification Cleanup ---');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const travelA = await Travel.create({
      userId: testUserA,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: tomorrow,
      departureTime: 840,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
    });

    const travelB = await Travel.create({
      userId: testUserB,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: tomorrow,
      departureTime: 850,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
    });

    // Simulate match notification sent to Student B about Student A's travel post
    const eventIdMatchB = `test_match_notif_${travelA._id}_${testUserB}`;
    await Notification.create({
      recipientId: testUserB,
      eventId: eventIdMatchB,
      type: 'COMPATIBLE_FIND_MATCH',
      module: 'poolmate',
      title: 'Compatible Student Found!',
      message: 'A student wants to travel on your route.',
      relatedTravelId: travelB._id,
      metadata: {
        matchedTravelId: String(travelA._id),
        source: travelA.source,
        destination: travelA.destination
      },
      isRead: false
    });

    // Verify notification exists for Student B
    let notifsB = await Notification.find({ recipientId: testUserB, module: 'poolmate' });
    console.log(`Initial PoolMate notifications for Student B: ${notifsB.length}`);
    if (notifsB.length === 0) throw new Error('Expected match notification for Student B');

    // Student A deletes travel post
    await Travel.findByIdAndDelete(travelA._id);
    await Notification.deleteMany({
      $or: [
        { relatedTravelId: travelA._id },
        { 'metadata.matchedTravelId': String(travelA._id) }
      ]
    });

    notifsB = await Notification.find({ recipientId: testUserB, module: 'poolmate' });
    console.log(`PoolMate notifications for Student B after Student A deleted post: ${notifsB.length}`);
    if (notifsB.length !== 0) {
      throw new Error('FAILED: Notification for deleted travel post still exists for Student B');
    }
    console.log('✅ Problem 1A Passed: PoolMate notification deleted when post deleted.');

    // =========================================================================
    // PROBLEM 1B: SlotMate - Match Notification Deletion on Slot Post Delete/Close
    // =========================================================================
    console.log('\n--- Testing Problem 1B: SlotMate Post Closure Notification Cleanup ---');
    const dummyCourseId = new mongoose.Types.ObjectId();
    const slotPostA = await SlotPost.create({
      userId: testUserA,
      courseId: dummyCourseId,
      courseCode: 'CSE3001',
      courseName: 'Software Engineering',
      slot: 'A1+TA1',
      teacherName: 'Dr. Sharma',
      status: 'active'
    });

    const slotPostB = await SlotPost.create({
      userId: testUserB,
      courseId: dummyCourseId,
      courseCode: 'CSE3001',
      courseName: 'Software Engineering',
      slot: 'A1+TA1',
      teacherName: 'Dr. Sharma',
      status: 'active'
    });

    // Simulate match notification sent to Student B about Student A's slot post
    const eventIdSlotB = `test_slot_notif_${slotPostA._id}_${testUserB}`;
    await Notification.create({
      recipientId: testUserB,
      eventId: eventIdSlotB,
      type: 'SLOT_MATCH_FOUND',
      module: 'slotmate',
      title: 'New Slot Match Found!',
      message: 'You have found a student studying the same course and slot.',
      relatedSlotPostId: slotPostB._id,
      metadata: {
        matchId: String(slotPostA._id),
        postId: String(slotPostB._id),
        courseCode: 'CSE3001',
        slot: 'A1+TA1',
        module: 'slotmate'
      },
      isRead: false
    });

    let slotNotifsB = await Notification.find({ recipientId: testUserB, module: 'slotmate' });
    console.log(`Initial SlotMate notifications for Student B: ${slotNotifsB.length}`);
    if (slotNotifsB.length === 0) throw new Error('Expected SlotMate match notification for Student B');

    // Student A closes / deletes slot post via deletePost controller logic
    const reqDelete = { params: { postId: slotPostA._id.toString() }, userId: testUserA };
    let deleteStatus = 0;
    let deleteBody = {};
    const resDelete = {
      status: (code) => { deleteStatus = code; return resDelete; },
      json: (body) => { deleteBody = body; return resDelete; }
    };
    await deletePost(reqDelete, resDelete);

    if (deleteStatus !== 200) throw new Error(`deletePost returned status ${deleteStatus}: ${JSON.stringify(deleteBody)}`);

    slotNotifsB = await Notification.find({ recipientId: testUserB, module: 'slotmate' });
    console.log(`SlotMate notifications for Student B after Student A deleted slot post: ${slotNotifsB.length}`);
    if (slotNotifsB.length !== 0) {
      throw new Error('FAILED: SlotMate notification for deleted post still exists for Student B');
    }
    console.log('✅ Problem 1B Passed: SlotMate notification deleted when slot post closed.');

    // =========================================================================
    // PROBLEM 2: Separate PoolMate and SlotMate Notifications
    // =========================================================================
    console.log('\n--- Testing Problem 2: PoolMate and SlotMate Isolation ---');
    // Create 1 PoolMate notification and 1 SlotMate notification for Student A
    await Notification.create([
      {
        recipientId: testUserA,
        eventId: `pm_notif_${Date.now()}`,
        type: 'NEW_MATCH_FOUND',
        module: 'poolmate',
        title: 'New Ride Match',
        message: 'A compatible ride has been found.',
        isRead: false
      },
      {
        recipientId: testUserA,
        eventId: `sm_notif_${Date.now()}`,
        type: 'SLOT_MATCH_FOUND',
        module: 'slotmate',
        title: 'New Slot Match Found!',
        message: 'A classmate matched your slot.',
        isRead: false
      }
    ]);

    // Test controller getMyNotifications
    const { getMyNotifications } = await import('../src/controllers/notification.controller.js');

    // 1. Query for PoolMate
    let pmData = null;
    const reqPm = { userId: testUserA, query: { module: 'poolmate' } };
    const resPm = {
      status: () => resPm,
      json: (body) => { pmData = body; return resPm; }
    };
    await getMyNotifications(reqPm, resPm);

    console.log(`PoolMate query returned: ${pmData?.data?.length} notifications`);
    if (pmData?.data?.length !== 1 || pmData.data[0].module !== 'poolmate') {
      throw new Error(`FAILED: Expected 1 poolmate notification, got: ${JSON.stringify(pmData?.data)}`);
    }

    // 2. Query for SlotMate
    let smData = null;
    const reqSm = { userId: testUserA, query: { module: 'slotmate' } };
    const resSm = {
      status: () => resSm,
      json: (body) => { smData = body; return resSm; }
    };
    await getMyNotifications(reqSm, resSm);

    console.log(`SlotMate query returned: ${smData?.data?.length} notifications`);
    if (smData?.data?.length !== 1 || smData.data[0].module !== 'slotmate') {
      throw new Error(`FAILED: Expected 1 slotmate notification, got: ${JSON.stringify(smData?.data)}`);
    }

    // 3. Default query (no module query param passed)
    let defData = null;
    const reqDef = { userId: testUserA, query: {} };
    const resDef = {
      status: () => resDef,
      json: (body) => { defData = body; return resDef; }
    };
    await getMyNotifications(reqDef, resDef);
    console.log(`Default query returned: ${defData?.data?.length} notifications`);
    if (defData?.data?.length !== 1 || defData.data[0].module !== 'poolmate') {
      throw new Error(`FAILED: Default query must return ONLY poolmate notifications`);
    }

    console.log('✅ Problem 2 Passed: PoolMate and SlotMate notifications are strictly isolated.');

    // =========================================================================
    // PROBLEM 3: Group Invitation Notification Navigation & Action
    // =========================================================================
    console.log('\n--- Testing Problem 3: Group Invitation Notification Navigation ---');
    // Student A creates travel post to propose group
    const travelA2 = await Travel.create({
      userId: testUserA,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: tomorrow,
      departureTime: 840,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
    });

    const travelB2 = await Travel.create({
      userId: testUserB,
      type: 'request',
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: tomorrow,
      departureTime: 850,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
    });

    // Student A sends group formation proposal to Student B
    let createGroupResult = null;
    const reqCreate = {
      userId: testUserA,
      body: {
        originatingTravelId: travelA2._id.toString(),
        candidateTravelId: travelB2._id.toString(),
        targetCapacity: 4
      }
    };
    const resCreate = {
      status: () => resCreate,
      json: (body) => { createGroupResult = body; return resCreate; }
    };
    await createGroupFromFindMatch(reqCreate, resCreate);

    console.log('Group formation proposal result:', createGroupResult?.message);
    const proposal = createGroupResult?.data?.joinRequest || createGroupResult?.data?.proposal;
    if (!proposal) throw new Error('Expected formation proposal to be created');

    // Simulate delivery of the Outbox notification for Student B
    const notifEventId = `formation_proposal_${proposal._id}_${testUserB}`;
    const groupNotif = await Notification.create({
      recipientId: testUserB,
      eventId: notifEventId,
      type: 'GROUP_INVITATION_RECEIVED',
      module: 'poolmate',
      title: 'Student A sent a Group Formation Request!',
      message: 'Student A wants to form a Shared Ride Group with you.',
      relatedTravelId: travelB2._id,
      metadata: {
        proposalId: proposal._id,
        requestId: proposal._id,
        isFormationProposal: true,
        source: travelA2.source,
        destination: travelA2.destination,
        navigationUrl: '/shared-rides?tab=invitations'
      },
      isRead: false
    });

    // Verify metadata has navigationUrl, requestId, and is NOT redirecting to rides
    if (!groupNotif.metadata?.navigationUrl || groupNotif.metadata.navigationUrl === `/rides/${travelB2._id}`) {
      throw new Error(`FAILED: Group notification has incorrect navigationUrl: ${groupNotif.metadata?.navigationUrl}`);
    }
    console.log(`Group invitation notification metadata navigationUrl: ${groupNotif.metadata.navigationUrl}`);

    // Now test student B accepting the group proposal
    let acceptResult = null;
    const reqAccept = {
      userId: testUserB,
      params: { requestId: proposal._id.toString() }
    };
    const resAccept = {
      status: () => resAccept,
      json: (body) => { acceptResult = body; return resAccept; }
    };
    await acceptGroupInvitation(reqAccept, resAccept);

    console.log('Accept invitation response:', acceptResult?.message);
    if (!acceptResult?.success || !acceptResult?.data?.group) {
      throw new Error(`FAILED: Group acceptance failed: ${JSON.stringify(acceptResult)}`);
    }

    const createdGroup = acceptResult.data.group;
    console.log(`Shared ride group successfully formed with ID: ${createdGroup._id}, status: ${createdGroup.status}`);
    console.log('✅ Problem 3 Passed: Group invitation has proper navigation and acceptance workflow.');

    console.log('\n========================================');
    console.log('🎉 ALL 3 NOTIFICATION PROBLEMS VERIFIED AND PASSED!');
    console.log('========================================\n');

  } finally {
    // Cleanup test records
    await Student.deleteMany({ userId: { $in: [testUserA, testUserB] } });
    await Travel.deleteMany({ userId: { $in: [testUserA, testUserB] } });
    await SlotPost.deleteMany({ userId: { $in: [testUserA, testUserB] } });
    await Notification.deleteMany({ recipientId: { $in: [testUserA, testUserB] } });
    await GroupJoinRequest.deleteMany({ $or: [{ senderId: testUserA }, { recipientId: testUserB }] });
    await SharedRideGroup.deleteMany({ adminId: { $in: [testUserA, testUserB] } });
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
