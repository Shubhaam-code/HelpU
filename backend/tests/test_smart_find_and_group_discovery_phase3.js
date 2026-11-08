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
import Booking from '../src/models/Booking.js';
import {
  findCompatibleGroupsForFindPost,
  findMatchesForTravel,
  detectAndNotifyCompatibleFindPosts
} from '../src/services/matching.service.js';
import {
  createJoinRequest,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  createGroupFromFindMatch,
  acceptGroupInvitation
} from '../src/controllers/group.controller.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

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
  console.log('TEST SUITE: Helpu Phase 3 — Smart Find Matches & Group Discovery');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas.\n');

  const ts = Date.now();
  const studentA = `user_p3_A_${ts}`; // Group Admin
  const studentB = `user_p3_B_${ts}`; // Member 2
  const studentC = `user_p3_C_${ts}`; // Discoverer / Join Requester
  const studentD = `user_p3_D_${ts}`; // Second Discoverer
  const studentE = `user_p3_E_${ts}`; // Third Discoverer for concurrency
  const studentDriver = `driver_p3_${ts}`; // Vehicle Owner for OFFER

  const today = new Date();
  const travelDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
  const differentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);

  const testStudentIds = [studentA, studentB, studentC, studentD, studentE, studentDriver];
  let createdGroupIds = [];
  let createdTravelIds = [];

  let passedScenarios = 0;
  const totalScenarios = 17;

  // Helpers
  async function createTestTravel(userId, overrides = {}) {
    const travel = await Travel.create({
      userId,
      type: 'request',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 600,
      timeFlexibility: 30,
      seats: 1,
      expiresAt: calculateExpiresAt(travelDate),
      ...overrides
    });
    createdTravelIds.push(travel._id);
    return travel;
  }

  async function createTestGroup(adminId, adminTravelId, overrides = {}) {
    const group = await SharedRideGroup.create({
      adminId,
      originatingTravelId: adminTravelId,
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 600,
      targetCapacity: 4,
      members: [{ userId: adminId, travelId: adminTravelId, role: 'admin', joinedAt: new Date() }],
      status: 'open',
      expiresAt: calculateExpiresAt(travelDate),
      ...overrides
    });
    createdGroupIds.push(group._id);
    return group;
  }

  try {
    // 0. Setup Students
    await Student.create([
      { clerkId: studentA, name: 'Alice Admin', email: `${studentA}@vitbhopal.ac.in`, college: 'VIT Bhopal' },
      { clerkId: studentB, name: 'Bob Member', email: `${studentB}@vitbhopal.ac.in`, college: 'VIT Bhopal' },
      { clerkId: studentC, name: 'Charlie Find', email: `${studentC}@vitbhopal.ac.in`, college: 'VIT Bhopal' },
      { clerkId: studentD, name: 'Dave Extra', email: `${studentD}@vitbhopal.ac.in`, college: 'VIT Bhopal' },
      { clerkId: studentE, name: 'Eve Concurrent', email: `${studentE}@vitbhopal.ac.in`, college: 'VIT Bhopal' },
      { clerkId: studentDriver, name: 'Dan Driver', email: `${studentDriver}@vitbhopal.ac.in`, college: 'VIT Bhopal' }
    ]);

    // Student A's active FIND post for originating groups
    const findPostA = await createTestTravel(studentA);

    // Student C's active FIND post: VIT Bhopal -> Bhopal Railway Station, 10:00 AM (600 mins)
    const findPostC = await createTestTravel(studentC, { departureTime: 600 });

    // Scenario 1: Compatible group appears in Find Matches
    console.log('Scenario 1: Compatible group appears in Find Matches...');
    const group1 = await createTestGroup(studentA, findPostA._id, {
      departureTime: 660, // 11:00 AM (60 min difference <= 420)
      targetCapacity: 3
    });

    let discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    const found1 = discovered.find((g) => g._id.toString() === group1._id.toString());
    if (!found1) throw new Error('Scenario 1 Failed: Compatible group was not discovered');
    if (found1.availableSpots !== 2) throw new Error(`Scenario 1 Failed: Expected 2 available spots, got ${found1.availableSpots}`);
    if (found1.admin.name !== 'Alice Admin') throw new Error('Scenario 1 Failed: Admin name missing');
    // Ensure no sensitive private data exposed
    if (found1.admin.phone || found1.admin.email || found1.admin.clerkId) {
      throw new Error('Scenario 1 Failed: Private data leaked in admin profile');
    }
    console.log('✓ Scenario 1 Passed: Compatible group discovered with safe profile and spots.\n');
    passedScenarios++;

    // Scenario 2: Incompatible route does not appear
    console.log('Scenario 2: Incompatible route does not appear...');
    const groupReverse = await createTestGroup(studentA, findPostA._id, {
      source: 'Bhopal Railway Station',
      destination: 'VIT, Bhopal' // Reverse direction!
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupReverse._id.toString())) {
      throw new Error('Scenario 2 Failed: Opposite direction group appeared');
    }
    console.log('✓ Scenario 2 Passed: Incompatible route correctly excluded.\n');
    passedScenarios++;

    // Scenario 3: Different travel date does not appear
    console.log('Scenario 3: Different travel date does not appear...');
    const postADiffDate = await createTestTravel(studentA, { travelDate: differentDate });
    const groupDiffDate = await createTestGroup(studentA, postADiffDate._id, {
      travelDate: differentDate,
      expiresAt: calculateExpiresAt(differentDate)
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupDiffDate._id.toString())) {
      throw new Error('Scenario 3 Failed: Different date group appeared');
    }
    console.log('✓ Scenario 3 Passed: Different travel date correctly excluded.\n');
    passedScenarios++;

    // Scenario 4: Time difference over 420 minutes does not appear
    console.log('Scenario 4: Time difference over 420 minutes does not appear...');
    const groupDiffTime = await createTestGroup(studentA, findPostA._id, {
      departureTime: 1200 // 20:00 (600 min difference > 420 tolerance)
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupDiffTime._id.toString())) {
      throw new Error('Scenario 4 Failed: Group with >420 min time difference appeared');
    }
    console.log('✓ Scenario 4 Passed: Departure time >420 min tolerance correctly excluded.\n');
    passedScenarios++;

    // Scenario 5: Full group does not appear as joinable
    console.log('Scenario 5: Full group does not appear as joinable...');
    const postB = await createTestTravel(studentB);
    const groupFull = await createTestGroup(studentA, findPostA._id, {
      targetCapacity: 2,
      members: [
        { userId: studentA, travelId: findPostA._id, role: 'admin', joinedAt: new Date() },
        { userId: studentB, travelId: postB._id, role: 'member', joinedAt: new Date() }
      ],
      status: 'full'
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupFull._id.toString())) {
      throw new Error('Scenario 5 Failed: Full group appeared in discovery');
    }
    console.log('✓ Scenario 5 Passed: Full group not displayed as joinable.\n');
    passedScenarios++;

    // Scenario 6: Expired group does not appear
    console.log('Scenario 6: Expired group does not appear...');
    const pastDate = new Date(Date.now() - 3600 * 1000);
    const groupExpired = await createTestGroup(studentA, findPostA._id, {
      expiresAt: pastDate // Expired 1 hour ago
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupExpired._id.toString())) {
      throw new Error('Scenario 6 Failed: Expired group appeared in discovery');
    }
    console.log('✓ Scenario 6 Passed: Expired group correctly excluded.\n');
    passedScenarios++;

    // Scenario 7: Own group does not appear
    console.log('Scenario 7: Own group does not appear...');
    const groupOwn = await createTestGroup(studentC, findPostC._id, {
      adminId: studentC
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupOwn._id.toString())) {
      throw new Error('Scenario 7 Failed: Own group appeared in discovery');
    }
    console.log('✓ Scenario 7 Passed: Own group correctly excluded from discovery.\n');
    passedScenarios++;

    // Scenario 8: Existing member does not see a join action
    console.log('Scenario 8: Existing member does not see a join action...');
    const groupWithCAsMember = await createTestGroup(studentA, findPostA._id, {
      members: [
        { userId: studentA, travelId: findPostA._id, role: 'admin', joinedAt: new Date() },
        { userId: studentC, travelId: findPostC._id, role: 'member', joinedAt: new Date() }
      ]
    });

    discovered = await findCompatibleGroupsForFindPost(findPostC, studentC);
    if (discovered.some((g) => g._id.toString() === groupWithCAsMember._id.toString())) {
      throw new Error('Scenario 8 Failed: Group where student is already a member appeared');
    }
    console.log('✓ Scenario 8 Passed: Existing member group excluded from discovery.\n');
    passedScenarios++;

    // Scenario 9: Duplicate pending join request is prevented
    console.log('Scenario 9: Duplicate pending join request is prevented...');
    const { req: reqJoin1, res: resJoin1 } = createMockReqRes({
      userId: studentC,
      params: { groupId: group1._id.toString() },
      body: { travelId: findPostC._id.toString(), message: 'Can I join your cab?' }
    });
    await createJoinRequest(reqJoin1, resJoin1);
    if (resJoin1.getStatusCode() !== 201) {
      throw new Error(`Scenario 9 Failed: First join request failed with status ${resJoin1.getStatusCode()}: ${JSON.stringify(resJoin1.getData())}`);
    }
    const createdJoinReqId = resJoin1.getData().data._id;

    // Second request to same group
    const { req: reqJoin2, res: resJoin2 } = createMockReqRes({
      userId: studentC,
      params: { groupId: group1._id.toString() },
      body: { travelId: findPostC._id.toString(), message: 'Second request attempt' }
    });
    await createJoinRequest(reqJoin2, resJoin2);
    if (resJoin2.getStatusCode() !== 400 && resJoin2.getStatusCode() !== 409) {
      throw new Error(`Scenario 9 Failed: Duplicate request returned ${resJoin2.getStatusCode()} instead of 400/409`);
    }
    console.log('✓ Scenario 9 Passed: Duplicate pending join request prevented.\n');
    passedScenarios++;

    // Scenario 10: Request to Join does not add membership immediately
    console.log('Scenario 10: Request to Join does not add membership immediately...');
    const groupAfterJoin = await SharedRideGroup.findById(group1._id).lean();
    if (groupAfterJoin.members.some((m) => m.userId === studentC)) {
      throw new Error('Scenario 10 Failed: Requester was immediately added as confirmed member');
    }
    if (groupAfterJoin.members.length !== 1) {
      throw new Error('Scenario 10 Failed: Member count unexpectedly increased');
    }
    console.log('✓ Scenario 10 Passed: Membership not added immediately upon requesting.\n');
    passedScenarios++;

    // Scenario 11: Admin acceptance adds confirmed membership
    console.log('Scenario 11: Admin acceptance adds confirmed membership...');
    const { req: reqAccept, res: resAccept } = createMockReqRes({
      userId: studentA, // Admin of group1
      params: { requestId: createdJoinReqId.toString() }
    });
    await acceptStudentJoinRequest(reqAccept, resAccept);
    if (resAccept.getStatusCode() !== 200) {
      throw new Error(`Scenario 11 Failed: Admin acceptance failed with ${resAccept.getStatusCode()}: ${JSON.stringify(resAccept.getData())}`);
    }
    const groupAfterAccept = await SharedRideGroup.findById(group1._id).lean();
    const confirmedMember = groupAfterAccept.members.find((m) => m.userId === studentC);
    if (!confirmedMember) {
      throw new Error('Scenario 11 Failed: Student C is not in confirmed members after acceptance');
    }
    console.log('✓ Scenario 11 Passed: Admin acceptance added confirmed membership.\n');
    passedScenarios++;

    // Scenario 12: Admin rejection does not add membership
    console.log('Scenario 12: Admin rejection does not add membership...');
    const groupForReject = await createTestGroup(studentA, findPostA._id, {
      targetCapacity: 3
    });

    const findPostD = await createTestTravel(studentD);

    const { req: reqJoinD, res: resJoinD } = createMockReqRes({
      userId: studentD,
      params: { groupId: groupForReject._id.toString() },
      body: { travelId: findPostD._id.toString() }
    });
    await createJoinRequest(reqJoinD, resJoinD);
    const rejectReqId = resJoinD.getData().data._id;

    const { req: reqReject, res: resReject } = createMockReqRes({
      userId: studentA,
      params: { requestId: rejectReqId.toString() }
    });
    await rejectStudentJoinRequest(reqReject, resReject);
    if (resReject.getStatusCode() !== 200) {
      throw new Error(`Scenario 12 Failed: Rejection returned ${resReject.getStatusCode()}`);
    }
    const groupAfterReject = await SharedRideGroup.findById(groupForReject._id).lean();
    if (groupAfterReject.members.some((m) => m.userId === studentD)) {
      throw new Error('Scenario 12 Failed: Student D was added to members despite rejection');
    }
    console.log('✓ Scenario 12 Passed: Admin rejection does not add membership.\n');
    passedScenarios++;

    // Scenario 13: Non-admin cannot accept/reject
    console.log('Scenario 13: Non-admin cannot accept/reject...');
    const findPostE = await createTestTravel(studentE);

    const { req: reqJoinE, res: resJoinE } = createMockReqRes({
      userId: studentE,
      params: { groupId: groupForReject._id.toString() },
      body: { travelId: findPostE._id.toString() }
    });
    await createJoinRequest(reqJoinE, resJoinE);
    const nonAdminReqId = resJoinE.getData().data._id;

    // Student B (not admin) attempts to accept
    const { req: reqNonAdminAccept, res: resNonAdminAccept } = createMockReqRes({
      userId: studentB, // Non-admin
      params: { requestId: nonAdminReqId.toString() }
    });
    await acceptStudentJoinRequest(reqNonAdminAccept, resNonAdminAccept);
    if (resNonAdminAccept.getStatusCode() !== 403) {
      throw new Error(`Scenario 13 Failed: Non-admin accept returned ${resNonAdminAccept.getStatusCode()} instead of 403`);
    }

    // Student B attempts to reject
    const { req: reqNonAdminReject, res: resNonAdminReject } = createMockReqRes({
      userId: studentB,
      params: { requestId: nonAdminReqId.toString() }
    });
    await rejectStudentJoinRequest(reqNonAdminReject, resNonAdminReject);
    if (resNonAdminReject.getStatusCode() !== 403) {
      throw new Error(`Scenario 13 Failed: Non-admin reject returned ${resNonAdminReject.getStatusCode()} instead of 403`);
    }
    console.log('✓ Scenario 13 Passed: Non-admin forbidden from accepting or rejecting.\n');
    passedScenarios++;

    // Scenario 14: Capacity cannot be exceeded during concurrent acceptance
    console.log('Scenario 14: Capacity cannot be exceeded during concurrent acceptance...');
    // Create group with capacity 2 and 1 member (admin studentA) -> only 1 spot left
    const groupTight = await createTestGroup(studentA, findPostA._id, {
      targetCapacity: 2
    });

    // Two join requests: studentD and studentE via createJoinRequest
    const { req: reqJD, res: resJD } = createMockReqRes({
      userId: studentD,
      params: { groupId: groupTight._id.toString() },
      body: { travelId: findPostD._id.toString() }
    });
    await createJoinRequest(reqJD, resJD);
    if (resJD.getStatusCode() !== 201) {
      throw new Error(`Scenario 14 Failed: Student D join request failed: ${JSON.stringify(resJD.getData())}`);
    }
    const joinReqDId = resJD.getData().data._id;

    const { req: reqJE, res: resJE } = createMockReqRes({
      userId: studentE,
      params: { groupId: groupTight._id.toString() },
      body: { travelId: findPostE._id.toString() }
    });
    await createJoinRequest(reqJE, resJE);
    if (resJE.getStatusCode() !== 201) {
      throw new Error(`Scenario 14 Failed: Student E join request failed: ${JSON.stringify(resJE.getData())}`);
    }
    const joinReqEId = resJE.getData().data._id;

    // Accept both concurrently
    const [resD, resE] = await Promise.all([
      (async () => {
        const { req, res } = createMockReqRes({ userId: studentA, params: { requestId: joinReqDId.toString() } });
        await acceptStudentJoinRequest(req, res);
        return res;
      })(),
      (async () => {
        const { req, res } = createMockReqRes({ userId: studentA, params: { requestId: joinReqEId.toString() } });
        await acceptStudentJoinRequest(req, res);
        return res;
      })()
    ]);

    const groupTightFinal = await SharedRideGroup.findById(groupTight._id).lean();
    if (groupTightFinal.members.length > 2) {
      throw new Error(`Scenario 14 Failed: Group exceeded capacity! Member count: ${groupTightFinal.members.length}`);
    }
    console.log(`✓ Scenario 14 Passed: Capacity enforced during concurrent acceptance (Final members: ${groupTightFinal.members.length} / ${groupTightFinal.targetCapacity}).\n`);
    passedScenarios++;

    // Scenario 15: Wait for OFFER continues to work without modifying FIND post
    console.log('Scenario 15: Wait for OFFER continues to work without modifying FIND post...');
    const findPostCheck = await Travel.findById(findPostC._id).lean();
    if (findPostCheck.status !== 'active') {
      throw new Error('Scenario 15 Failed: FIND post status was unexpectedly modified');
    }
    if (findPostCheck.type !== 'request') {
      throw new Error('Scenario 15 Failed: FIND post type changed');
    }
    console.log('✓ Scenario 15 Passed: Student FIND post remains active, unexpired, and unmodified.\n');
    passedScenarios++;

    // Scenario 16: Normal Booking and seat behavior remain unchanged
    console.log('Scenario 16: Normal Booking and seat behavior remain unchanged...');
    const offerTravel = await Travel.create({
      userId: studentDriver,
      type: 'offer',
      status: 'active',
      source: 'VIT, Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate,
      departureTime: 600,
      seats: 3,
      bookedSeats: 0,
      pricePerSeat: 150,
      timeFlexibility: 30,
      expiresAt: calculateExpiresAt(travelDate)
    });
    createdTravelIds.push(offerTravel._id);

    // Run findMatchesForTravel on the FIND post
    const normalMatches = await findMatchesForTravel(findPostC);
    const foundOffer = normalMatches.find((m) => m._id.toString() === offerTravel._id.toString());
    if (!foundOffer) {
      throw new Error('Scenario 16 Failed: Normal OFFER post was not matched for FIND post');
    }
    if (foundOffer.availableSeats !== 3) {
      throw new Error(`Scenario 16 Failed: Expected 3 available seats, got ${foundOffer.availableSeats}`);
    }
    console.log('✓ Scenario 16 Passed: Normal vehicle offer matching and seat calculation unchanged.\n');
    passedScenarios++;

    // Scenario 17: Phase 1 notifications and Phase 2 invitation workflows remain unchanged
    console.log('Scenario 17: Phase 1 notifications and Phase 2 invitation workflows remain unchanged...');
    const studentF = `user_p3_F_${ts}`;
    testStudentIds.push(studentF);
    await Student.create({
      clerkId: studentF,
      name: 'Frank Fresh',
      email: `${studentF}@vitbhopal.ac.in`,
      college: 'VIT Bhopal'
    });

    const findPostF = await createTestTravel(studentF);
    const findPostForP1 = await createTestTravel(studentB);

    const outboxEvents = await detectAndNotifyCompatibleFindPosts(findPostForP1);
    if (!Array.isArray(outboxEvents)) {
      throw new Error('Scenario 17 Failed: Phase 1 detectAndNotifyCompatibleFindPosts did not return array');
    }

    // Test Phase 2 group creation and invitation from FIND match
    const { req: reqP2Create, res: resP2Create } = createMockReqRes({
      userId: studentB,
      body: {
        originatingTravelId: findPostForP1._id.toString(),
        candidateTravelId: findPostF._id.toString(),
        targetCapacity: 4
      }
    });
    await createGroupFromFindMatch(reqP2Create, resP2Create);
    if (resP2Create.getStatusCode() !== 201) {
      throw new Error(`Scenario 17 Failed: Phase 2 group creation returned ${resP2Create.getStatusCode()}: ${JSON.stringify(resP2Create.getData())}`);
    }
    const p2GroupId = resP2Create.getData().data._id;
    createdGroupIds.push(p2GroupId);

    console.log('✓ Scenario 17 Passed: Phase 1 notifications and Phase 2 group creation remain intact.\n');
    passedScenarios++;

    console.log('================================================================');
    console.log(`ALL ${passedScenarios} OF ${totalScenarios} SCENARIOS PASSED SUCCESSFULLY (Exit Code 0)`);
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED with error:\n', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up test artifacts...');
    try {
      if (createdGroupIds.length > 0) {
        await SharedRideGroup.deleteMany({ _id: { $in: createdGroupIds } });
        await GroupJoinRequest.deleteMany({ groupId: { $in: createdGroupIds } });
      }
      if (createdTravelIds.length > 0) {
        await Travel.deleteMany({ _id: { $in: createdTravelIds } });
      }
      if (testStudentIds.length > 0) {
        await Student.deleteMany({ clerkId: { $in: testStudentIds } });
        await Outbox.deleteMany({ recipientId: { $in: testStudentIds } });
        await Notification.deleteMany({ userId: { $in: testStudentIds } });
      }
      console.log('Cleaned up test documents.\n');
    } catch (cleanupErr) {
      console.warn('Cleanup error:', cleanupErr.message);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
    process.exit(process.exitCode || 0);
  }
}

runTests();
