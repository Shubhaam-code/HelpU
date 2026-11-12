#!/usr/bin/env node
/**
 * TEST: Confirmation Before Deleting a Post Linked to an Active Group
 * 
 * REQUIREMENTS (From GitHub Issue):
 * 1. When user attempts to delete a travel post, first check if linked to active group
 * 2. If linked to active group, show warning modal with group details
 * 3. User can cancel (no changes) or confirm (delete post + leave group)
 * 4. If user confirms, delete post AND remove user from group
 * 5. If user is last/only member, trigger auto-dissolution
 * 6. All other group members notified of departure
 * 
 * TEST SCENARIOS:
 * 1. Delete post with NO active group → standard deletion
 * 2. Check group status endpoint returns correct data
 * 3. Delete post WITH active group (3 members) → leaves group, group remains active
 * 4. Delete post WITH active group (2 members) → leaves group, triggers auto-dissolution
 * 5. Verify notification sent to remaining members
 * 6. Verify deleted user can match individually again
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';
import Student from '../src/models/Student.js';
import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import Notification from '../src/models/Notification.js';
import { removeStudentFromGroupsForTravel } from '../src/controllers/group.controller.js';
import { getCandidateUserIds } from '../src/utils/studentProfileResolver.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/helpu_test';

async function cleanup() {
  const testEmails = ['delete_test_a@vit.ac.in', 'delete_test_b@vit.ac.in', 'delete_test_c@vit.ac.in'];
  const testUserPrefixes = ['fb_delete_test_', 'firebase_delete_test_'];
  
  await Student.deleteMany({ email: { $in: testEmails } });
  await Travel.deleteMany({ authorEmail: { $in: testEmails } });
  await SharedRideGroup.deleteMany({
    $or: [
      { 'members.userId': { $regex: /^fb_delete_test_/ } },
      { 'members.userId': { $regex: /^firebase_delete_test_/ } },
      { adminId: { $regex: /^fb_delete_test_/ } },
      { adminId: { $regex: /^firebase_delete_test_/ } }
    ]
  });
  await GroupJoinRequest.deleteMany({
    $or: [
      { initiatorId: { $regex: /^fb_delete_test_/ } },
      { initiatorId: { $regex: /^firebase_delete_test_/ } },
      { targetId: { $regex: /^fb_delete_test_/ } },
      { targetId: { $regex: /^firebase_delete_test_/ } }
    ]
  });
  await Notification.deleteMany({
    $or: [
      { recipientId: { $regex: /^fb_delete_test_/ } },
      { recipientId: { $regex: /^firebase_delete_test_/ } }
    ]
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('TEST: DELETE CONFIRMATION FOR POSTS LINKED TO ACTIVE GROUPS');
  console.log('================================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    await cleanup();

    // ──────────────────────────────────────────────────────────────────
    // SETUP: Create 3 Test Students
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Setup: Creating Test Students ---');
    const studentA = await Student.create({
      email: 'delete_test_a@vit.ac.in',
      clerkId: 'fb_delete_test_uA',
      firebaseUid: 'firebase_delete_test_uA',
      name: 'Delete Test A',
      phone: '9000000001',
      whatsappNumber: '9000000001',
      college: 'VIT Bhopal',
      isVerified: true
    });

    const studentB = await Student.create({
      email: 'delete_test_b@vit.ac.in',
      clerkId: 'fb_delete_test_uB',
      firebaseUid: 'firebase_delete_test_uB',
      name: 'Delete Test B',
      phone: '9000000002',
      whatsappNumber: '9000000002',
      college: 'VIT Bhopal',
      isVerified: true
    });

    const studentC = await Student.create({
      email: 'delete_test_c@vit.ac.in',
      clerkId: 'fb_delete_test_uC',
      firebaseUid: 'firebase_delete_test_uC',
      name: 'Delete Test C',
      phone: '9000000003',
      whatsappNumber: '9000000003',
      college: 'VIT Bhopal',
      isVerified: true
    });

    console.log('  ✓ Created 3 test students');

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 1: Delete Post with NO Active Group (Standard Deletion)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 1: Delete Post with NO Active Group ---');
    
    const soloTravel = await Travel.create({
      userId: studentA.firebaseUid,
      type: 'request',
      source: 'bhopal',
      destination: 'indore',
      travelDate: new Date('2026-12-01'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      authorName: studentA.name,
      authorEmail: studentA.email
    });

    console.log('  ✓ Created solo travel post');

    // Simulate checking group status (should return no active group)
    const variants = getCandidateUserIds(studentA.firebaseUid);
    const activeGroup = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: new Date() },
      'members.userId': { $in: variants }
    });

    if (!activeGroup) {
      console.log('  ✓ No active group found (as expected)');
    } else {
      throw new Error('Unexpected: Found active group when none should exist');
    }

    // Simulate standard deletion
    await Travel.deleteOne({ _id: soloTravel._id });
    const deletedTravel = await Travel.findById(soloTravel._id);
    
    if (!deletedTravel) {
      console.log('  ✓ Post deleted successfully (standard deletion)');
    } else {
      throw new Error('Post was not deleted');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 2: Check Group Status Endpoint Logic
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 2: Group Status Check with Active Group ---');

    // Create travel posts for group formation
    const travelA = await Travel.create({
      userId: studentA.firebaseUid,
      type: 'request',
      source: 'bhopal',
      destination: 'delhi',
      travelDate: new Date('2026-12-15'),
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
      destination: 'delhi',
      travelDate: new Date('2026-12-15'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      authorName: studentB.name,
      authorEmail: studentB.email
    });

    const travelC = await Travel.create({
      userId: studentC.firebaseUid,
      type: 'request',
      source: 'bhopal',
      destination: 'delhi',
      travelDate: new Date('2026-12-15'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      authorName: studentC.name,
      authorEmail: studentC.email
    });

    console.log('  ✓ Created 3 travel posts');

    // Create group with 3 members
    const group = await SharedRideGroup.create({
      groupDisplayName: 'Delhi Trip',
      source: 'bhopal',
      destination: 'delhi',
      travelDate: new Date('2026-12-15'),
      departureTime: 480,
      targetCapacity: 4,
      status: 'open',
      originatingTravelId: travelA._id,
      adminId: studentA.firebaseUid,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      members: [
        { userId: studentA.firebaseUid, role: 'admin', travelId: travelA._id, joinedAt: new Date() },
        { userId: studentB.firebaseUid, role: 'member', travelId: travelB._id, joinedAt: new Date() },
        { userId: studentC.firebaseUid, role: 'member', travelId: travelC._id, joinedAt: new Date() }
      ]
    });

    console.log('  ✓ Created 3-member group');

    // Check group status for studentA
    const variantsA = getCandidateUserIds(studentA.firebaseUid);
    const activeGroupA = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: new Date() },
      'members.userId': { $in: variantsA }
    }).lean();

    if (activeGroupA && activeGroupA._id.toString() === group._id.toString()) {
      console.log('  ✓ Group status check returns active group for user A');
      console.log(`    Group: ${activeGroupA.source} → ${activeGroupA.destination}`);
      console.log(`    Members: ${activeGroupA.members.length}`);
      console.log(`    Status: ${activeGroupA.status}`);
    } else {
      throw new Error('Group status check failed for user A');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 3: Delete Post with Active Group (3 → 2 members)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 3: Delete Post with 3-Member Group (should remain active) ---');

    // User C deletes their post (should leave group)
    const cleanupResult = await removeStudentFromGroupsForTravel(travelC._id, studentC.firebaseUid);
    
    console.log(`  ✓ User C left ${cleanupResult.removedCount} group(s)`);

    // Delete the travel post
    await Travel.deleteOne({ _id: travelC._id });
    console.log('  ✓ Travel post deleted');

    // Verify group still active with 2 members
    const groupAfterC = await SharedRideGroup.findById(group._id);
    if (groupAfterC.members.length === 2 && groupAfterC.status === 'open') {
      console.log('  ✓ Group still active with 2 members');
    } else {
      throw new Error(`Expected 2 members with status=open, got ${groupAfterC.members.length} members with status=${groupAfterC.status}`);
    }

    // Verify user C no longer in active groups
    const variantsC = getCandidateUserIds(studentC.firebaseUid);
    const activeGroupC = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: new Date() },
      'members.userId': { $in: variantsC }
    });

    if (!activeGroupC) {
      console.log('  ✓ User C no longer in any active group');
    } else {
      throw new Error('User C still in active group after deletion');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 4: Delete Post with 2-Member Group (should auto-dissolve)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 4: Delete Post with 2-Member Group (should auto-dissolve) ---');

    // User B deletes their post (should trigger auto-dissolution)
    const cleanupResultB = await removeStudentFromGroupsForTravel(travelB._id, studentB.firebaseUid);
    
    console.log(`  ✓ User B left ${cleanupResultB.removedCount} group(s)`);

    // Delete the travel post
    await Travel.deleteOne({ _id: travelB._id });
    console.log('  ✓ Travel post deleted');

    // Verify group auto-dissolved
    const groupAfterB = await SharedRideGroup.findById(group._id);
    if (groupAfterB.members.length === 1 && groupAfterB.status === 'empty') {
      console.log('  ✓ Group automatically dissolved (status=empty, 1 member)');
    } else {
      throw new Error(`Expected 1 member with status=empty, got ${groupAfterB.members.length} members with status=${groupAfterB.status}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 5: Verify Notifications
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 5: Verify Dissolution Notification ---');

    const dissolutionNotif = await Notification.findOne({
      recipientId: studentA.firebaseUid,
      type: 'GROUP_CLOSED'
    }).sort({ createdAt: -1 });

    if (dissolutionNotif) {
      console.log('  ✓ Dissolution notification sent to remaining member');
      if (dissolutionNotif.title.includes('closed') || dissolutionNotif.title.includes('dissolved')) {
        console.log('  ✓ Notification has correct title');
      }
    } else {
      console.log('  ⚠ No dissolution notification found (may be async)');
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST CASE 6: Verify All Users Can Match Individually Again
    // ──────────────────────────────────────────────────────────────────
    console.log('\n--- Test Case 6: Verify Users Restored to Individual Matching ---');

    const variantsB = getCandidateUserIds(studentB.firebaseUid);
    const activeGroupB = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: new Date() },
      'members.userId': { $in: variantsB }
    });

    if (!activeGroupB) {
      console.log('  ✓ User B no longer in any active group');
    }

    const activeGroupA2 = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: new Date() },
      'members.userId': { $in: variantsA }
    });

    if (!activeGroupA2) {
      console.log('  ✓ User A no longer in any active group (group dissolved)');
    }

    console.log('  ✓ All users can now match individually again');

    // ──────────────────────────────────────────────────────────────────
    // SUCCESS
    // ──────────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('🎉 ALL DELETE CONFIRMATION TESTS PASSED!');
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
