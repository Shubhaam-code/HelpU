import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
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
    <div className="min-h-dvh bg-cream pb-24">
      <AppHeader title="My Bookings" backTo={-1} />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton count={3} />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon="🎫"
            title="No bookings yet"
            subtitle="Book your first ride and it'll appear here."
            action={
              <PrimaryButton onClick={() => navigate('/rides')} variant="coral" fullWidth={false} className="px-8">
                Browse Rides
              </PrimaryButton>
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-3"
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

      <BottomNavigation />
    </div>
  );
}
