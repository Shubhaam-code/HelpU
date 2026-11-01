import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { BookingCard } from '../components/ui/BookingCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { getMyBookings } from '../lib/api';

export default function BookingsListPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await getMyBookings();
      setBookings(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="My Bookings" backTo={-1} />}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="hidden sm:flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black text-navy text-2xl lg:text-3xl">My Campus Bookings</h2>
            <p className="text-text-secondary text-sm mt-1">Review active, completed, and upcoming travel rides.</p>
          </div>
          <button
            onClick={() => navigate('/rides')}
            className="px-4 py-2.5 bg-coral text-white font-bold text-xs rounded-2xl hover:bg-coral/90 cursor-pointer shadow-xs"
          >
            Find New Ride
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LoadingSkeleton count={4} />
          </div>
        ) : bookings.length === 0 ? (
          <div className="max-w-md mx-auto py-12">
            <EmptyState
              icon="🎫"
              title="No bookings yet"
              subtitle="Book your first campus ride and it will appear here."
              action={
                <PrimaryButton onClick={() => navigate('/rides')} variant="coral" fullWidth={false} className="px-8">
                  Browse Rides
                </PrimaryButton>
              }
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {bookings.map((b) => (
              <BookingCard
                key={b._id}
                booking={b}
                onPress={() => navigate(`/bookings/${b._id}`)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </ResponsiveShell>
  );
}
