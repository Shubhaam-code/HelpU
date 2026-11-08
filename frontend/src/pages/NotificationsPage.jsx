import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Bell, CheckCheck, Clock, CheckCircle2, XCircle, Car, AlertCircle, 
  ArrowRight, ShieldCheck, RefreshCw, Sparkles, Filter, Calendar, MessageSquare, ChevronRight, Users
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { markRead, markAllRead, createGroupFromFindMatch } from '../lib/api';
import { timeAgo, formatDateShort, formatMinutesToTime } from '../lib/utils';
import { useNotificationsList, useUnreadNotificationsCount } from '../hooks/useAppData';
import { QUERY_KEYS, invalidateNotificationQueries, invalidateGroupQueries } from '../lib/queryClient';
import { useUser } from '../context/FirebaseAuthContext';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [markingAll, setMarkingAll] = useState(false);
  const [creatingGroupId, setCreatingGroupId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Cached notifications list and unread count via TanStack Query (no repeated full-page loading)
  const { 
    data: notifications = [], 
    isLoading, 
    isFetching, 
    error: fetchError,
    refetch 
  } = useNotificationsList({ limit: 50 });

  const { data: unreadCount = 0 } = useUnreadNotificationsCount();

  // Show skeleton loading ONLY on first visit when no cached data exists yet
  const loading = isLoading && notifications.length === 0;
  const isRefreshing = isFetching && !isLoading;

  // Mark all notifications as read (only when explicitly requested by user)
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      // Optimistically update query cache
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((n) => ({ ...n, isRead: true }));
      });
      queryClient.setQueryData(QUERY_KEYS.unreadCount(user?.id), 0);
      invalidateNotificationQueries();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Handle clicking on a notification item: marks only THIS notification as read and navigates
  const handleNotificationClick = async (notification) => {
    // If not read yet, mark ONLY this notification as read in cache and backend
    if (!notification.isRead) {
      // 1. Optimistic cache update for notifications list
      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n));
      });

      // 2. Optimistic decrement of unread count
      queryClient.setQueryData(QUERY_KEYS.unreadCount(user?.id), (old) => Math.max(0, (old || 1) - 1));
      window.dispatchEvent(new CustomEvent('notifications-updated'));

      // 3. Persist read status in MongoDB backend
      markRead(notification._id).catch((err) => {
        console.error('Failed to persist read status on backend:', err);
      });
    }

    const bookingId = notification.relatedBookingId;
    const travelId = notification.relatedTravelId;
    const groupId = notification.payload?.groupId;

    // Direct routing to group details if notification belongs to a Shared Ride Group
    if (groupId) {
      navigate(`/groups/${groupId}`);
      return;
    }

    // Direct routing to the exact booking details whenever a related booking exists
    if (bookingId) {
      navigate(`/bookings/${bookingId}`);
      return;
    }

    // Fallback to ride details if no booking is linked
    if (travelId) {
      navigate(`/rides/${travelId}`);
      return;
    }

    // Fallback: My Posts page
    navigate('/posts');
  };

  // Direct action: Create Shared Ride Group from a compatible FIND match notification
  const handleCreateGroupFromMatch = async (notification, e) => {
    if (e) e.stopPropagation();
    const originatingTravelId = notification.relatedTravelId;
    const candidateTravelId = notification.payload?.candidateTravelId || notification.payload?.initiatorTravelId;

    if (!originatingTravelId || !candidateTravelId) {
      navigate('/shared-rides');
      return;
    }

    setCreatingGroupId(notification._id);
    setActionError(null);
    try {
      const res = await createGroupFromFindMatch({
        originatingTravelId,
        candidateTravelId
      });
      invalidateGroupQueries();
      const group = res.data?.data?.group || res.data?.group;
      if (group?._id) {
        if (!notification.isRead) {
          markRead(notification._id).catch(() => {});
        }
        navigate(`/groups/${group._id}`);
      } else {
        navigate('/shared-rides');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create group';
      setActionError({ notifId: notification._id, message: msg });
    } finally {
      setCreatingGroupId(null);
    }
  };

  // Filter tab counts
  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter((n) => !n.isRead).length,
      read: notifications.filter((n) => n.isRead).length,
    };
  }, [notifications]);

  // Filtered notifications based on active filter tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.isRead;
      if (activeFilter === 'read') return n.isRead;
      return true; // 'all'
    });
  }, [notifications, activeFilter]);

  // Icon, color scheme, and action label based on notification type
  const getNotificationVisuals = (type) => {
    const t = (type || '').toUpperCase();

    if (t.includes('REQUESTED') || t.includes('CONTACTED')) {
      return {
        icon: Users,
        iconBg: 'bg-[#FFF4ED]',
        iconColor: 'text-[#FF572E]',
        badgeBg: 'bg-[#FFF4ED]',
        badgeColor: 'text-[#FF572E]',
        badgeText: 'New Ride Request',
        actionLabel: 'View Coordination',
      };
    }

    if (t.includes('CONFIRM')) {
      return {
        icon: CheckCircle2,
        iconBg: 'bg-[#EDFAF3]',
        iconColor: 'text-[#16A34A]',
        badgeBg: 'bg-[#EDFAF3]',
        badgeColor: 'text-[#16A34A]',
        badgeText: 'Booking Confirmed',
        actionLabel: 'View Ride Ticket',
      };
    }

    if (t.includes('CANCELLED_BY_PASSENGER')) {
      return {
        icon: XCircle,
        iconBg: 'bg-[#FEF2F2]',
        iconColor: 'text-[#DC2626]',
        badgeBg: 'bg-[#FEF2F2]',
        badgeColor: 'text-[#DC2626]',
        badgeText: 'Passenger Cancelled',
        actionLabel: 'View Details',
      };
    }

    if (t.includes('CANCELLED_BY_OWNER')) {
      return {
        icon: XCircle,
        iconBg: 'bg-[#FEF2F2]',
        iconColor: 'text-[#DC2626]',
        badgeBg: 'bg-[#FEF2F2]',
        badgeColor: 'text-[#DC2626]',
        badgeText: 'Ride Cancelled',
        actionLabel: 'View Details',
      };
    }

    if (t.includes('REMINDER_24H') || t.includes('REMINDER_1H') || t.includes('REMIND')) {
      return {
        icon: Clock,
        iconBg: 'bg-[#FFF8E7]',
        iconColor: 'text-[#D97706]',
        badgeBg: 'bg-[#FFF8E7]',
        badgeColor: 'text-[#D97706]',
        badgeText: t.includes('1H') ? 'Departing in 1 Hour' : 'Ride Tomorrow (24h)',
        actionLabel: 'View Departure',
      };
    }

    if (t === 'COMPATIBLE_FIND_MATCH') {
      return {
        icon: Users,
        iconBg: 'bg-[#FFF4ED]',
        iconColor: 'text-[#FF572E]',
        badgeBg: 'bg-[#FFF4ED]',
        badgeColor: 'text-[#FF572E]',
        badgeText: 'Compatible FIND Match',
        actionLabel: 'Create Group',
      };
    }

    if (t === 'GROUP_INVITATION_RECEIVED') {
      return {
        icon: Car,
        iconBg: 'bg-[#FFF4ED]',
        iconColor: 'text-[#FF572E]',
        badgeBg: 'bg-[#FFF4ED]',
        badgeColor: 'text-[#FF572E]',
        badgeText: 'Group Invitation',
        actionLabel: 'View Group',
      };
    }

    if (t.includes('MATCH')) {
      return {
        icon: Sparkles,
        iconBg: 'bg-[#FFF4ED]',
        iconColor: 'text-[#FF572E]',
        badgeBg: 'bg-[#FFF4ED]',
        badgeColor: 'text-[#FF572E]',
        badgeText: 'New Ride Match',
        actionLabel: 'View Match',
      };
    }

    if (t.includes('ACCEPTED')) {
      return {
        icon: CheckCircle2,
        iconBg: 'bg-[#EDFAF3]',
        iconColor: 'text-[#16A34A]',
        badgeBg: 'bg-[#EDFAF3]',
        badgeColor: 'text-[#16A34A]',
        badgeText: 'Request Accepted',
        actionLabel: 'View Booking',
      };
    }

    if (t.includes('REJECTED')) {
      return {
        icon: XCircle,
        iconBg: 'bg-[#FEF2F2]',
        iconColor: 'text-[#DC2626]',
        badgeBg: 'bg-[#FEF2F2]',
        badgeColor: 'text-[#DC2626]',
        badgeText: 'Request Declined',
        actionLabel: 'Find Rides',
      };
    }

    if (t.includes('WITHDRAWN')) {
      return {
        icon: AlertCircle,
        iconBg: 'bg-[#F8FAFC]',
        iconColor: 'text-[#64748B]',
        badgeBg: 'bg-[#F1F5F9]',
        badgeColor: 'text-[#64748B]',
        badgeText: 'Request Withdrawn',
        actionLabel: 'View Post',
      };
    }

    if (t.includes('UPDATED')) {
      return {
        icon: Car,
        iconBg: 'bg-[#FFF8E7]',
        iconColor: 'text-[#D97706]',
        badgeBg: 'bg-[#FFF8E7]',
        badgeColor: 'text-[#D97706]',
        badgeText: 'Ride Updated',
        actionLabel: 'View Changes',
      };
    }

    if (t.includes('EXPIRED')) {
      return {
        icon: Clock,
        iconBg: 'bg-[#F8FAFC]',
        iconColor: 'text-[#64748B]',
        badgeBg: 'bg-[#F1F5F9]',
        badgeColor: 'text-[#64748B]',
        badgeText: 'Ride Expired',
        actionLabel: 'View Post',
      };
    }

    // Default Fallback
    return {
      icon: Bell,
      iconBg: 'bg-[#FFF4ED]',
      iconColor: 'text-[#FF572E]',
      badgeBg: 'bg-[#FFF4ED]',
      badgeColor: 'text-[#FF572E]',
      badgeText: 'Helpu Alert',
      actionLabel: 'View Notification',
    };
  };

  const filterTabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'unread', label: 'Unread', count: counts.unread },
    { id: 'read', label: 'Read', count: counts.read },
  ];

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      unreadCount={unreadCount}
      customMobileHeader={
        <AppHeader
          title="Notifications"
          backTo="/home"
          unreadCount={unreadCount}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-3 pb-16 sm:pt-6 space-y-4">
        
        {/* ========================================================================= */}
        {/* HEADER: TITLE, UNREAD BADGE & ACTIONS                                     */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                Notification Center
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FF572E] text-white text-xs font-black shadow-2xs">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#6E7587] mt-0.5">
              Your ride connections, booking updates and travel reminders.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] hover:text-[#FF572E] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className={`w-4 h-4 text-[#FF572E] ${markingAll ? 'animate-pulse' : ''}`} />
                <span>Mark all as read</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF572E]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FILTER BAR                                                                */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-[#F4E3D8]/90 shadow-2xs overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            {filterTabs.map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#17233C] text-white shadow-xs font-black'
                      : 'bg-transparent text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFFBF8]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[#FFF4ED] text-[#FF572E]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NOTIFICATIONS LIST / LOADING / ERROR / EMPTY STATES                       */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border border-[#F4E3D8] animate-pulse flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError && notifications.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-red-200 max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#17233C]">Unable to Load Notifications</h3>
              <p className="text-xs text-red-600 mt-1">{fetchError?.message || 'Failed to retrieve notifications.'}</p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-5 py-2 bg-[#FF572E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 sm:p-12 text-center border border-[#F4E3D8] shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto text-2xl shadow-2xs">
              <Bell className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-[#17233C]">
                {activeFilter === 'all'
                  ? "You're all caught up! 🎉"
                  : activeFilter === 'unread'
                  ? "No unread notifications"
                  : "No read notifications"}
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-1 max-w-xs mx-auto leading-relaxed">
                {activeFilter === 'all'
                  ? "New ride connections and travel updates will appear here."
                  : activeFilter === 'unread'
                  ? "All your notifications have been read."
                  : "You haven't read any notifications yet."}
              </p>
            </div>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="px-4 py-2 bg-[#FFF4ED] hover:bg-[#FFE8DC] text-[#FF572E] font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                View All Notifications
              </button>
            )}
          </div>
        ) : (
          /* Clean Notification Cards (No tick/checkmark icon anywhere) */
          <div className="space-y-2.5">
            {filteredNotifications.map((n) => {
              const visuals = getNotificationVisuals(n.type);
              const IconComponent = visuals.icon;

              return (
                <motion.div
                  key={n._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleNotificationClick(n)}
                  className={`bg-white rounded-2xl p-4 sm:p-4.5 border transition-all cursor-pointer relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-sm hover:border-[#FF572E]/40 ${
                    n.isRead
                      ? 'border-[#F4E3D8]/80 text-[#6E7587]'
                      : 'border-[#FF572E]/35 bg-gradient-to-r from-white via-white to-[#FFFBF8] shadow-2xs ring-1 ring-[#FF572E]/10'
                  }`}
                >
                  {/* Left: Icon & Notification Content */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Icon container */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${visuals.iconBg} ${visuals.iconColor}`}
                    >
                      <IconComponent className="w-5 h-5 stroke-[2.2]" />
                    </div>

                    {/* Content */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${visuals.badgeBg} ${visuals.badgeColor}`}
                        >
                          {visuals.badgeText}
                        </span>

                        <span className="text-[11px] text-[#A0A6B5] font-medium">
                          {timeAgo(n.createdAt)}
                        </span>

                        {/* Proper Read / Unread Status Indicator (No tick icon) */}
                        {!n.isRead ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#FF572E] ring-2 ring-white shrink-0 animate-pulse" />
                            <span className="px-2 py-0.2 rounded-full text-[9.5px] font-black bg-[#FFF0E6] text-[#FF572E] border border-[#FFD9C7] shrink-0">
                              Unread
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-[#F1F5F9] text-[#64748B] shrink-0">
                            Read
                          </span>
                        )}
                      </div>

                      {/* Notification Title */}
                      <h4
                        className={`text-sm sm:text-base font-extrabold truncate ${
                          n.isRead ? 'text-[#17233C]/80' : 'text-[#17233C]'
                        }`}
                      >
                        {n.title || visuals.badgeText}
                      </h4>

                      {/* Notification Message */}
                      <p className="text-xs text-[#555E70] leading-relaxed line-clamp-2">
                        {n.message}
                      </p>

                      {/* Rich details for Compatible FIND match */}
                      {n.type === 'COMPATIBLE_FIND_MATCH' && n.payload && (
                        <div className="mt-2.5 p-3 rounded-xl bg-[#FFF9F5] border border-[#FDE0D0] text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#FFEAE0] text-[#FF572E] font-black flex items-center justify-center text-[10px] shrink-0 uppercase">
                                {(n.payload.candidateName || n.payload.initiatorName || 'S').charAt(0)}
                              </div>
                              <span className="font-extrabold text-[#17233C]">
                                {n.payload.candidateName || n.payload.initiatorName || 'Campus Student'}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-[#FDE0D0] text-[10px] font-bold text-[#FF572E]">
                              Active Match
                            </span>
                          </div>

                          {(n.payload.source || n.payload.destination) && (
                            <div className="text-[11px] font-bold text-[#475569] flex items-center gap-1.5 flex-wrap">
                              <span>{n.payload.source}</span>
                              <span>→</span>
                              <span>{n.payload.destination}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-[#64748B] flex-wrap">
                            {n.payload.travelDate && (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Calendar className="w-3 h-3 text-[#FF572E]" />
                                {formatDateShort(n.payload.travelDate)}
                              </span>
                            )}
                            {typeof n.payload.departureTime === 'number' && (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Clock className="w-3 h-3 text-[#FF572E]" />
                                {formatMinutesToTime(n.payload.departureTime)}
                              </span>
                            )}
                          </div>

                          {actionError?.notifId === n._id && (
                            <div className="text-[11px] text-red-600 font-semibold bg-red-50 p-1.5 rounded-lg border border-red-100">
                              {actionError.message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Clean Action button */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-13 sm:pl-0">
                    {n.type === 'COMPATIBLE_FIND_MATCH' ? (
                      <button
                        type="button"
                        disabled={creatingGroupId === n._id}
                        onClick={(e) => handleCreateGroupFromMatch(n, e)}
                        className="px-3.5 py-1.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 shadow-2xs disabled:opacity-50"
                      >
                        {creatingGroupId === n._id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <span>Create Group</span>
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationClick(n);
                        }}
                        className="px-3.5 py-1.5 bg-[#FFF4ED] hover:bg-[#FFE8DC] text-[#FF572E] text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                      >
                        <span>{visuals.actionLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}
