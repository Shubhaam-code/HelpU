import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIDBPersister } from './lib/idbPersister';
import { queryClient } from './lib/queryClient';
import { FirebaseAuthProvider } from './context/FirebaseAuthContext';
import './index.css';
import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerServiceWorker';

// Register PWA service worker
registerServiceWorker();

// Suppress accidental long-press Android context menu & selection popups on non-input UI elements
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    const tag = e.target?.tagName?.toUpperCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.target?.isContentEditable) {
      e.preventDefault();
    }
  });
}

console.log('[HelpuPush] 0. Web app mounted inside Capacitor WebView.');

// IndexedDB persister — survives Android app restart
// Only caches NON-sensitive public data (rides, slot posts, home listings)
// Sensitive data (bookings, profile, notifications) is kept in-memory only
const idbPersister = createIDBPersister('helpu-query-cache-v1');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours — matches public listing gcTime
        buster: '1.0.0',             // bump this string on breaking schema changes to bust old cache
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key)) return false;
            const root = key[0];
            // ✅ Persist: public ride listings and SlotMate posts (non-sensitive)
            if (root === 'travels') return true;
            // ✅ Persist: community posts
            if (root === 'community') return true;
            // ✅ Persist: FFCS courses cache
            if (root === 'ffcs') return true;
            // ❌ Do NOT persist: private/sensitive data
            // bookings, profile, notifications, groups are excluded
            return false;
          },
        },
      }}
    >
      <FirebaseAuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FirebaseAuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
