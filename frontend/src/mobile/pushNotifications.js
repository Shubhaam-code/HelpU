import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { triggerInAppNotification } from '../components/ui/InAppNotificationBanner';
import { registerFcmToken, unregisterFcmToken } from '../lib/api';

/**
 * In-memory cache of the latest device FCM token
 */
let cachedFcmToken = null;

/**
 * Current authenticated Clerk user
 */
let currentAuthUser = null;

/**
 * Sync key tracking `${userId}:${token}` to prevent duplicate API requests
 */
let lastSyncedKey = null;
let isSyncInProgress = false;

export const getCachedFcmToken = () => cachedFcmToken;

/**
 * High-importance notification channel ID for heads-up notifications
 */
export const HELPU_NOTIFICATION_CHANNEL_ID = 'helpu_high_importance';

/**
 * Synchronize the current device FCM token with the backend for the authenticated user.
 * Safe to call repeatedly: deduplicates requests using an in-memory sync key.
 *
 * @param {Object} [user] - Clerk user object (defaults to current active user)
 * @returns {Promise<{ synced: boolean, reason?: string, error?: string }>}
 */
export async function syncDeviceTokenWithBackend(user = currentAuthUser) {
  if (user && user.id) {
    currentAuthUser = user;
  }

  const userId = currentAuthUser?.id;
  const token = cachedFcmToken;

  if (!userId) {
    return { synced: false, reason: 'unauthenticated' };
  }

  if (!token) {
    return { synced: false, reason: 'no_cached_fcm_token' };
  }

  const syncKey = `${userId}:${token}`;
  if (lastSyncedKey === syncKey) {
    return { synced: true, reason: 'already_synced' };
  }

  if (isSyncInProgress) {
    return { synced: false, reason: 'sync_in_progress' };
  }

  isSyncInProgress = true;
  const tokenPrefix = token.slice(0, 8) + '...';

  try {
    console.log(`[HelpuPush] Registering device token prefix ${tokenPrefix} for user ${userId}...`);
    const platform = Capacitor.getPlatform() || 'android';
    await registerFcmToken(token, platform);

    lastSyncedKey = syncKey;
    console.log(`[HelpuPush] Successfully registered device token with backend for user ${userId}`);
    return { synced: true };
  } catch (err) {
    console.warn(`[HelpuPush] Non-fatal error registering device token prefix ${tokenPrefix}:`, err.message);
    return { synced: false, error: err.message };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Unregisters the current device FCM token from the backend upon user logout.
 *
 * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string }>}
 */
export async function unregisterDeviceTokenFromBackend() {
  const token = cachedFcmToken;
  if (!token) {
    lastSyncedKey = null;
    currentAuthUser = null;
    return { success: true, skipped: true, reason: 'no_cached_token' };
  }

  const tokenPrefix = token.slice(0, 8) + '...';

  try {
    console.log(`[HelpuPush] Unregistering device token prefix ${tokenPrefix} from backend...`);
    await unregisterFcmToken(token);
    console.log(`[HelpuPush] Successfully unregistered device token from backend`);
    lastSyncedKey = null;
    currentAuthUser = null;
    return { success: true };
  } catch (err) {
    console.warn(`[HelpuPush] Non-fatal warning unregistering device token prefix ${tokenPrefix}:`, err.message);
    lastSyncedKey = null;
    currentAuthUser = null;
    return { success: false, error: err.message };
  }
}

/**
 * Sets or updates the active authenticated user for FCM synchronization.
 * Handles login, token arrival, and logout transitions.
 *
 * @param {Object|null} user - Clerk user object or null on logout
 */
export function setActiveAuthUser(user) {
  if (user && user.id) {
    currentAuthUser = user;
    if (cachedFcmToken) {
      syncDeviceTokenWithBackend(user);
    }
  } else {
    currentAuthUser = null;
    unregisterDeviceTokenFromBackend();
  }
}

/**
 * Initialize Push Notifications for Native Mobile (Android & iOS)
 * Safely no-ops in web / PWA environments.
 */
