import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import DeviceToken from '../models/DeviceToken.js';
import Travel from '../models/Travel.js';
import SlotPost from '../models/SlotPost.js';

/**
 * Helper to build strict module isolation filter between PoolMate and SlotMate
 */
function buildNotificationModuleFilter(moduleName) {
  if (moduleName === 'all') {
    return null;
  }
  if (moduleName === 'slotmate') {
    return {
      $or: [
        { module: 'slotmate' },
        { type: /^SLOT_/ },
        { relatedSlotPostId: { $ne: null } }
      ]
    };
  }
  // Default to poolmate: strictly prevent slotmate notifications from leaking into PoolMate
  return {
    $and: [
      { module: { $ne: 'slotmate' } },
      { type: { $not: /^SLOT_/ } },
      { relatedSlotPostId: null }
    ]
  };
}

/**
 * Automatically purges and filters out notifications referencing deleted,
 * expired, or closed/unavailable posts for the authenticated student (Problem 1)
 */
async function pruneStaleNotificationsForUser(recipientId) {
  if (!recipientId) return;
  try {
    const now = new Date();
    const notifs = await Notification.find({
      recipientId,
      $or: [
        { relatedTravelId: { $ne: null } },
        { relatedSlotPostId: { $ne: null } },
        { 'metadata.matchedTravelId': { $exists: true } },
        { 'metadata.matchId': { $exists: true } },
        { 'metadata.postId': { $exists: true } }
      ]
    }).select('_id type module relatedTravelId relatedSlotPostId metadata').lean();

    if (!notifs || notifs.length === 0) return;

    const staleIds = [];
    const travelIdsToCheck = new Set();
    const slotPostIdsToCheck = new Set();

    for (const n of notifs) {
      if (n.relatedTravelId && mongoose.Types.ObjectId.isValid(n.relatedTravelId)) {
        travelIdsToCheck.add(String(n.relatedTravelId));
      }
      if (n.metadata?.matchedTravelId && mongoose.Types.ObjectId.isValid(n.metadata.matchedTravelId)) {
        travelIdsToCheck.add(String(n.metadata.matchedTravelId));
      }
      if (n.relatedSlotPostId && mongoose.Types.ObjectId.isValid(n.relatedSlotPostId)) {
        slotPostIdsToCheck.add(String(n.relatedSlotPostId));
      }
      if (n.metadata?.matchId && mongoose.Types.ObjectId.isValid(n.metadata.matchId)) {
        slotPostIdsToCheck.add(String(n.metadata.matchId));
      }
      if (n.metadata?.postId && mongoose.Types.ObjectId.isValid(n.metadata.postId)) {
        slotPostIdsToCheck.add(String(n.metadata.postId));
      }
    }

    const [validTravels, validSlotPosts] = await Promise.all([
      travelIdsToCheck.size > 0
        ? Travel.find({ _id: { $in: Array.from(travelIdsToCheck) } }).select('_id status expiresAt').lean()
        : [],
      slotPostIdsToCheck.size > 0
        ? SlotPost.find({ _id: { $in: Array.from(slotPostIdsToCheck) } }).select('_id status').lean()
        : []
    ]);

    const travelMap = new Map();
    for (const t of validTravels) {
      travelMap.set(String(t._id), t);
    }

    const slotMap = new Map();
    for (const s of validSlotPosts) {
      slotMap.set(String(s._id), s);
    }

    for (const n of notifs) {
      // Check PoolMate match/travel notifications
      if (n.type === 'NEW_MATCH_FOUND' || n.type === 'COMPATIBLE_FIND_MATCH') {
        const tid = n.relatedTravelId ? String(n.relatedTravelId) : null;
        const matchedTid = n.metadata?.matchedTravelId ? String(n.metadata.matchedTravelId) : null;

        if (tid) {
          const t = travelMap.get(tid);
          if (!t || t.status !== 'active' || (t.expiresAt && new Date(t.expiresAt) <= now)) {
            staleIds.push(n._id);
            continue;
          }
        }
        if (matchedTid) {
          const mt = travelMap.get(matchedTid);
          if (!mt || mt.status !== 'active' || (mt.expiresAt && new Date(mt.expiresAt) <= now)) {
            staleIds.push(n._id);
            continue;
          }
        }
      }

      // Check SlotMate match notifications
      if (n.type === 'SLOT_MATCH_FOUND' || n.module === 'slotmate') {
        const sid = n.relatedSlotPostId ? String(n.relatedSlotPostId) : null;
        const matchId = n.metadata?.matchId ? String(n.metadata.matchId) : null;
        const postId = n.metadata?.postId ? String(n.metadata.postId) : null;

        if (sid) {
          const s = slotMap.get(sid);
          if (!s || s.status !== 'active') {
            staleIds.push(n._id);
            continue;
          }
        }
        if (matchId) {
          const ms = slotMap.get(matchId);
          if (!ms || ms.status !== 'active') {
            staleIds.push(n._id);
            continue;
          }
        }
        if (postId) {
          const ps = slotMap.get(postId);
          if (!ps || ps.status !== 'active') {
            staleIds.push(n._id);
            continue;
          }
        }
      }
    }

    if (staleIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: staleIds } });
    }
  } catch (err) {
    console.warn('[NotificationCleanup] Non-fatal error pruning stale notifications:', err.message);
  }
}

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications for logged-in student (newest first)
 * @access  Protected
 */
