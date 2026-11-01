import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, MapPin, Star, Users, Hash, XCircle } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { getBookingById, cancelBooking } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';

export default function BookingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    getBookingById(id)
      .then((res) => setBooking(res.data?.data || res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setCancelling(true);
    try {
      await cancelBooking(id);
      setBooking((prev) => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      alert(err.message || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-cream">
        <AppHeader title="Booking Details" backTo={-1} />
        <div className="px-5"><LoadingSkeleton type="full" /></div>
      </div>
    );
  }

  const travel = booking?.travel;
  const isConfirmed = booking?.status === 'confirmed';
  const isCancelled = booking?.status === 'cancelled';

  return (
    <div className="min-h-dvh bg-cream pb-28">
      <AppHeader title="Booking Details" backTo={-1} />

      <div className="px-5 space-y-4">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full self-start w-fit ${
            isConfirmed ? 'bg-green-50 text-green-700' : isCancelled ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isConfirmed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span className="font-semibold text-sm capitalize">{booking?.status}</span>
        </motion.div>

        {/* Route timeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-coral" />
              <div className="w-0.5 h-12 bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-navy" />
            </div>
            <div className="flex flex-col justify-between py-0.5 flex-1">
              <div>
                <div className="font-bold text-navy text-base">{travel?.from || 'VIT, Bhopal'}</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-text-secondary my-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(travel?.departureTime)}</span>
              </div>
              <div>
                <div className="font-bold text-navy text-base">{travel?.to || 'Bhopal'}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Driver */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
        >
          <Avatar avatarId={booking?.driverAvatarId || 'm1'} size="md" />
          <div className="flex-1">
            <div className="font-semibold text-navy">{booking?.driverName || travel?.student?.name || 'Aman Verma'}</div>
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>4.8</span>
              <span className="mx-1">•</span>
              <span>Car (Hyundai i20)</span>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-50 rounded-xl">
            <span className="text-lg">💬</span>
          </button>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3"
        >
          {[
            { icon: <Users className="w-4 h-4 text-coral" />, label: 'Your Seat', value: booking?.seatsBooked || 1 },
            { icon: <span className="text-base">₹</span>, label: 'Amount', value: formatCurrency(booking?.totalAmount) },
            { icon: <Hash className="w-4 h-4 text-coral" />, label: 'Booking ID', value: booking?.bookingId || `HPU${booking?._id?.slice(-5).toUpperCase()}` },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-secondary text-sm">
                {row.icon}
                <span>{row.label}</span>
              </div>
              <span className="font-semibold text-navy text-sm">{row.value}</span>
            </div>
          ))}
        </motion.div>

        {/* Actions */}
        {!isCancelled && (
          <>
            <PrimaryButton variant="outlineNavy" onClick={() => {}}>
              📅  Add to Calendar
            </PrimaryButton>
            <PrimaryButton variant="outline" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Booking'}
            </PrimaryButton>
          </>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
