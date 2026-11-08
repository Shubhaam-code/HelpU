import mongoose from 'mongoose';
import SharedRideGroup from '../models/SharedRideGroup.js';
import GroupJoinRequest from '../models/GroupJoinRequest.js';
import Travel from '../models/Travel.js';
import Student from '../models/Student.js';
import { createOutboxEvent, triggerOutboxSweep } from '../services/outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';
import { isSameDirection, isSameCalendarDay, isDepartureTimeCompatible, areFindPostsCompatible, findCompatibleGroupsForFindPost } from '../services/matching.service.js';

/**
 * Helper: commits a transaction session with retry support for UnknownTransactionCommitResult.
 * Per MongoDB specification, if commitTransaction throws an error labeled UnknownTransactionCommitResult,
 * committing the same session must be retried rather than re-running the entire transaction callback.
 * This prevents duplicate document updates, array pushes, and duplicate Outbox event creations.
 */
export async function commitWithRetry(session) {
  const maxCommitRetries = 3;
  for (let commitAttempt = 1; commitAttempt <= maxCommitRetries; commitAttempt++) {
    try {
      await session.commitTransaction();
      return;
    } catch (commitErr) {
      const isUnknownCommit =
        commitErr?.hasErrorLabel?.('UnknownTransactionCommitResult') ||
        (Array.isArray(commitErr?.errorLabels) && commitErr.errorLabels.includes('UnknownTransactionCommitResult'));

      if (isUnknownCommit && commitAttempt < maxCommitRetries) {
        await new Promise((resolve) => setTimeout(resolve, commitAttempt * 50));
        continue;
      }
      throw commitErr;
    }
  }
}

/**
 * Helper: executes a callback inside a MongoDB transaction session with retry
 * support for transient transaction errors (such as write conflicts) and commit errors.
 * Requires transactions to be supported by the MongoDB deployment. If transactions
 * are unavailable, fails safely with a 500 error to prevent partial writes.
 */
export async function runInTransaction(callback) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (startErr) {
      console.error('[Transaction] MongoDB transactions required but unavailable:', startErr.message);
      const err = new Error('Database transaction could not be started. Transactions are required for multi-document operations to guarantee consistency.');
      err.statusCode = 500;
      throw err;
    }

    try {
      const result = await callback(session);
      await commitWithRetry(session);
      return result;
    } catch (err) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // ignore abort errors
      }

      const isTransient =
        err?.hasErrorLabel?.('TransientTransactionError') ||
        (Array.isArray(err?.errorLabels) && err.errorLabels.includes('TransientTransactionError')) ||
        err?.code === 112 ||
        err?.codeName === 'WriteConflict';

      if (isTransient && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 50));
        continue;
      }

      throw err;
    } finally {
      if (session) {
        try {
          await session.endSession();
        } catch (endErr) {
          // ignore session end errors
        }
      }
    }
  }
}

/**
 * @route   POST /api/groups
 * @desc    Create a Shared Ride Group from an active FIND (request) post
 * @access  Protected (Firebase Authenticated)
 */
export async function createSharedRideGroup(req, res) {
  try {
    const {
      originatingTravelId,
      travelId,
      targetCapacity,
      actualCabCapacity,
      notes,
      whatsappGroupUrl
    } = req.body;

    const rawTravelId = originatingTravelId || travelId;
    const adminId = req.userId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    // If candidate FIND match post ID is provided, delegate to the match-based group creation handler
    if (req.body?.candidateTravelId || req.body?.inviteeTravelId) {
      return createGroupFromFindMatch(req, res);
    }

    // 1. Validate targetCapacity (must be a positive integer)
    if (
      targetCapacity === undefined ||
      targetCapacity === null ||
      isNaN(Number(targetCapacity)) ||
      !Number.isInteger(Number(targetCapacity)) ||
      Number(targetCapacity) < 1
    ) {
      return res.status(400).json({
        success: false,
        message: 'targetCapacity is required and must be a positive integer of at least 1'
      });
    }
    const parsedTargetCapacity = Number(targetCapacity);

    // 2. Validate optional actualCabCapacity (positive integer or null)
    let parsedCabCapacity = null;
    if (actualCabCapacity !== undefined && actualCabCapacity !== null) {
      if (
        isNaN(Number(actualCabCapacity)) ||
        !Number.isInteger(Number(actualCabCapacity)) ||
        Number(actualCabCapacity) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: 'actualCabCapacity must be a positive integer or null'
        });
      }
      parsedCabCapacity = Number(actualCabCapacity);
    }

    // 3. Validate originatingTravelId format
    if (!rawTravelId || !mongoose.Types.ObjectId.isValid(rawTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid originating travel ID format'
      });
    }

    // 4. Validate optional WhatsApp URL format
    if (whatsappGroupUrl && typeof whatsappGroupUrl === 'string') {
      const trimmedUrl = whatsappGroupUrl.trim();
      const isValidWhatsapp = /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[a-zA-Z0-9_\-]+$/i.test(trimmedUrl);
      if (!isValidWhatsapp) {
        return res.status(400).json({
          success: false,
          message: 'Must be a valid WhatsApp invite or chat URL'
        });
      }
    }

    // 5. Fetch and validate originating travel post
    const travel = await Travel.findById(rawTravelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Originating travel post not found'
      });
    }

    // 6. Verify ownership (must belong to authenticated student)
    if (travel.userId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create a shared ride group from your own travel post'
      });
    }

    // 7. Verify post type is FIND ('request')
    if (travel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Only FIND (request) posts can be used to create a shared ride group'
      });
    }

    // 8. Verify post is active and unexpired
    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create group from an inactive travel post'
      });
    }

    const now = new Date();
    if (travel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create group from an expired travel post'
      });
    }

    // 9. Verify route, date, and departure time validity
    if (!travel.source || !travel.destination || !travel.travelDate || typeof travel.departureTime !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Originating travel post has invalid route, date, or departure time'
      });
    }

    // 10. Check if an active group already exists for this FIND post
    const existingActiveGroup = await SharedRideGroup.findOne({
      originatingTravelId: travel._id,
      status: { $in: ['open', 'full'] }
    });

    if (existingActiveGroup) {
      return res.status(409).json({
        success: false,
        message: 'An active shared ride group already exists for this FIND post',
        data: { existingGroupId: existingActiveGroup._id }
      });
    }

    // 11. Create SharedRideGroup inside transaction
    const createdGroup = await runInTransaction(async (session) => {
      // Re-verify inside session to protect against race conditions
      const query = {
        originatingTravelId: travel._id,
        status: { $in: ['open', 'full'] }
      };
      const activeExisting = session
        ? await SharedRideGroup.findOne(query).session(session)
        : await SharedRideGroup.findOne(query);

      if (activeExisting) {
        const conflictErr = new Error('An active shared ride group already exists for this FIND post');
        conflictErr.statusCode = 409;
        conflictErr.existingGroupId = activeExisting._id;
        throw conflictErr;
      }

      const options = session ? { session } : {};
      const [group] = await SharedRideGroup.create(
        [
          {
            adminId,
            originatingTravelId: travel._id,
            source: travel.source,
            destination: travel.destination,
            travelDate: travel.travelDate,
            departureTime: travel.departureTime,
            targetCapacity: parsedTargetCapacity,
            actualCabCapacity: parsedCabCapacity,
            notes: typeof notes === 'string' ? notes.trim() : '',
            whatsappGroupUrl:
              typeof whatsappGroupUrl === 'string' && whatsappGroupUrl.trim()
                ? whatsappGroupUrl.trim()
                : null,
            status: 'open',
            expiresAt: travel.expiresAt,
            members: [
              {
                userId: adminId,
                travelId: travel._id,
                role: 'admin',
                joinedAt: new Date()
              }
            ]
          }
        ],
        options
      );

      return group;
    });

    return res.status(201).json({
      success: true,
      message: 'Shared ride group created successfully',
      data: createdGroup
    });
  } catch (err) {
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An active shared ride group already exists for this FIND post',
        data: err.existingGroupId ? { existingGroupId: err.existingGroupId } : undefined
      });
    }

    console.error('[SharedRideGroup] Error creating group:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create shared ride group',
      error: err.message
    });
  }
}

/**
 * @route   GET /api/groups/discover?travelId=<FIND_TRAVEL_ID>
 * @desc    Discover compatible Shared Ride Groups for a student's active FIND post
 * @access  Protected
 */
