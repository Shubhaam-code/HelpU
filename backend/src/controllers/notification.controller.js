import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import DeviceToken from '../models/DeviceToken.js';

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications for logged-in student (newest first)
 * @access  Protected
 */
export async function getMyNotifications(req, res) {
  try {
    const recipientId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { recipientId };
    if (req.query.unreadOnly === 'true' || req.query.unreadOnly === true) {
      filter.isRead = false;
    }

    const [total, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      page,
      totalPages,
      data: notifications
    });
  } catch (error) {
    console.error('Error in getMyNotifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching notifications',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for logged-in student
 * @access  Protected
 */
export async function getUnreadNotificationCount(req, res) {
  try {
    const recipientId = req.userId;
    const unreadCount = await Notification.countDocuments({
      recipientId,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      count: unreadCount,
      data: {
        unreadCount,
        count: unreadCount
      }
    });
  } catch (error) {
    console.error('Error in getUnreadNotificationCount:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching unread notification count',
      error: error.message
    });
  }
}

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Protected
 */
export async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const recipientId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId },
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while marking notification as read',
      error: error.message
    });
  }
}

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all unread notifications as read for logged-in student
 * @access  Protected
 */
export async function markAllNotificationsAsRead(req, res) {
  try {
    const recipientId = req.userId;

    const result = await Notification.updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in markAllNotificationsAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while marking all notifications as read',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/fcm-token
 * @desc    Register or update device FCM token for authenticated user
 * @access  Protected
 */
export async function registerDeviceToken(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user identity'
      });
    }

    const { token, platform } = req.body || {};

    // Validate token
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FCM registration token. Token must be a non-empty string of at least 10 characters.'
      });
    }

    const cleanToken = token.trim();
    const tokenPrefix = cleanToken.slice(0, 8) + '...';

    // Validate platform
    const validPlatforms = ['android', 'ios', 'web'];
    const chosenPlatform = (platform && typeof platform === 'string' && validPlatforms.includes(platform.toLowerCase().trim()))
      ? platform.toLowerCase().trim()
      : 'android';

    // Atomically upsert token.
    // If device switched users, updates userId ownership safely.
    const record = await DeviceToken.findOneAndUpdate(
      { token: cleanToken },
      {
        $set: {
          userId,
          platform: chosenPlatform,
          lastSeenAt: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.log(`[HelpuPush] Registered device token prefix ${tokenPrefix} for user ${userId} (${chosenPlatform})`);

    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        platform: record.platform,
        lastSeenAt: record.lastSeenAt
      }
    });
  } catch (error) {
    console.error('Error in registerDeviceToken:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while registering device token',
      error: error.message
    });
  }
}

/**
 * @route   DELETE /api/notifications/fcm-token
 * @desc    Unregister device FCM token for authenticated user
 * @access  Protected
 */
export async function unregisterDeviceToken(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing authenticated user identity'
      });
    }

    const token = req.body?.token || req.query?.token;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token is required to unregister device'
      });
    }

    const cleanToken = token.trim();
    const tokenPrefix = cleanToken.slice(0, 8) + '...';

    // Only allow unregistering token belonging to this authenticated user
    const result = await DeviceToken.deleteOne({
      token: cleanToken,
      userId
    });

    console.log(`[HelpuPush] Unregistered device token prefix ${tokenPrefix} for user ${userId} (deleted: ${result.deletedCount > 0})`);

    return res.status(200).json({
      success: true,
      message: 'Device token unregistered successfully',
      deleted: result.deletedCount > 0
    });
  } catch (error) {
    console.error('Error in unregisterDeviceToken:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while unregistering device token',
      error: error.message
    });
  }
}

