import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Car, Minus, Plus } from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { createBooking } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';

export default function BookSeatPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const travel = state?.travel;
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pricePerSeat = travel?.pricePerSeat || 350;
  const totalAmount = seats * pricePerSeat;

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await createBooking({ travelId: id || travel?._id, seatsBooked: seats });
      const booking = res.data?.data || res.data;
      navigate(`/bookings/${booking._id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Booking failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Book Seat" backTo={-1} />}
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-5">
        {/* Route header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-coral rounded-2xl p-5 text-white"
        >
          <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
            <Car className="w-4 h-4" />
            <span>{travel?.from || 'VIT, Bhopal'} → {travel?.to || 'Bhopal Railway Station'}</span>
          </div>
          <div className="text-sm text-white/80">{formatDate(travel?.departureTime)}</div>
        </motion.div>

        {/* Driver info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
        >
          <Avatar avatarId={travel?.student?.avatarId || travel?.studentAvatarId || 'm2'} size="md" />
          <div>
            <div className="font-semibold text-navy">{travel?.student?.name || travel?.studentName || 'Student Driver'}</div>
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{travel?.rating || '4.9'}</span>
              <span className="mx-1">•</span>
              <span>{travel?.carModel || (travel?.type === 'offer' ? 'Campus Carpool' : 'Ride Request')}</span>
            </div>
          </div>
        </motion.div>

        {/* Seats selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-navy">Seats</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSeats((s) => Math.max(1, s - 1))}
                className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-navy hover:border-coral hover:text-coral transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-navy text-xl w-6 text-center">{seats}</span>
              <button
                onClick={() => setSeats((s) => Math.min(travel?.availableSeats || 4, s + 1))}
                className="w-9 h-9 rounded-full border-2 border-coral bg-coral/5 flex items-center justify-center text-coral hover:bg-coral hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Price breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between py-2">
            <span className="text-text-secondary">Price per Seat</span>
            <span className="font-medium text-navy">{formatCurrency(pricePerSeat)}</span>
          </div>
          <div className="border-t border-gray-100 my-2" />
          <div className="flex items-center justify-between py-2 bg-peach -mx-4 px-4 rounded-xl">
            <span className="font-bold text-navy">Total Amount</span>
            <span className="font-black text-navy text-lg">{formatCurrency(totalAmount)}</span>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
        )}

        <PrimaryButton variant="coral" onClick={handleConfirm} disabled={loading}>
          {loading ? 'Confirming...' : 'Confirm Booking'}
        </PrimaryButton>
      </div>
    </ResponsiveShell>
  );
}

