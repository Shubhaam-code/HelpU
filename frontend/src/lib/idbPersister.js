/**
 * IndexedDB Persister for TanStack Query v5
 * Uses idb-keyval for a lightweight key-value IDB store.
 *
 * This persister enables the query cache to survive:
 *  - Android app restarts (Capacitor WebView memory clear)
 *  - PWA background kills
 *  - Browser tab closures
 *
 * Only NON-SENSITIVE public queries are persisted (filtered in main.jsx via
 * shouldDehydrateQuery). Sensitive data (bookings, profile, notifications)
 * is kept in-memory only.
 */
import { get, set, del } from 'idb-keyval';

/**
 * Creates an IDB persister compatible with @tanstack/react-query-persist-client v5.
 * @param {string} idbValidKey - The IDB store key (use a versioned string to bust old cache)
 */
export function createIDBPersister(idbValidKey = 'reactQuery') {
  return {
    persistClient: async (client) => {
      try {
        await set(idbValidKey, client);
      } catch (err) {
        // IDB write failure is non-fatal — app continues without persistence
        console.warn('[HelpuCache] IDB persistClient failed:', err);
      }
    },
    restoreClient: async () => {
      try {
        return await get(idbValidKey);
      } catch (err) {
        console.warn('[HelpuCache] IDB restoreClient failed:', err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(idbValidKey);
      } catch (err) {
        console.warn('[HelpuCache] IDB removeClient failed:', err);
      }
    },
  };
}
