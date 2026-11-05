import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 inset-x-0 z-[100] bg-[#17233C] text-white px-4 py-2.5 text-xs font-bold shadow-lg flex items-center justify-between border-b border-[#FF572E]/40"
        >
          <div className="flex items-center gap-2 max-w-xl mx-auto w-full justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#FF572E] animate-ping shrink-0" />
              <WifiOff className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
              <span className="truncate">
                You are offline. Showing cached campus views.
              </span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-extrabold text-[#FFF0E6] shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        </motion.div>
      )}

      {isOnline && showReconnected && (
        <motion.div
          key="online-banner"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 inset-x-0 z-[100] bg-[#16A34A] text-white px-4 py-2 text-xs font-bold shadow-lg flex items-center justify-center gap-2"
        >
          <Wifi className="w-3.5 h-3.5 shrink-0" />
          <span>Back online! Synchronizing latest campus rides and matches.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