export async function initPushNotifications({
  navigate,
  onToken,
  onNotificationReceived,
  onNotificationActionPerformed
} = {}) {
  const isNative = Capacitor.isNativePlatform();
  const isPluginReady = Capacitor.isPluginAvailable('PushNotifications');

  console.log(`[HelpuPush] 1. Push notification initialization started. Platform: ${Capacitor.getPlatform()} | isNative: ${isNative} | isPluginAvailable: ${isPluginReady}`);

  // Only execute on native platforms with PushNotifications plugin available
  if (!isNative) {
    console.log('[HelpuPush] Running on browser/web environment; native push notifications skipped.');
    return () => {};
  }

  if (!isPluginReady) {
    console.error('[HelpuPush] ERROR: PushNotifications plugin is NOT available on native platform! Verify Android Gradle sync.');
    return () => {};
  }

  const listenerHandles = [];

  try {
    // 2. Attach listeners FIRST before requesting registration to avoid missing native events
    console.log('[HelpuPush] Attaching registration listeners...');

    // Listener A: Registration Success (FCM Device Token)
    const regHandle = await PushNotifications.addListener('registration', (token) => {
      cachedFcmToken = token?.value || null;
      const tokenPrefix = token?.value ? token.value.slice(0, 8) + '...' : 'none';
      console.log(`[HelpuPush] 4. FCM registration SUCCESS! Token prefix: ${tokenPrefix}`);

      // Dispatch custom event for app components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('helpu-fcm-token-ready', { detail: { tokenPrefix } }));
      }

      // If user is already authenticated, immediately sync device token
      if (currentAuthUser && token?.value) {
        syncDeviceTokenWithBackend(currentAuthUser);
      }

      if (typeof onToken === 'function' && token?.value) {
        onToken(token.value);
      }
    });
    listenerHandles.push(regHandle);

    // Listener B: Registration Error
    const errHandle = await PushNotifications.addListener('registrationError', (error) => {
      console.error('[HelpuPush] 5. FCM registration ERROR:', JSON.stringify(error) || error);
    });
    listenerHandles.push(errHandle);

    // Listener C: Push Notification Received in Foreground
    const recHandle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[HelpuPush] Foreground notification received:', notification.title, notification.body);

      // Trigger beautiful floating in-app popup banner (WhatsApp style)
      try {
        const data = notification.data || {};
        triggerInAppNotification({
          id: notification.id || data.eventId || data.id,
          title: notification.title,
          body: notification.body,
          data,
          type: data.type || 'BOOKING_REQUESTED',
          senderName: data.senderName || data.passengerName || data.ownerName || '',
          senderAvatar: data.senderAvatar || data.passengerImage || data.ownerImage || '',
          targetRoute: data.route || (data.bookingId ? `/bookings/${data.bookingId}` : (data.travelId ? `/rides/${data.travelId}` : '/notifications'))
        });
      } catch (err) {
        console.warn('[HelpuPush] Error displaying foreground in-app banner:', err);
      }

      if (typeof onNotificationReceived === 'function') {
        onNotificationReceived(notification);
      }
    });
    listenerHandles.push(recHandle);

    // Listener D: Push Notification Action Performed (Notification Tapped)
    const actHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[HelpuPush] Notification tapped by user:', action);
      const data = action.notification?.data || {};

      let targetRoute = null;
      if (data.route) {
        targetRoute = data.route;
      } else if (data.url) {
        targetRoute = data.url;
      } else if (data.bookingId) {
        targetRoute = `/bookings/${data.bookingId}`;
      } else if (data.travelId) {
        targetRoute = `/rides/${data.travelId}`;
      } else if (data.type === 'notification') {
        targetRoute = '/notifications';
      }

      if (targetRoute && typeof navigate === 'function') {
        navigate(targetRoute);
      } else if (typeof navigate === 'function') {
        navigate('/notifications');
      }

      if (typeof onNotificationActionPerformed === 'function') {
        onNotificationActionPerformed(action);
      }
    });
    listenerHandles.push(actHandle);

    console.log('[HelpuPush] All 4 push notification listeners successfully attached.');

    // 3. Check and request notification permissions
    console.log('[HelpuPush] 2. Checking notification permissions...');
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[HelpuPush] Initial notification permission status:', permStatus.receive);

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      console.log('[HelpuPush] Prompting user for notification permission...');
      permStatus = await PushNotifications.requestPermissions();
      console.log('[HelpuPush] Post-prompt permission status:', permStatus.receive);
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[HelpuPush] Notification permission NOT granted (status: ' + permStatus.receive + '). Native registration halted.');
      return () => {
        listenerHandles.forEach((h) => h?.remove?.());
      };
    }

    // 4. Create High-Importance Android Notification Channel for Heads-up popups in background
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: HELPU_NOTIFICATION_CHANNEL_ID,
          name: 'HelpU Booking & Ride Alerts',
          description: 'Instant popup alerts for booking requests, confirmations, and ride updates',
          importance: 5, // NotificationManager.IMPORTANCE_HIGH / MAX
          visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#FF572E'
        });
        console.log('[HelpuPush] Android High Importance notification channel created:', HELPU_NOTIFICATION_CHANNEL_ID);
      } catch (channelErr) {
        console.warn('[HelpuPush] Warning creating Android notification channel:', channelErr);
      }
    }

    // 5. Request FCM Device Registration
    console.log('[HelpuPush] 3. Notification permission is granted. Requesting native FCM registration via PushNotifications.register()...');
    await PushNotifications.register();
    console.log('[HelpuPush] PushNotifications.register() dispatched successfully to native Android layer.');

  } catch (err) {
    console.error('[HelpuPush] Initialization error during push setup:', err);
  }

  // Return cleanup function to remove all listeners
  return () => {
    console.log('[HelpuPush] Cleaning up push notification listeners...');
    listenerHandles.forEach((h) => {
      if (h && typeof h.remove === 'function') {
        h.remove();
      }
    });
  };
}
