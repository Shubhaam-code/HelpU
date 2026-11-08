import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  createSharedRideGroup,
  createGroupFromFindMatch,
  discoverSharedRideGroups,
  createJoinRequest,
  getGroupJoinRequests,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  inviteStudentToGroup,
  acceptGroupInvitation,
  rejectGroupInvitation,
  getSharedRideGroupById,
  getMyGroups,
  getGroupInvites,
  getReceivedInvitations,
  directJoinSharedRideGroup,
  leaveSharedRideGroup
} from '../controllers/group.controller.js';

const router = express.Router();

// Enforce Firebase authentication across all Shared Ride Group endpoints
router.use(requireAuth);

// 1. Group Discovery for FIND students (must precede /:id)
router.get('/discover', discoverSharedRideGroups);

// 1b. Create Shared Group and pending invitation from compatible FIND match (must precede /:id)
router.post('/from-match', createGroupFromFindMatch);

// 2. Base group creation & user groups
router.post('/', createSharedRideGroup);
router.get('/my', getMyGroups);

// 2b. Received invitations for authenticated student (must precede /:id)
router.get('/invitations/received', getReceivedInvitations);
router.get('/invites/received', getReceivedInvitations);

// 3. Invitation resolution actions (recipient acceptance/rejection)
router.post('/invitations/:requestId/accept', acceptGroupInvitation);
router.post('/invites/:requestId/accept', acceptGroupInvitation);
router.post('/invitations/:requestId/reject', rejectGroupInvitation);
router.post('/invites/:requestId/reject', rejectGroupInvitation);

// 4. Join request resolution actions (admin acceptance/rejection)
router.post('/join-requests/:requestId/accept', acceptStudentJoinRequest);
router.post('/join-requests/:requestId/reject', rejectStudentJoinRequest);

// 5. Specific group routes
router.get('/:id', getSharedRideGroupById);

// 6. Admin invitations sent for a group
router.post('/:id/invites', inviteStudentToGroup);
router.post('/:id/invite', inviteStudentToGroup);
router.get('/:id/invites', getGroupInvites);

// 7. Student-initiated join requests for a group
router.post('/:groupId/join-requests', createJoinRequest);
router.get('/:groupId/join-requests', getGroupJoinRequests);

// 8. Dynamic Direct Join & Leave
router.post('/:groupId/join', directJoinSharedRideGroup);
router.post('/:id/join', directJoinSharedRideGroup);
router.post('/:groupId/leave', leaveSharedRideGroup);
router.post('/:id/leave', leaveSharedRideGroup);

export default router;
