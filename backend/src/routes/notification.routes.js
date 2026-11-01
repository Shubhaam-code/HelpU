import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../controllers/notification.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);

export default router;
