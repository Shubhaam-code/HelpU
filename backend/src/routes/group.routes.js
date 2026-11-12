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
  withdrawInvitation,
  getSharedRideGroupById,
  getMyGroups,
  getGroupInvites,
  getReceivedInvitations,
  getSentProposals,
  directJoinSharedRideGroup,
  leaveSharedRideGroup,
  updateGroupWhatsAppLink
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

// 2b. Received invitations/proposals & sent proposals for authenticated student (must precede /:id)
router.get('/invitations/received', getReceivedInvitations);
router.get('/invites/received', getReceivedInvitations);
router.get('/proposals/sent', getSentProposals);

// 3. Invitation & formation proposal resolution actions (recipient acceptance/rejection)
router.post('/invitations/:requestId/accept', acceptGroupInvitation);
router.post('/invites/:requestId/accept', acceptGroupInvitation);
router.post('/proposals/:requestId/accept', acceptGroupInvitation);
router.post('/invitations/:requestId/reject', rejectGroupInvitation);
router.post('/invites/:requestId/reject', rejectGroupInvitation);
router.post('/proposals/:requestId/reject', rejectGroupInvitation);
router.post('/invitations/:requestId/withdraw', withdrawInvitation);
router.post('/invites/:requestId/withdraw', withdrawInvitation);
router.post('/proposals/:requestId/withdraw', withdrawInvitation);

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

// 9. WhatsApp Group Link Management - BUG 4 FIX
router.put('/:groupId/whatsapp', updateGroupWhatsAppLink);
router.put('/:id/whatsapp', updateGroupWhatsAppLink);

export default router;
