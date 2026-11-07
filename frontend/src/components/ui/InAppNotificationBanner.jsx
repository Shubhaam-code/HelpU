import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Bell,
  X,
  ChevronRight,
  Car
} from 'lucide-react';
import { Avatar } from './Avatar';

// Global Event Name for triggering in-app banner
export const HELPU_IN_APP_POPUP_EVENT = 'helpu-in-app-popup';

// Deduplication store with 30s TTL
const recentEventCache = new Map();

/**
 * Dispatch an in-app popup banner from anywhere (Capacitor FCM listener, Socket.IO, API)
 */
export function triggerInAppNotification({
  id,
  title,
  body,
  message,
  type = 'BOOKING_REQUESTED',
  data = {},
  senderName,
  senderAvatar,
  targetRoute,
  duration = 6000
} = {}) {
  const eventId = id || data?.eventId || data?.id || `${title}-${body}-${Date.now()}`;
  
  // Deduplicate against recent events within 30 seconds
  const now = Date.now();
  if (recentEventCache.has(eventId)) {
    const lastSeen = recentEventCache.get(eventId);
    if (now - lastSeen < 30000) {
      console.log('[HelpuPopup] Ignored duplicate notification banner:', eventId);
      return;
    }
  }
  recentEventCache.set(eventId, now);

  // Prune old deduplication cache entries
  for (const [key, timestamp] of recentEventCache.entries()) {
    if (now - timestamp > 60000) {
      recentEventCache.delete(key);
    }
  }

  const detail = {
    id: eventId,
    title: title || 'New Notification',
    body: body || message || '',
    type,
    data,
    senderName: senderName || data?.senderName || data?.passengerName || data?.ownerName || '',
    senderAvatar: senderAvatar || data?.senderAvatar || data?.passengerImage || data?.ownerImage || '',
    targetRoute: targetRoute || resolveTargetRoute(data, type),
    duration
  };

  window.dispatchEvent(new CustomEvent(HELPU_IN_APP_POPUP_EVENT, { detail }));
}

/**
 * Helper to resolve appropriate target navigation route
 */
function resolveTargetRoute(data = {}, type = '') {
  if (data?.route) return data.route;
  if (data?.url) return data.url;
  if (data?.bookingId) return `/bookings/${data.bookingId}`;
  if (data?.relatedBookingId) return `/bookings/${data.relatedBookingId}`;
  if (data?.travelId) return `/rides/${data.travelId}`;
  if (data?.relatedTravelId) return `/rides/${data.relatedTravelId}`;

  const t = (type || '').toUpperCase();
  if (t.includes('MATCH')) return '/matches';
  if (t.includes('BOOKING')) return '/bookings';
  return '/notifications';
}

/**
 * Visual styling configuration for various notification types
 */
function getBannerVisuals(type = '') {
  const t = (type || '').toUpperCase();

  if (t.includes('REQUESTED') || t.includes('CONTACTED')) {
    return {
      icon: Users,
      badgeText: 'New Ride Request',
      badgeBg: 'bg-[#FFF4ED]',
      badgeColor: 'text-[#FF572E]',
      actionLabel: 'View Request',
      borderColor: 'border-[#FF572E]/30',
      accentColor: '#FF572E'
    };
  }

  if (t.includes('CONFIRM')) {
    return {
      icon: CheckCircle2,
      badgeText: 'Booking Confirmed',
      badgeBg: 'bg-[#EDFAF3]',
      badgeColor: 'text-[#16A34A]',
      actionLabel: 'View Ticket',
      borderColor: 'border-[#16A34A]/30',
      accentColor: '#16A34A'
    };
  }

  if (t.includes('ACCEPTED')) {
    return {
      icon: CheckCircle2,
      badgeText: 'Booking Accepted',
      badgeBg: 'bg-[#EDFAF3]',
      badgeColor: 'text-[#16A34A]',
      actionLabel: 'Confirm Seat',
      borderColor: 'border-[#16A34A]/30',
      accentColor: '#16A34A'
    };
  }

  if (t.includes('WITHDRAW')) {
    return {
      icon: XCircle,
      badgeText: 'Request Withdrawn',
      badgeBg: 'bg-[#FFF4ED]',
      badgeColor: 'text-[#FF572E]',
      actionLabel: 'View Ride',
      borderColor: 'border-[#FF572E]/30',
      accentColor: '#FF572E'
    };
  }

  if (t.includes('UPDATE')) {
    return {
      icon: Clock,
      badgeText: 'Ride Updated',
      badgeBg: 'bg-[#FFF8E7]',
      badgeColor: 'text-[#D97706]',
      actionLabel: 'View Changes',
      borderColor: 'border-[#D97706]/30',
      accentColor: '#D97706'
    };
  }

  if (t.includes('EXPIRE')) {
    return {
      icon: Clock,
      badgeText: 'Ride Expired',
      badgeBg: 'bg-[#F3F4F6]',
      badgeColor: 'text-[#6B7280]',
      actionLabel: 'View Post',
      borderColor: 'border-[#9CA3AF]/30',
      accentColor: '#6B7280'
    };
  }

  if (t.includes('REJECTED')) {
    return {
      icon: XCircle,
      badgeText: 'Request Declined',
      badgeBg: 'bg-[#FEF2F2]',
      badgeColor: 'text-[#DC2626]',
      actionLabel: 'Find Rides',
      borderColor: 'border-[#DC2626]/30',
      accentColor: '#DC2626'
    };
  }

  if (t.includes('CANCEL')) {
    return {
      icon: XCircle,
      badgeText: 'Booking Cancelled',
      badgeBg: 'bg-[#FEF2F2]',
      badgeColor: 'text-[#DC2626]',
      actionLabel: 'View Details',
      borderColor: 'border-[#DC2626]/30',
      accentColor: '#DC2626'
    };
  }

  if (t.includes('MATCH')) {
    return {
      icon: Sparkles,
      badgeText: 'New Ride Match',
      badgeBg: 'bg-[#F5F3FF]',
      badgeColor: 'text-[#7C3AED]',
      actionLabel: 'View Match',
      borderColor: 'border-[#7C3AED]/30',
      accentColor: '#7C3AED'
    };
  }

  if (t.includes('REMIND')) {
    return {
      icon: Clock,
      badgeText: 'Ride Reminder',
      badgeBg: 'bg-[#FFF8E7]',
      badgeColor: 'text-[#D97706]',
      actionLabel: 'View Ride',
      borderColor: 'border-[#D97706]/30',
      accentColor: '#D97706'
    };
  }

  return {
    icon: Bell,
    badgeText: 'Helpu Alert',
    badgeBg: 'bg-[#FFF4ED]',
    badgeColor: 'text-[#FF572E]',
    actionLabel: 'View',
    borderColor: 'border-[#FF572E]/20',
    accentColor: '#FF572E'
  };
}