export async function getMyNotifications(req, res) {
  try {
    const recipientId = req.userId;

    // Auto-clean stale notifications for deleted/closed/expired posts (Problem 1)
    await pruneStaleNotificationsForUser(recipientId);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { recipientId };
    if (req.query.unreadOnly === 'true' || req.query.unreadOnly === true) {
      filter.isRead = false;
    }

    // Module-specific filtering to cleanly isolate PoolMate and SlotMate
    const moduleFilter = buildNotificationModuleFilter(req.query.module);
    if (moduleFilter) {
      Object.assign(filter, moduleFilter);
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

    // Auto-clean stale notifications for deleted/closed/expired posts (Problem 1)
    await pruneStaleNotificationsForUser(recipientId);

    const filter = {
      recipientId,
      isRead: false
    };

    const moduleFilter = buildNotificationModuleFilter(req.query.module);
    if (moduleFilter) {
      Object.assign(filter, moduleFilter);
    }

    const unreadCount = await Notification.countDocuments(filter);

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
    const filter = { recipientId, isRead: false };

    const moduleFilter = buildNotificationModuleFilter(req.query.module);
    if (moduleFilter) {
      Object.assign(filter, moduleFilter);
    }

    const result = await Notification.updateMany(
      filter,
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
 * SlotMate-specific notification handlers for clean isolation
 */
export async function getSlotMateNotifications(req, res) {
  req.query.module = 'slotmate';
  return getMyNotifications(req, res);
}

export async function getSlotMateUnreadCount(req, res) {
  req.query.module = 'slotmate';
  return getUnreadNotificationCount(req, res);
}

export async function markAllSlotMateNotificationsAsRead(req, res) {
  req.query.module = 'slotmate';
  return markAllNotificationsAsRead(req, res);
}

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Dismiss/delete a single notification for the authenticated student
 * @access  Protected
 */
export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const recipientId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }

    const filter = { _id: id, recipientId };
    const moduleFilter = buildNotificationModuleFilter(req.query.module);
    if (moduleFilter) {
      Object.assign(filter, moduleFilter);
    }

    const deleted = await Notification.findOneAndDelete(filter);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification dismissed',
      deletedId: id
    });
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting notification',
      error: error.message
    });
  }
}

export async function deleteSlotMateNotification(req, res) {
  req.query.module = 'slotmate';
  return deleteNotification(req, res);
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

