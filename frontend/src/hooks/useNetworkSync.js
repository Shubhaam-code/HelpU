/**
 * useNetworkSync — Capacitor + Web network status listener.
 *
 * On network reconnect:
 *  - Silently revalidates stale public queries (rides, community posts)
 *  - Does NOT force-refetch everything (avoids hammering the server)
 *
 * Uses @capacitor/network for native Android network events.
 * Falls back to browser navigator.onLine events for PWA/web.
 *
 * Call this hook ONCE at the app level (inside App.jsx or a wrapper component).
 */
import { useEffect } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { queryClient } from '../lib/queryClient';

export function useNetworkSync() {
  useEffect(() => {
    // Handler: called whenever network comes back online
    function handleOnline() {
      console.log('[HelpuCache] Network reconnected — revalidating stale public queries.');
      // Only invalidate public data that benefits from fresh data on reconnect.
      // Bookings/seats always go to server per request so no need to bulk-invalidate.
      queryClient.invalidateQueries({
        queryKey: ['travels'],
        refetchType: 'active', // only refetch if currently mounted/active
      });
      queryClient.invalidateQueries({
        queryKey: ['community'],
        refetchType: 'active',
      });
    }

    let capacitorListener = null;

    if (Capacitor.isNativePlatform()) {
      // Native Android: use Capacitor Network plugin
      Network.addListener('networkStatusChange', (status) => {
        if (status.connected) {
          handleOnline();
        }
      }).then((listener) => {
        capacitorListener = listener;
      });
    } else {
      // Web/PWA: use browser events
      window.addEventListener('online', handleOnline);
    }

    return () => {
      if (capacitorListener) {
        capacitorListener.remove();
      } else {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, []);
}
