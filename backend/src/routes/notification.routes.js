import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  registerDeviceToken,
  unregisterDeviceToken
} from '../controllers/notification.controller.js';

const router = express.Router();

router.use(requireAuth);

// Device FCM Token Management
router.post('/fcm-token', registerDeviceToken);
router.delete('/fcm-token', unregisterDeviceToken);

// In-App Notifications
router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);

export default router;