export async function discoverSharedRideGroups(req, res) {
  try {
    const studentId = req.userId;
    const { travelId } = req.query;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    if (!travelId || !mongoose.Types.ObjectId.isValid(travelId)) {
      return res.status(400).json({
        success: false,
        message: 'travelId query parameter is required and must be a valid ID'
      });
    }

    // 1. Fetch and validate the originating FIND Travel post
    const travel = await Travel.findById(travelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Travel post not found'
      });
    }

    // 2. Verify post ownership
    if (travel.userId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only discover groups using your own travel post'
      });
    }

    // 3. Verify post is FIND/request
    if (travel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Only FIND (request) posts can be used to discover shared ride groups'
      });
    }

    // 4. Verify post is active and unexpired
    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot discover groups with an inactive travel post'
      });
    }

    const now = new Date();
    if (travel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot discover groups with an expired travel post'
      });
    }

    // 5. Discover compatible shared ride groups using centralized matching service
    const safeResults = await findCompatibleGroupsForFindPost(travel, studentId);

    return res.status(200).json({
      success: true,
      count: safeResults.length,
      data: safeResults
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error discovering groups:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to discover shared ride groups',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/:groupId/join-requests
 * @desc    Student creates a request to join an open Shared Ride Group
 * @access  Protected
 */
export async function createJoinRequest(req, res) {
  try {
    const { groupId, id } = req.params;
    const targetGroupId = groupId || id;
    const requesterId = req.userId;
    const { travelId, requesterTravelId, message } = req.body;
    const rawTravelId = travelId || requesterTravelId;

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    // 1. Validate Group ID format
    if (!targetGroupId || !mongoose.Types.ObjectId.isValid(targetGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    // 2. Fetch group
    const group = await SharedRideGroup.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    // 3. Verify group status is 'open'
    if (group.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: `Cannot request to join a group with status "${group.status}"`
      });
    }

    // 4. Verify group is not expired
    const now = new Date();
    if (group.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot join an expired group'
      });
    }

    // 5. Check available capacity
    const currentMemberCount = Array.isArray(group.members) ? group.members.length : 0;
    if (currentMemberCount >= group.targetCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Group has already reached its target capacity'
      });
    }

    // 6. Prevent group admin or existing members from requesting
    if (group.adminId === requesterId) {
      return res.status(400).json({
        success: false,
        message: 'You are the admin of this group'
      });
    }

    const isAlreadyMember = Array.isArray(group.members) && group.members.some((m) => m.userId === requesterId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    }

    // 7. Validate requester's FIND Travel ID format
    if (!rawTravelId || !mongoose.Types.ObjectId.isValid(rawTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'travelId is required and must be a valid ID'
      });
    }

    // 8. Fetch and validate requester's FIND post
    const travel = await Travel.findById(rawTravelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Requester travel post not found'
      });
    }

    if (travel.userId !== requesterId) {
      return res.status(403).json({
        success: false,
        message: 'Travel post does not belong to you'
      });
    }

    if (travel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Only FIND (request) posts can be used to join a shared ride group'
      });
    }

    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot request to join with an inactive travel post'
      });
    }

    if (travel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request to join because your travel post has expired'
      });
    }

    // 9. Reject if group originates from the same travel post
    if (String(group.originatingTravelId) === String(travel._id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot join a group that originates from this travel post'
      });
    }

    // 10. Compatibility checks: route/direction, calendar day, departure time window
    if (!isSameDirection(group.source, group.destination, travel.source, travel.destination)) {
      return res.status(400).json({
        success: false,
        message: 'Your travel route or direction is not compatible with this group'
      });
    }

    if (!isSameCalendarDay(group.travelDate, travel.travelDate)) {
      return res.status(400).json({
        success: false,
        message: 'Your travel date does not match the group calendar date'
      });
    }

    if (!isDepartureTimeCompatible(group.departureTime, travel.departureTime, 420)) {
      return res.status(400).json({
        success: false,
        message: 'Departure time difference exceeds the maximum allowed window (420 minutes)'
      });
    }

    // 11. Check duplicate pending join request or invitation (excluding expired ones)
    const existingPending = await GroupJoinRequest.findOne({
      groupId: group._id,
      requesterId,
      status: 'pending'
    });

    const isExistingExpired = existingPending?.expiresAt && new Date(existingPending.expiresAt) <= now;
    if (existingPending && !isExistingExpired) {
      return res.status(409).json({
        success: false,
        message: 'A pending join request or invitation already exists for this group',
        data: { existingRequestId: existingPending._id }
      });
    }

    // 12. Create join request inside transaction
    const joinRequest = await runInTransaction(async (session) => {
      const txNow = new Date();

      // Atomically reconcile any expired pending requests for this user and group
      // so they transition to 'expired' and release the partial unique index
      await GroupJoinRequest.updateMany(
        {
          groupId: group._id,
          requesterId,
          status: 'pending',
          expiresAt: { $lte: txNow }
        },
        {
          $set: { status: 'expired' }
        },
        session ? { session } : {}
      );

      // Re-verify active pending request inside session
      const query = {
        groupId: group._id,
        requesterId,
        status: 'pending'
      };
      const concurrentRequest = session
        ? await GroupJoinRequest.findOne(query).session(session)
        : await GroupJoinRequest.findOne(query);

      if (concurrentRequest) {
        const conflictErr = new Error('A pending join request or invitation already exists for this group');
        conflictErr.statusCode = 409;
        conflictErr.existingRequestId = concurrentRequest._id;
        throw conflictErr;
      }

      const options = session ? { session } : {};
      const [newRequest] = await GroupJoinRequest.create(
        [
          {
            groupId: group._id,
            requesterId,
            requesterTravelId: travel._id,
            senderId: requesterId,
            recipientId: group.adminId,
            type: 'join_request',
            status: 'pending',
            expiresAt: group.expiresAt,
            message: typeof message === 'string' ? message.trim() : ''
          }
        ],
        options
      );

      // Fetch requester student record for friendly notification message
      const requesterStudentQuery = Student.findOne({ clerkId: requesterId });
      const requesterStudent = session ? await requesterStudentQuery.session(session) : await requesterStudentQuery;
      const requesterName = requesterStudent?.name || 'A student';

      // Create outbox event notifying the group admin
      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_RECEIVED,
          recipientId: group.adminId,
          relatedTravelId: travel._id,
          payload: {
            groupId: group._id,
            requestId: newRequest._id,
            requesterId,
            requesterName,
            source: group.source,
            destination: group.destination,
            travelDate: group.travelDate,
            departureTime: group.departureTime,
            targetCapacity: group.targetCapacity
          }
        },
        session
      );

      return newRequest;
    });

    // Trigger outbox sweep asynchronously
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Join request sent successfully',
      data: joinRequest
    });
  } catch (err) {
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A pending join request or invitation already exists for this group',
        data: err.existingRequestId ? { existingRequestId: err.existingRequestId } : undefined
      });
    }

    console.error('[SharedRideGroup] Error creating join request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create join request',
      error: err.message
    });
  }
}

/**
 * @route   GET /api/groups/:groupId/join-requests
 * @desc    Get join requests inbox for a group (Admin only)
 * @access  Protected (Group Admin only)
 */
