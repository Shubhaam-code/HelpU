import express from 'express';
import { getCourses } from '../controllers/course.controller.js';
import {
  createPost,
  updatePost,
  getMyPosts,
  getMyMatches,
  getPostMatches,
  getMatchDetailsHandler,
  deletePost,
  getPublicPosts
} from '../controllers/slotPost.controller.js';
import {
  getSlotMateNotifications,
  getSlotMateUnreadCount,
  markAllSlotMateNotificationsAsRead
} from '../controllers/notification.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';
import { requireIdempotency } from '../middlewares/idempotency.js';

const router = express.Router();

// 1. Course catalogue lookup (Course search API) - Public
// GET /api/slotmate/courses?q=data
router.get('/courses', getCourses);

// 2. Public Slot Post Exploration Feed (Privacy-scrubbed) - Optional Auth
// GET /api/slotmate/posts
router.get('/posts', optionalAuth, getPublicPosts);

// 3. Slot Post Creation & Management (Protected)
// POST /api/slotmate/posts
router.post('/posts', requireAuth, requireIdempotency({ required: false }), createPost);

// PUT /api/slotmate/posts/:postId
router.put('/posts/:postId', requireAuth, updatePost);

// GET /api/slotmate/posts/my
router.get('/posts/my', requireAuth, getMyPosts);

// DELETE /api/slotmate/posts/:postId
router.delete('/posts/:postId', requireAuth, deletePost);

// 4. Slot Matching APIs (Strictly Protected - only matched peers can view)
// GET /api/slotmate/matches/my
router.get('/matches/my', requireAuth, getMyMatches);

// GET /api/slotmate/posts/:postId/matches
router.get('/posts/:postId/matches', requireAuth, getPostMatches);

// GET /api/slotmate/matches/:matchId
router.get('/matches/:matchId', requireAuth, getMatchDetailsHandler);

// 5. SlotMate Dedicated Notification APIs (Strictly Protected)
// GET /api/slotmate/notifications
router.get('/notifications', requireAuth, getSlotMateNotifications);

// GET /api/slotmate/notifications/unread-count
router.get('/notifications/unread-count', requireAuth, getSlotMateUnreadCount);

// PATCH /api/slotmate/notifications/read-all
router.patch('/notifications/read-all', requireAuth, markAllSlotMateNotificationsAsRead);

export default router;