/**
 * In-App Popup Banner Component (like WhatsApp heads-up banner)
 * Renders in foreground when app is active.
 */
export function InAppNotificationBanner() {
  const navigate = useNavigate();
  const [currentNotif, setCurrentNotif] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentNotif(null);
  }, []);

  // Handle incoming notification events
  useEffect(() => {
    const handlePopupEvent = (e) => {
      const notif = e.detail;
      if (!notif) return;
      setCurrentNotif(notif);
    };

    window.addEventListener(HELPU_IN_APP_POPUP_EVENT, handlePopupEvent);
    return () => {
      window.removeEventListener(HELPU_IN_APP_POPUP_EVENT, handlePopupEvent);
    };
  }, []);

  // Auto-dismiss timer (pauses on hover/touch)
  useEffect(() => {
    if (!currentNotif || isPaused) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const ms = currentNotif.duration || 6000;
    timerRef.current = setTimeout(() => {
      dismiss();
    }, ms);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentNotif, isPaused, dismiss]);

  // Handle tap on banner or button
  const handleBannerClick = () => {
    if (!currentNotif) return;
    const route = currentNotif.targetRoute || '/notifications';
    dismiss();
    navigate(route);
  };

  if (!currentNotif) return null;

  const visuals = getBannerVisuals(currentNotif.type);
  const IconComponent = visuals.icon;
  const senderName = currentNotif.senderName;
  const avatarUrl = currentNotif.senderAvatar;

  return (
    <AnimatePresence>
      {currentNotif && (
        <motion.div
          key={currentNotif.id}
          initial={{ y: -80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -20) {
              dismiss();
            }
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          className="fixed top-2 sm:top-4 inset-x-2 sm:inset-x-auto sm:right-6 sm:max-w-md z-[99999] cursor-pointer select-none"
          style={{
            paddingTop: 'max(0.25rem, env(safe-area-inset-top, 0px))'
          }}
        >
          <div
            onClick={handleBannerClick}
            className={`w-full bg-white/98 backdrop-blur-md rounded-2xl p-3.5 border ${visuals.borderColor} shadow-[0_12px_32px_rgba(23,35,60,0.18)] flex items-start gap-3 transition-transform active:scale-[0.98]`}
          >
            {/* Left: Avatar or Type Icon */}
            <div className="shrink-0 relative">
              {avatarUrl || senderName ? (
                <div className="relative">
                  <Avatar
                    src={avatarUrl}
                    name={senderName || 'Helpu User'}
                    size="md"
                    ring={true}
                    className="w-11 h-11"
                  />
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${visuals.badgeBg} ${visuals.badgeColor} flex items-center justify-center border-2 border-white shadow-xs`}
                  >
                    <IconComponent className="w-2.5 h-2.5" />
                  </div>
                </div>
              ) : (
                <div
                  className={`w-11 h-11 rounded-full ${visuals.badgeBg} ${visuals.badgeColor} flex items-center justify-center shadow-xs`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Middle: Content */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${visuals.badgeBg} ${visuals.badgeColor}`}
                >
                  {visuals.badgeText}
                </span>
                <span className="text-[10px] text-[#8A786B] font-medium">Just now</span>
              </div>

              {/* Title & Sender */}
              <h4 className="text-xs sm:text-sm font-black text-[#17233C] leading-snug line-clamp-1">
                {currentNotif.title}
              </h4>

              {/* Message Body */}
              {currentNotif.body && (
                <p className="text-xs text-[#5D6B82] leading-tight line-clamp-2 mt-0.5">
                  {currentNotif.body}
                </p>
              )}

              {/* Action Prompt */}
              <div className="flex items-center gap-1.5 mt-2 text-[#FF572E] text-xs font-bold hover:underline">
                <span>{visuals.actionLabel}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Right: Dismiss Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss();
              }}
              className="p-1 rounded-full text-[#8A786B] hover:text-[#17233C] hover:bg-[#FFF4ED] transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Development testing helper (accessible via browser console or debugging)
if (typeof window !== 'undefined') {
  window.__testHelpuPopup = (type = 'BOOKING_REQUESTED') => {
    triggerInAppNotification({
      title: type === 'BOOKING_REQUESTED' ? 'Rahul Sharma' : 'Booking Confirmed!',
      body: type === 'BOOKING_REQUESTED' ? 'Requested 2 seats • Bhopal to Indore' : 'Your ride from Campus to Railway Station is confirmed!',
      type,
      senderName: 'Rahul Sharma',
      data: { type, bookingId: 'sample' }
    });
  };
}