export async function getGroupJoinRequests(req, res) {
  try {
    const { groupId, id } = req.params;
    const targetGroupId = groupId || id;
    const adminId = req.userId;

    if (!targetGroupId || !mongoose.Types.ObjectId.isValid(targetGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    const group = await SharedRideGroup.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    if (group.adminId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can view join requests for this group'
      });
    }

    // Query only 'join_request' records (never mix invitations with join requests)
    const requests = await GroupJoinRequest.find({
      groupId: group._id,
      type: 'join_request'
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'requesterTravelId',
        select: 'source destination travelDate departureTime seats status'
      })
      .lean();

    // Attach safe student profiles for requesters (strictly omitting private phone, email, firebaseUid)
    const requesterIds = requests.map((r) => r.requesterId);
    const students = await Student.find(
      { clerkId: { $in: requesterIds } },
      { name: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
    ).lean();

    const studentMap = new Map(students.map((s) => [s.clerkId, s]));

    const enrichedRequests = requests.map((r) => {
      const profile = studentMap.get(r.requesterId);
      return {
        ...r,
        requester: profile || { name: 'Campus Student', isVerified: false }
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedRequests.length,
      data: enrichedRequests
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error fetching group join requests:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch join requests',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/join-requests/:requestId/accept
 * @desc    Admin accepts a student join request
 * @access  Protected (Group Admin only)
 */
export async function acceptStudentJoinRequest(req, res) {
  try {
    const { requestId, id } = req.params;
    const targetRequestId = requestId || id;
    const adminId = req.userId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    if (!targetRequestId || !mongoose.Types.ObjectId.isValid(targetRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format'
      });
    }

    // 1. Fetch join request
    const joinRequest = await GroupJoinRequest.findById(targetRequestId);
    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Join request not found'
      });
    }

    // 2. Authorization check: only group admin (recipient) can accept
    if (joinRequest.recipientId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can accept this join request'
      });
    }

    // 3. Verify request type is 'join_request'
    if (joinRequest.type !== 'join_request') {
      return res.status(400).json({
        success: false,
        message: 'Only join requests can be accepted through this endpoint'
      });
    }

    // 4. Verify request status is 'pending'
    if (joinRequest.status !== 'pending') {
      if (joinRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Join request has already been accepted'
        });
      }
      if (joinRequest.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot accept a rejected join request'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot accept join request with status "${joinRequest.status}"`
      });
    }

    // 5. Fetch target group
    const group = await SharedRideGroup.findById(joinRequest.groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    // 6. Verify group is 'open' and not expired
    if (group.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept requests for a group with status "${group.status}"`
      });
    }

    const now = new Date();
    if (group.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept requests for an expired group'
      });
    }

    // 7. Prevent duplicate membership
    const isAlreadyMember = Array.isArray(group.members) && group.members.some((m) => m.userId === joinRequest.requesterId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'Student is already a member of this group'
      });
    }

    // 8. Check capacity
    const currentMemberCount = Array.isArray(group.members) ? group.members.length : 0;
    if (currentMemberCount >= group.targetCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Group has already reached its target capacity'
      });
    }

    // 9. Fetch and validate requester's FIND post
    const travel = await Travel.findById(joinRequest.requesterTravelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Requester travel post not found'
      });
    }

    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept request with an inactive travel post'
      });
    }

    if (travel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept request because the travel post has expired'
      });
    }

    // 10. Revalidate compatibility
    if (!isSameDirection(group.source, group.destination, travel.source, travel.destination)) {
      return res.status(400).json({
        success: false,
        message: 'Requester travel route or direction is no longer compatible with this group'
      });
    }

    if (!isSameCalendarDay(group.travelDate, travel.travelDate)) {
      return res.status(400).json({
        success: false,
        message: 'Requester travel date does not match the group calendar date'
      });
    }

    if (!isDepartureTimeCompatible(group.departureTime, travel.departureTime, 420)) {
      return res.status(400).json({
        success: false,
        message: 'Departure time difference exceeds the maximum allowed window (420 minutes)'
      });
    }

    // 11. Atomic acceptance inside transaction with concurrency protection
    const { updatedGroup, updatedRequest } = await runInTransaction(async (session) => {
      // Re-verify live group status and capacity within transaction session
      const liveGroup = session
        ? await SharedRideGroup.findById(group._id).session(session)
        : await SharedRideGroup.findById(group._id);

      if (!liveGroup || liveGroup.status !== 'open') {
        const err = new Error(`Cannot accept request for a group with status "${liveGroup ? liveGroup.status : 'unknown'}"`);
        err.statusCode = 400;
        throw err;
      }

      const txNow = new Date();
      if (!liveGroup.expiresAt || liveGroup.expiresAt <= txNow) {
        const err = new Error('Cannot accept request for an expired group');
        err.statusCode = 400;
        throw err;
      }

      if (Array.isArray(liveGroup.members) && liveGroup.members.length >= liveGroup.targetCapacity) {
        const err = new Error('Group has already reached its target capacity');
        err.statusCode = 400;
        throw err;
      }

      // Step A: Atomically transition join request to 'accepted'
      const reqQuery = {
        _id: joinRequest._id,
        status: 'pending',
        recipientId: adminId
      };
      const reqUpdate = {
        $set: {
          status: 'accepted',
          respondedAt: new Date(),
          respondedBy: adminId
        }
      };

      const transRequest = session
        ? await GroupJoinRequest.findOneAndUpdate(reqQuery, reqUpdate, { session, returnDocument: 'after' })
        : await GroupJoinRequest.findOneAndUpdate(reqQuery, reqUpdate, { returnDocument: 'after' });

      if (!transRequest) {
        const err = new Error('Join request is no longer pending or has already been resolved');
        err.statusCode = 400;
        throw err;
      }

      // Step B: Atomically and conditionally add member to group only if members.length < targetCapacity
      const groupQuery = {
        _id: group._id,
        status: 'open',
        expiresAt: { $gt: txNow },
        'members.userId': { $ne: joinRequest.requesterId },
        $expr: { $lt: [{ $size: '$members' }, '$targetCapacity'] }
      };

      const groupUpdate = {
        $push: {
          members: {
            userId: joinRequest.requesterId,
            travelId: travel._id,
            role: 'member',
            joinedAt: new Date()
          }
        }
      };

      const transGroup = session
        ? await SharedRideGroup.findOneAndUpdate(groupQuery, groupUpdate, { session, returnDocument: 'after' })
        : await SharedRideGroup.findOneAndUpdate(groupQuery, groupUpdate, { returnDocument: 'after' });

      if (!transGroup) {
        const err = new Error('Group has already reached its target capacity or is no longer open');
        err.statusCode = 400;
        throw err;
      }

      // Step C: If target capacity is reached, transition status to 'full'
      if (Array.isArray(transGroup.members) && transGroup.members.length >= transGroup.targetCapacity) {
        transGroup.status = 'full';
        if (session) {
          await transGroup.save({ session });
        } else {
          await transGroup.save();
        }
      }

      // Step D: Create Outbox notification for requester
      const adminStudentQuery = Student.findOne({ clerkId: adminId });
      const adminStudent = session ? await adminStudentQuery.session(session) : await adminStudentQuery;
      const adminName = adminStudent?.name || 'The group admin';

      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_ACCEPTED,
          recipientId: joinRequest.requesterId,
          relatedTravelId: travel._id,
          payload: {
            groupId: group._id,
            requestId: joinRequest._id,
            adminId,
            adminName,
            source: group.source,
            destination: group.destination,
            travelDate: group.travelDate,
            currentMemberCount: transGroup.members.length,
            targetCapacity: transGroup.targetCapacity,
            isFull: transGroup.status === 'full'
          }
        },
        session
      );

      return { updatedGroup: transGroup, updatedRequest: transRequest };
    });

    // Trigger outbox sweep asynchronously
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Join request accepted successfully',
      data: {
        group: updatedGroup,
        joinRequest: updatedRequest
      }
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }

    console.error('[SharedRideGroup] Error accepting join request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept join request',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/join-requests/:requestId/reject
 * @desc    Admin rejects a student join request
 * @access  Protected (Group Admin only)
 */
export async function rejectStudentJoinRequest(req, res) {
  try {
    const { requestId, id } = req.params;
    const targetRequestId = requestId || id;
    const adminId = req.userId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    if (!targetRequestId || !mongoose.Types.ObjectId.isValid(targetRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format'
      });
    }

    // 1. Fetch join request
    const joinRequest = await GroupJoinRequest.findById(targetRequestId);
    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Join request not found'
      });
    }

    // 2. Authorization check: only group admin (recipient) can reject
    if (joinRequest.recipientId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can reject this join request'
      });
    }

    // 3. Verify request type is 'join_request'
    if (joinRequest.type !== 'join_request') {
      return res.status(400).json({
        success: false,
        message: 'Only join requests can be rejected through this endpoint'
      });
    }

    // 4. Verify request status is 'pending'
    if (joinRequest.status !== 'pending') {
      if (joinRequest.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Join request has already been rejected'
        });
      }
      if (joinRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot reject a join request that has already been accepted'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot reject join request with status "${joinRequest.status}"`
      });
    }

    // 5. Fetch group to populate route in notification
    const group = await SharedRideGroup.findById(joinRequest.groupId);

    // 6. Atomically update status to 'rejected'
    const updatedRequest = await GroupJoinRequest.findOneAndUpdate(
      {
        _id: joinRequest._id,
        status: 'pending',
        recipientId: adminId
      },
      {
        $set: {
          status: 'rejected',
          respondedAt: new Date(),
          respondedBy: adminId
        }
      },
      { returnDocument: 'after' }
    );

    if (!updatedRequest) {
      return res.status(400).json({
        success: false,
        message: 'Join request is no longer pending or has already been resolved'
      });
    }

    // 7. Create outbox notification event for the requester
    try {
      await createOutboxEvent({
        eventType: NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_REJECTED,
        recipientId: joinRequest.requesterId,
        relatedTravelId: joinRequest.requesterTravelId,
        payload: {
          groupId: joinRequest.groupId,
          requestId: joinRequest._id,
          source: group?.source || 'Source',
          destination: group?.destination || 'Destination',
          travelDate: group?.travelDate
        }
      });

      triggerOutboxSweep();
    } catch (notifErr) {
      console.warn('[Outbox] Non-blocking warning during join request reject notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Join request rejected successfully',
      data: updatedRequest
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error rejecting join request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject join request',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/:id/invites
 * @route   POST /api/groups/:id/invite
 * @desc    Invite a compatible FIND student to the shared ride group
 * @access  Protected (Group Admin only)
 */
export async function inviteStudentToGroup(req, res) {
  try {
    const { id, groupId } = req.params;
    const targetGroupId = id || groupId;
    const adminId = req.userId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    // 1. Validate Group ID format
    if (!targetGroupId || !mongoose.Types.ObjectId.isValid(targetGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    // 2. Fetch group
    const group = await SharedRideGroup.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    // 3. Admin authorization check
    if (group.adminId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can invite members to this group'
      });
    }

    // 4. Check group status is 'open'
    if (group.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: `Cannot invite members to a group with status "${group.status}"`
      });
    }

    // 5. Check if group has already reached target capacity
    const currentCount = Array.isArray(group.members) ? group.members.length : 0;
    if (currentCount >= group.targetCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Group has already reached its target capacity'
      });
    }

    // 6. Extract candidate travel and user details
    const {
      candidateTravelId,
      inviteeTravelId,
      recipientTravelId,
      requesterTravelId,
      travelId,
      candidateUserId,
      inviteeId,
      recipientId,
      requesterId,
      userId,
      message
    } = req.body;

    const rawCandidateTravelId = candidateTravelId || inviteeTravelId || recipientTravelId || requesterTravelId || travelId;
    const rawCandidateUserId = candidateUserId || inviteeId || recipientId || requesterId || userId;

    if (!rawCandidateTravelId || !mongoose.Types.ObjectId.isValid(rawCandidateTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid candidate travel ID format'
      });
    }

    // 7. Fetch candidate travel post
    const candidateTravel = await Travel.findById(rawCandidateTravelId);
    if (!candidateTravel) {
      return res.status(404).json({
        success: false,
        message: 'Candidate travel post not found'
      });
    }

    // 8. Prevent inviting own post
    if (candidateTravel.userId === adminId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite your own travel post to the group'
      });
    }

    // 9. If candidate user ID was explicitly provided, verify ownership match
    if (rawCandidateUserId && candidateTravel.userId !== rawCandidateUserId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate travel post does not belong to the specified invitee'
      });
    }

    // 10. Only FIND ('request') posts can be invited
    if (candidateTravel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Only FIND (request) posts can be invited to a shared ride group'
      });
    }

    // 11. Check candidate post active and unexpired
    if (candidateTravel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot invite an inactive travel post'
      });
    }

    const now = new Date();
    if (candidateTravel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot invite an expired travel post'
      });
    }

    // 12. Compatibility check: Route and Direction (strict same direction)
    if (!isSameDirection(group.source, group.destination, candidateTravel.source, candidateTravel.destination)) {
      return res.status(400).json({
        success: false,
        message: 'Candidate travel route or direction is not compatible with this group'
      });
    }

    // 13. Compatibility check: Calendar Day (Asia/Kolkata timezone)
    if (!isSameCalendarDay(group.travelDate, candidateTravel.travelDate)) {
      return res.status(400).json({
        success: false,
        message: 'Candidate travel date does not match the group calendar date'
      });
    }

    // 14. Compatibility check: Departure time (420 minutes / 7 hours window)
    if (!isDepartureTimeCompatible(group.departureTime, candidateTravel.departureTime, 420)) {
      return res.status(400).json({
        success: false,
        message: 'Departure time difference exceeds the maximum allowed window (420 minutes)'
      });
    }

    // 15. Check if candidate is already a member of this group
    const isAlreadyMember = group.members.some((m) => m.userId === candidateTravel.userId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'Student is already a member of this group'
      });
    }

    // 16. Check if duplicate pending invitation or join request exists (excluding expired ones)
    const existingPending = await GroupJoinRequest.findOne({
      groupId: group._id,
      requesterId: candidateTravel.userId,
      status: 'pending'
    });

    const isExistingExpired = existingPending?.expiresAt && new Date(existingPending.expiresAt) <= now;
    if (existingPending && !isExistingExpired) {
      return res.status(409).json({
        success: false,
        message: 'A pending invitation or request already exists for this student and group',
        data: { existingRequestId: existingPending._id }
      });
    }

    // 17. Create GroupJoinRequest + Outbox notification inside transaction
    const joinRequest = await runInTransaction(async (session) => {
      const txNow = new Date();

      // Atomically reconcile any expired pending requests for this student and group
      // so they transition to 'expired' and release the partial unique index
      await GroupJoinRequest.updateMany(
        {
          groupId: group._id,
          requesterId: candidateTravel.userId,
          status: 'pending',
          expiresAt: { $lte: txNow }
        },
        {
          $set: { status: 'expired' }
        },
        session ? { session } : {}
      );

      // Re-verify inside session to protect against concurrent duplicates
      const query = {
        groupId: group._id,
        requesterId: candidateTravel.userId,
        status: 'pending'
      };
      const concurrentRequest = session
        ? await GroupJoinRequest.findOne(query).session(session)
        : await GroupJoinRequest.findOne(query);

      if (concurrentRequest) {
        const conflictErr = new Error('A pending invitation or request already exists for this student and group');
        conflictErr.statusCode = 409;
        conflictErr.existingRequestId = concurrentRequest._id;
        throw conflictErr;
      }

      const options = session ? { session } : {};
      const [newRequest] = await GroupJoinRequest.create(
        [
          {
            groupId: group._id,
            requesterId: candidateTravel.userId,
            requesterTravelId: candidateTravel._id,
            senderId: adminId,
            recipientId: candidateTravel.userId,
            type: 'invite',
            status: 'pending',
            expiresAt: group.expiresAt,
            message: typeof message === 'string' ? message.trim() : ''
          }
        ],
        options
      );

      // Fetch admin student details for friendly notification message
      const adminStudentQuery = Student.findOne({ clerkId: adminId });
      const adminStudent = session ? await adminStudentQuery.session(session) : await adminStudentQuery;
      const adminName = adminStudent?.name || 'A campus peer';

      // Create Outbox notification event for the invited student
      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_RECEIVED,
          recipientId: candidateTravel.userId,
          relatedTravelId: candidateTravel._id,
          payload: {
            groupId: group._id,
            requestId: newRequest._id,
            adminId,
            adminName,
            source: group.source,
            destination: group.destination,
            travelDate: group.travelDate,
            departureTime: group.departureTime,
            targetCapacity: group.targetCapacity
          }
        },
        session
      );

      return newRequest;
    });

    // Trigger outbox sweep asynchronously
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: joinRequest
    });
  } catch (err) {
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A pending invitation or request already exists for this student and group',
        data: err.existingRequestId ? { existingRequestId: err.existingRequestId } : undefined
      });
    }

    console.error('[SharedRideGroup] Error inviting student to group:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to invite student to shared ride group',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/invitations/:requestId/accept
 * @desc    Accept an invitation to join a Shared Ride Group
 * @access  Protected (Intended Recipient only)
 */
export async function acceptGroupInvitation(req, res) {
  try {
    const { requestId, id } = req.params;
    const targetRequestId = requestId || id;
    const recipientId = req.userId;

    if (!recipientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    // 1. Validate request ID format
    if (!targetRequestId || !mongoose.Types.ObjectId.isValid(targetRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation request ID format'
      });
    }

    // 2. Fetch invitation document
    const joinRequest = await GroupJoinRequest.findById(targetRequestId);
    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Invitation request not found'
      });
    }

    // 3. Authorization check: only intended recipient can accept
    if (joinRequest.recipientId !== recipientId) {
      return res.status(403).json({
        success: false,
        message: 'Only the intended recipient can accept this invitation'
      });
    }

    // 4. Verify request type is 'invite'
    if (joinRequest.type !== 'invite') {
      return res.status(400).json({
        success: false,
        message: 'Only invitations can be accepted through this endpoint'
      });
    }

    // 5. Verify status is 'pending'
    if (joinRequest.status !== 'pending') {
      if (joinRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Invitation has already been accepted'
        });
      }
      if (joinRequest.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot accept a rejected invitation'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot accept invitation with status "${joinRequest.status}"`
      });
    }

    // 5b. Verify invitation has not expired
    const now = new Date();
    if (joinRequest.expiresAt && new Date(joinRequest.expiresAt) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept an expired invitation'
      });
    }

    // 6. Fetch target group
    const group = await SharedRideGroup.findById(joinRequest.groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    // 7. Verify group is still 'open' and unexpired
    if (group.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: `Cannot join a group with status "${group.status}"`
      });
    }

    if (!group.expiresAt || group.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept invitation for an expired group'
      });
    }

    // 8. Prevent duplicate group membership
    const isAlreadyMember = Array.isArray(group.members) && group.members.some((m) => m.userId === recipientId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    }

    // 9. Check available capacity
    const currentMemberCount = Array.isArray(group.members) ? group.members.length : 0;
    if (currentMemberCount >= group.targetCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Group has already reached its target capacity'
      });
    }

    // 10. Fetch and validate recipient's FIND post
    const travel = await Travel.findById(joinRequest.requesterTravelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Recipient travel post not found'
      });
    }

    if (travel.userId !== recipientId) {
      return res.status(403).json({
        success: false,
        message: 'Travel post does not belong to the authenticated recipient'
      });
    }

    if (travel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Only FIND (request) posts can join a shared ride group'
      });
    }

    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept invitation with an inactive travel post'
      });
    }

    if (travel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept invitation because your travel post has expired'
      });
    }

    // 11. Revalidate compatibility: route/direction, calendar day, departure time
    if (!isSameDirection(group.source, group.destination, travel.source, travel.destination)) {
      return res.status(400).json({
        success: false,
        message: 'Your travel route or direction is no longer compatible with this group'
      });
    }

    if (!isSameCalendarDay(group.travelDate, travel.travelDate)) {
      return res.status(400).json({
        success: false,
        message: 'Your travel date does not match the group calendar date'
      });
    }

    if (!isDepartureTimeCompatible(group.departureTime, travel.departureTime, 420)) {
      return res.status(400).json({
        success: false,
        message: 'Departure time difference exceeds the maximum allowed window (420 minutes)'
      });
    }

    // 12. Execute atomic acceptance inside MongoDB transaction
    const { updatedGroup, updatedRequest } = await runInTransaction(async (session) => {
      // Step A: Re-fetch group inside session to verify live status & capacity
      const liveGroup = session
        ? await SharedRideGroup.findById(group._id).session(session)
        : await SharedRideGroup.findById(group._id);

      if (!liveGroup || liveGroup.status !== 'open') {
        const err = new Error(`Cannot join a group with status "${liveGroup ? liveGroup.status : 'unknown'}"`);
        err.statusCode = 400;
        throw err;
      }

      const txNow = new Date();
      if (!liveGroup.expiresAt || liveGroup.expiresAt <= txNow) {
        const err = new Error('Cannot accept invitation for an expired group');
        err.statusCode = 400;
        throw err;
      }

      if (Array.isArray(liveGroup.members) && liveGroup.members.length >= liveGroup.targetCapacity) {
        const err = new Error('Group has already reached its target capacity');
        err.statusCode = 400;
        throw err;
      }

      // Step B: Atomically transition invitation to 'accepted'
      const reqQuery = {
        _id: joinRequest._id,
        status: 'pending',
        recipientId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: txNow } }
        ]
      };
      const reqUpdate = {
        $set: {
          status: 'accepted',
          respondedAt: new Date(),
          respondedBy: recipientId
        }
      };

      const transRequest = session
        ? await GroupJoinRequest.findOneAndUpdate(reqQuery, reqUpdate, { session, returnDocument: 'after' })
        : await GroupJoinRequest.findOneAndUpdate(reqQuery, reqUpdate, { returnDocument: 'after' });

      if (!transRequest) {
        const err = new Error('Invitation is no longer pending, has expired, or has already been resolved');
        err.statusCode = 400;
        throw err;
      }

      // Step B2: Verify recipient is not already a confirmed member of another active group
      const otherActiveGroup = session
        ? await SharedRideGroup.findOne({
            _id: { $ne: group._id },
            status: { $in: ['open', 'full'] },
            'members.userId': recipientId
          }).session(session)
        : await SharedRideGroup.findOne({
            _id: { $ne: group._id },
            status: { $in: ['open', 'full'] },
            'members.userId': recipientId
          });

      if (otherActiveGroup) {
        const activeErr = new Error('You are already a confirmed member of an active Shared Ride Group. You must leave that group before accepting another invitation.');
        activeErr.statusCode = 409;
        throw activeErr;
      }

      // Step C: Atomically and conditionally add member to group only if members.length < targetCapacity
      const groupQuery = {
        _id: group._id,
        status: 'open',
        expiresAt: { $gt: txNow },
        'members.userId': { $ne: recipientId },
        $expr: { $lt: [{ $size: '$members' }, '$targetCapacity'] }
      };

      const groupUpdate = {
        $push: {
          members: {
            userId: recipientId,
            travelId: travel._id,
            role: 'member',
            joinedAt: new Date()
          }
        }
      };

      const transGroup = session
        ? await SharedRideGroup.findOneAndUpdate(groupQuery, groupUpdate, { session, returnDocument: 'after' })
        : await SharedRideGroup.findOneAndUpdate(groupQuery, groupUpdate, { returnDocument: 'after' });

      if (!transGroup) {
        const err = new Error('Group has already reached its target capacity, is expired, or is no longer open');
        err.statusCode = 400;
        throw err;
      }

      // Step D: If target capacity is reached, transition status to 'full'
      if (Array.isArray(transGroup.members) && transGroup.members.length >= transGroup.targetCapacity) {
        transGroup.status = 'full';
        if (session) {
          await transGroup.save({ session });
        } else {
          await transGroup.save();
        }
      }

      // Step E: Create Outbox notification for group admin
      const recipientStudentQuery = Student.findOne({ clerkId: recipientId });
      const recipientStudent = session ? await recipientStudentQuery.session(session) : await recipientStudentQuery;
      const recipientName = recipientStudent?.name || 'A student';

      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_ACCEPTED,
          recipientId: group.adminId,
          relatedTravelId: travel._id,
          payload: {
            groupId: group._id,
            requestId: joinRequest._id,
            memberId: recipientId,
            memberName: recipientName,
            source: group.source,
            destination: group.destination,
            travelDate: group.travelDate,
            currentMemberCount: transGroup.members.length,
            targetCapacity: transGroup.targetCapacity,
            isFull: transGroup.status === 'full'
          }
        },
        session
      );

      return { updatedGroup: transGroup, updatedRequest: transRequest };
    });

    // Trigger outbox sweep asynchronously
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully. You have joined the group.',
      data: {
        group: updatedGroup,
        invitation: updatedRequest
      }
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }

    console.error('[SharedRideGroup] Error accepting invitation:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept invitation',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/invitations/:requestId/reject
 * @desc    Reject an invitation to join a Shared Ride Group
 * @access  Protected (Intended Recipient only)
 */
export async function rejectGroupInvitation(req, res) {
  try {
    const { requestId, id } = req.params;
    const targetRequestId = requestId || id;
    const recipientId = req.userId;

    if (!recipientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    // 1. Validate request ID format
    if (!targetRequestId || !mongoose.Types.ObjectId.isValid(targetRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation request ID format'
      });
    }

    // 2. Fetch invitation document
    const joinRequest = await GroupJoinRequest.findById(targetRequestId);
    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Invitation request not found'
      });
    }

    // 3. Authorization check: only intended recipient can reject
    if (joinRequest.recipientId !== recipientId) {
      return res.status(403).json({
        success: false,
        message: 'Only the intended recipient can reject this invitation'
      });
    }

    // 4. Verify request type is 'invite'
    if (joinRequest.type !== 'invite') {
      return res.status(400).json({
        success: false,
        message: 'Only invitations can be rejected through this endpoint'
      });
    }

    // 5. Verify status is 'pending' (prevent repeated rejection or changing resolved requests)
    if (joinRequest.status !== 'pending') {
      if (joinRequest.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Invitation has already been rejected'
        });
      }
      if (joinRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot reject an invitation that has already been accepted'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot reject invitation with status "${joinRequest.status}"`
      });
    }

    // 6. Atomically update status to 'rejected'
    const updatedRequest = await GroupJoinRequest.findOneAndUpdate(
      {
        _id: joinRequest._id,
        status: 'pending',
        recipientId
      },
      {
        $set: {
          status: 'rejected',
          respondedAt: new Date(),
          respondedBy: recipientId
        }
      },
      { returnDocument: 'after' }
    );

    if (!updatedRequest) {
      return res.status(400).json({
        success: false,
        message: 'Invitation is no longer pending or has already been resolved'
      });
    }

    // 7. Create outbox notification event for the group admin
    try {
      const group = await SharedRideGroup.findById(joinRequest.groupId);
      const rejectingStudent = await Student.findOne({ clerkId: recipientId }, { name: 1 }).lean();
      const studentName = rejectingStudent?.name || 'A student';

      await createOutboxEvent({
        eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_REJECTED,
        recipientId: joinRequest.senderId || group?.adminId,
        relatedTravelId: joinRequest.requesterTravelId,
        payload: {
          groupId: joinRequest.groupId,
          requestId: joinRequest._id,
          memberId: recipientId,
          memberName: studentName,
          source: group?.source || 'Source',
          destination: group?.destination || 'Destination',
          travelDate: group?.travelDate
        }
      });

      triggerOutboxSweep();
    } catch (notifErr) {
      console.warn('[Outbox] Non-blocking warning during invitation reject notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation rejected successfully',
      data: updatedRequest
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error rejecting invitation:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject invitation',
      error: err.message
    });
  }
}

