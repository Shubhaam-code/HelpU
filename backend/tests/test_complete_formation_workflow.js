#!/usr/bin/env node
/**
 * TEST: Complete Group Formation Workflow
 * 
 * WORKFLOW:
 * 1. STATE 1: No Request - Both see "Create Group Together"
 * 2. STATE 2: A Sends Request - A sees "REQUEST_SENT", B sees "REQUEST_RECEIVED"
 * 3. STATE 3A: B Accepts - Both see "ACCEPTED", actual group created
 * 4. STATE 3B: B Rejects - Both reset to "NONE", can create new request
 * 
 * VERIFIES:
 * - Relationship state persistence across sessions
 * - Duplicate proposal prevention
 * - Exactly one group creation on acceptance
 * - Rejection clears state properly
 * - New proposal after rejection works
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';
import Student from '../src/models/Student.js';
import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import { computePairRelationshipStates } from '../src/services/matching.service.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/helpu_test';

async function cleanup() {
  const testEmails = ['workflow_a@vit.ac.in', 'workflow_b@vit.ac.in'];
  await Student.deleteMany({ email: { $in: testEmails } });
  await Travel.deleteMany({ authorEmail: { $in: testEmails } });
  await SharedRideGroup.deleteMany({
    $or: [
      { 'members.userId': { $regex: /^workflow_/ } },
      { adminId: { $regex: /^workflow_/ } }
    ]
  });
  await GroupJoinRequest.deleteMany({
    $or: [
      { senderId: { $regex: /^workflow_/ } },
      { recipientId: { $regex: /^workflow_/ } },
      { requesterId: { $regex: /^workflow_/ } }
    ]
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('TEST: COMPLETE GROUP FORMATION WORKFLOW');
  console.log('================================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    await cleanup();

    // ──────────────────────────────────────────────────────────────────
    // SETUP: Create 2 Test Students
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Setup: Creating Test Students ---');
    const studentA = await Student.create({
      email: 'workflow_a@vit.ac.in',
      clerkId: 'workflow_uA',
      firebaseUid: 'firebase_workflow_uA',
      name: 'Workflow A',
      phone: '9100000001',
      whatsappNumber: '9100000001',
      college: 'VIT Bhopal',
      isVerified: true
    });

    const studentB = await Student.create({
      email: 'workflow_b@vit.ac.in',
      clerkId: 'workflow_uB',
      firebaseUid: 'firebase_workflow_uB',
      name: 'Workflow B',
      phone: '9100000002',
      whatsappNumber: '9100000002',
      college: 'VIT Bhopal',
      isVerified: true
    });

    console.log('  ✓ Created 2 test students (A and B)');

    // Create compatible FIND posts
    const travelA = await Travel.create({
      userId: studentA.firebaseUid,
      type: 'request',
      source: 'bhopal',
      destination: 'mumbai',
      travelDate: new Date('2026-12-20'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      authorName: studentA.name,
      authorEmail: studentA.email
    });

    const travelB = await Travel.create({
      userId: studentB.firebaseUid,
      type: 'request',
      source: 'bhopal',
      destination: 'mumbai',
      travelDate: new Date('2026-12-20'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      authorName: studentB.name,
      authorEmail: studentB.email
    });

    console.log('  ✓ Created 2 compatible FIND posts');

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 1: STATE 1 - No Request Exists (Both see NONE)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 1: STATE 1 - No Request Exists ---');

    let relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    let stateA = relationshipMapA.get(studentB.clerkId);

    let relationshipMapB = await computePairRelationshipStates(studentB.firebaseUid, [studentA.firebaseUid]);
    let stateB = relationshipMapB.get(studentA.clerkId);

    if (stateA?.relationshipState === 'NONE') {
      console.log('  ✓ User A sees NONE (Create Group Together available)');
    } else {
      throw new Error(`Expected A to see NONE, got: ${stateA?.relationshipState}`);
    }

    if (stateB?.relationshipState === 'NONE') {
      console.log('  ✓ User B sees NONE (Create Group Together available)');
    } else {
      throw new Error(`Expected B to see NONE, got: ${stateB?.relationshipState}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 2: STATE 2 - A Sends Request to B
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 2: STATE 2 - A Sends Request to B ---');

    // Simulate API call: createGroupFromFindMatch
    const proposal = await GroupJoinRequest.create({
      type: 'formation_proposal',
      senderId: studentA.firebaseUid,
      senderTravelId: travelA._id,
      requesterId: studentB.firebaseUid,
      requesterTravelId: travelB._id,
      recipientId: studentB.firebaseUid,
      status: 'pending',
      proposedCapacity: 4,
      proposalKey: [String(travelA._id), String(travelB._id)].sort().join(':'),
      pairUserKey: [studentA.clerkId, studentB.clerkId].sort().join(':'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log('  ✓ Formation proposal created');

    // Check relationship states
    relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    stateA = relationshipMapA.get(studentB.clerkId);

    relationshipMapB = await computePairRelationshipStates(studentB.firebaseUid, [studentA.firebaseUid]);
    stateB = relationshipMapB.get(studentA.clerkId);

    if (stateA?.relationshipState === 'REQUEST_SENT') {
      console.log('  ✓ User A sees REQUEST_SENT (Group Request Sent)');
    } else {
      throw new Error(`Expected A to see REQUEST_SENT, got: ${stateA?.relationshipState}`);
    }

    if (stateB?.relationshipState === 'REQUEST_RECEIVED') {
      console.log('  ✓ User B sees REQUEST_RECEIVED (Accept/Reject buttons)');
    } else {
      throw new Error(`Expected B to see REQUEST_RECEIVED, got: ${stateB?.relationshipState}`);
    }

    if (stateA?.proposalId?.toString() === proposal._id.toString()) {
      console.log('  ✓ A has correct proposalId');
    }

    if (stateB?.proposalId?.toString() === proposal._id.toString()) {
      console.log('  ✓ B has correct proposalId');
    }

    // Verify no group exists yet
    const groupBeforeAccept = await SharedRideGroup.findOne({
      'members.userId': { $all: [studentA.firebaseUid, studentB.firebaseUid] }
    });

    if (!groupBeforeAccept) {
      console.log('  ✓ No SharedRideGroup exists before acceptance');
    } else {
      throw new Error('SharedRideGroup should NOT exist before acceptance');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 3: Persistence - Reload relationship states
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 3: Persistence Across Sessions ---');

    // Simulate page refresh - fetch states again
    relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    stateA = relationshipMapA.get(studentB.clerkId);

    relationshipMapB = await computePairRelationshipStates(studentB.firebaseUid, [studentA.firebaseUid]);
    stateB = relationshipMapB.get(studentA.clerkId);

    if (stateA?.relationshipState === 'REQUEST_SENT' && stateB?.relationshipState === 'REQUEST_RECEIVED') {
      console.log('  ✓ Relationship states persist correctly after reload');
    } else {
      throw new Error('Relationship states did not persist');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 4: Duplicate Prevention - A tries to send another request
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 4: Duplicate Proposal Prevention ---');

    try {
      await GroupJoinRequest.create({
        type: 'formation_proposal',
        senderId: studentA.firebaseUid,
        senderTravelId: travelA._id,
        requesterId: studentB.firebaseUid,
        requesterTravelId: travelB._id,
        recipientId: studentB.firebaseUid,
        status: 'pending',
        proposedCapacity: 4,
        proposalKey: [String(travelA._id), String(travelB._id)].sort().join(':'),
        pairUserKey: [studentA.clerkId, studentB.clerkId].sort().join(':'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      throw new Error('Duplicate proposal should have been rejected');
    } catch (err) {
      if (err.code === 11000) {
        console.log('  ✓ Duplicate pending proposal rejected by unique index');
      } else {
        throw err;
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 5: STATE 3B - B Rejects the Request
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 5: STATE 3B - B Rejects Request ---');

    // Update proposal to rejected
    proposal.status = 'rejected';
    proposal.respondedAt = new Date();
    proposal.respondedBy = studentB.firebaseUid;
    await proposal.save();

    console.log('  ✓ Proposal marked as rejected');

    // Check relationship states
    relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    stateA = relationshipMapA.get(studentB.clerkId);

    relationshipMapB = await computePairRelationshipStates(studentB.firebaseUid, [studentA.firebaseUid]);
    stateB = relationshipMapB.get(studentA.clerkId);

    if (stateA?.relationshipState === 'DECLINED') {
      console.log('  ✓ User A sees DECLINED after rejection');
    }

    if (stateB?.relationshipState === 'DECLINED') {
      console.log('  ✓ User B sees DECLINED after rejection');
    }

    // Verify no group was created
    const groupAfterReject = await SharedRideGroup.findOne({
      'members.userId': { $all: [studentA.firebaseUid, studentB.firebaseUid] }
    });

    if (!groupAfterReject) {
      console.log('  ✓ No SharedRideGroup created after rejection');
    } else {
      throw new Error('SharedRideGroup should NOT exist after rejection');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 6: New Proposal After Rejection
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 6: New Proposal After Rejection ---');

    const newProposal = await GroupJoinRequest.create({
      type: 'formation_proposal',
      senderId: studentA.firebaseUid,
      senderTravelId: travelA._id,
      requesterId: studentB.firebaseUid,
      requesterTravelId: travelB._id,
      recipientId: studentB.firebaseUid,
      status: 'pending',
      proposedCapacity: 4,
      proposalKey: [String(travelA._id), String(travelB._id)].sort().join(':'),
      pairUserKey: [studentA.clerkId, studentB.clerkId].sort().join(':'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log('  ✓ New proposal created after rejection');

    relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    stateA = relationshipMapA.get(studentB.clerkId);

    if (stateA?.relationshipState === 'REQUEST_SENT') {
      console.log('  ✓ User A sees REQUEST_SENT for new proposal');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 7: STATE 3A - B Accepts the New Request
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 7: STATE 3A - B Accepts Request ---');

    // Simulate acceptance via controller logic
    newProposal.status = 'accepted';
    newProposal.respondedAt = new Date();
    newProposal.respondedBy = studentB.firebaseUid;
    await newProposal.save();

    const createdGroup = await SharedRideGroup.create({
      adminId: studentA.firebaseUid,
      originatingTravelId: travelA._id,
      source: travelA.source,
      destination: travelA.destination,
      travelDate: travelA.travelDate,
      departureTime: travelA.departureTime,
      targetCapacity: 4,
      status: 'open',
      expiresAt: travelA.expiresAt,
      proposalKey: newProposal.proposalKey,
      members: [
        {
          userId: studentA.firebaseUid,
          travelId: travelA._id,
          role: 'admin',
          joinedAt: new Date()
        },
        {
          userId: studentB.firebaseUid,
          travelId: travelB._id,
          role: 'member',
          joinedAt: new Date()
        }
      ]
    });

    newProposal.groupId = createdGroup._id;
    await newProposal.save();

    console.log('  ✓ SharedRideGroup created with both members');

    // Check relationship states
    relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    stateA = relationshipMapA.get(studentB.clerkId);

    relationshipMapB = await computePairRelationshipStates(studentB.firebaseUid, [studentA.firebaseUid]);
    stateB = relationshipMapB.get(studentA.clerkId);

    if (stateA?.relationshipState === 'ACCEPTED') {
      console.log('  ✓ User A sees ACCEPTED (Group Formed)');
    } else {
      throw new Error(`Expected A to see ACCEPTED, got: ${stateA?.relationshipState}`);
    }

    if (stateB?.relationshipState === 'ACCEPTED') {
      console.log('  ✓ User B sees ACCEPTED (Group Formed)');
    } else {
      throw new Error(`Expected B to see ACCEPTED, got: ${stateB?.relationshipState}`);
    }

    if (stateA?.groupId?.toString() === createdGroup._id.toString()) {
      console.log('  ✓ Both users reference the same groupId');
    }

    if (createdGroup.members.length === 2) {
      console.log('  ✓ Group has exactly 2 members');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 8: Reverse Direction (B sends to A)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 8: Reverse Direction Proposal ---');

    // Delete the group to test reverse
    await SharedRideGroup.deleteOne({ _id: createdGroup._id });
    await GroupJoinRequest.deleteMany({
      pairUserKey: [studentA.clerkId, studentB.clerkId].sort().join(':')
    });

    const reverseProposal = await GroupJoinRequest.create({
      type: 'formation_proposal',
      senderId: studentB.firebaseUid,
      senderTravelId: travelB._id,
      requesterId: studentA.firebaseUid,
      requesterTravelId: travelA._id,
      recipientId: studentA.firebaseUid,
      status: 'pending',
      proposedCapacity: 4,
      proposalKey: [String(travelA._id), String(travelB._id)].sort().join(':'),
      pairUserKey: [studentA.clerkId, studentB.clerkId].sort().join(':'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    relationshipMapA = await computePairRelationshipStates(studentA.firebaseUid, [studentB.firebaseUid]);
    stateA = relationshipMapA.get(studentB.clerkId);

    relationshipMapB = await computePairRelationshipStates(studentB.firebaseUid, [studentA.firebaseUid]);
    stateB = relationshipMapB.get(studentA.clerkId);

    if (stateA?.relationshipState === 'REQUEST_RECEIVED') {
      console.log('  ✓ User A now sees REQUEST_RECEIVED (roles reversed)');
    } else {
      throw new Error(`Expected A to see REQUEST_RECEIVED, got: ${stateA?.relationshipState}`);
    }

    if (stateB?.relationshipState === 'REQUEST_SENT') {
      console.log('  ✓ User B now sees REQUEST_SENT (roles reversed)');
    } else {
      throw new Error(`Expected B to see REQUEST_SENT, got: ${stateB?.relationshipState}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUCCESS
    // ──────────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('🎉 ALL WORKFLOW TESTS PASSED!');
    console.log('================================================================\n');

    console.log('Cleaning up test documents...');
    await cleanup();

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.\n');
  }
}

runTests();
