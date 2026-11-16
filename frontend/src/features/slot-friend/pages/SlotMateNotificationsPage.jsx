import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Clock,
  ChevronRight,
  Sparkles,
  CalendarDays,
  User,
  Plus,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

import { useSlotMateNotificationsList, useUnreadNotificationsCount } from '../../../hooks/useAppData';
import { markRead, markAllSlotMateRead, deleteSlotMateNotification } from '../../../lib/api';
import { timeAgo } from '../../../lib/utils';
import { getCourseSubjectTheme } from '../utils/courseIconHelper';
import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { useUser } from '../../../context/FirebaseAuthContext';
import { Avatar } from '../../../components/ui/Avatar';

export default function SlotMateNotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [markingAll, setMarkingAll] = useState(false);
  const didSwipeRef = useRef(false);

  // TanStack Query for SlotMate notifications
  const {
    data: notifications = [],
    isLoading,
    isFetching,
    refetch
  } = useSlotMateNotificationsList({ limit: 50 });

  const { data: serverUnreadCount = 0 } = useUnreadNotificationsCount({ module: 'slotmate' });

  // Dynamically calculate counts directly from real backend notifications
  const totalCount = Array.isArray(notifications) ? notifications.length : 0;
  const unreadItemsCount = useMemo(() => {
    if (!Array.isArray(notifications)) return 0;
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);
  const readItemsCount = useMemo(() => {
    if (!Array.isArray(notifications)) return 0;
    return notifications.filter((n) => n.isRead).length;
  }, [notifications]);

  const displayUnread = unreadItemsCount > 0 ? unreadItemsCount : (serverUnreadCount || 0);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    if (!Array.isArray(notifications)) return [];
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    if (activeFilter === 'read') {
      return notifications.filter((n) => n.isRead);
    }
    return notifications;
  }, [notifications, activeFilter]);

  // Mark all SlotMate notifications as read
  const handleMarkAllRead = async () => {
    if (displayUnread === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllSlotMateRead();
      queryClient.setQueriesData({ queryKey: ['notifications', 'slotmate'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((n) => ({ ...n, isRead: true }));
      });
      queryClient.setQueryData(['notifications', 'unread-count', user?.id, 'slotmate'], 0);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('[SlotMate] Failed to mark all notifications as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Dismiss / delete notification on left or right swipe
  const handleDismissNotification = async (notif) => {
    const id = notif?._id;
    if (!id) return;

    queryClient.setQueriesData({ queryKey: ['notifications', 'slotmate'] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.filter((n) => n._id !== id);
    });
    if (!notif.isRead) {
      queryClient.setQueryData(
        ['notifications', 'unread-count', user?.id, 'slotmate'],
        (old) => Math.max(0, (old || 1) - 1)
      );
    }
    window.dispatchEvent(new CustomEvent('notifications-updated'));

    deleteSlotMateNotification(id).catch((err) => {
      console.warn('[SlotMate] Failed to dismiss notification:', err?.message);
    });
  };

  // Click on single notification: mark read and navigate to match details
  const handleNotificationClick = async (notif) => {
    if (didSwipeRef.current) return;
    if (!notif.isRead) {
      queryClient.setQueriesData({ queryKey: ['notifications', 'slotmate'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n));
      });
      queryClient.setQueryData(
        ['notifications', 'unread-count', user?.id, 'slotmate'],
        (old) => Math.max(0, (old || 1) - 1)
      );
      window.dispatchEvent(new CustomEvent('notifications-updated'));

      markRead(notif._id).catch((err) => {
        console.warn('[SlotMate] Failed to mark notification as read:', err);
      });
    }

    const metadata = notif.metadata || {};
    const postId = metadata.postId || notif.relatedSlotPostId;
    if (metadata.route) {
      navigate(metadata.route);
    } else if (postId) {
      navigate(`/slotmate/matches?postId=${postId}`);
    } else {
      navigate('/slotmate/matches');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Back button + Title ("Notifications") + Mark All Read      */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-[#FFF8F3]/95 backdrop-blur-md border-b border-[#F4E3D8] px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/slotmate')}
            className="p-1.5 -ml-1.5 text-[#17233C] hover:bg-white rounded-xl transition-colors cursor-pointer"
            aria-label="Back to SlotMate Home"
          >
            <ArrowLeft className="w-5 h-5 text-[#17233C] stroke-[2.4]" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-[#17233C] text-lg sm:text-xl tracking-tight">
                Notifications
              </h1>
              {displayUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#EAB308] text-white text-[10px] font-black shadow-xs">
                  {displayUnread} new
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6E7587] font-medium hidden sm:block">
              Real-time course and slot match alerts
            </p>
          </div>
        </div>

        {/* Mark All Read button */}
        {displayUnread > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-[#854D0E] font-black text-xs shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden min-[380px]:inline">Mark all read</span>
          </button>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA                                                      */}
      {/* ========================================================================= */}
      <main className="w-full max-w-xl mx-auto px-4 pt-3.5 pb-28 sm:pb-32 space-y-3.5 flex-1">
        {/* Dynamic Filter Pills: All (count) | Unread (count) | Read (count) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeFilter === 'all'
                ? 'bg-[#17233C] text-white shadow-2xs'
                : 'bg-white text-[#6E7587] border border-[#F4E3D8] hover:text-[#17233C]'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('unread')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeFilter === 'unread'
                ? 'bg-[#17233C] text-white shadow-2xs'
                : 'bg-white text-[#6E7587] border border-[#F4E3D8] hover:text-[#17233C]'
            }`}
          >
            Unread ({unreadItemsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('read')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeFilter === 'read'
                ? 'bg-[#17233C] text-white shadow-2xs'
                : 'bg-white text-[#6E7587] border border-[#F4E3D8] hover:text-[#17233C]'
            }`}
          >
            Read ({readItemsCount})
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto p-1.5 text-[#6E7587] hover:text-[#17233C] hover:bg-white rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#EAB308]' : ''}`} />
          </button>
        </div>

        {/* Loading Skeleton */}
        {isLoading && notifications.length === 0 && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full p-4 rounded-2xl bg-white border border-[#F4E3D8] animate-pulse flex items-start gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-[#F4E3D8]/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4E3D8]/60 rounded w-1/3" />
                  <div className="h-3 bg-[#F4E3D8]/40 rounded w-2/3" />
                  <div className="h-3 bg-[#F4E3D8]/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredNotifications.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full rounded-[24px] bg-white border border-[#F4E3D8] p-6 sm:p-7 text-center space-y-3 shadow-2xs mt-2"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#FEF08A] to-[#FEF9C3] flex items-center justify-center mx-auto text-[#B45309] shadow-inner">
              <Bell className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-black text-[#17233C] text-base sm:text-lg">
                {activeFilter === 'unread'
                  ? 'No Unread Notifications'
                  : activeFilter === 'read'
                  ? 'No Read Notifications'
                  : 'No Notifications Yet'}
              </h2>
              <p className="text-xs text-[#6E7587] font-medium max-w-sm mx-auto mt-1 leading-relaxed">
                {activeFilter === 'unread'
                  ? 'You are all caught up! When a classmate matches your slot post, it will appear here.'
                  : activeFilter === 'read'
                  ? 'You have not read any notifications yet.'
                  : 'When another student publishes a slot post matching your course and class slot, you will receive an instant notification here!'}
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate('/slotmate/create')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-[#17233C] font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.8]" />
                <span>Create a Slot Post</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Notification Cards List (Swipe left/right to dismiss) */}
        <div className="space-y-3 overflow-x-hidden">
          <AnimatePresence>
            {filteredNotifications.map((item) => {
              const metadata = item.metadata || {};
              const courseCode = metadata.courseCode || 'COURSE';
              const courseName = metadata.courseName || '';
              const slot = metadata.slot || '';
              const studentName = metadata.matchedStudentName || 'Classmate';
              const studentAvatar = metadata.matchedStudentAvatar || item.imageUrl || '/default-avatar.png';
              const subjectTheme = getCourseSubjectTheme(courseCode, courseName);
              const SubjectIcon = subjectTheme.icon;

              return (
                <motion.div
                  key={item._id || item.eventId}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 240, height: 0, marginBottom: 0 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.45}
                  dragMomentum={false}
                  onDragStart={() => { didSwipeRef.current = true; }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 85 || Math.abs(info.velocity.x) > 450) {
                      handleDismissNotification(item);
                    }
                    setTimeout(() => { didSwipeRef.current = false; }, 120);
                  }}
                  style={{ touchAction: 'pan-y' }}
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full rounded-[22px] p-4 border transition-all cursor-pointer relative overflow-hidden group active:scale-[0.99] select-none ${
                    !item.isRead
                      ? 'bg-gradient-to-br from-[#FFFBEB] via-white to-white border-[#FDE047] shadow-xs'
                      : 'bg-white border-[#F4E3D8] hover:border-[#FACC15]'
                  }`}
                >
                  {/* Left accent bar for unread notifications */}
                  {!item.isRead && (
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-[#F59E0B] to-[#FACC15]" />
                  )}

                  <div className="flex items-start gap-3 pl-1">
                    {/* Matched Student Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full border-2 border-white shadow-xs overflow-hidden bg-[#FEF9C3] flex items-center justify-center">
                        <Avatar
                          src={studentAvatar}
                          name={studentName}
                          size="full"
                          className="w-full h-full"
                        />
                      </div>
                      {/* Mini subject icon badge */}
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${subjectTheme.bgClass} ${subjectTheme.textClass} border-2 border-white flex items-center justify-center shadow-2xs`}
                      >
                        <SubjectIcon className="w-2.8 h-2.8" />
                      </div>
                    </div>

                    {/* Middle Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Header Row: Student name + Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-sm text-[#17233C] truncate">
                            {studentName}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#EAB308] shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-[#8C93A4] font-semibold shrink-0">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>

                      {/* Course & Slot Pill Badge */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${subjectTheme.bgClass} ${subjectTheme.textClass} border ${subjectTheme.borderClass}`}
                        >
                          <SubjectIcon className="w-3 h-3" />
                          <span>{courseCode}</span>
                        </span>
                        {slot && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold border border-[#FDE68A]">
                            <CalendarDays className="w-2.8 h-2.8" />
                            <span>Slot {slot}</span>
                          </span>
                        )}
                      </div>

                      {/* Notification message */}
                      <p className="text-xs text-[#475569] font-medium leading-relaxed pt-0.5">
                        {item.message || 'You have found a student studying the same course and slot. Connect now!'}
                      </p>

                      {/* Bottom action indicator */}
                      <div className="flex items-center gap-1 text-[11px] font-black text-[#D97706] pt-1 group-hover:translate-x-0.5 transition-transform">
                        <span>View Matched Post</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. SLOTMATE BOTTOM NAVIGATION                                             */}
      {/* ========================================================================= */}
      <SlotMateBottomNav active="match" />
    </div>
  );
}