/**
 * @route   GET /api/groups/:id
 * @desc    Get Shared Ride Group details by ID with strict privacy protections
 * @access  Protected
 */
export async function getSharedRideGroupById(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = req.userId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    // Populate originatingTravelId selecting only non-sensitive route/schedule fields
    const group = await SharedRideGroup.findById(id).populate({
      path: 'originatingTravelId',
      select: 'source destination travelDate departureTime seats status'
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    // Check if the current authenticated viewer is a confirmed member or the admin of this group
    const isMemberOrAdmin = Array.isArray(group.members) && group.members.some((m) => m.userId === currentUserId);

    // Attach public student profiles for members (strictly omitting private phone, email, firebaseUid)
    const memberUserIds = group.members.map((m) => m.userId);
    const students = await Student.find(
      { clerkId: { $in: memberUserIds } },
      { name: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
    ).lean();

    const studentMap = new Map(students.map((s) => [s.clerkId, s]));

    const enrichedMembers = group.members.map((m) => {
      const profile = studentMap.get(m.userId);
      return {
        _id: m._id,
        userId: m.userId,
        travelId: m.travelId,
        role: m.role,
        joinedAt: m.joinedAt,
        student: profile || { name: 'Campus Student', isVerified: false }
      };
    });

    const groupObj = group.toObject({ virtuals: true });
    groupObj.members = enrichedMembers;

    // Privacy Guard:
    // If the viewer is NOT a confirmed group member or admin:
    // 1. Hide the WhatsApp group link
    // 2. Hide private coordination notes
    if (!isMemberOrAdmin) {
      groupObj.whatsappGroupUrl = null;
      groupObj.notes = '';
    }

    return res.status(200).json({
      success: true,
      data: groupObj
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error fetching group by ID:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch shared ride group',
      error: err.message
    });
  }
}

/**
 * @route   GET /api/groups/my
 * @desc    List all Shared Ride Groups the authenticated student is part of
 * @access  Protected
 */
export async function getMyGroups(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    const groups = await SharedRideGroup.find({ 'members.userId': userId })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      data: groups
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error fetching user groups:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your shared ride groups',
      error: err.message
    });
  }
}

