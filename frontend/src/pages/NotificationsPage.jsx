import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCheck } from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
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
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Notifications" backTo={-1} />}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 lg:py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black text-navy text-2xl lg:text-3xl">Notifications</h2>
            <p className="text-text-secondary text-sm mt-0.5">Stay updated on ride confirmations, matches, and reminders.</p>
          </div>

          {notifications.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-gray-100 text-xs font-bold text-coral hover:bg-cream transition-colors cursor-pointer shadow-2xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton count={4} />
        ) : notifications.length === 0 ? (
          <div className="py-12 bg-white rounded-3xl border border-gray-100">
            <EmptyState 
              icon="🔔" 
              title="No notifications yet" 
              subtitle="Booking updates and reminders will appear here." 
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {notifications.map((n) => (
              <motion.div
                key={n._id}
                onClick={() => handleMarkOne(n._id)}
                whileTap={{ scale: 0.98 }}
                className={`flex items-start gap-3 bg-white rounded-2xl p-4 shadow-xs border cursor-pointer transition-all hover:shadow-sm ${
                  n.isRead ? 'border-gray-50 opacity-75' : 'border-coral/30 ring-1 ring-coral/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  n.isRead ? 'bg-gray-100' : 'bg-coral/10'
                }`}>
                  <span className="text-lg">{typeEmoji(n.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy text-sm">{n.title || n.type}</div>
                  <div className="text-text-secondary text-xs mt-0.5 leading-relaxed">{n.message || n.body}</div>
                  <div className="text-[10px] text-text-secondary font-medium mt-1">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && <div className="w-2.5 h-2.5 bg-coral rounded-full shrink-0 mt-1 shadow-xs" />}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </ResponsiveShell>
  );
}
