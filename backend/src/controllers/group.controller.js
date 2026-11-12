import mongoose from 'mongoose';
import SharedRideGroup from '../models/SharedRideGroup.js';
import GroupJoinRequest from '../models/GroupJoinRequest.js';
import Travel from '../models/Travel.js';
import Student from '../models/Student.js';
import { createOutboxEvent, triggerOutboxSweep } from '../services/outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';
import { isSameDirection, isSameCalendarDay, isDepartureTimeCompatible, areFindPostsCompatible, findCompatibleGroupsForFindPost, buildPairUserKey, buildGroupDisplayName } from '../services/matching.service.js';
import { getCandidateUserIds, isSameUserId, resolveStudentProfilesMap, getStudentFromMap, resolveSingleStudent, formatSafePublicStudent } from '../utils/studentProfileResolver.js';

function isConfirmedGroupMember(group, userId) {
  if (!group || !userId || !Array.isArray(group.members)) return false;
  return group.members.some((m) => isSameUserId(m.userId, userId));
}

function isGroupAdmin(group, userId) {
  if (!group || !userId) return false;
  if (isSameUserId(group.adminId, userId)) return true;
  return Array.isArray(group.members) && group.members.some((m) => isSameUserId(m.userId, userId) && m.role === 'admin');
}

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

const ONE_ACTIVE_GROUP_MESSAGE =
  'You are already a member of another active group. Leave your current group before joining or creating another group.';

function isMemberUniqueConflict(err) {
  return (
    err?.code === 11000 &&
    Boolean(
      (err.keyPattern && err.keyPattern['members.userId']) ||
      err.message?.includes('members.userId')
    )
  );
}

/**
 * Finds any currently active ('open' or 'full', non-empty, unexpired) group where userId is a member.
 * Lazily reconciles empty (0 members) -> 'empty' and expired -> 'expired' groups so stale records do not block users.
 */
async function findActiveGroupForStudent(userId, { excludeGroupId = null, session = null } = {}) {
  if (!userId) return null;
  const now = new Date();
  const variants = getCandidateUserIds(userId);
  const query = {
    status: { $in: ['open', 'full'] },
    'members.userId': { $in: variants.length > 0 ? variants : [userId] }
  };
  if (excludeGroupId) {
    query._id = { $ne: excludeGroupId };
  }

  const candidates = await (session
    ? SharedRideGroup.find(query).session(session)
    : SharedRideGroup.find(query));

  for (const g of candidates) {
    if (!Array.isArray(g.members) || g.members.length === 0) {
      g.status = 'empty';
      await g.save(session ? { session } : {});
      continue;
    }
    if (g.expiresAt && new Date(g.expiresAt) <= now) {
      g.status = 'expired';
      await g.save(session ? { session } : {});
      continue;
    }
    return g;
  }

  return null;
}

/**
 * Cancels all pending join requests/invites for a group (e.g., when it becomes empty).
 */