/**
 * @route   GET /api/groups/:id/invites
 * @desc    List all invitations for a group (Admin only)
 * @access  Protected (Group Admin only)
 */
export async function getGroupInvites(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    const group = await SharedRideGroup.findById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    if (group.adminId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group admin can view invitations for this group'
      });
    }

    // Return only 'invite' records (never mix invitations with join requests)
    const requests = await GroupJoinRequest.find({ groupId: group._id, type: 'invite' })
      .sort({ createdAt: -1 })
      .populate({
        path: 'requesterTravelId',
        select: 'source destination travelDate departureTime seats status'
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: requests
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error fetching group invites:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch group invitations',
      error: err.message
    });
  }
}

/**
 * @route   GET /api/groups/invitations/received
 * @desc    List all pending group invitations received by the authenticated student
 * @access  Protected
 */
export async function getReceivedInvitations(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    const now = new Date();
    // Query pending invitations sent to this user
    const invitations = await GroupJoinRequest.find({
      recipientId: userId,
      type: 'invite',
      status: 'pending'
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'groupId',
        select: 'source destination travelDate departureTime targetCapacity status members adminId expiresAt'
      })
      .populate({
        path: 'requesterTravelId',
        select: 'source destination travelDate departureTime seats status'
      })
      .lean();

    // Filter out expired groups or invitations
    const validInvitations = invitations.filter((inv) => {
      if (!inv.groupId || inv.groupId.status !== 'open') return false;
      const groupExpiry = inv.groupId.expiresAt;
      if (groupExpiry && new Date(groupExpiry) <= now) return false;
      if (inv.expiresAt && new Date(inv.expiresAt) <= now) return false;
      return true;
    });

    // Attach safe student profile for the group admin (sender)
    const adminIds = [...new Set(validInvitations.map((inv) => inv.senderId || inv.groupId?.adminId).filter(Boolean))];
    const adminStudents = await Student.find(
      { clerkId: { $in: adminIds } },
      { name: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
    ).lean();

    const adminMap = new Map(adminStudents.map((s) => [s.clerkId, s]));

    const enriched = validInvitations.map((inv) => {
      const adminId = inv.senderId || inv.groupId?.adminId;
      const adminProfile = adminMap.get(adminId) || { name: 'Campus Student', isVerified: false };
      const currentMemberCount = Array.isArray(inv.groupId?.members) ? inv.groupId.members.length : 1;
      return {
        ...inv,
        admin: adminProfile,
        confirmedMemberCount: currentMemberCount,
        targetCapacity: inv.groupId?.targetCapacity || 4
      };
    });

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error fetching received invitations:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch received invitations',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/from-match
 * @desc    Create a Shared Ride Group and pending invitation from a compatible FIND match
 * @access  Protected (Firebase Authenticated)
 */
export async function createGroupFromFindMatch(req, res) {
  try {
    const creatorId = req.userId;
    if (!creatorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    const {
      originatingTravelId,
      travelId,
      candidateTravelId,
      inviteeTravelId,
      targetCapacity,
      actualCabCapacity,
      notes,
      whatsappGroupUrl
    } = req.body;

    const myTravelId = originatingTravelId || travelId;
    const peerTravelId = candidateTravelId || inviteeTravelId;

    // 1. Validate IDs format
    if (!myTravelId || !mongoose.Types.ObjectId.isValid(myTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid originating travel ID format'
      });
    }

    if (!peerTravelId || !mongoose.Types.ObjectId.isValid(peerTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid candidate travel ID format'
      });
    }

    if (String(myTravelId) === String(peerTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a shared group with your own travel post'
      });
    }

    // 2. Validate targetCapacity (must be a positive integer >= 1; defaults to 2)
    let parsedTargetCapacity = 2;
    if (targetCapacity !== undefined && targetCapacity !== null) {
      if (
        isNaN(Number(targetCapacity)) ||
        !Number.isInteger(Number(targetCapacity)) ||
        Number(targetCapacity) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: 'targetCapacity must be a positive integer of at least 1'
        });
      }
      parsedTargetCapacity = Number(targetCapacity);
    }

    // 3. Validate optional actualCabCapacity (positive integer or null)
    let parsedCabCapacity = null;
    if (actualCabCapacity !== undefined && actualCabCapacity !== null) {
      if (
        isNaN(Number(actualCabCapacity)) ||
        !Number.isInteger(Number(actualCabCapacity)) ||
        Number(actualCabCapacity) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: 'actualCabCapacity must be a positive integer or null'
        });
      }
      parsedCabCapacity = Number(actualCabCapacity);
    }

    // 4. Validate optional WhatsApp URL format
    if (whatsappGroupUrl && typeof whatsappGroupUrl === 'string') {
      const trimmedUrl = whatsappGroupUrl.trim();
      const isValidWhatsapp = /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[a-zA-Z0-9_\-]+$/i.test(trimmedUrl);
      if (!isValidWhatsapp) {
        return res.status(400).json({
          success: false,
          message: 'Must be a valid WhatsApp invite or chat URL'
        });
      }
    }

    // 5. Fetch both travel posts
    const [originatingTravel, candidateTravel] = await Promise.all([
      Travel.findById(myTravelId),
      Travel.findById(peerTravelId)
    ]);

    if (!originatingTravel) {
      return res.status(404).json({
        success: false,
        message: 'Originating travel post not found'
      });
    }

    if (!candidateTravel) {
      return res.status(404).json({
        success: false,
        message: 'Candidate travel post not found'
      });
    }

    // 6. Ownership check: originatingTravel must belong to creator
    if (originatingTravel.userId !== creatorId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create a shared ride group from your own travel post'
      });
    }

    // 7. Verify both students are different
    if (candidateTravel.userId === creatorId) {
      return res.status(400).json({
        success: false,
        message: 'Both travel posts belong to the same student. Cannot create group proposal with yourself.'
      });
    }

    // 8. Verify post types (both must be FIND / 'request')
    if (originatingTravel.type !== 'request' || candidateTravel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Both travel posts must be FIND (request) posts to form a shared ride group'
      });
    }

    // 9. Verify both posts are active
    if (originatingTravel.status !== 'active' || candidateTravel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create group from inactive travel posts'
      });
    }

    // 10. Verify neither post is expired
    const now = new Date();
    if (originatingTravel.expiresAt <= now || candidateTravel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create group from expired travel posts'
      });
    }

    // 11. Verify compatibility using matching service helper (420 min window, same route, direction, calendar day)
    const areCompatible = await areFindPostsCompatible(originatingTravel, candidateTravel, { skipGroupCheck: true });
    if (!areCompatible) {
      return res.status(400).json({
        success: false,
        message: 'Travel posts are not compatible for a shared ride group (must have same route, direction, calendar date, and departure within 420 minutes)'
      });
    }

    // 12. Canonical proposal key for deduplication
    const proposalKey = [String(originatingTravel._id), String(candidateTravel._id)].sort().join(':');

    // 13. Pre-check: Check if an active group already exists for this proposalKey
    const existingProposalGroup = await SharedRideGroup.findOne({
      proposalKey,
      status: { $in: ['open', 'full'] }
    });

    if (existingProposalGroup) {
      const existingInvite = await GroupJoinRequest.findOne({
        groupId: existingProposalGroup._id,
        type: 'invite',
        status: 'pending'
      });

      return res.status(200).json({
        success: true,
        message: 'A shared ride group already exists for this trip proposal',
        data: {
          group: existingProposalGroup,
          invitation: existingInvite,
          isExisting: true
        }
      });
    }

    // 14. Pre-check: Verify neither student is already confirmed in another active group for their respective travel posts
    const existingActiveMemberGroup = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      $or: [
        { 'members.travelId': originatingTravel._id },
        { 'members.travelId': candidateTravel._id }
      ]
    });

    if (existingActiveMemberGroup) {
      const isOriginating = existingActiveMemberGroup.members.some(
        (m) => String(m.travelId) === String(originatingTravel._id)
      );
      return res.status(400).json({
        success: false,
        message: isOriginating
          ? 'You are already a confirmed member of an active group for this trip'
          : 'The other student is already a confirmed member of an active group for this trip'
      });
    }

    // 15. Create group and invitation atomically inside transaction
    const { group, invitation, isExisting } = await runInTransaction(async (session) => {
      const txNow = new Date();

      // Check proposalKey inside session to prevent simultaneous creation race condition
      const groupCheck = session
        ? await SharedRideGroup.findOne({ proposalKey, status: { $in: ['open', 'full'] } }).session(session)
        : await SharedRideGroup.findOne({ proposalKey, status: { $in: ['open', 'full'] } });

      if (groupCheck) {
        const inviteCheck = session
          ? await GroupJoinRequest.findOne({ groupId: groupCheck._id, type: 'invite', status: 'pending' }).session(session)
          : await GroupJoinRequest.findOne({ groupId: groupCheck._id, type: 'invite', status: 'pending' });

        return { group: groupCheck, invitation: inviteCheck, isExisting: true };
      }

      // Check member travel posts inside session
      const memberGroupCheck = session
        ? await SharedRideGroup.findOne({
            status: { $in: ['open', 'full'] },
            $or: [{ 'members.travelId': originatingTravel._id }, { 'members.travelId': candidateTravel._id }]
          }).session(session)
        : await SharedRideGroup.findOne({
            status: { $in: ['open', 'full'] },
            $or: [{ 'members.travelId': originatingTravel._id }, { 'members.travelId': candidateTravel._id }]
          });

      if (memberGroupCheck) {
        const err = new Error('One of the students is already confirmed in an active group for this travel post');
        err.statusCode = 400;
        throw err;
      }

      const options = session ? { session } : {};

      // Expiration time set to earlier of both travel posts' expiresAt
      const groupExpiresAt = originatingTravel.expiresAt < candidateTravel.expiresAt
        ? originatingTravel.expiresAt
        : candidateTravel.expiresAt;

      const [newGroup] = await SharedRideGroup.create(
        [
          {
            adminId: creatorId,
            originatingTravelId: originatingTravel._id,
            source: originatingTravel.source,
            destination: originatingTravel.destination,
            travelDate: originatingTravel.travelDate,
            departureTime: originatingTravel.departureTime,
            targetCapacity: parsedTargetCapacity,
            actualCabCapacity: parsedCabCapacity,
            notes: typeof notes === 'string' ? notes.trim() : '',
            whatsappGroupUrl: whatsappGroupUrl ? whatsappGroupUrl.trim() : null,
            proposalKey,
            status: 'open',
            expiresAt: groupExpiresAt,
            members: [
              {
                userId: creatorId,
                travelId: originatingTravel._id,
                role: 'admin',
                joinedAt: txNow
              }
            ]
          }
        ],
        options
      );

      // Reconcile any existing expired pending requests for candidate
      await GroupJoinRequest.updateMany(
        {
          groupId: newGroup._id,
          requesterId: candidateTravel.userId,
          status: 'pending',
          expiresAt: { $lte: txNow }
        },
        {
          $set: { status: 'expired' }
        },
        options
      );

      // Create pending invitation for the other student
      const [newInvitation] = await GroupJoinRequest.create(
        [
          {
            groupId: newGroup._id,
            requesterId: candidateTravel.userId,
            requesterTravelId: candidateTravel._id,
            senderId: creatorId,
            recipientId: candidateTravel.userId,
            type: 'invite',
            status: 'pending',
            expiresAt: newGroup.expiresAt,
            message: typeof notes === 'string' && notes ? notes.trim() : 'Invited to join Shared Group from compatible trip match'
          }
        ],
        options
      );

      // Fetch admin student details for friendly notification message
      const adminStudentQuery = Student.findOne({ clerkId: creatorId });
      const adminStudent = session ? await adminStudentQuery.session(session) : await adminStudentQuery;
      const adminName = adminStudent?.name || 'A student';

      // Create Outbox notification event for the invited student
      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_RECEIVED,
          recipientId: candidateTravel.userId,
          relatedTravelId: candidateTravel._id,
          payload: {
            groupId: newGroup._id,
            requestId: newInvitation._id,
            adminId: creatorId,
            adminName,
            fromMatchProposal: true,
            customTitle: 'You have a Shared Group invitation!',
            customMessage: 'A student wants to create a Shared Group with you for your trip. Review and accept the invitation to join.',
            source: newGroup.source,
            destination: newGroup.destination,
            travelDate: newGroup.travelDate,
            departureTime: newGroup.departureTime,
            targetCapacity: newGroup.targetCapacity
          }
        },
        session
      );

      return { group: newGroup, invitation: newInvitation, isExisting: false };
    });

    // Trigger outbox sweep asynchronously
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
    }

    if (isExisting) {
      return res.status(200).json({
        success: true,
        message: 'A shared ride group already exists for this trip proposal',
        data: { group, invitation, isExisting: true }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Shared ride group created and invitation sent successfully',
      data: { group, invitation }
    });
  } catch (err) {
    // If unique key conflict on proposalKey occurred concurrently
    if (err.code === 11000 && ((err.keyPattern && err.keyPattern.proposalKey) || (err.message && err.message.includes('proposalKey')))) {
      try {
        const myTravelId = req.body?.originatingTravelId || req.body?.travelId;
        const peerTravelId = req.body?.candidateTravelId || req.body?.inviteeTravelId;
        const proposalKey = [String(myTravelId), String(peerTravelId)].sort().join(':');
        const winningGroup = await SharedRideGroup.findOne({ proposalKey, status: { $in: ['open', 'full'] } });
        if (winningGroup) {
          const winningInvite = await GroupJoinRequest.findOne({
            groupId: winningGroup._id,
            type: 'invite',
            status: 'pending'
          });
          return res.status(200).json({
            success: true,
            message: 'A shared ride group was concurrently created for this match proposal',
            data: { group: winningGroup, invitation: winningInvite, isExisting: true }
          });
        }
      } catch (recoveryErr) {
        console.error('[SharedRideGroup] Recovery error after duplicate proposal key:', recoveryErr);
      }
    }

    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }

    console.error('[SharedRideGroup] Error creating group from FIND match:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create group from compatible FIND match',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/:groupId/join
 * @desc    Directly joins an open Shared Ride Group without requiring approval
 * @access  Protected
 */
export async function directJoinSharedRideGroup(req, res) {
  try {
    const { groupId, id } = req.params;
    const targetGroupId = groupId || id;
    const studentId = req.userId;
    const { travelId, requesterTravelId } = req.body;
    const rawTravelId = travelId || requesterTravelId;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    if (!targetGroupId || !mongoose.Types.ObjectId.isValid(targetGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    if (!rawTravelId || !mongoose.Types.ObjectId.isValid(rawTravelId)) {
      return res.status(400).json({
        success: false,
        message: 'An active FIND travel post ID (travelId) is required to join a shared group'
      });
    }

    // 1. Fetch group & travel outside session for quick initial validation
    const group = await SharedRideGroup.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    const now = new Date();
    if (group.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: group.status === 'full' ? 'Group is already full' : 'Group is not open for joining'
      });
    }

    if (group.expiresAt && new Date(group.expiresAt) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot join an expired group'
      });
    }

    if (group.adminId === studentId) {
      return res.status(400).json({
        success: false,
        message: 'You are the admin of this group and cannot join it again'
      });
    }

    if (Array.isArray(group.members) && group.members.some((m) => m.userId === studentId)) {
      return res.status(409).json({
        success: false,
        message: 'You are already a confirmed member of this group'
      });
    }

    // Check if student is already a confirmed member of ANY active group
    const existingActiveGroup = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      'members.userId': studentId
    });
    if (existingActiveGroup) {
      return res.status(409).json({
        success: false,
        message: 'You are already a confirmed member of an active Shared Ride Group. You must leave that group before joining another.'
      });
    }

    if (Array.isArray(group.members) && group.members.length >= group.targetCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Group has already reached its target capacity'
      });
    }

    // 2. Fetch and validate candidate travel post
    const travel = await Travel.findById(rawTravelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Candidate travel post not found'
      });
    }

    if (travel.userId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only join with your own travel post'
      });
    }

    if (travel.type !== 'request') {
      return res.status(400).json({
        success: false,
        message: 'Only FIND (request) posts are eligible to join a shared ride group'
      });
    }

    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot join with an inactive travel post'
      });
    }

    if (travel.expiresAt && new Date(travel.expiresAt) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot join with an expired travel post'
      });
    }

    // 2b. Fetch and validate original FIND post referenced by originatingTravelId
    const originalFind = await Travel.findById(group.originatingTravelId);
    if (!originalFind) {
      return res.status(404).json({
        success: false,
        message: 'Original originating FIND post for this group not found'
      });
    }

    if (originalFind.status === 'expired' || (originalFind.expiresAt && new Date(originalFind.expiresAt) <= now)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot join because the original originating FIND post for this group has expired'
      });
    }

    // 3. Validate route and schedule compatibility strictly anchored to the original FIND post
    if (!isSameDirection(originalFind.source, originalFind.destination, travel.source, travel.destination)) {
      return res.status(400).json({
        success: false,
        message: 'Incompatible travel route or direction with original group proposal'
      });
    }

    if (!isSameCalendarDay(originalFind.travelDate, travel.travelDate)) {
      return res.status(400).json({
        success: false,
        message: 'Travel dates must be on the same calendar day (Asia/Kolkata)'
      });
    }

    if (!isDepartureTimeCompatible(originalFind.departureTime, travel.departureTime, 420)) {
      return res.status(400).json({
        success: false,
        message: 'Departure time exceeds the maximum 420-minute tolerance window from original FIND'
      });
    }

    // 4. Fetch joining student profile for safe notification
    const studentProfile = await Student.findOne(
      { clerkId: studentId },
      { name: 1, college: 1, imageUrl: 1, avatarId: 1, _id: 0 }
    ).lean();

    // 5. Execute atomic join inside transaction session
    const updatedGroup = await runInTransaction(async (session) => {
      const q = { _id: targetGroupId };
      const currentGroup = session
        ? await SharedRideGroup.findOne(q).session(session)
        : await SharedRideGroup.findOne(q);

      if (!currentGroup) {
        const notFoundErr = new Error('Shared ride group not found');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      if (currentGroup.status !== 'open') {
        const statusErr = new Error(
          currentGroup.status === 'full' ? 'Group is already full' : 'Group is not open for joining'
        );
        statusErr.statusCode = 400;
        throw statusErr;
      }

      if (currentGroup.expiresAt && new Date(currentGroup.expiresAt) <= new Date()) {
        const expErr = new Error('Cannot join an expired group');
        expErr.statusCode = 400;
        throw expErr;
      }

      if (currentGroup.adminId === studentId) {
        const adminErr = new Error('You are the admin of this group and cannot join it again');
        adminErr.statusCode = 400;
        throw adminErr;
      }

      if (Array.isArray(currentGroup.members) && currentGroup.members.some((m) => m.userId === studentId)) {
        const dupErr = new Error('You are already a confirmed member of this group');
        dupErr.statusCode = 409;
        throw dupErr;
      }

      // Inside transaction: verify student is not already a member of any other active group
      const studentActiveGroupTx = session
        ? await SharedRideGroup.findOne({
            _id: { $ne: targetGroupId },
            status: { $in: ['open', 'full'] },
            'members.userId': studentId
          }).session(session)
        : await SharedRideGroup.findOne({
            _id: { $ne: targetGroupId },
            status: { $in: ['open', 'full'] },
            'members.userId': studentId
          });

      if (studentActiveGroupTx) {
        const activeGrpErr = new Error('You are already a confirmed member of an active Shared Ride Group. You must leave that group before joining another.');
        activeGrpErr.statusCode = 409;
        throw activeGrpErr;
      }

      // Inside transaction: verify original originating FIND post is still valid and unexpired
      const txOriginalFind = session
        ? await Travel.findById(currentGroup.originatingTravelId).session(session)
        : await Travel.findById(currentGroup.originatingTravelId);

      if (!txOriginalFind || txOriginalFind.status === 'expired' || (txOriginalFind.expiresAt && new Date(txOriginalFind.expiresAt) <= new Date())) {
        const origExpErr = new Error('Cannot join because the original originating FIND post for this group has expired');
        origExpErr.statusCode = 400;
        throw origExpErr;
      }

      const currentCount = Array.isArray(currentGroup.members) ? currentGroup.members.length : 0;
      if (currentCount >= currentGroup.targetCapacity) {
        const fullErr = new Error('Group has already reached its target capacity');
        fullErr.statusCode = 400;
        throw fullErr;
      }

      // Add student to members
      currentGroup.members.push({
        userId: studentId,
        travelId: travel._id,
        role: 'member',
        joinedAt: new Date()
      });

      // If capacity reached, transition status to 'full'
      if (currentGroup.members.length >= currentGroup.targetCapacity) {
        currentGroup.status = 'full';
      }

      await currentGroup.save(session ? { session } : {});

      // Notify group admin of direct member arrival
      try {
        await createOutboxEvent({
          eventType: NOTIFICATION_JOB_TYPES.GROUP_MEMBER_JOINED,
          recipientId: currentGroup.adminId,
          relatedTravelId: currentGroup.originatingTravelId,
          payload: {
            groupId: currentGroup._id,
            source: currentGroup.source,
            destination: currentGroup.destination,
            travelDate: currentGroup.travelDate,
            departureTime: currentGroup.departureTime,
            memberName: studentProfile?.name || 'A fellow student',
            targetCapacity: currentGroup.targetCapacity,
            currentMembers: currentGroup.members.length,
            route: `/groups/${currentGroup._id}`,
            navigationUrl: `/groups/${currentGroup._id}`
          }
        }, session);
      } catch (evtErr) {
        console.warn('[DirectJoin] Outbox notification event creation warning:', evtErr.message);
      }

      return currentGroup;
    });

    try {
      triggerOutboxSweep();
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Successfully joined shared ride group',
      data: updatedGroup
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }
    console.error('[SharedRideGroup] Error joining group directly:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to join shared ride group',
      error: err.message
    });
  }
}

