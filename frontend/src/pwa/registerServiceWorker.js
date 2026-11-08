import { Capacitor } from '@capacitor/core';

/**
 * PWA Service Worker Registration & Lifecycle Manager
 * Active only on Web / PWA environments; safely skipped in native Capacitor apps.
 */
export function registerServiceWorker() {
  if (Capacitor.isNativePlatform()) {
    console.log('[Helpu Native] Running in native app shell; service worker skipped.');
    return;
  }

  // During local development on localhost/127.0.0.1, skip service worker to avoid stale asset cache & HMR issues
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
    }
    return;
  }

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[Helpu PWA] Service Worker registered with scope:', registration.scope);

          // Check for service worker updates periodically
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[Helpu PWA] New content is available; please refresh.');
                    window.dispatchEvent(new CustomEvent('pwa-update-available'));
                  } else {
                    console.log('[Helpu PWA] Content is cached for offline use.');
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[Helpu PWA] Service Worker registration failed:', error);
        });
    });
  }
}

