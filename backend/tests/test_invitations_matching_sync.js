/**
 * Test: Invitations-Matching UI Synchronization Bug
 * 
 * Verifies that pending formation proposals appear consistently in BOTH:
 * 1. Invitations page (Sent/Received)
 * 2. Matching page (Compatible Students with correct relationship state)
 * 
 * BUG REPRODUCTION:
 * - User A sends B a group formation request
 * - Request appears in A's Sent Invitations ✓
 * - Request appears in B's Received Invitations ✓
 * - BUT: Both A and B still see "Create Group Together" in Matching page ✗
 */

import mongoose from 'mongoose';
import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

import Travel from '../src/models/Travel.js';
import Student from '../src/models/Student.js';
import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';

const TEST_PREFIX = 'SYNC_TEST_';

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  await Travel.deleteMany({ authorName: { $regex: /^SYNC_TEST_/ } });
  await Student.deleteMany({ name: { $regex: /^SYNC_TEST_/ } });
  await SharedRideGroup.deleteMany({ displayName: { $regex: /^SYNC_TEST_/ } });
  await GroupJoinRequest.deleteMany({
    $or: [
      { proposalKey: { $regex: /SYNC_TEST_/ } },
      { pairUserKey: { $regex: /SYNC_TEST_/ } }
    ]
  });
  console.log('✅ Cleanup complete');
}

