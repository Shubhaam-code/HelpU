import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, CheckCheck, Clock, CheckCircle2, XCircle, Car, AlertCircle, 
  ArrowRight, ShieldCheck, RefreshCw, Sparkles, Filter, Calendar, MessageSquare, ChevronRight, Check, Users
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../lib/api';
import { timeAgo } from '../lib/utils';

export default function NotificationsPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch notifications and unread count
  const fetchNotificationsData = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const [notifsRes, countRes] = await Promise.allSettled([
        getNotifications({ page: pageNum, limit: 20 }),
        getUnreadCount()
      ]);

      if (notifsRes.status === 'fulfilled') {
        const data = notifsRes.value?.data || {};
        const items = data.data || [];
        setNotifications((prev) => (append ? [...prev, ...items] : items));
        setHasMore(data.page < data.totalPages);
        setPage(data.page || pageNum);
      } else {
        throw new Error(notifsRes.reason?.response?.data?.message || 'Failed to load notifications');
      }

      if (countRes.status === 'fulfilled') {
        setUnreadCount(countRes.value?.data?.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationsData(1, false);
  }, [fetchNotificationsData]);

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Mark single notification as read
  const handleMarkOneRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Handle clicking on a notification item: navigate to the appropriate target
  const handleNotificationClick = (notification) => {
    // If not read yet, mark it as read
    if (!notification.isRead) {
      handleMarkOneRead(notification._id);
    }

    const type = notification.type || '';
    const bookingId = notification.relatedBookingId;
    const travelId = notification.relatedTravelId;

    // 1. Booking requested / contacted: Ride owner coordinates or reviews request
    if (type === 'BOOKING_REQUESTED' || type === 'BOOKING_CONTACTED') {
      if (travelId) {
        navigate(`/rides/${travelId}`);
      } else {
        navigate('/posts');
      }
      return;
    }

    // 2. Booking confirmed, accepted or cancelled: passenger or owner checks ride
    if (travelId) {
      navigate(`/rides/${travelId}`);
      return;
    }

    // Fallback: My Posts page
    navigate('/posts');
  };

  // Filter tab counts
  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter((n) => !n.isRead).length,
      read: notifications.filter((n) => n.isRead).length,
    };
  }, [notifications]);

  // Filtered notifications
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

    if (t.includes('ACCEPTED')) {
      return {
        icon: CheckCircle2,
        iconBg: 'bg-[#EDFAF3]',
        iconColor: 'text-[#16A34A]',
        badgeBg: 'bg-[#EDFAF3]',
        badgeColor: 'text-[#16A34A]',
        badgeText: 'Request Accepted',
        actionLabel: 'Review Booking',
      };
    }

    if (t.includes('REJECTED')) {
      return {
        icon: XCircle,
        iconBg: 'bg-[#F8FAFC]',
        iconColor: 'text-[#64748B]',
        badgeBg: 'bg-[#F8FAFC]',
        badgeColor: 'text-[#64748B]',
        badgeText: 'Request Declined',
        actionLabel: 'Find Other Rides',
      };
    }

    return {
      icon: Bell,
      iconBg: 'bg-[#FFF4ED]',
      iconColor: 'text-[#FF572E]',
      badgeBg: 'bg-[#FFF4ED]',
      badgeColor: 'text-[#FF572E]',
      badgeText: 'CampusPool Update',
      actionLabel: 'View Details',
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
      customMobileHeader={<AppHeader title="Notifications" backTo="/home" />}
    >
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
        
        {/* ========================================================================= */}
        {/* HEADER: TITLE, UNREAD BADGE & MARK ALL AS READ ACTION                     */}
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
                  {unreadCount} new
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
              onClick={() => fetchNotificationsData(1, false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF572E]' : ''}`} />
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
        ) : error ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-red-200 max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#17233C]">Unable to Load Notifications</h3>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchNotificationsData(1, false)}
              className="px-5 py-2 bg-[#FF572E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* Premium Compact Friendly Empty State (no oversized blank box) */
          <div className="bg-white rounded-[24px] p-8 sm:p-10 text-center border border-[#F4E3D8] max-w-md mx-auto space-y-3.5 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto text-2xl shadow-inner">
              🎉
            </div>
            <div>
              <h3 className="font-black text-lg sm:text-xl text-[#17233C]">
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
          /* Compact Notification Cards */
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
                      : 'border-[#FF572E]/30 bg-gradient-to-r from-white via-white to-[#FFFBF8] shadow-2xs ring-1 ring-[#FF572E]/10'
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

                        {/* Unread dot */}
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#FF572E] ring-2 ring-white shrink-0" />
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
                    </div>
                  </div>

                  {/* Right: Action button & mark read trigger */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-13 sm:pl-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNotificationClick(n);
                      }}
                      className="px-3.5 py-1.5 bg-[#FFF4ED] hover:bg-[#FFE8DC] text-[#FF572E] text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>{visuals.actionLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkOneRead(n._id, e)}
                        className="p-1.5 text-[#A0A6B5] hover:text-[#17233C] rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Load More Pagination */}
            {hasMore && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchNotificationsData(page + 1, true)}
                  className="px-5 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF572E]" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More Notifications</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}
