import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { initPushNotifications } from './pushNotifications';

/**
 * Check if running inside a native Capacitor shell (Android or iOS)
 */
export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Initialize Mobile Native Behaviors (StatusBar, Keyboard, Splash, Back Button)
 * Safe to call on web/PWA — will gracefully no-op.
 */
export function initMobileNativeBridge({ navigate }) {
  if (!isNativeApp()) {
    return () => {};
  }

  console.log('[Helpu Native] Mobile bridge initialized for platform:', Capacitor.getPlatform());
  console.log('[HelpuPush] Initializing push notifications via mobile bridge...');

  // 1. Configure Status Bar
  try {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setStyle({ style: Style.Light }).catch(() => {}); // dark icons on light background
    StatusBar.setBackgroundColor({ color: '#FFF8F3' }).catch(() => {});
  } catch (err) {
    console.warn('[Helpu Native] StatusBar init warning:', err);
  }

  // 2. Hide Splash Screen smoothly once UI is mounted
  try {
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
  } catch (err) {
    console.warn('[Helpu Native] SplashScreen hide warning:', err);
  }

  // 3. Android Hardware Back Button listener
  let backListenerRemove = null;
  try {
    const handleBackButton = ({ canGoBack }) => {
      const currentPath = window.location.pathname;
      const rootPaths = ['/', '/home', '/auth', '/login', '/signup'];

      // If at root routes, let user exit the app
      if (rootPaths.includes(currentPath)) {
        CapApp.exitApp();
        return;
      }

      // If can go back in browser history, navigate back
      if (canGoBack || window.history.length > 1) {
        if (navigate) {
          navigate(-1);
        } else {
          window.history.back();
        }
      } else {
        CapApp.exitApp();
      }
    };

    CapApp.addListener('backButton', handleBackButton).then((listener) => {
      backListenerRemove = () => listener.remove();
    });
  } catch (err) {
    console.warn('[Helpu Native] Back button listener warning:', err);
  }

  // 4. Keyboard appearance listener (toggle body class for CSS adjustments)
  let kbShowRemove = null;
  let kbHideRemove = null;
  try {
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.classList.add('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    }).then((l) => { kbShowRemove = () => l.remove(); });

    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    }).then((l) => { kbHideRemove = () => l.remove(); });
  } catch (err) {
    console.warn('[Helpu Native] Keyboard listener warning:', err);
  }

  // 5. Native Push Notifications initialization & listeners
  let pushCleanup = null;
  initPushNotifications({ navigate }).then((cleanupFn) => {
    pushCleanup = cleanupFn;
  }).catch((err) => {
    console.warn('[Helpu Native] Push notification bridge error:', err);
  });

  // 6. Deep link listener (OAuth & custom scheme callbacks)
  let appUrlRemove = null;
  try {
    CapApp.addListener('appUrlOpen', (event) => {
      console.log('[Helpu Native] appUrlOpen received:', event.url);
      if (!event?.url) return;

      try {
        const rawUrl = event.url;

        // Custom scheme OAuth callback from Clerk (e.g. com.helpu.app://callback?...)
        if (rawUrl.startsWith('com.helpu.app://callback') || rawUrl.startsWith('helpu://callback')) {
          const queryStartIndex = rawUrl.indexOf('?');
          const hashStartIndex = rawUrl.indexOf('#');
          let queryAndHash = '';
          if (queryStartIndex !== -1) {
            queryAndHash = rawUrl.substring(queryStartIndex);
          } else if (hashStartIndex !== -1) {
            queryAndHash = rawUrl.substring(hashStartIndex);
          }
          const targetUrl = '/callback' + queryAndHash;
          console.log('[Helpu Native] Routing OAuth callback to:', targetUrl);
          window.history.replaceState({}, '', targetUrl);
          if (navigate) {
            navigate(targetUrl, { replace: true });
          }
          return;
        }

        const parsedUrl = new URL(event.url);
        const search = parsedUrl.search || '';
        const hash = parsedUrl.hash || '';
        const pathname = parsedUrl.pathname || '/home';

        if (search && search.includes('__clerk_handshake')) {
          console.log('[Helpu Native] Handshake query param detected in deep link URL.');
          window.history.replaceState({}, '', pathname + search + hash);
          if (navigate) {
            navigate(pathname + search, { replace: true });
          }
        } else if (navigate) {
          navigate(pathname || '/home');
        }
      } catch (e) {
        console.warn('[Helpu Native] Error parsing appUrlOpen URL:', e);
      }
    }).then((l) => { appUrlRemove = () => l.remove(); });
  } catch (err) {
    console.warn('[Helpu Native] appUrlOpen listener warning:', err);
  }

  // 7. App resume & state change listener (re-evaluates auth when returning from external browser)
  let stateChangeRemove = null;
  try {
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Helpu Native] App resumed to foreground.');
        try {
          const authPaths = ['/auth', '/login', '/signup', '/'];
          if (authPaths.includes(window.location.pathname) && (window.Clerk?.session || window.Clerk?.user)) {
            console.log('[Helpu Native] Active Clerk session on resume, navigating to /home');
            if (navigate) {
              navigate('/home', { replace: true });
            }
          }
        } catch (_) {}
      }
    }).then((l) => { stateChangeRemove = () => l.remove(); });
  } catch (err) {
    console.warn('[Helpu Native] appStateChange listener warning:', err);
  }

  return () => {
    if (backListenerRemove) backListenerRemove();
    if (kbShowRemove) kbShowRemove();
    if (kbHideRemove) kbHideRemove();
    if (pushCleanup) pushCleanup();
    if (appUrlRemove) appUrlRemove();
    if (stateChangeRemove) stateChangeRemove();
  };
}