async function createTestUser(name, firebaseUid) {
  const student = await Student.create({
    userId: firebaseUid,
    firebaseUid,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '')}@test.com`,
    college: 'VIT Bhopal',
    branch: 'CSE',
    isVerified: true,
    createdAt: new Date()
  });
  console.log(`✅ Created test user: ${name} (${firebaseUid})`);
  return student;
}

async function createFindPost(userId, authorName, source, destination, date) {
  const travel = await Travel.create({
    userId,
    authorName,
    type: 'request',
    source,
    destination,
    travelDate: date,
    departureTime: 480, // 08:00 AM
    timeFlexibility: 60, // 1 hour flexibility
    seats: 1,
    status: 'active',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date()
  });
  console.log(`✅ Created FIND post: ${authorName} (${source} → ${destination})`);
  return travel;
}

async function getSentProposalsAPI(userId) {
  const { getCandidateUserIds } = await import('../src/utils/studentProfileResolver.js');
  const now = new Date();
  const userVariants = getCandidateUserIds(userId);
  
  const proposals = await GroupJoinRequest.find({
    senderId: { $in: userVariants.length > 0 ? userVariants : [userId] },
    type: { $in: ['formation_proposal', 'invite'] },
    status: { $in: ['pending', 'accepted', 'rejected', 'declined'] }
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const enriched = proposals.filter((p) => {
    return !(p.status === 'pending' && p.expiresAt && new Date(p.expiresAt) <= now);
  });

  return enriched;
}

async function getReceivedInvitationsAPI(userId) {
  const { getCandidateUserIds } = await import('../src/utils/studentProfileResolver.js');
  const now = new Date();
  const userVariants = getCandidateUserIds(userId);
  
  const invitations = await GroupJoinRequest.find({
    $or: [
      { requesterId: { $in: userVariants } },
      { recipientId: { $in: userVariants } }
    ],
    type: { $in: ['formation_proposal', 'invite'] },
    status: { $in: ['pending', 'accepted', 'rejected', 'declined'] }
  })
    .populate('groupId', 'source destination travelDate departureTime targetCapacity status members')
    .populate('senderTravelId', 'source destination travelDate departureTime')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  // Filter recipient-facing invites only
  const recipientInvites = invitations.filter((inv) => {
    if (inv.status === 'pending' && inv.expiresAt && new Date(inv.expiresAt) <= now) {
      return false;
    }
    
    const recipientId = inv.requesterId || inv.recipientId;
    return userVariants.some(variant => variant.toString() === recipientId?.toString());
  });

  return recipientInvites;
}

async function getMatchingRelationshipState(viewerUserId, peerUserId) {
  // Import matching service functions
  const { computePairRelationshipStates } = await import('../src/services/matching.service.js');
  const { stripFirebasePrefix } = await import('../src/utils/studentProfileResolver.js');
  
  const relationshipMap = await computePairRelationshipStates(viewerUserId, [peerUserId]);
  const rawKey = stripFirebasePrefix(peerUserId) || peerUserId;
  const relationship = relationshipMap.get(rawKey) || {
    relationshipState: 'NONE',
    proposalId: null,
    proposedCapacity: null,
    groupId: null
  };
  
  return relationship;
}

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    await cleanup();

    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: Request Synchronization - Check Invitations APIs');
    console.log('='.repeat(80));

    // Create two test users
    const userA = await createTestUser(`${TEST_PREFIX}Alice`, `${TEST_PREFIX}firebase_alice_001`);
    const userB = await createTestUser(`${TEST_PREFIX}Bob`, `${TEST_PREFIX}firebase_bob_002`);

    // Create compatible FIND posts
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    
    const postA = await createFindPost(
      userA.firebaseUid,
      userA.name,
      'VIT Bhopal Campus',
      'Bhopal Railway Station',
      targetDate
    );

    const postB = await createFindPost(
      userB.firebaseUid,
      userB.name,
      'VIT Bhopal Campus',
      'Bhopal Railway Station',
      targetDate
    );

    console.log('\n📝 Creating formation proposal from A to B...');
    
    const { buildPairUserKey } = await import('../src/services/matching.service.js');
    const proposalKey = [String(postA._id), String(postB._id)].sort().join(':');
    const pairUserKey = buildPairUserKey(userA.firebaseUid, userB.firebaseUid);
    
    const proposal = await GroupJoinRequest.create({
      groupId: null,
      type: 'formation_proposal',
      requesterId: userB.firebaseUid,
      requesterTravelId: postB._id,
      senderId: userA.firebaseUid,
      senderTravelId: postA._id,
      recipientId: userB.firebaseUid,
      proposedCapacity: 4,
      proposalKey,
      pairUserKey,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      message: 'Test group formation request'
    });

    console.log(`✅ Formation proposal created: ${proposal._id}`);
    console.log(`   proposalKey: ${proposalKey}`);
    console.log(`   pairUserKey: ${pairUserKey}`);
    console.log(`   status: ${proposal.status}`);

    // Check MongoDB document directly
    console.log('\n🔍 Verifying MongoDB document...');
    const dbProposal = await GroupJoinRequest.findById(proposal._id).lean();
    console.log('   MongoDB document:', {
      _id: dbProposal._id,
      type: dbProposal.type,
      status: dbProposal.status,
      senderId: dbProposal.senderId,
      recipientId: dbProposal.recipientId,
      proposalKey: dbProposal.proposalKey,
      pairUserKey: dbProposal.pairUserKey
    });

    // Check Sent Invitations for A
    console.log('\n📤 Checking A\'s Sent Invitations API...');
    const aSent = await getSentProposalsAPI(userA.firebaseUid);
    console.log(`   Found ${aSent.length} sent invitation(s)`);
    if (aSent.length > 0) {
      console.log('   ✅ PASS: A sees the proposal in Sent Invitations');
      console.log('   Details:', {
        proposalId: aSent[0]._id,
        status: aSent[0].status,
        recipientId: aSent[0].recipientId
      });
    } else {
      console.log('   ❌ FAIL: A does NOT see the proposal in Sent Invitations');
    }

    // Check Received Invitations for B
    console.log('\n📥 Checking B\'s Received Invitations API...');
    const bReceived = await getReceivedInvitationsAPI(userB.firebaseUid);
    console.log(`   Found ${bReceived.length} received invitation(s)`);
    if (bReceived.length > 0) {
      console.log('   ✅ PASS: B sees the proposal in Received Invitations');
      console.log('   Details:', {
        proposalId: bReceived[0]._id,
        status: bReceived[0].status,
        senderId: bReceived[0].senderId
      });
    } else {
      console.log('   ❌ FAIL: B does NOT see the proposal in Received Invitations');
    }

    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: Matching Page Relationship States');
    console.log('='.repeat(80));

    // Check A's view of B in Matching
    console.log('\n👤 Checking A\'s Matching view of B...');
    const aViewOfB = await getMatchingRelationshipState(userA.firebaseUid, userB.firebaseUid);
    console.log('   Relationship state:', aViewOfB.relationshipState);
    console.log('   Proposal ID:', aViewOfB.proposalId);
    console.log('   Proposed capacity:', aViewOfB.proposedCapacity);
    
    if (aViewOfB.relationshipState === 'REQUEST_SENT') {
      console.log('   ✅ PASS: A sees REQUEST_SENT for B');
    } else {
      console.log(`   ❌ FAIL: A sees "${aViewOfB.relationshipState}" instead of "REQUEST_SENT"`);
    }

    // Check B's view of A in Matching
    console.log('\n👤 Checking B\'s Matching view of A...');
    const bViewOfA = await getMatchingRelationshipState(userB.firebaseUid, userA.firebaseUid);
    console.log('   Relationship state:', bViewOfA.relationshipState);
    console.log('   Proposal ID:', bViewOfA.proposalId);
    console.log('   Proposed capacity:', bViewOfA.proposedCapacity);
    
    if (bViewOfA.relationshipState === 'REQUEST_RECEIVED') {
      console.log('   ✅ PASS: B sees REQUEST_RECEIVED for A');
    } else {
      console.log(`   ❌ FAIL: B sees "${bViewOfA.relationshipState}" instead of "REQUEST_RECEIVED"`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const allPass = 
      aSent.length > 0 &&
      bReceived.length > 0 &&
      aViewOfB.relationshipState === 'REQUEST_SENT' &&
      bViewOfA.relationshipState === 'REQUEST_RECEIVED';
    
    if (allPass) {
      console.log('✅ ALL TESTS PASSED - Invitations and Matching are synchronized!');
    } else {
      console.log('❌ SOME TESTS FAILED - Synchronization bug exists!');
      
      console.log('\n🔍 Root cause analysis:');
      if (aSent.length === 0) {
        console.log('   ❌ Sent Invitations API not finding the proposal');
      }
      if (bReceived.length === 0) {
        console.log('   ❌ Received Invitations API not finding the proposal');
      }
      if (aViewOfB.relationshipState !== 'REQUEST_SENT') {
        console.log('   ❌ Matching API not calculating correct state for sender');
      }
      if (bViewOfA.relationshipState !== 'REQUEST_RECEIVED') {
        console.log('   ❌ Matching API not calculating correct state for receiver');
      }
    }

    await cleanup();
    process.exit(allPass ? 0 : 1);

  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    await cleanup();
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runTests();