/**
 * @route   POST /api/groups/:groupId/leave
 * @desc    Leave a Shared Ride Group dynamically without affecting the FIND post
 * @access  Protected
 */
export async function leaveSharedRideGroup(req, res) {
  try {
    const { groupId, id } = req.params;
    const targetGroupId = groupId || id;
    const studentId = req.userId;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    if (!targetGroupId || !mongoose.Types.ObjectId.isValid(targetGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    // 1. Initial check
    const group = await SharedRideGroup.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    const isMember = Array.isArray(group.members) && group.members.some((m) => m.userId === studentId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a confirmed member of this shared ride group'
      });
    }

    const leavingStudent = await Student.findOne(
      { clerkId: studentId },
      { name: 1, college: 1, _id: 0 }
    ).lean();

    // 2. Perform leave and admin transfer inside transaction
    const updatedGroup = await runInTransaction(async (session) => {
      const q = { _id: targetGroupId };
      const currentGroup = session
        ? await SharedRideGroup.findOne(q).session(session)
        : await SharedRideGroup.findOne(q);

      if (!currentGroup) {
        const notFoundErr = new Error('Shared ride group not found');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const memberIdx = currentGroup.members.findIndex((m) => m.userId === studentId);
      if (memberIdx === -1) {
        const notMemberErr = new Error('You are not a confirmed member of this shared ride group');
        notMemberErr.statusCode = 403;
        throw notMemberErr;
      }

      const wasAdmin = currentGroup.adminId === studentId;

      // Remove the member
      currentGroup.members.splice(memberIdx, 1);

      const remainingMembersCount = currentGroup.members.length;

      if (wasAdmin) {
        if (remainingMembersCount > 0) {
          // Promote earliest joined member to admin
          currentGroup.members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
          const newAdmin = currentGroup.members[0];
          newAdmin.role = 'admin';
          currentGroup.adminId = newAdmin.userId;

          // Reopen if group was full
          const now = new Date();
          if (currentGroup.members.length < currentGroup.targetCapacity && new Date(currentGroup.expiresAt) > now) {
            currentGroup.status = 'open';
          }

          // Notify promoted admin
          try {
            await createOutboxEvent({
              eventType: NOTIFICATION_JOB_TYPES.GROUP_ADMIN_PROMOTED,
              recipientId: newAdmin.userId,
              relatedTravelId: currentGroup.originatingTravelId,
              payload: {
                groupId: currentGroup._id,
                source: currentGroup.source,
                destination: currentGroup.destination,
                travelDate: currentGroup.travelDate,
                route: `/groups/${currentGroup._id}`,
                navigationUrl: `/groups/${currentGroup._id}`
              }
            }, session);
          } catch (promoteEvtErr) {
            console.warn('[LeaveGroup] Promoted admin event warning:', promoteEvtErr.message);
          }
        } else {
          // No members left: close group
          currentGroup.status = 'cancelled';
        }
      } else {
        // Non-admin member left
        const now = new Date();
        if (remainingMembersCount > 0) {
          // If group was full, reopen it
          if (currentGroup.members.length < currentGroup.targetCapacity && new Date(currentGroup.expiresAt) > now) {
            currentGroup.status = 'open';
          }

          // Notify group admin that a member left
          try {
            await createOutboxEvent({
              eventType: NOTIFICATION_JOB_TYPES.GROUP_MEMBER_LEFT,
              recipientId: currentGroup.adminId,
              relatedTravelId: currentGroup.originatingTravelId,
              payload: {
                groupId: currentGroup._id,
                source: currentGroup.source,
                destination: currentGroup.destination,
                travelDate: currentGroup.travelDate,
                memberName: leavingStudent?.name || 'A student',
                route: `/groups/${currentGroup._id}`,
                navigationUrl: `/groups/${currentGroup._id}`
              }
            }, session);
          } catch (leftEvtErr) {
            console.warn('[LeaveGroup] Member left event warning:', leftEvtErr.message);
          }
        } else {
          // No members left
          currentGroup.status = 'cancelled';
        }
      }

      await currentGroup.save(session ? { session } : {});
      return currentGroup;
    });

    try {
      triggerOutboxSweep();
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'You have left the group. You can still find normal ride offers.',
      data: updatedGroup
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }
    console.error('[SharedRideGroup] Error leaving group:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to leave shared ride group',
      error: err.message
    });
  }
}