async function cancelPendingRequestsForGroup(groupId, session = null) {
  if (!groupId) return;
  await GroupJoinRequest.updateMany(
    { groupId, status: 'pending' },
    { $set: { status: 'cancelled' } },
    session ? { session } : {}
  );
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
      groupSize,
      actualCabCapacity,
      notes,
      whatsappGroupUrl
    } = req.body;

    const rawTargetCapacity = targetCapacity ?? groupSize;
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

    // 1. Validate targetCapacity / groupSize (must be integer between 2 and 6)
    if (
      rawTargetCapacity === undefined ||
      rawTargetCapacity === null ||
      isNaN(Number(rawTargetCapacity)) ||
      !Number.isInteger(Number(rawTargetCapacity)) ||
      Number(rawTargetCapacity) < 2 ||
      Number(rawTargetCapacity) > 6
    ) {
      return res.status(400).json({
        success: false,
        message: 'Group size (targetCapacity) is required and must be an integer between 2 and 6'
      });
    }
    const parsedTargetCapacity = Number(rawTargetCapacity);

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

    // 10a. Enforce One Active Group Per Student rule
    const existingStudentActiveGroup = await findActiveGroupForStudent(adminId);
    if (existingStudentActiveGroup) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE,
        data: { existingGroupId: existingStudentActiveGroup._id }
      });
    }

    // 10b. Check if an active group already exists for this FIND post
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
      // Re-verify one-active-group-per-student inside session
      const txStudentGroup = await findActiveGroupForStudent(adminId, { session });
      if (txStudentGroup) {
        const activeErr = new Error(ONE_ACTIVE_GROUP_MESSAGE);
        activeErr.statusCode = 409;
        activeErr.existingGroupId = txStudentGroup._id;
        throw activeErr;
      }

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
    if (isMemberUniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE
      });
    }
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: err.message || 'An active shared ride group already exists for this FIND post',
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

    // 5. Check group non-empty & available capacity
    const currentMemberCount = Array.isArray(group.members) ? group.members.length : 0;
    if (currentMemberCount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot join an empty group'
      });
    }
    if (currentMemberCount >= group.targetCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Group has already reached its target capacity'
      });
    }

    // 6. Prevent group admin, existing members, or students in another active group
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

    const existingStudentActiveGroup = await findActiveGroupForStudent(requesterId, { excludeGroupId: group._id });
    if (existingStudentActiveGroup) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE,
        data: { existingGroupId: existingStudentActiveGroup._id }
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

      const txActiveGroup = await findActiveGroupForStudent(requesterId, { excludeGroupId: group._id, session });
      if (txActiveGroup) {
        const activeErr = new Error(ONE_ACTIVE_GROUP_MESSAGE);
        activeErr.statusCode = 409;
        activeErr.existingGroupId = txActiveGroup._id;
        throw activeErr;
      }

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
      const requesterStudent = await resolveSingleStudent(requesterId, { session });
      const requesterName = requesterStudent?.name || 'A student';

      // Notify ALL confirmed group members so any member can review and approve (BUG 7)
      const memberRecipients = [];
      const seenMemberIds = new Set();
      for (const m of group.members || []) {
        if (m?.userId && !isSameUserId(m.userId, requesterId) && !seenMemberIds.has(m.userId)) {
          seenMemberIds.add(m.userId);
          memberRecipients.push(m.userId);
        }
      }
      if (memberRecipients.length === 0 && group.adminId) {
        memberRecipients.push(group.adminId);
      }

      for (const memberRecipientId of memberRecipients) {
        await createOutboxEvent(
          {
            eventId: `join_req_${newRequest._id}_${memberRecipientId}`,
            eventType: NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_RECEIVED,
            recipientId: memberRecipientId,
            relatedTravelId: travel._id,
            payload: {
              groupId: group._id,
              requestId: newRequest._id,
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
      }

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
        message: err.statusCode === 409 && err.message ? err.message : 'A pending join request or invitation already exists for this group',
        data: err.existingGroupId
          ? { existingGroupId: err.existingGroupId }
          : (err.existingRequestId ? { existingRequestId: err.existingRequestId } : undefined)
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
    const actorId = req.userId;

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

    // BUG 7: Any confirmed active member of the group can view join requests
    if (!isConfirmedGroupMember(group, actorId) && !isGroupAdmin(group, actorId)) {
      return res.status(403).json({
        success: false,
        message: 'Only confirmed members of this group can view join requests'
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

    // Attach resolved safe student profiles across clerkId & firebaseUid variants (BUG 2)
    const requesterIds = requests.map((r) => r.requesterId).filter(Boolean);
    const studentMap = await resolveStudentProfilesMap(requesterIds, { includeContact: false });

    const enrichedRequests = requests.map((r) => {
      const profile = formatSafePublicStudent(getStudentFromMap(studentMap, r.requesterId), {
        fallbackName: 'Student'
      });
      return {
        ...r,
        requesterName: profile.name,
        requester: profile
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
    const actorId = req.userId;

    if (!actorId) {
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

    // 2. Verify request type is 'join_request'
    if (joinRequest.type !== 'join_request') {
      return res.status(400).json({
        success: false,
        message: 'Only join requests can be accepted through this endpoint'
      });
    }

    // 3. Fetch target group and verify authorization (BUG 7: ANY confirmed group member can accept)
    const group = await SharedRideGroup.findById(joinRequest.groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    if (!isConfirmedGroupMember(group, actorId) && !isGroupAdmin(group, actorId) && !isSameUserId(joinRequest.recipientId, actorId)) {
      return res.status(403).json({
        success: false,
        message: 'Only confirmed members of this group can accept join requests'
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

    // 5. Verify group is 'open' and not expired
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

    // 6. Prevent duplicate membership & enforce One Active Group Per Student
    const isAlreadyMember = Array.isArray(group.members) && group.members.some((m) => isSameUserId(m.userId, joinRequest.requesterId));
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'Student is already a member of this group'
      });
    }

    const requesterOtherActiveGroup = await findActiveGroupForStudent(joinRequest.requesterId, { excludeGroupId: group._id });
    if (requesterOtherActiveGroup) {
      return res.status(409).json({
        success: false,
        message: 'This student is already a member of another active group and cannot join a second group.'
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

      if (!isConfirmedGroupMember(liveGroup, actorId) && !isGroupAdmin(liveGroup, actorId) && !isSameUserId(joinRequest.recipientId, actorId)) {
        const err = new Error('Only confirmed members of this group can accept join requests');
        err.statusCode = 403;
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
        status: 'pending'
      };
      const reqUpdate = {
        $set: {
          status: 'accepted',
          respondedAt: new Date(),
          respondedBy: actorId
        }
      };

      const transRequest = session
        ? await GroupJoinRequest.findOneAndUpdate(reqQuery, reqUpdate, { session, returnDocument: 'after' })
        : await GroupJoinRequest.findOneAndUpdate(reqQuery, reqUpdate, { returnDocument: 'after' });

      if (!transRequest) {
        const err = new Error('Join request is no longer pending or has already been resolved');
        err.statusCode = 409;
        throw err;
      }

      // Step A2: Verify requester is not already a confirmed member of another active group
      const txOtherActiveGroup = await findActiveGroupForStudent(joinRequest.requesterId, { excludeGroupId: group._id, session });
      if (txOtherActiveGroup) {
        const activeErr = new Error('This student is already a member of another active group and cannot join a second group.');
        activeErr.statusCode = 409;
        throw activeErr;
      }

      // Step B: Atomically and conditionally add member to group only if members.length < targetCapacity
      const requesterVariants = getCandidateUserIds(joinRequest.requesterId);
      const groupQuery = {
        _id: group._id,
        status: 'open',
        expiresAt: { $gt: txNow },
        'members.userId': { $nin: requesterVariants.length > 0 ? requesterVariants : [joinRequest.requesterId] },
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
      const approverStudent = await resolveSingleStudent(actorId, { session });
      const approverName = approverStudent?.name || 'A group member';

      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_ACCEPTED,
          recipientId: joinRequest.requesterId,
          relatedTravelId: travel._id,
          payload: {
            groupId: group._id,
            requestId: joinRequest._id,
            adminName: approverName,
            approvedByName: approverName,
            source: group.source,
            destination: group.destination,
            travelDate: group.travelDate,
            currentMemberCount: transGroup.members.length,
            targetCapacity: transGroup.targetCapacity,
            availableSpots: Math.max(0, transGroup.targetCapacity - transGroup.members.length),
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
    if (isMemberUniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: 'This student is already a member of another active group and cannot join a second group.'
      });
    }
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
    const actorId = req.userId;

    if (!actorId) {
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

    // 2. Verify request type is 'join_request'
    if (joinRequest.type !== 'join_request') {
      return res.status(400).json({
        success: false,
        message: 'Only join requests can be rejected through this endpoint'
      });
    }

    // 3. Fetch group & check authorization: ANY confirmed group member can reject (BUG 7)
    const group = await SharedRideGroup.findById(joinRequest.groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    if (!isConfirmedGroupMember(group, actorId) && !isGroupAdmin(group, actorId) && !isSameUserId(joinRequest.recipientId, actorId)) {
      return res.status(403).json({
        success: false,
        message: 'Only confirmed members of this group can reject join requests'
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

    // 5. Atomically update status to 'rejected'
    const updatedRequest = await GroupJoinRequest.findOneAndUpdate(
      {
        _id: joinRequest._id,
        status: 'pending'
      },
      {
        $set: {
          status: 'rejected',
          respondedAt: new Date(),
          respondedBy: actorId
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

    // 15. Check if candidate is already a member of this group or another active group
    const isAlreadyMember = group.members.some((m) => m.userId === candidateTravel.userId);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'Student is already a member of this group'
      });
    }

    const candidateOtherActiveGroup = await findActiveGroupForStudent(candidateTravel.userId, { excludeGroupId: group._id });
    if (candidateOtherActiveGroup) {
      return res.status(409).json({
        success: false,
        message: 'This student is already a member of another active group and cannot be invited.'
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

    // 2. Fetch invitation / proposal document
    const joinRequest = await GroupJoinRequest.findById(targetRequestId);
    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: 'Invitation or formation request not found'
      });
    }

    // 3. Authorization check: only intended recipient can accept
    if (!isSameUserId(joinRequest.recipientId, recipientId) && !isSameUserId(joinRequest.requesterId, recipientId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the intended recipient can accept this request'
      });
    }
    if (isSameUserId(joinRequest.senderId, recipientId)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot accept a request that you sent yourself'
      });
    }

    // 4. Verify request type is 'invite' or 'formation_proposal'
    if (joinRequest.type !== 'invite' && joinRequest.type !== 'formation_proposal') {
      return res.status(400).json({
        success: false,
        message: 'Only invitations or group formation proposals can be accepted through this endpoint'
      });
    }

    // 5. Verify status is 'pending'
    if (joinRequest.status !== 'pending') {
      if (joinRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Request has already been accepted'
        });
      }
      if (joinRequest.status === 'rejected' || joinRequest.status === 'declined') {
        return res.status(400).json({
          success: false,
          message: 'Cannot accept a declined request'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot accept request with status "${joinRequest.status}"`
      });
    }

    // 5b. Verify invitation / proposal has not expired
    const now = new Date();
    if (joinRequest.expiresAt && new Date(joinRequest.expiresAt) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept an expired request'
      });
    }

    // ------------------------------------------------------------------
    // BRANCH A: PRE-GROUP FORMATION PROPOSAL ACCEPTANCE (BUG 3 & BUG 4)
    // Atomically creates ONE SharedRideGroup with [sender (admin), recipient (member)]
    // ------------------------------------------------------------------
    if (joinRequest.type === 'formation_proposal') {
      const senderId = joinRequest.senderId;

      const [recipientActiveGroup, senderActiveGroup] = await Promise.all([
        findActiveGroupForStudent(recipientId),
        findActiveGroupForStudent(senderId)
      ]);
      if (recipientActiveGroup) {
        return res.status(409).json({
          success: false,
          message: ONE_ACTIVE_GROUP_MESSAGE,
          data: { existingGroupId: recipientActiveGroup._id }
        });
      }
      if (senderActiveGroup) {
        return res.status(409).json({
          success: false,
          message: 'The requesting student has already joined another active group.',
          data: { existingGroupId: senderActiveGroup._id }
        });
      }

      const [senderTravel, recipientTravel] = await Promise.all([
        Travel.findById(joinRequest.senderTravelId),
        Travel.findById(joinRequest.requesterTravelId)
      ]);
      if (!senderTravel || !recipientTravel) {
        return res.status(404).json({
          success: false,
          message: 'One of the matching ride posts for this proposal is no longer available'
        });
      }
      if (senderTravel.type !== 'request' || recipientTravel.type !== 'request') {
        return res.status(400).json({
          success: false,
          message: 'Only FIND (request) posts can form a shared ride group'
        });
      }
      if (senderTravel.status !== 'active' || recipientTravel.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Cannot form a group because one of the travel posts is no longer active'
        });
      }
      if (senderTravel.expiresAt <= now || recipientTravel.expiresAt <= now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot form a group because one of the travel posts has expired'
        });
      }

      const stillCompatible = await areFindPostsCompatible(senderTravel, recipientTravel, { skipGroupCheck: true });
      if (!stillCompatible) {
        return res.status(400).json({
          success: false,
          message: 'Travel details are no longer compatible to form this group'
        });
      }

      const finalCapacity = Math.min(6, Math.max(2, Number(joinRequest.proposedCapacity) || 4));
      const proposalKey = joinRequest.proposalKey || [String(senderTravel._id), String(recipientTravel._id)].sort().join(':');
      const groupExpiresAt = senderTravel.expiresAt < recipientTravel.expiresAt
        ? senderTravel.expiresAt
        : recipientTravel.expiresAt;

      const { createdGroup, updatedRequest } = await runInTransaction(async (session) => {
        const txNow = new Date();
        const txOpts = session ? { session } : {};

        // Step 1: Atomically lock and transition pending proposal to accepted
        const transReq = await GroupJoinRequest.findOneAndUpdate(
          {
            _id: joinRequest._id,
            type: 'formation_proposal',
            status: 'pending',
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: txNow } }
            ]
          },
          {
            $set: {
              status: 'accepted',
              respondedAt: txNow,
              respondedBy: recipientId
            }
          },
          { ...txOpts, returnDocument: 'after' }
        );

        if (!transReq) {
          const conflictErr = new Error('Group formation request is no longer pending or has already been processed');
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        // Step 2: Re-verify One Active Group Per Student inside tx
        const [txSenderGrp, txRecipientGrp, existingProposalGrp] = await Promise.all([
          findActiveGroupForStudent(senderId, { session }),
          findActiveGroupForStudent(recipientId, { session }),
          SharedRideGroup.findOne({ proposalKey, status: { $in: ['open', 'full'] } }).session(session)
        ]);

        if (existingProposalGrp) {
          const dupErr = new Error('A group has already been created for this match proposal');
          dupErr.statusCode = 409;
          dupErr.existingGroupId = existingProposalGrp._id;
          throw dupErr;
        }
        if (txSenderGrp) {
          const err = new Error('The requesting student is already in another active group.');
          err.statusCode = 409;
          throw err;
        }
        if (txRecipientGrp) {
          const err = new Error(ONE_ACTIVE_GROUP_MESSAGE);
          err.statusCode = 409;
          throw err;
        }

        // Step 3: Create EXACTLY ONE SharedRideGroup with both A and B as confirmed members
        const [newGroup] = await SharedRideGroup.create(
          [
            {
              adminId: senderId,
              originatingTravelId: senderTravel._id,
              source: senderTravel.source,
              destination: senderTravel.destination,
              travelDate: senderTravel.travelDate,
              departureTime: senderTravel.departureTime,
              targetCapacity: finalCapacity,
              status: finalCapacity <= 2 ? 'full' : 'open',
              expiresAt: groupExpiresAt,
              proposalKey,
              notes: joinRequest.message || '',
              members: [
                {
                  userId: senderId,
                  travelId: senderTravel._id,
                  role: 'admin',
                  joinedAt: txNow
                },
                {
                  userId: joinRequest.requesterId,
                  travelId: recipientTravel._id,
                  role: 'member',
                  joinedAt: txNow
                }
              ]
            }
          ],
          txOpts
        );

        // Link created group back onto the accepted proposal
        transReq.groupId = newGroup._id;
        await transReq.save(txOpts);

        // Step 4: Cancel any other pending proposals or invites for A or B so no stale proposals remain
        const pairUserVariants = Array.from(new Set([
          ...getCandidateUserIds(senderId),
          ...getCandidateUserIds(recipientId),
          ...getCandidateUserIds(joinRequest.requesterId)
        ]));
        await GroupJoinRequest.updateMany(
          {
            _id: { $ne: transReq._id },
            type: { $in: ['formation_proposal', 'invite'] },
            status: 'pending',
            $or: [
              { senderId: { $in: pairUserVariants } },
              { requesterId: { $in: pairUserVariants } },
              { recipientId: { $in: pairUserVariants } }
            ]
          },
          { $set: { status: 'cancelled' } },
          txOpts
        );

        // Step 5: Notify A that B accepted and the group is live
        const recipientStudent = await resolveSingleStudent(recipientId, { session });
        const recipientName = recipientStudent?.name || 'Student';
        const avail = Math.max(0, newGroup.targetCapacity - newGroup.members.length);

        await createOutboxEvent(
          {
            eventId: `proposal_accepted_${transReq._id}_${senderId}`,
            eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_ACCEPTED,
            recipientId: senderId,
            relatedTravelId: senderTravel._id,
            payload: {
              groupId: newGroup._id,
              requestId: transReq._id,
              isFormationProposal: true,
              memberName: recipientName,
              source: newGroup.source,
              destination: newGroup.destination,
              travelDate: newGroup.travelDate,
              currentMemberCount: newGroup.members.length,
              targetCapacity: newGroup.targetCapacity,
              availableSpots: avail,
              isFull: newGroup.status === 'full'
            }
          },
          session
        );

        return { createdGroup: newGroup, updatedRequest: transReq };
      });

      try {
        triggerOutboxSweep();
      } catch (sweepErr) {
        console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
      }

      const groupObj = createdGroup.toObject({ virtuals: true });
      const confirmedCount = Array.isArray(groupObj.members) ? groupObj.members.length : 2;
      const availableSpots = Math.max(0, (groupObj.targetCapacity || finalCapacity) - confirmedCount);

      return res.status(200).json({
        success: true,
        message: 'Group formation accepted! Shared ride group created with both members.',
        data: {
          group: {
            ...groupObj,
            confirmedMemberCount: confirmedCount,
            availableSpots,
            availableSeats: availableSpots
          },
          invitation: updatedRequest,
          proposal: updatedRequest,
          relationshipState: 'ACCEPTED'
        }
      });
    }

    // ------------------------------------------------------------------
    // BRANCH B: EXISTING GROUP INVITATION ACCEPTANCE
    // ------------------------------------------------------------------
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

    // 8. Prevent duplicate group membership & enforce One Active Group Per Student
    const isAlreadyMember = Array.isArray(group.members) && group.members.some((m) => isSameUserId(m.userId, recipientId));
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    }

    const recipientOtherActiveGroup = await findActiveGroupForStudent(recipientId, { excludeGroupId: group._id });
    if (recipientOtherActiveGroup) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE,
        data: { existingGroupId: recipientOtherActiveGroup._id }
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

    if (!isSameUserId(travel.userId, recipientId)) {
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
      const otherActiveGroup = await findActiveGroupForStudent(recipientId, { excludeGroupId: group._id, session });

      if (otherActiveGroup) {
        const activeErr = new Error(ONE_ACTIVE_GROUP_MESSAGE);
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
      const recipientStudent = await resolveSingleStudent(recipientId, { session });
      const recipientName = recipientStudent?.name || 'Student';

      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_ACCEPTED,
          recipientId: group.adminId,
          relatedTravelId: travel._id,
          payload: {
            groupId: group._id,
            requestId: joinRequest._id,
            memberName: recipientName,
            source: group.source,
            destination: group.destination,
            travelDate: group.travelDate,
            currentMemberCount: transGroup.members.length,
            targetCapacity: transGroup.targetCapacity,
            availableSpots: Math.max(0, transGroup.targetCapacity - transGroup.members.length),
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

    const groupObj = updatedGroup.toObject ? updatedGroup.toObject({ virtuals: true }) : updatedGroup;
    const confirmedCount = Array.isArray(groupObj.members) ? groupObj.members.length : 1;
    const avail = Math.max(0, (groupObj.targetCapacity || 0) - confirmedCount);

    return res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully. You have joined the group.',
      data: {
        group: {
          ...groupObj,
          confirmedMemberCount: confirmedCount,
          availableSpots: avail,
          availableSeats: avail
        },
        invitation: updatedRequest,
        relationshipState: 'ACCEPTED'
      }
    });
  } catch (err) {
    if (isMemberUniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE
      });
    }
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
    if (!isSameUserId(joinRequest.recipientId, recipientId) && !isSameUserId(joinRequest.requesterId, recipientId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the intended recipient can reject this request'
      });
    }

    // 4. Verify request type is 'invite' or 'formation_proposal'
    if (joinRequest.type !== 'invite' && joinRequest.type !== 'formation_proposal') {
      return res.status(400).json({
        success: false,
        message: 'Only invitations or formation proposals can be rejected through this endpoint'
      });
    }

    // 5. Verify status is 'pending' (prevent repeated rejection or changing resolved requests)
    if (joinRequest.status !== 'pending') {
      if (joinRequest.status === 'rejected' || joinRequest.status === 'declined') {
        return res.status(400).json({
          success: false,
          message: 'Request has already been rejected'
        });
      }
      if (joinRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot reject a request that has already been accepted'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status "${joinRequest.status}"`
      });
    }

    // 6. Atomically update status to 'rejected'
    const updatedRequest = await GroupJoinRequest.findOneAndUpdate(
      {
        _id: joinRequest._id,
        status: 'pending'
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
        message: 'Request is no longer pending or has already been resolved'
      });
    }

    // 7. Create outbox notification event for the sender / group admin
    try {
      const [group, senderTravel, rejectingStudent] = await Promise.all([
        joinRequest.groupId ? SharedRideGroup.findById(joinRequest.groupId) : Promise.resolve(null),
        joinRequest.senderTravelId ? Travel.findById(joinRequest.senderTravelId).lean() : Promise.resolve(null),
        resolveSingleStudent(recipientId, { lean: true })
      ]);
      const studentName = rejectingStudent?.name || 'Student';

      await createOutboxEvent({
        eventId: `proposal_rejected_${joinRequest._id}_${joinRequest.senderId || group?.adminId || 'sender'}`,
        eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_REJECTED,
        recipientId: joinRequest.senderId || group?.adminId,
        relatedTravelId: joinRequest.senderTravelId || joinRequest.requesterTravelId,
        payload: {
          groupId: joinRequest.groupId || null,
          requestId: joinRequest._id,
          isFormationProposal: joinRequest.type === 'formation_proposal',
          memberName: studentName,
          source: group?.source || senderTravel?.source || 'Source',
          destination: group?.destination || senderTravel?.destination || 'Destination',
          travelDate: group?.travelDate || senderTravel?.travelDate
        }
      });

      triggerOutboxSweep();
    } catch (notifErr) {
      console.warn('[Outbox] Non-blocking warning during invitation reject notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: joinRequest.type === 'formation_proposal' ? 'Group formation request declined' : 'Invitation rejected successfully',
      data: updatedRequest,
      relationshipState: 'DECLINED'
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
 * @route   POST /api/groups/invitations/:requestId/withdraw
 * @desc    Withdraw a sent invitation or formation proposal (sender only)
 * @access  Protected (Sender only)
 */
export async function withdrawInvitation(req, res) {
  try {
    const userId = req.userId;
    const { requestId, id } = req.params;
    const finalRequestId = requestId || id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    if (!finalRequestId || !mongoose.Types.ObjectId.isValid(finalRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID'
      });
    }

    // Find the invitation/proposal
    const invitation = await GroupJoinRequest.findById(finalRequestId);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Verify the authenticated user is the sender
    const userVariants = getCandidateUserIds(userId);
    const senderMatches = userVariants.some((variant) =>
      variant.toString() === invitation.senderId?.toString()
    );

    if (!senderMatches) {
      return res.status(403).json({
        success: false,
        message: 'You can only withdraw invitations you sent'
      });
    }

    // Only pending invitations can be withdrawn
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw invitation with status: ${invitation.status}`
      });
    }

    // Update status to 'cancelled' (withdrawn by sender)
    invitation.status = 'cancelled';
    invitation.updatedAt = new Date();
    await invitation.save();

    return res.status(200).json({
      success: true,
      message: 'Invitation withdrawn successfully',
      data: {
        requestId: invitation._id,
        status: 'cancelled'
      }
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error withdrawing invitation:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to withdraw invitation',
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
    const isMemberOrAdmin = isConfirmedGroupMember(group, currentUserId) || isGroupAdmin(group, currentUserId);
    const viewerIsAdmin = isGroupAdmin(group, currentUserId);

    // Attach resolved public student profiles across clerkId & firebaseUid variants (BUG 2)
    // Include contact info (phone/whatsapp) for confirmed members only
    const memberUserIds = [...new Set([...group.members.map((m) => m.userId), group.adminId].filter(Boolean))];
    const studentMap = await resolveStudentProfilesMap(memberUserIds, { includeContact: isMemberOrAdmin });

    const enrichedMembers = group.members.map((m) => {
      const safeProfile = formatSafePublicStudent(getStudentFromMap(studentMap, m.userId), {
        fallbackName: 'Student',
        includeContact: isMemberOrAdmin
      });
      return {
        _id: m._id,
        userId: m.userId,
        travelId: m.travelId,
        role: m.role,
        joinedAt: m.joinedAt,
        isMe: isSameUserId(m.userId, currentUserId),
        isAdmin: m.role === 'admin' || isSameUserId(m.userId, group.adminId),
        student: safeProfile
      };
    });

    const groupObj = group.toObject({ virtuals: true });
    const adminProfile = formatSafePublicStudent(getStudentFromMap(studentMap, group.adminId), {
      fallbackName: 'Student',
      includeContact: isMemberOrAdmin
    });
    const confirmedMemberCount = enrichedMembers.length;
    const availableSpots = Math.max(0, (groupObj.targetCapacity || 0) - confirmedMemberCount);

    groupObj.members = enrichedMembers;
    groupObj.admin = adminProfile;
    groupObj.groupDisplayName = buildGroupDisplayName(enrichedMembers.map((m) => m.student), adminProfile.name);
    groupObj.isConfirmedMember = isMemberOrAdmin;
    groupObj.isAdmin = viewerIsAdmin;
    groupObj.confirmedMemberCount = confirmedMemberCount;
    groupObj.availableSpots = availableSpots;
    groupObj.availableSeats = availableSpots;

    // Attach viewer's pending request/invitation status on this group (if non-member)
    if (currentUserId && !isMemberOrAdmin) {
      const viewerVariants = getCandidateUserIds(currentUserId);
      const myPending = await GroupJoinRequest.findOne({
        groupId: group._id,
        requesterId: { $in: viewerVariants.length > 0 ? viewerVariants : [currentUserId] },
        status: 'pending',
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      })
        .select('_id type status expiresAt')
        .lean();
      groupObj.myPendingRequest = myPending || null;
    } else {
      groupObj.myPendingRequest = null;
    }

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

    const userVariants = getCandidateUserIds(userId);
    const groups = await SharedRideGroup.find({
      'members.userId': { $in: userVariants.length > 0 ? userVariants : [userId] },
      status: { $ne: 'empty' }
    })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    const allUserIds = [
      ...new Set([
        ...groups.map((g) => g.adminId),
        ...groups.flatMap((g) => (g.members || []).map((m) => m.userId))
      ].filter(Boolean))
    ];

    const studentMap = await resolveStudentProfilesMap(allUserIds, { includeContact: false });

    const enrichedGroups = groups.map((g) => {
      const members = (g.members || []).map((m) => ({
        ...m,
        isMe: isSameUserId(m.userId, userId),
        isAdmin: m.role === 'admin' || isSameUserId(m.userId, g.adminId),
        student: formatSafePublicStudent(getStudentFromMap(studentMap, m.userId), { fallbackName: 'Student' })
      }));
      const adminProfile = formatSafePublicStudent(getStudentFromMap(studentMap, g.adminId), { fallbackName: 'Student' });
      const memberCount = members.length;
      const availableSpots = Math.max(0, (g.targetCapacity || 0) - memberCount);
      return {
        ...g,
        admin: adminProfile,
        members,
        groupDisplayName: buildGroupDisplayName(members.map((m) => m.student), adminProfile.name),
        isConfirmedMember: true,
        isAdmin: isGroupAdmin(g, userId),
        confirmedMemberCount: memberCount,
        availableSpots,
        availableSeats: availableSpots
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedGroups
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
 * @desc    List all invitations for a group (Confirmed Members)
 * @access  Protected (Confirmed Group Members)
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

    if (!isConfirmedGroupMember(group, userId) && !isGroupAdmin(group, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only confirmed members of this group can view invitations'
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

    const profileIds = [
      ...new Set(requests.flatMap((r) => [r.requesterId, r.senderId]).filter(Boolean))
    ];
    const studentMap = await resolveStudentProfilesMap(profileIds, { includeContact: false });

    const enrichedInvites = requests.map((r) => {
      const requesterProfile = formatSafePublicStudent(getStudentFromMap(studentMap, r.requesterId), {
        fallbackName: 'Student'
      });
      const senderProfile = formatSafePublicStudent(getStudentFromMap(studentMap, r.senderId), {
        fallbackName: 'Student'
      });
      return {
        ...r,
        requesterName: requesterProfile.name,
        requester: requesterProfile,
        sender: senderProfile
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedInvites
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
 * @desc    List all pending group invitations AND group formation proposals received by the student
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
    const userVariants = getCandidateUserIds(userId);
    const invFilter = {
      recipientId: { $in: userVariants.length > 0 ? userVariants : [userId] },
      type: { $in: ['invite', 'formation_proposal'] },
      status: 'pending'
    };

    const invitations = await GroupJoinRequest.find(invFilter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'groupId',
        select: 'source destination travelDate departureTime targetCapacity status members adminId expiresAt'
      })
      .populate({
        path: 'requesterTravelId',
        select: 'source destination travelDate departureTime seats status expiresAt'
      })
      .populate({
        path: 'senderTravelId',
        select: 'source destination travelDate departureTime seats status expiresAt'
      })
      .lean();

    // Also check if recipient is already in an active group (formation proposals cannot form a 2nd group)
    const recipientActiveGroup = await findActiveGroupForStudent(userId);

    // Filter valid invitations and formation proposals
    const validInvitations = [];
    for (const inv of invitations) {
      if (inv.expiresAt && new Date(inv.expiresAt) <= now) continue;

      if (inv.type === 'formation_proposal') {
        if (recipientActiveGroup) continue;
        const sTravel = inv.senderTravelId;
        const rTravel = inv.requesterTravelId;
        if (!sTravel || !rTravel) continue;
        if (sTravel.status !== 'active' || rTravel.status !== 'active') continue;
        if ((sTravel.expiresAt && new Date(sTravel.expiresAt) <= now) || (rTravel.expiresAt && new Date(rTravel.expiresAt) <= now)) {
          continue;
        }
        validInvitations.push(inv);
      } else {
        if (!inv.groupId || inv.groupId.status !== 'open') continue;
        const groupExpiry = inv.groupId.expiresAt;
        if (groupExpiry && new Date(groupExpiry) <= now) continue;
        validInvitations.push(inv);
      }
    }

    // Attach resolved safe student profile for sender / admin across clerkId & firebaseUid variants
    const senderIds = [...new Set(validInvitations.map((inv) => inv.senderId || inv.groupId?.adminId).filter(Boolean))];
    const senderMap = await resolveStudentProfilesMap(senderIds, { includeContact: false });

    const enriched = validInvitations.map((inv) => {
      const senderId = inv.senderId || inv.groupId?.adminId;
      const senderProfile = formatSafePublicStudent(getStudentFromMap(senderMap, senderId), {
        fallbackName: 'Student'
      });
      const isProposal = inv.type === 'formation_proposal';
      const currentMemberCount = isProposal
        ? 0
        : (Array.isArray(inv.groupId?.members) ? inv.groupId.members.length : 1);
      const targetCapacity = isProposal
        ? (inv.proposedCapacity || 4)
        : (inv.groupId?.targetCapacity || 4);

      const tripMeta = isProposal ? (inv.senderTravelId || inv.requesterTravelId) : inv.groupId;

      return {
        ...inv,
        isFormationProposal: isProposal,
        proposedCapacity: targetCapacity,
        targetCapacity,
        confirmedMemberCount: currentMemberCount,
        availableSpots: isProposal ? targetCapacity : Math.max(0, targetCapacity - currentMemberCount),
        source: tripMeta?.source || inv.requesterTravelId?.source,
        destination: tripMeta?.destination || inv.requesterTravelId?.destination,
        travelDate: tripMeta?.travelDate || inv.requesterTravelId?.travelDate,
        departureTime: tripMeta?.departureTime ?? inv.requesterTravelId?.departureTime,
        admin: senderProfile,
        sender: senderProfile,
        senderName: senderProfile.name,
        relationshipState: 'REQUEST_RECEIVED'
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
 * @route   GET /api/groups/proposals/sent
 * @desc    List group formation proposals & invitations sent by the authenticated student
 * @access  Protected
 */
export async function getSentProposals(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user ID'
      });
    }

    const now = new Date();
    const userVariants = getCandidateUserIds(userId);
    
    // STRICT FILTERING: Only return pending invitations
    // Accepted, rejected, declined, withdrawn invitations should NOT appear in Sent Invitations
    const proposals = await GroupJoinRequest.find({
      senderId: { $in: userVariants.length > 0 ? userVariants : [userId] },
      type: { $in: ['formation_proposal', 'invite'] },
      status: 'pending' // ONLY pending invitations
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate({
        path: 'groupId',
        select: 'source destination travelDate departureTime targetCapacity status members expiresAt'
      })
      .populate({
        path: 'requesterTravelId',
        select: 'source destination travelDate departureTime seats status expiresAt'
      })
      .populate({
        path: 'senderTravelId',
        select: 'source destination travelDate departureTime seats status expiresAt'
      })
      .lean();

    // Filter out expired pending invitations
    const validProposals = proposals.filter((p) => {
      if (p.expiresAt && new Date(p.expiresAt) <= now) return false;
      
      // For formation proposals, verify both travel posts are still active
      if (p.type === 'formation_proposal') {
        const sTravel = p.senderTravelId;
        const rTravel = p.requesterTravelId;
        if (!sTravel || !rTravel) return false;
        if (sTravel.status !== 'active' || rTravel.status !== 'active') return false;
        if ((sTravel.expiresAt && new Date(sTravel.expiresAt) <= now) || 
            (rTravel.expiresAt && new Date(rTravel.expiresAt) <= now)) {
          return false;
        }
      } else if (p.type === 'invite') {
        // For group invitations, verify group is still active
        if (!p.groupId || p.groupId.status !== 'open') return false;
        const groupExpiry = p.groupId.expiresAt;
        if (groupExpiry && new Date(groupExpiry) <= now) return false;
      }
      
      return true;
    });

    const recipientIds = [...new Set(validProposals.map((p) => p.requesterId || p.recipientId).filter(Boolean))];
    const recipientMap = await resolveStudentProfilesMap(recipientIds, { includeContact: false });

    const enriched = validProposals.map((p) => {
        const peerId = p.requesterId || p.recipientId;
        const recipientProfile = formatSafePublicStudent(getStudentFromMap(recipientMap, peerId), {
          fallbackName: 'Student'
        });

        // All invitations in this list are pending, so relationshipState is always REQUEST_SENT
        const relationshipState = 'REQUEST_SENT';

        const tripMeta = p.groupId || p.senderTravelId || p.requesterTravelId;
        return {
          ...p,
          isFormationProposal: p.type === 'formation_proposal',
          proposedCapacity: p.proposedCapacity || p.groupId?.targetCapacity || 4,
          source: tripMeta?.source,
          destination: tripMeta?.destination,
          travelDate: tripMeta?.travelDate,
          departureTime: tripMeta?.departureTime,
          requester: recipientProfile,
          recipient: recipientProfile,
          recipientName: recipientProfile.name,
          relationshipState
        };
      });

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    console.error('[SharedRideGroup] Error fetching sent proposals:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sent proposals',
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
      groupSize,
      actualCabCapacity,
      notes,
      whatsappGroupUrl
    } = req.body;

    const rawTargetCapacity = targetCapacity ?? groupSize;
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

    // 2. Validate targetCapacity / groupSize (must be an integer between 2 and 6; defaults to 4)
    let parsedTargetCapacity = 4;
    if (rawTargetCapacity !== undefined && rawTargetCapacity !== null) {
      if (
        isNaN(Number(rawTargetCapacity)) ||
        !Number.isInteger(Number(rawTargetCapacity)) ||
        Number(rawTargetCapacity) < 2 ||
        Number(rawTargetCapacity) > 6
      ) {
        return res.status(400).json({
          success: false,
          message: 'Group size (targetCapacity) must be an integer between 2 and 6'
        });
      }
      parsedTargetCapacity = Number(rawTargetCapacity);
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
    if (!isSameUserId(originatingTravel.userId, creatorId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only send a group formation request from your own travel post'
      });
    }

    // 7. Verify both students are different
    if (isSameUserId(candidateTravel.userId, creatorId)) {
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

    // 12. Canonical proposal & user-pair keys for deduplication
    const proposalKey = [String(originatingTravel._id), String(candidateTravel._id)].sort().join(':');
    const pairUserKey = buildPairUserKey(creatorId, candidateTravel.userId);

    // 13. Pre-check: Prevent duplicate group formation if an active group already exists for this pair
    const existingProposalGroup = await SharedRideGroup.findOne({
      proposalKey,
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: now }
    });

    if (existingProposalGroup) {
      return res.status(409).json({
        success: false,
        message: 'An active shared ride group already exists for this pair.',
        data: {
          group: existingProposalGroup,
          existingGroupId: existingProposalGroup._id,
          relationshipState: 'ACCEPTED',
          isExisting: true
        }
      });
    }

    // 14. Pre-check: Enforce One Active Group Per Student for both sender and peer
    const creatorActiveGroup = await findActiveGroupForStudent(creatorId);
    if (creatorActiveGroup) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE,
        data: { existingGroupId: creatorActiveGroup._id }
      });
    }

    const peerActiveGroup = await findActiveGroupForStudent(candidateTravel.userId);
    if (peerActiveGroup) {
      return res.status(409).json({
        success: false,
        message: 'The matched student is already a member of another active group.',
        data: { existingGroupId: peerActiveGroup._id }
      });
    }

    // 15. BUG 4 FIX: Create ONLY a pre-group formation proposal inside transaction.
    // Do NOT create a SharedRideGroup until the receiving student explicitly accepts!
    const { proposal, isExisting } = await runInTransaction(async (session) => {
      const txNow = new Date();
      const txOpts = session ? { session } : {};

      // Reconcile any expired pending formation proposals for this pair/key
      await GroupJoinRequest.updateMany(
        {
          type: 'formation_proposal',
          status: 'pending',
          expiresAt: { $lte: txNow },
          $or: [
            { proposalKey },
            ...(pairUserKey ? [{ pairUserKey }] : [])
          ]
        },
        { $set: { status: 'expired' } },
        txOpts
      );

      // Re-verify One Active Group Per Student inside transaction
      const [txCreatorGroup, txPeerGroup, txActiveGroup] = await Promise.all([
        findActiveGroupForStudent(creatorId, { session }),
        findActiveGroupForStudent(candidateTravel.userId, { session }),
        SharedRideGroup.findOne({ proposalKey, status: { $in: ['open', 'full'] }, expiresAt: { $gt: txNow } }).session(session)
      ]);

      if (txActiveGroup) {
        const err = new Error('An active shared ride group already exists for this pair.');
        err.statusCode = 409;
        err.existingGroupId = txActiveGroup._id;
        throw err;
      }
      if (txCreatorGroup) {
        const err = new Error(ONE_ACTIVE_GROUP_MESSAGE);
        err.statusCode = 409;
        throw err;
      }
      if (txPeerGroup) {
        const err = new Error('The matched student is already a member of another active group.');
        err.statusCode = 409;
        throw err;
      }

      // Check for existing pending formation proposal on this proposalKey or active user pair
      const existingPendingProposal = await GroupJoinRequest.findOne({
        type: 'formation_proposal',
        status: 'pending',
        $or: [
          { proposalKey },
          ...(pairUserKey ? [{ pairUserKey }] : [])
        ]
      }).session(session);

      if (existingPendingProposal) {
        return { proposal: existingPendingProposal, isExisting: true };
      }

      const proposalExpiresAt = originatingTravel.expiresAt < candidateTravel.expiresAt
        ? originatingTravel.expiresAt
        : candidateTravel.expiresAt;

      const [newProposal] = await GroupJoinRequest.create(
        [
          {
            groupId: null,
            type: 'formation_proposal',
            requesterId: candidateTravel.userId,
            requesterTravelId: candidateTravel._id,
            senderId: creatorId,
            senderTravelId: originatingTravel._id,
            recipientId: candidateTravel.userId,
            proposedCapacity: parsedTargetCapacity,
            proposalKey,
            pairUserKey,
            status: 'pending',
            expiresAt: proposalExpiresAt,
            message: typeof notes === 'string' && notes.trim()
              ? notes.trim()
              : `Group formation request (Capacity ${parsedTargetCapacity}) from compatible trip match`
          }
        ],
        txOpts
      );

      // Resolve sender student profile cleanly (BUG 2)
      const senderStudent = await resolveSingleStudent(creatorId, { session });
      const senderName = senderStudent?.name || 'Student';

      // Create Outbox notification event for recipient B
      await createOutboxEvent(
        {
          eventId: `formation_proposal_${newProposal._id}_${candidateTravel.userId}`,
          eventType: NOTIFICATION_JOB_TYPES.GROUP_INVITATION_RECEIVED,
          recipientId: candidateTravel.userId,
          relatedTravelId: candidateTravel._id,
          payload: {
            proposalId: newProposal._id,
            requestId: newProposal._id,
            isFormationProposal: true,
            fromMatchProposal: true,
            adminName: senderName,
            senderName,
            senderCollege: senderStudent?.college || null,
            senderBranch: senderStudent?.branch || senderStudent?.course || null,
            customTitle: `${senderName} sent a Group Formation Request!`,
            customMessage: `${senderName} wants to form a Shared Ride Group (Capacity ${parsedTargetCapacity}) for ${originatingTravel.source} → ${originatingTravel.destination}. Accept or Decline to continue.`,
            source: originatingTravel.source,
            destination: originatingTravel.destination,
            travelDate: originatingTravel.travelDate,
            departureTime: originatingTravel.departureTime,
            proposedCapacity: parsedTargetCapacity,
            targetCapacity: parsedTargetCapacity,
            navigationUrl: '/shared-rides?tab=invitations'
          }
        },
        session
      );

      return { proposal: newProposal, isExisting: false };
    });

    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Outbox] Trigger sweep non-blocking warning:', sweepErr.message);
    }

    const viewerIsSender = isSameUserId(proposal.senderId, creatorId);
    const relationshipState = viewerIsSender ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';

    if (isExisting) {
      return res.status(200).json({
        success: true,
        message: viewerIsSender
          ? 'Group formation request already sent and pending response'
          : 'This student has already sent you a pending group formation request',
        data: {
          group: null,
          proposal,
          invitation: proposal,
          proposedCapacity: proposal.proposedCapacity || parsedTargetCapacity,
          relationshipState,
          isExisting: true
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Group formation request sent! Group will be created once the other student accepts.',
      data: {
        group: null,
        proposal,
        invitation: proposal,
        proposedCapacity: proposal.proposedCapacity || parsedTargetCapacity,
        relationshipState
      }
    });
  } catch (err) {
    // If unique key conflict on proposalKey occurred concurrently
    if (err.code === 11000 && ((err.keyPattern && err.keyPattern.proposalKey) || (err.message && err.message.includes('proposalKey')))) {
      try {
        const myTravelId = req.body?.originatingTravelId || req.body?.travelId;
        const peerTravelId = req.body?.candidateTravelId || req.body?.inviteeTravelId;
        const proposalKey = [String(myTravelId), String(peerTravelId)].sort().join(':');
        const winningProposal = await GroupJoinRequest.findOne({
          proposalKey,
          type: 'formation_proposal',
          status: 'pending'
        });
        if (winningProposal) {
          const viewerIsSender = isSameUserId(winningProposal.senderId, req.userId);
          return res.status(200).json({
            success: true,
            message: 'A group formation proposal was concurrently sent for this match',
            data: {
              group: null,
              proposal: winningProposal,
              invitation: winningProposal,
              proposedCapacity: winningProposal.proposedCapacity,
              relationshipState: viewerIsSender ? 'REQUEST_SENT' : 'REQUEST_RECEIVED',
              isExisting: true
            }
          });
        }
      } catch (recoveryErr) {
        console.error('[SharedRideGroup] Recovery error after duplicate proposal key:', recoveryErr);
      }
    }

    if (isMemberUniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE
      });
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
    const existingActiveGroup = await findActiveGroupForStudent(studentId, { excludeGroupId: group._id });
    if (existingActiveGroup) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE
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
    const studentProfile = await resolveSingleStudent(studentId, { lean: true });

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

      if (isGroupAdmin(currentGroup, studentId)) {
        const adminErr = new Error('You are the admin of this group and cannot join it again');
        adminErr.statusCode = 400;
        throw adminErr;
      }

      if (isConfirmedGroupMember(currentGroup, studentId)) {
        const dupErr = new Error('You are already a confirmed member of this group');
        dupErr.statusCode = 409;
        throw dupErr;
      }

      // Inside transaction: verify student is not already a member of any other active group
      const studentActiveGroupTx = await findActiveGroupForStudent(studentId, { excludeGroupId: targetGroupId, session });

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
    if (isMemberUniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: ONE_ACTIVE_GROUP_MESSAGE
      });
    }
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

    const isMember = isConfirmedGroupMember(group, studentId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a confirmed member of this shared ride group'
      });
    }

    const leavingStudent = await resolveSingleStudent(studentId, { lean: true });

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

      const memberIdx = currentGroup.members.findIndex((m) => isSameUserId(m.userId, studentId));
      if (memberIdx === -1) {
        const notMemberErr = new Error('You are not a confirmed member of this shared ride group');
        notMemberErr.statusCode = 403;
        throw notMemberErr;
      }

      const wasAdmin = isSameUserId(currentGroup.adminId, studentId);

      // Remove the member
      currentGroup.members.splice(memberIdx, 1);

      const remainingMembersCount = currentGroup.members.length;

      // CRITICAL: Automatically dissolve group if only 1 or 0 members remain
      // Minimum active group size = 2 confirmed members
      if (remainingMembersCount <= 1) {
        // Mark group as empty (dissolved/ended)
        currentGroup.status = 'empty';
        
        // Cancel all pending requests
        await cancelPendingRequestsForGroup(currentGroup._id, session);

        // If exactly 1 member remains, notify them about auto-dissolution
        if (remainingMembersCount === 1) {
          const lastMember = currentGroup.members[0];
          try {
            await createOutboxEvent({
              eventType: NOTIFICATION_JOB_TYPES.GROUP_CLOSED,
              recipientId: lastMember.userId,
              relatedTravelId: currentGroup.originatingTravelId,
              payload: {
                groupId: currentGroup._id,
                source: currentGroup.source,
                destination: currentGroup.destination,
                travelDate: currentGroup.travelDate,
                reason: 'auto_dissolution',
                message: 'Your group has ended because all other members have left. You can now find new compatible students for your journey.',
                route: `/shared-rides`,
                navigationUrl: `/shared-rides`,
                actionLabel: 'Find New Matches'
              }
            }, session);
          } catch (notifyErr) {
            console.warn('[LeaveGroup] Auto-dissolution notification warning:', notifyErr.message);
          }
        }

        await currentGroup.save(session ? { session } : {});
        return currentGroup;
      }

      // Group still has 2+ members, continue normal flow
      if (wasAdmin) {
        // Promote earliest joined member to admin
        currentGroup.members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
        const newAdmin = currentGroup.members[0];
        newAdmin.role = 'admin';
        currentGroup.adminId = newAdmin.userId;

        if (newAdmin.travelId) {
          currentGroup.originatingTravelId = newAdmin.travelId;
        }

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
        // Non-admin member left (2+ members remain)
        const now = new Date();
        
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
    if (isMemberUniqueConflict(err)) {
      return res.status(409).json({
        success: false,
        message: 'This student is already a member of another active group and cannot join a second group.'
      });
    }
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

/**
 * Automatically removes a student from any active Shared Ride Groups linked to a
 * deleted or cancelled travel post, promotes the next admin or cancels empty groups,
 * reopens full groups if seats become available, and cancels pending join requests.
 *
 * @param {string|mongoose.Types.ObjectId} travelId
 * @param {string} userId
 * @returns {Promise<{ removedCount: number, cancelledGroupIds: string[], updatedGroupIds: string[] }>}
 */
export async function removeStudentFromGroupsForTravel(travelId, userId) {
  if (!travelId || !userId || !mongoose.Types.ObjectId.isValid(travelId)) {
    return { removedCount: 0, cancelledGroupIds: [], updatedGroupIds: [] };
  }

  const targetTravelObjId = new mongoose.Types.ObjectId(travelId);
  const targetTravelStr = String(travelId);
  const candidateUserIds = getCandidateUserIds(userId);

  const matchingGroups = await SharedRideGroup.find({
    status: { $in: ['open', 'full'] },
    $or: [
      { 'members.travelId': targetTravelObjId },
      { originatingTravelId: targetTravelObjId, 'members.userId': { $in: candidateUserIds } },
      { 'members.userId': { $in: candidateUserIds } }
    ]
  }).select('_id').lean();

  const leavingStudent = await Student.findOne(
    { clerkId: { $in: candidateUserIds } },
    { name: 1, _id: 0 }
  ).lean();

  const summary = await runInTransaction(async (session) => {
    const now = new Date();
    const cancelledGroupIds = [];
    const updatedGroupIds = [];
    let removedCount = 0;

    for (const gStub of matchingGroups) {
      const currentGroup = session
        ? await SharedRideGroup.findById(gStub._id).session(session)
        : await SharedRideGroup.findById(gStub._id);

      if (!currentGroup || !['open', 'full'].includes(currentGroup.status)) {
        continue;
      }

      const memberIdx = currentGroup.members.findIndex(
        (m) =>
          candidateUserIds.includes(m.userId) &&
          (String(m.travelId) === targetTravelStr ||
            String(currentGroup.originatingTravelId) === targetTravelStr ||
            matchingGroups.length === 1)
      );

      if (memberIdx === -1) {
        continue;
      }

      const wasAdmin = candidateUserIds.includes(currentGroup.adminId);
      currentGroup.members.splice(memberIdx, 1);
      removedCount += 1;

      const remainingMembersCount = currentGroup.members.length;

      // BUG FIX: Auto-dissolve if only 1 or 0 members remain (minimum 2 required)
      if (remainingMembersCount <= 1) {
        currentGroup.status = 'empty';
        cancelledGroupIds.push(String(currentGroup._id));

        await cancelPendingRequestsForGroup(currentGroup._id, session);

        // Notify remaining member (if any) that group has been dissolved
        if (remainingMembersCount === 1) {
          const lastMember = currentGroup.members[0];
          try {
            await createOutboxEvent(
              {
                eventType: NOTIFICATION_JOB_TYPES.GROUP_CLOSED,
                recipientId: lastMember.userId,
                relatedTravelId: currentGroup.originatingTravelId,
                payload: {
                  groupId: currentGroup._id,
                  title: 'Shared group closed',
                  message: `Your shared ride group (${currentGroup.source} → ${currentGroup.destination}) was automatically closed because only one member remained. You can now match individually again.`,
                  reason: 'insufficient_members',
                  source: currentGroup.source,
                  destination: currentGroup.destination,
                  travelDate: currentGroup.travelDate,
                  route: `/groups/${currentGroup._id}`,
                  navigationUrl: `/groups/${currentGroup._id}`
                }
              },
              session
            );
          } catch (dissolveEvtErr) {
            console.warn('[DeleteTravelGroupCleanup] Auto-dissolution notification warning:', dissolveEvtErr.message);
          }
        }
      } else {
        if (wasAdmin) {
          currentGroup.members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
          const newAdmin = currentGroup.members[0];
          newAdmin.role = 'admin';
          currentGroup.adminId = newAdmin.userId;

          if (
            String(currentGroup.originatingTravelId) === targetTravelStr &&
            newAdmin.travelId
          ) {
            currentGroup.originatingTravelId = newAdmin.travelId;
          }

          try {
            await createOutboxEvent(
              {
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
              },
              session
            );
          } catch (promoteEvtErr) {
            console.warn('[DeleteTravelGroupCleanup] Promoted admin event warning:', promoteEvtErr.message);
          }
        } else {
          try {
            await createOutboxEvent(
              {
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
              },
              session
            );
          } catch (leftEvtErr) {
            console.warn('[DeleteTravelGroupCleanup] Member left event warning:', leftEvtErr.message);
          }
        }

        if (
          currentGroup.members.length < currentGroup.targetCapacity &&
          new Date(currentGroup.expiresAt) > now
        ) {
          currentGroup.status = 'open';
        }
        updatedGroupIds.push(String(currentGroup._id));
      }  // End of else block for remainingMembersCount > 1

      await currentGroup.save(session ? { session } : {});
    }

    // Cancel any pending join requests or invitations tied to this deleted travel post
    await GroupJoinRequest.updateMany(
      { requesterTravelId: targetTravelObjId, status: 'pending' },
      { $set: { status: 'cancelled' } },
      session ? { session } : {}
    );

    return { removedCount, cancelledGroupIds, updatedGroupIds };
  });

  if (summary.removedCount > 0) {
    try {
      triggerOutboxSweep();
    } catch {}
  }

  return summary;
}


/**
 * @route   PUT /api/groups/:id/whatsapp
 * @desc    Update WhatsApp group invite link (Admin only) - BUG 4 FIX
 * @access  Protected (Admin only)
 */
export async function updateGroupWhatsAppLink(req, res) {
  try {
    const { groupId, id } = req.params;
    const targetGroupId = groupId || id;
    const { whatsappGroupUrl } = req.body;
    const actorId = req.userId;

    if (!actorId) {
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

    const group = await SharedRideGroup.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Shared ride group not found'
      });
    }

    if (!isGroupAdmin(group, actorId)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can update WhatsApp group link'
      });
    }

    // Validate URL if provided
    if (whatsappGroupUrl && typeof whatsappGroupUrl === 'string' && whatsappGroupUrl.trim()) {
      const trimmedUrl = whatsappGroupUrl.trim();
      const isValid = /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[a-zA-Z0-9_\-]+$/i.test(trimmedUrl);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Must be a valid WhatsApp invite URL (https://chat.whatsapp.com/xxxxx or https://wa.me/xxxxx)'
        });
      }
      group.whatsappGroupUrl = trimmedUrl;
    } else {
      // Remove link if empty/null
      group.whatsappGroupUrl = null;
    }

    await group.save();

    return res.status(200).json({
      success: true,
      message: whatsappGroupUrl ? 'WhatsApp group link updated successfully' : 'WhatsApp group link removed successfully',
      data: group
    });
  } catch (err) {
    console.error('[Group] Error updating WhatsApp link:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update WhatsApp group link',
      error: err.message
    });
  }
}
