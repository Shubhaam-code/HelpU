import mongoose from 'mongoose';
import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import SharedRideGroup from '../src/models/SharedRideGroup.js';
import GroupJoinRequest from '../src/models/GroupJoinRequest.js';
import Travel, { calculateExpiresAt } from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Student from '../src/models/Student.js';
import Outbox from '../src/models/Outbox.js';
import Notification from '../src/models/Notification.js';

import {
  findCompatibleFindPosts,
  findMatchesForTravel,
  findMatchesForUser
} from '../src/services/matching.service.js';

import {
  createSharedRideGroup,
  createGroupFromFindMatch,
  discoverSharedRideGroups,
  createJoinRequest,
  acceptStudentJoinRequest,
  acceptGroupInvitation,
  inviteStudentToGroup,
  leaveSharedRideGroup,
  getMyGroups,
  getSharedRideGroupById
} from '../src/controllers/group.controller.js';

import {
  createBookingRequest,
  respondToBookingRequest,
  cancelBooking
} from '../src/controllers/booking.controller.js';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

function mockReq({ userId, params = {}, query = {}, body = {} }) {
  return {
    userId,
    auth: { userId },
    user: { id: userId },
    params,
    query,
    body
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function runDynamicGroupE2E() {
  console.log('================================================================');
  console.log('TEST SUITE: Dynamic Group Formation & Smart Matching (Scenarios 1-12)');
  console.log('================================================================\n');

  if (!MONGO_URI) {
    throw new Error('MONGO_URI missing in backend/.env');
  }

  await mongoose.connect(MONGO_URI);
  await SharedRideGroup.syncIndexes();
  console.log('Connected to MongoDB & synced SharedRideGroup indexes.\n');

  const ts = Date.now();
  const ids = {
    A: `e2e_A_${ts}`,
    B: `e2e_B_${ts}`,
    C: `e2e_C_${ts}`,
    D: `e2e_D_${ts}`,
    E: `e2e_E_${ts}`,
    F: `e2e_F_${ts}`,
    G: `e2e_G_${ts}`,
    H: `e2e_H_${ts}`,
    P: `e2e_P_${ts}`
  };
  const allUserIds = Object.values(ids);

  const now = new Date();
  const travelDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 4));
  const createdTravelIds = [];
  const createdGroupIds = [];
  const createdBookingIds = [];

  const createFind = async (userId, timeOffset = 0, src = 'VIT Bhopal', dst = 'Bhopal Junction') => {
    const t = await Travel.create({
      userId,
      type: 'request',
      source: src,
      destination: dst,
      travelDate,
      departureTime: 600 + timeOffset,
      timeFlexibility: 60,
      seats: 1,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    createdTravelIds.push(t._id);
    return t;
  };

  try {
    await Student.create(
      Object.entries(ids).map(([label, clerkId]) => ({
        clerkId,
        name: `Student ${label}`,
        email: `${clerkId}@vitbhopal.ac.in`,
        phone: '9876543210'
      }))
    );

    const tA = await createFind(ids.A, 0);
    const tB = await createFind(ids.B, 15);
    const tC = await createFind(ids.C, 20);
    const tD = await createFind(ids.D, 30);
    const tE = await createFind(ids.E, 40); // Organizer for external compatible Group X
    const tF = await createFind(ids.F, 10);
    const tG = await createFind(ids.G, 25);

    // =========================================================================
    // SCENARIO 1: Bidirectional Individual Matching (FIND <-> FIND) & No req-req booking
    // =========================================================================
    console.log('SCENARIO 1: Bidirectional Individual Matching...');
    const findsForA = await findCompatibleFindPosts(tA);
    const findsForB = await findCompatibleFindPosts(tB);
    assert(findsForA.some((p) => String(p._id) === String(tB._id)), 'A must discover B');
    assert(findsForB.some((p) => String(p._id) === String(tA._id)), 'B must discover A');

    const userMatchesA = await findMatchesForUser(ids.A);
    assert(
      userMatchesA.compatibleFinds.some((p) => String(p._id) === String(tB._id)),
      'findMatchesForUser(A) must expose B in compatibleFinds'
    );
    assert(
      !userMatchesA.matches.some((m) => String(m._id) === String(tB._id)),
      'Request-to-request must never appear as direct bookable ride offer'
    );
    console.log('  ✔ PASS: Bidirectional FIND discovery works & excludes request-to-request booking\n');

    // =========================================================================
    // SCENARIO 2: No Automatic Group Creation on Match
    // =========================================================================
    console.log('SCENARIO 2: No automatic group creation...');
    const groupsBeforeExplicitAction = await SharedRideGroup.countDocuments({
      'members.userId': { $in: [ids.A, ids.B] }
    });
    assert.strictEqual(groupsBeforeExplicitAction, 0, 'No group should be auto-created on matching');
    console.log('  ✔ PASS: Zero groups auto-created before explicit user action\n');

    // =========================================================================
    // SCENARIO 3: Explicit Group Creation with Capacity Selection (2..6)
    // =========================================================================
    console.log('SCENARIO 3: Explicit Group Creation & Capacity Validation (2..6)...');
    const badCapRes = mockRes();
    await createGroupFromFindMatch(
      mockReq({
        userId: ids.A,
        body: { originatingTravelId: tA._id.toString(), candidateTravelId: tB._id.toString(), targetCapacity: 1 }
      }),
      badCapRes
    );
    assert.strictEqual(badCapRes.statusCode, 400, 'targetCapacity=1 must be rejected with 400');

    const badCapHighRes = mockRes();
    await createGroupFromFindMatch(
      mockReq({
        userId: ids.A,
        body: { originatingTravelId: tA._id.toString(), candidateTravelId: tB._id.toString(), targetCapacity: 7 }
      }),
      badCapHighRes
    );
    assert.strictEqual(badCapHighRes.statusCode, 400, 'targetCapacity=7 must be rejected with 400');

    const createRes = mockRes();
    await createGroupFromFindMatch(
      mockReq({
        userId: ids.A,
        body: { originatingTravelId: tA._id.toString(), candidateTravelId: tB._id.toString(), targetCapacity: 4 }
      }),
      createRes
    );
    assert.strictEqual(createRes.statusCode, 201, `Expected 201, got ${createRes.statusCode}: ${createRes.body?.message}`);
    const mainGroup = createRes.body.data.group;
    const inviteAB = createRes.body.data.invitation;
    createdGroupIds.push(mainGroup._id);
    assert.strictEqual(mainGroup.targetCapacity, 4);
    assert.strictEqual(mainGroup.members.length, 1, 'Pending invite must not count until B accepts');

    const acceptABRes = mockRes();
    await acceptGroupInvitation(
      mockReq({ userId: ids.B, params: { requestId: inviteAB._id.toString() } }),
      acceptABRes
    );
    assert.strictEqual(acceptABRes.statusCode, 200, `B accept failed: ${acceptABRes.body?.message}`);
    const afterBGroup = await SharedRideGroup.findById(mainGroup._id);
    assert.strictEqual(afterBGroup.members.length, 2, 'Confirmed members should be 2 after B accepts');
    assert.strictEqual(afterBGroup.availableSpots, 2, 'Remaining offered spots should be 2');
    console.log('  ✔ PASS: Capacity 4 group created -> 1/4 pending -> B accepts -> 2/4 confirmed, 2 seats left\n');

    // =========================================================================
    // SCENARIO 4: Shared Group Becomes Discoverable Offer (Single Entity)
    // =========================================================================
    console.log('SCENARIO 4: Single persisted group discoverable by C & D in Find Match and Groups...');
    const matchResC = await findMatchesForTravel(tC);
    const groupOfferInFindMatchC = matchResC.find(
      (item) => item.isGroupOffer && String(item.groupId) === String(mainGroup._id)
    );
    assert(groupOfferInFindMatchC, 'Group must appear in Student C Find Match results');
    assert.strictEqual(groupOfferInFindMatchC.availableSeats, 2);

    const discoverGroupsResC = mockRes();
    await discoverSharedRideGroups(mockReq({ userId: ids.C, query: { travelId: tC._id.toString() } }), discoverGroupsResC);
    assert.strictEqual(discoverGroupsResC.statusCode, 200);
    const groupInGroupsPageC = discoverGroupsResC.body.data.find((g) => String(g._id) === String(mainGroup._id));
    assert(groupInGroupsPageC, 'Group must appear in Student C Groups Discovery');
    assert.strictEqual(
      String(groupOfferInFindMatchC.groupId),
      String(groupInGroupsPageC._id),
      'Find Match and Groups must share the exact same persisted entity ID'
    );
    console.log('  ✔ PASS: Single persisted group offer visible in both Find Match & Groups with 2 spots left\n');

    // =========================================================================
    // SCENARIO 5: View Group Details & Request to Join Flow (C joins -> 3/4, 1 left)
    // =========================================================================
    console.log('SCENARIO 5: Join Request -> Organizer Approval -> 3/4 Confirmed...');
    const joinReqCRes = mockRes();
    await createJoinRequest(
      mockReq({
        userId: ids.C,
        params: { groupId: mainGroup._id.toString() },
        body: { travelId: tC._id.toString(), message: 'Joining near main gate' }
      }),
      joinReqCRes
    );
    assert.strictEqual(joinReqCRes.statusCode, 201, `Join request failed: ${joinReqCRes.body?.message}`);
    const reqC = joinReqCRes.body.data;

    // Group Details as viewer C reflects myPendingRequest
    const detailsCRes = mockRes();
    await getSharedRideGroupById(mockReq({ userId: ids.C, params: { id: mainGroup._id.toString() } }), detailsCRes);
    assert.strictEqual(detailsCRes.statusCode, 200, `Expected 200 for group details, got ${detailsCRes.statusCode}: ${detailsCRes.body?.message}`);
    assert.strictEqual(detailsCRes.body.data.myPendingRequest?.status, 'pending');

    const approveCRes = mockRes();
    await acceptStudentJoinRequest(
      mockReq({ userId: ids.A, params: { requestId: reqC._id.toString() } }),
      approveCRes
    );
    assert.strictEqual(approveCRes.statusCode, 200);
    assert.strictEqual(approveCRes.body.data.group.members.length, 3);
    assert.strictEqual(approveCRes.body.data.group.availableSpots, 1);
    console.log('  ✔ PASS: C approved -> 3/4 confirmed, 1 seat remaining\n');

    // =========================================================================
    // SCENARIO 6: One Active Group Per Student Rule (409 + DB partial index)
    // =========================================================================
    console.log('SCENARIO 6: Strict One Active Group Per Student enforcement...');
    // External Group X organized by Student E
    const createGroupXRes = mockRes();
    await createSharedRideGroup(
      mockReq({
        userId: ids.E,
        body: { originatingTravelId: tE._id.toString(), targetCapacity: 3 }
      }),
      createGroupXRes
    );
    assert.strictEqual(createGroupXRes.statusCode, 201);
    const groupX = createGroupXRes.body.data;
    createdGroupIds.push(groupX._id);

    // 6a: B (already in mainGroup) tries creating a group -> 409
    const bCreateConflict = mockRes();
    await createSharedRideGroup(
      mockReq({ userId: ids.B, body: { originatingTravelId: tB._id.toString(), targetCapacity: 2 } }),
      bCreateConflict
    );
    assert.strictEqual(bCreateConflict.statusCode, 409, 'Already-in-group student cannot create a second group');

    // 6b: C (already in mainGroup) tries requesting to join groupX -> 409
    const cJoinConflict = mockRes();
    await createJoinRequest(
      mockReq({ userId: ids.C, params: { groupId: groupX._id.toString() }, body: { travelId: tC._id.toString() } }),
      cJoinConflict
    );
    assert.strictEqual(cJoinConflict.statusCode, 409, 'Already-in-group student cannot request to join Group X');

    // 6c: Organizer E tries inviting B into Group X -> 409
    const inviteBConflict = mockRes();
    await inviteStudentToGroup(
      mockReq({ userId: ids.E, params: { groupId: groupX._id.toString() }, body: { travelId: tB._id.toString() } }),
      inviteBConflict
    );
    assert.strictEqual(inviteBConflict.statusCode, 409, 'Cannot invite student already in another active group');

    // 6d: Discovery for B returns 0 groups because B is already in an active group
    const discoverWhileMember = mockRes();
    await discoverSharedRideGroups(mockReq({ userId: ids.B, query: { travelId: tB._id.toString() } }), discoverWhileMember);
    assert.strictEqual(discoverWhileMember.body.data.length, 0, 'Active group members must see 0 external groups');
    console.log('  ✔ PASS: 409 returned across create/join/invite + hidden discovery while active member\n');

    // =========================================================================
    // SCENARIO 7: Duplicate Pair Prevention
    // =========================================================================
    console.log('SCENARIO 7: Duplicate Pair Prevention (idempotent return)...');
    const dupPairRes = mockRes();
    await createGroupFromFindMatch(
      mockReq({
        userId: ids.A,
        body: { originatingTravelId: tA._id.toString(), candidateTravelId: tB._id.toString(), targetCapacity: 4 }
      }),
      dupPairRes
    );
    assert(dupPairRes.statusCode === 200 || dupPairRes.statusCode === 409, `Unexpected status ${dupPairRes.statusCode}`);
    const pairGroupCount = await SharedRideGroup.countDocuments({
      _id: { $in: createdGroupIds },
      'members.userId': { $all: [ids.A, ids.B] },
      status: { $in: ['open', 'full'] }
    });
    assert.strictEqual(pairGroupCount, 1, 'Only one active group should exist for the matched pair A & B');
    console.log('  ✔ PASS: Duplicate group prevented for matched pair A & B\n');

    // =========================================================================
    // SCENARIO 8: Group Reaches Full Capacity -> Hidden from Discovery
    // =========================================================================
    console.log('SCENARIO 8: Group reaches Full capacity (4/4) -> hidden from discovery...');
    const joinReqDRes = mockRes();
    await createJoinRequest(
      mockReq({
        userId: ids.D,
        params: { groupId: mainGroup._id.toString() },
        body: { travelId: tD._id.toString() }
      }),
      joinReqDRes
    );
    assert.strictEqual(joinReqDRes.statusCode, 201);

    const approveDRes = mockRes();
    await acceptStudentJoinRequest(
      mockReq({ userId: ids.A, params: { requestId: joinReqDRes.body.data._id.toString() } }),
      approveDRes
    );
    assert.strictEqual(approveDRes.statusCode, 200);
    assert.strictEqual(approveDRes.body.data.group.status, 'full');
    assert.strictEqual(approveDRes.body.data.group.availableSpots, 0);

    const discoverFWhileFull = mockRes();
    await discoverSharedRideGroups(mockReq({ userId: ids.F, query: { travelId: tF._id.toString() } }), discoverFWhileFull);
    assert(
      !discoverFWhileFull.body.data.some((g) => String(g._id) === String(mainGroup._id)),
      'Full group must disappear from discovery'
    );
    const matchFWhileFull = await findMatchesForTravel(tF);
    assert(
      !matchFWhileFull.some((item) => item.isGroupOffer && String(item.groupId) === String(mainGroup._id)),
      'Full group must disappear from Find Match group offers'
    );
    console.log('  ✔ PASS: 4/4 group transitioned to full and hidden from discovery\n');

    // =========================================================================
    // SCENARIO 9: Member Leaving & Reopening (full -> open)
    // =========================================================================
    console.log('SCENARIO 9: Member leaves full group -> reopens to 3/4...');
    const leaveDRes = mockRes();
    await leaveSharedRideGroup(
      mockReq({ userId: ids.D, params: { groupId: mainGroup._id.toString() } }),
      leaveDRes
    );
    assert.strictEqual(leaveDRes.statusCode, 200);

    const reopenedGroup = await SharedRideGroup.findById(mainGroup._id);
    assert.strictEqual(reopenedGroup.status, 'open', 'Group must reopen from full to open');
    assert.strictEqual(reopenedGroup.members.length, 3);
    assert.strictEqual(reopenedGroup.availableSpots, 1);

    const discoverFAfterReopen = mockRes();
    await discoverSharedRideGroups(mockReq({ userId: ids.F, query: { travelId: tF._id.toString() } }), discoverFAfterReopen);
    assert(
      discoverFAfterReopen.body.data.some((g) => String(g._id) === String(mainGroup._id)),
      'Reopened group must appear again in discovery'
    );
    console.log('  ✔ PASS: Group reopened cleanly with 1 spot left and reappeared in discovery\n');

    // =========================================================================
    // SCENARIO 10: Admin Transfer & Last Member Leaving -> status: 'empty'
    // =========================================================================
    console.log('SCENARIO 10: Admin transfer & last member leaves -> status: empty...');
    // Admin A leaves -> B becomes admin + originatingTravelId transfers to tB
    const leaveARes = mockRes();
    await leaveSharedRideGroup(mockReq({ userId: ids.A, params: { groupId: mainGroup._id.toString() } }), leaveARes);
    assert.strictEqual(leaveARes.statusCode, 200);
    const afterAdminLeave = await SharedRideGroup.findById(mainGroup._id);
    assert.strictEqual(afterAdminLeave.adminId, ids.B, 'Ownership should transfer to earliest remaining member B');
    assert.strictEqual(String(afterAdminLeave.originatingTravelId), String(tB._id), 'originatingTravelId should update to new admin travel');

    // B leaves -> C becomes admin
    await leaveSharedRideGroup(mockReq({ userId: ids.B, params: { groupId: mainGroup._id.toString() } }), mockRes());
    // C leaves -> 0 members -> 'empty'
    const leaveCRes = mockRes();
    await leaveSharedRideGroup(mockReq({ userId: ids.C, params: { groupId: mainGroup._id.toString() } }), leaveCRes);
    assert.strictEqual(leaveCRes.statusCode, 200);

    const emptyGroup = await SharedRideGroup.findById(mainGroup._id);
    assert.strictEqual(emptyGroup.status, 'empty', 'Last member leaving must set status to empty');
    assert.strictEqual(emptyGroup.members.length, 0);

    const myGroupsC = mockRes();
    await getMyGroups(mockReq({ userId: ids.C }), myGroupsC);
    assert(
      !myGroupsC.body.data.some((g) => String(g._id) === String(mainGroup._id)),
      'Empty group must not show in getMyGroups'
    );
    console.log('  ✔ PASS: Admin transferred cleanly and last departure marked group as empty\n');

    // =========================================================================
    // SCENARIO 11: Concurrent Last-Seat Approval Race Condition
    // =========================================================================
    console.log('SCENARIO 11: Concurrent last-seat approval race condition...');
    const raceGroupRes = mockRes();
    await createSharedRideGroup(
      mockReq({ userId: ids.A, body: { originatingTravelId: tA._id.toString(), targetCapacity: 2 } }),
      raceGroupRes
    );
    assert.strictEqual(raceGroupRes.statusCode, 201, `A failed creating post-leave group: ${raceGroupRes.body?.message}`);
    const raceGroup = raceGroupRes.body.data;
    createdGroupIds.push(raceGroup._id);

    const reqFRes = mockRes();
    const reqGRes = mockRes();
    await createJoinRequest(mockReq({ userId: ids.F, params: { groupId: raceGroup._id.toString() }, body: { travelId: tF._id.toString() } }), reqFRes);
    await createJoinRequest(mockReq({ userId: ids.G, params: { groupId: raceGroup._id.toString() }, body: { travelId: tG._id.toString() } }), reqGRes);
    assert.strictEqual(reqFRes.statusCode, 201);
    assert.strictEqual(reqGRes.statusCode, 201);

    const resF = mockRes();
    const resG = mockRes();
    await Promise.allSettled([
      acceptStudentJoinRequest(mockReq({ userId: ids.A, params: { requestId: reqFRes.body.data._id.toString() } }), resF),
      acceptStudentJoinRequest(mockReq({ userId: ids.A, params: { requestId: reqGRes.body.data._id.toString() } }), resG)
    ]);
    const codes = [resF.statusCode, resG.statusCode].sort();
    assert.strictEqual(codes.filter((c) => c === 200).length, 1, `Strictly 1 concurrent approval may succeed, got ${JSON.stringify(codes)}`);
    const finalRaceGroup = await SharedRideGroup.findById(raceGroup._id);
    assert.strictEqual(finalRaceGroup.members.length, 2, 'Group must never exceed targetCapacity=2 under concurrency');
    assert.strictEqual(finalRaceGroup.status, 'full');
    console.log('  ✔ PASS: Strictly 1 concurrent approval succeeded; capacity=2 preserved without overbooking\n');

    // =========================================================================
    // SCENARIO 12: Existing Offer Booking & Cancellation Seat Release Unaffected
    // =========================================================================
    console.log('SCENARIO 12: Existing offer booking & cancellation seat release unaffected...');
    const offerH = await Travel.create({
      userId: ids.H,
      type: 'offer',
      source: 'VIT Bhopal',
      destination: 'Bhopal Junction',
      travelDate,
      departureTime: 610,
      timeFlexibility: 30,
      seats: 3,
      bookedSeats: 0,
      pricePerSeat: 300,
      status: 'active',
      expiresAt: calculateExpiresAt(travelDate)
    });
    createdTravelIds.push(offerH._id);

    const bookRes = mockRes();
    await createBookingRequest(
      mockReq({ userId: ids.P, body: { travelId: offerH._id.toString(), seats: 1, passengerName: 'Student P' } }),
      bookRes
    );
    assert.strictEqual(bookRes.statusCode, 201, `Booking failed: ${bookRes.body?.message}`);
    const bookingId = bookRes.body.data._id;
    createdBookingIds.push(bookingId);

    const respondRes = mockRes();
    await respondToBookingRequest(
      mockReq({ userId: ids.H, params: { id: bookingId.toString() }, body: { action: 'accept' } }),
      respondRes
    );
    assert.strictEqual(respondRes.statusCode, 200, `Accept booking failed: ${respondRes.body?.message}`);
    const afterAcceptOffer = await Travel.findById(offerH._id);
    assert.strictEqual(afterAcceptOffer.bookedSeats, 1);

    const cancelRes = mockRes();
    await cancelBooking(mockReq({ userId: ids.P, params: { id: bookingId.toString() }, body: { reason: 'Change of plans' } }), cancelRes);
    assert.strictEqual(cancelRes.statusCode, 200, `Cancel booking failed: ${cancelRes.body?.message}`);
    const afterCancelOffer = await Travel.findById(offerH._id);
    assert.strictEqual(afterCancelOffer.bookedSeats, 0, 'Seats must be released back on booking cancellation');
    console.log('  ✔ PASS: Booking creation, acceptance & cancellation seat release intact\n');

    console.log('================================================================');
    console.log('ALL 12 SCENARIOS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    await Promise.allSettled([
      Booking.deleteMany({ _id: { $in: createdBookingIds } }),
      GroupJoinRequest.deleteMany({ groupId: { $in: createdGroupIds } }),
      SharedRideGroup.deleteMany({ _id: { $in: createdGroupIds } }),
      Travel.deleteMany({ _id: { $in: createdTravelIds } }),
      Student.deleteMany({ clerkId: { $in: allUserIds } }),
      Notification.deleteMany({ userId: { $in: allUserIds } }),
      Outbox.deleteMany({
        $or: [
          { recipientUserId: { $in: allUserIds } },
          { 'payload.studentId': { $in: allUserIds } }
        ]
      })
    ]);
    await mongoose.disconnect();
    console.log('\nCleanup complete & disconnected.');
  }
}

runDynamicGroupE2E()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTEST SUITE FAILED:', err);
    process.exit(1);
  });
