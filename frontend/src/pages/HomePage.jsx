import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { SearchBar } from '../components/ui/SearchBar';
import { ActionWidget } from '../components/ui/ActionWidget';
import { BookingCard } from '../components/ui/BookingCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { getProfile, getMyBookings, getUnreadCount } from '../lib/api';

// "Going Home?" promo card with car illustration
function PromoCard({ onClick }) {
  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="bg-peach rounded-2xl p-4 flex items-center justify-between cursor-pointer overflow-hidden relative"
    >
      <div className="z-10">
        <div className="text-lg mb-1">🏠</div>
        <div className="font-bold text-navy text-base">Going Home?</div>
        <div className="text-text-secondary text-xs mt-1">Share a ride. Save cost.<br />Travel together.</div>
      </div>
      {/* Car illustration */}
      <div className="text-6xl">🚕</div>
    </motion.div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, bookingsRes, notifRes] = await Promise.allSettled([
        getProfile(),
        getMyBookings(),
        getUnreadCount(),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data);
      }
      if (bookingsRes.status === 'fulfilled') {
        setBookings(bookingsRes.value.data?.data?.slice(0, 3) || []);
      }
      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.data?.data?.count || 0);
      }
    } catch (err) {
      console.error('Home data fetch error:', err);
    } finally {
      setLoadingProfile(false);
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const firstName = profile?.name?.split(' ')[0] || user?.firstName || 'there';

  const actions = [
    { icon: '🚗', title: 'Offer a Ride', subtitle: 'Share your journey', color: 'peach', path: '/rides/offer' },
    { icon: '📍', title: 'Request a Ride', subtitle: 'Find a ride easily', color: 'lavender', path: '/rides/request' },
    { icon: '🤝', title: 'Find a Match', subtitle: 'Get travel buddies', color: 'mint', path: '/match' },
    { icon: '🔧', title: 'Get Help', subtitle: 'Campus services', color: 'sky', path: '/help' },
  ];

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <AppHeader
        avatarId={profile?.avatarId}
        onBell={() => navigate('/notifications')}
        unreadCount={unreadCount}
      />

      <main className="px-5 space-y-5">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-black text-navy text-2xl">
            Hey {firstName} 👋
          </h1>
          <p className="text-text-secondary text-sm">How can we help you today?</p>
        </motion.div>

        {/* Search */}
        <SearchBar />

        {/* Action grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-2 gap-3"
        >
          {actions.map((a) => (
            <ActionWidget
              key={a.path}
              icon={a.icon}
              title={a.title}
              subtitle={a.subtitle}
              color={a.color}
              onClick={() => navigate(a.path)}
            />
          ))}
        </motion.div>

        {/* Going Home promo */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <PromoCard onClick={() => navigate('/rides')} />
        </motion.div>

        {/* Upcoming Bookings */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy text-lg">Upcoming Bookings</h2>
            <button
              onClick={() => navigate('/bookings')}
              className="text-coral font-semibold text-sm"
            >
              View All
            </button>
          </div>

          {loadingBookings ? (
            <LoadingSkeleton count={2} />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon="🎫"
              title="No upcoming bookings"
              subtitle="Book a ride and it'll appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => (
                <BookingCard
                  key={b._id}
                  booking={b}
                  onPress={() => navigate(`/bookings/${b._id}`)}
                />
              ))}
            </div>
          )}
        </motion.section>
      </main>

      <BottomNavigation />
    </div>
  );
}
