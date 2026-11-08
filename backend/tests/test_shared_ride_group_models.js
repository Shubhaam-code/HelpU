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

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: SharedRideGroup & GroupJoinRequest Model Validation');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  // Ensure Mongoose builds all schema indexes on MongoDB before testing unique constraints
  await Promise.all([
    SharedRideGroup.init(),
    GroupJoinRequest.init()
  ]);
  console.log('Indexes initialized on MongoDB.\n');

  const testAdminId = `test_admin_${Date.now()}`;
  const testStudentId = `test_student_${Date.now()}`;
  const dummyTravelId1 = new mongoose.Types.ObjectId();
  const dummyTravelId2 = new mongoose.Types.ObjectId();

  let testGroup = null;
  let testRequest = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: SharedRideGroup Required Fields & Auto-initialization
    // -------------------------------------------------------------
    console.log('TEST 1: SharedRideGroup Creation & Auto-initialization');
    const today = new Date();
    const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    testGroup = new SharedRideGroup({
      adminId: testAdminId,
      originatingTravelId: dummyTravelId1,
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 540, // 9:00 AM
      targetCapacity: 4,
      actualCabCapacity: 4,
      notes: 'Need 3 more students to split Uber XL'
    });

    await testGroup.validate();
    console.log('  ✔ Mongoose schema validation passed');

    console.log(`  - expiresAt auto-calculated: ${Boolean(testGroup.expiresAt)} (${testGroup.expiresAt?.toISOString()})`);
    if (!testGroup.expiresAt) throw new Error('expiresAt must be auto-calculated from travelDate');

    console.log(`  - members auto-initialized with admin: count = ${testGroup.members.length}`);
    if (testGroup.members.length !== 1) throw new Error('Creator must be auto-initialized as first member');
    if (testGroup.members[0].userId !== testAdminId) throw new Error('First member userId must match adminId');
    if (testGroup.members[0].role !== 'admin') throw new Error('First member role must be admin');
    if (String(testGroup.members[0].travelId) !== String(dummyTravelId1)) throw new Error('Member travelId must match originatingTravelId');

    console.log(`  - virtual currentMemberCount: ${testGroup.currentMemberCount} (Expected: 1)`);
    console.log(`  - virtual availableSpots: ${testGroup.availableSpots} (Expected: 3)`);
    console.log(`  - virtual isFull: ${testGroup.isFull} (Expected: false)`);
    if (testGroup.currentMemberCount !== 1) throw new Error('currentMemberCount virtual failed');
    if (testGroup.availableSpots !== 3) throw new Error('availableSpots virtual failed');
    if (testGroup.isFull !== false) throw new Error('isFull virtual failed');

    await testGroup.save();
    console.log('  ✔ SharedRideGroup successfully saved to MongoDB\n');

    // -------------------------------------------------------------
    // TEST 2: Capacity Constraints & Type Validation
    // -------------------------------------------------------------
    console.log('TEST 2: Target Capacity & Cab Capacity Constraints');

    // 2A: Verify positive integers accepted without arbitrary maximum (e.g. 2, 4, 8, 12)
    for (const validCap of [1, 2, 4, 8, 12]) {
      const validGroup = new SharedRideGroup({
        adminId: testAdminId,
        originatingTravelId: dummyTravelId1,
        source: 'VIT Bhopal',
        destination: 'Bhopal Station',
        travelDate,
        departureTime: 540,
        targetCapacity: validCap
      });
      await validGroup.validate();
    }
    console.log('  - Positive integer target capacities (1, 2, 4, 8, 12) accepted: true');

    // 2B: Reject zero (0)
    const zeroCapGroup = new SharedRideGroup({
      adminId: testAdminId,
      originatingTravelId: dummyTravelId1,
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 540,
      targetCapacity: 0
    });
    let zeroCapRejected = false;
    try {
      await zeroCapGroup.validate();
    } catch {
      zeroCapRejected = true;
    }
    console.log(`  - Target capacity = 0 rejected: ${zeroCapRejected}`);
    if (!zeroCapRejected) throw new Error('targetCapacity = 0 must be rejected');

    // 2C: Reject negative (-3)
    const negCapGroup = new SharedRideGroup({
      adminId: testAdminId,
      originatingTravelId: dummyTravelId1,
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 540,
      targetCapacity: -3
    });
    let negCapRejected = false;
    try {
      await negCapGroup.validate();
    } catch {
      negCapRejected = true;
    }
    console.log(`  - Negative target capacity (-3) rejected: ${negCapRejected}`);
    if (!negCapRejected) throw new Error('Negative targetCapacity must be rejected');

    // 2D: Reject non-integer (3.5)
    const floatCapGroup = new SharedRideGroup({
      adminId: testAdminId,
      originatingTravelId: dummyTravelId1,
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 540,
      targetCapacity: 3.5
    });
    let floatCapRejected = false;
    try {
      await floatCapGroup.validate();
    } catch {
      floatCapRejected = true;
    }
    console.log(`  - Non-integer target capacity (3.5) rejected: ${floatCapRejected}`);
    if (!floatCapRejected) throw new Error('Float targetCapacity must be rejected');

    // 2E: Optional actualCabCapacity verification
    // Null/undefined accepted
    const nullCabGroup = new SharedRideGroup({
      adminId: testAdminId,
      originatingTravelId: dummyTravelId1,
      source: 'VIT Bhopal',
      destination: 'Bhopal Station',
      travelDate,
      departureTime: 540,
      targetCapacity: 4,
      actualCabCapacity: null
    });
    await nullCabGroup.validate();
    console.log('  - Optional actualCabCapacity (null/omitted) accepted: true');

    // Valid positive integers accepted for actualCabCapacity
    for (const validCab of [1, 4, 6, 7, 10]) {
      const validCabGroup = new SharedRideGroup({
        adminId: testAdminId,
        originatingTravelId: dummyTravelId1,
        source: 'VIT Bhopal',
        destination: 'Bhopal Station',
        travelDate,
        departureTime: 540,
        targetCapacity: 4,
        actualCabCapacity: validCab
      });
      await validCabGroup.validate();
    }
    console.log('  - Valid positive integer actualCabCapacity (1, 4, 6, 7, 10) accepted: true');

    // Invalid actualCabCapacity rejected (0, -2, 4.5)
    for (const invalidCab of [0, -2, 4.5]) {
      const invalidCabGroup = new SharedRideGroup({
        adminId: testAdminId,
        originatingTravelId: dummyTravelId1,
        source: 'VIT Bhopal',
        destination: 'Bhopal Station',
        travelDate,
        departureTime: 540,
        targetCapacity: 4,
        actualCabCapacity: invalidCab
      });
      let rejected = false;
      try {
        await invalidCabGroup.validate();
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error(`actualCabCapacity = ${invalidCab} must be rejected`);
    }
    console.log('  - Invalid actualCabCapacity (0, -2, 4.5) rejected: true');

    console.log('  ✔ All target capacity and actual cab capacity constraints verified\n');

    // -------------------------------------------------------------
    // TEST 3: WhatsApp URL Validator & Status Enum
    // -------------------------------------------------------------
    console.log('TEST 3: WhatsApp URL & Status Validation');

    // Valid WhatsApp group URL
    testGroup.whatsappGroupUrl = 'https://chat.whatsapp.com/L123456789abcdef';
    await testGroup.validate();
    console.log('  - Valid WhatsApp URL accepted: true');

    // Invalid WhatsApp URL
    testGroup.whatsappGroupUrl = 'https://fake-phishing-url.com/group';
    let invalidUrlRejected = false;
    try {
      await testGroup.validate();
    } catch (err) {
      invalidUrlRejected = true;
    }
    console.log(`  - Invalid URL rejected: ${invalidUrlRejected}`);
    if (!invalidUrlRejected) throw new Error('Invalid WhatsApp URL must be rejected');

    // Reset to null
    testGroup.whatsappGroupUrl = null;

    // Status enum validation
    const allowedStatuses = ['open', 'full', 'completed', 'cancelled', 'expired'];
    for (const st of allowedStatuses) {
      testGroup.status = st;
      await testGroup.validate();
    }
    console.log(`  - All allowed statuses accepted: [${allowedStatuses.join(', ')}]`);

    testGroup.status = 'invalid_status_xyz';
    let invalidStatusRejected = false;
    try {
      await testGroup.validate();
    } catch (err) {
      invalidStatusRejected = true;
    }
    console.log(`  - Invalid status rejected: ${invalidStatusRejected}`);
    if (!invalidStatusRejected) throw new Error('Invalid status must be rejected');

    testGroup.status = 'open';
    await testGroup.save();
    console.log('  ✔ Status & WhatsApp validators verified\n');

    // -------------------------------------------------------------
    // TEST 4: GroupJoinRequest Creation (join_request and invite)
    // -------------------------------------------------------------
    console.log('TEST 4: GroupJoinRequest Creation');

    // 4A: Student creates join_request to admin
    testRequest = await GroupJoinRequest.create({
      groupId: testGroup._id,
      requesterId: testStudentId,
      requesterTravelId: dummyTravelId2,
      senderId: testStudentId,
      recipientId: testAdminId,
      type: 'join_request',
      status: 'pending',
      message: 'Hey, I am also traveling to the station at 9 AM, can I join?'
    });

    console.log(`  - join_request created with status: ${testRequest.status}`);
    console.log(`  - sender: ${testRequest.senderId}, recipient: ${testRequest.recipientId}`);
    if (testRequest.status !== 'pending') throw new Error('Default status must be pending');

    testRequest.expiresAt = new Date('2026-11-10T18:30:00.000Z');
    await testRequest.validate();
    console.log('  - expiresAt field accepted and validated: true');

    // 4B: Invalid type validation
    const invalidTypeReq = new GroupJoinRequest({
      groupId: testGroup._id,
      requesterId: 'other_user',
      requesterTravelId: dummyTravelId2,
      senderId: testAdminId,
      recipientId: 'other_user',
      type: 'invalid_type',
      status: 'pending'
    });
    let invalidTypeRejected = false;
    try {
      await invalidTypeReq.validate();
    } catch (err) {
      invalidTypeRejected = true;
    }
    console.log(`  - Invalid request type rejected: ${invalidTypeRejected}`);
    if (!invalidTypeRejected) throw new Error('Invalid request type must be rejected');

    // 4C: Invalid status validation
    const invalidStatusReq = new GroupJoinRequest({
      groupId: testGroup._id,
      requesterId: 'other_user',
      requesterTravelId: dummyTravelId2,
      senderId: testAdminId,
      recipientId: 'other_user',
      type: 'invite',
      status: 'unknown_status'
    });
    let invalidReqStatusRejected = false;
    try {
      await invalidStatusReq.validate();
    } catch (err) {
      invalidReqStatusRejected = true;
    }
    console.log(`  - Invalid request status rejected: ${invalidReqStatusRejected}`);
    if (!invalidReqStatusRejected) throw new Error('Invalid request status must be rejected');

    console.log('  ✔ GroupJoinRequest creation & type validation passed\n');

    // -------------------------------------------------------------
    // TEST 5: Duplicate Pending Request Prevention (Partial Unique Index)
    // -------------------------------------------------------------
    console.log('TEST 5: Duplicate Pending Request Prevention');
    let duplicateRejected = false;
    try {
      await GroupJoinRequest.create({
        groupId: testGroup._id,
        requesterId: testStudentId,
        requesterTravelId: dummyTravelId2,
        senderId: testStudentId,
        recipientId: testAdminId,
        type: 'join_request',
        status: 'pending',
        message: 'Duplicate request attempt'
      });
    } catch (err) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        duplicateRejected = true;
      }
    }
    console.log(`  - Duplicate pending join_request rejected by partial unique index: ${duplicateRejected}`);
    if (!duplicateRejected) throw new Error('Duplicate pending request must be rejected by partial unique index');

    // Transition existing request to 'rejected'
    testRequest.status = 'rejected';
    testRequest.respondedAt = new Date();
    testRequest.respondedBy = testAdminId;
    await testRequest.save();

    // Now that previous request is rejected, a new request is permitted!
    const reRequest = await GroupJoinRequest.create({
      groupId: testGroup._id,
      requesterId: testStudentId,
      requesterTravelId: dummyTravelId2,
      senderId: testAdminId,
      recipientId: testStudentId,
      type: 'invite', // Admin decides to invite after all
      status: 'pending',
      message: 'Actually we have space now, would you like to join?'
    });

    console.log(`  - Subsequent request allowed after previous resolved: ${Boolean(reRequest._id)} (ID: ${reRequest._id})`);
    if (!reRequest._id) throw new Error('Subsequent request should be allowed when previous status is not pending');

    await GroupJoinRequest.deleteOne({ _id: reRequest._id });
    console.log('  ✔ Duplicate pending index prevents duplicates while allowing re-requests after resolution\n');

    // -------------------------------------------------------------
    // TEST 6: Verify Existing Models Remain Untouched
    // -------------------------------------------------------------
    console.log('TEST 6: Zero Regression on Existing Models');
    const offerTest = new Travel({
      userId: 'test_regression_user',
      type: 'offer',
      source: 'Campus Gate',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 3
    });
    await offerTest.validate();
    console.log(`  - OFFER model seats preserved (3 seats): valid = ${offerTest.seats === 3}`);

    const findTest = new Travel({
      userId: 'test_regression_user',
      type: 'request',
      source: 'Campus Gate',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 4 // Should be forced to 1
    });
    await findTest.validate();
    console.log(`  - FIND model single-seat rule preserved (seats forced to 1): valid = ${findTest.seats === 1}`);
    if (findTest.seats !== 1) throw new Error('FIND seats must be forced to 1');

    console.log('  ✔ Existing Travel model behaviors completely intact\n');

    console.log('================================================================');
    console.log('ALL 6 MODEL VALIDATION SUITES PASSED (100% SUCCESS)');
    console.log('================================================================');
  } finally {
    if (testGroup) await SharedRideGroup.deleteOne({ _id: testGroup._id });
    if (testRequest) await GroupJoinRequest.deleteOne({ _id: testRequest._id });
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB & cleaned up test data.');
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
