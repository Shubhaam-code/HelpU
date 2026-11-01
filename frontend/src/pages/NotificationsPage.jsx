import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { getNotifications, markAllRead, markRead } from '../lib/api';
import { timeAgo } from '../lib/utils';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) { console.error(err); }
  };

  const handleMarkOne = async (id) => {
    try {
      await markRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) { console.error(err); }
  };

  const typeEmoji = (type) => {
    if (type?.includes('CONFIRM')) return '✅';
    if (type?.includes('CANCEL')) return '❌';
    if (type?.includes('REMIND')) return '⏰';
    return '🔔';
  };

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <AppHeader title="Notifications" backTo={-1} />

      <div className="px-5">
        {notifications.some(n => !n.isRead) && (
          <div className="flex justify-end mb-3">
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-coral"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton count={4} />
        ) : notifications.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications yet" subtitle="Booking updates and reminders will appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <motion.div
                key={n._id}
                onClick={() => handleMarkOne(n._id)}
                whileTap={{ scale: 0.98 }}
                className={`flex items-start gap-3 bg-white rounded-2xl p-4 shadow-sm border cursor-pointer ${n.isRead ? 'border-gray-50 opacity-70' : 'border-coral/20'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${n.isRead ? 'bg-gray-100' : 'bg-coral/10'}`}>
                  <span className="text-lg">{typeEmoji(n.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy text-sm">{n.title || n.type}</div>
                  <div className="text-text-secondary text-xs mt-0.5 leading-relaxed">{n.message || n.body}</div>
                  <div className="text-[10px] text-text-secondary mt-1">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && <div className="w-2 h-2 bg-coral rounded-full flex-shrink-0 mt-1" />}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
