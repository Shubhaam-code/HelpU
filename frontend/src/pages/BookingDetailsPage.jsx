import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, MapPin, Star, Users, Hash, XCircle, MessageSquare } from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { WhatsAppContactCard } from '../components/booking/WhatsAppContactButton';
import { getBookingById, cancelBooking } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';
import { openWhatsAppChat } from '../lib/whatsapp';

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

  const travel = booking?.travelId || booking?.travel;
  const isConfirmed = booking?.status === 'confirmed';
  const isCancelled = booking?.status === 'cancelled';

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Booking Details" backTo={-1} />}
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-5">
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
                <div className="font-bold text-navy text-base">{travel?.source || travel?.from || 'Campus Origin'}</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-text-secondary my-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {travel?.travelDate 
                    ? new Date(travel.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + (typeof travel.departureTime === 'number' ? ` ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}` : '')
                    : formatDate(travel?.departureTime)}
                </span>
              </div>
              <div>
                <div className="font-bold text-navy text-base">{travel?.destination || travel?.to || 'Destination'}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* WhatsApp Coordination - Only for confirmed/accepted bookings */}
        {['confirmed', 'accepted'].includes(booking?.status) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <WhatsAppContactCard
              bookingId={booking?._id}
              bookingStatus={booking?.status}
              contactPerson={booking?.ownerStudent || booking?.passengerStudent || {
                name: booking?.ownerStudent?.name || booking?.passengerStudent?.name || 'Fellow Student',
                imageUrl: booking?.ownerStudent?.imageUrl || booking?.passengerStudent?.imageUrl,
                college: booking?.ownerStudent?.college || booking?.passengerStudent?.college
              }}
              title="Coordinate Your Ride"
            />
          </motion.div>
        )}

        {/* Driver / Partner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
        >
          <Avatar 
            avatarId={booking?.ownerStudent?.avatarId || booking?.passengerStudent?.avatarId || booking?.driverAvatarId || 'm1'} 
            src={booking?.ownerStudent?.imageUrl || booking?.passengerStudent?.imageUrl}
            size="md" 
            ring
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy truncate">
              {booking?.ownerStudent?.name || booking?.passengerStudent?.name || booking?.driverName || travel?.student?.name || 'Campus Student'}
            </div>
            <div className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>4.9</span>
              <span className="mx-1">•</span>
              <span>{travel?.carModel || 'Campus Carpool'}</span>
            </div>
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3"
        >
          {[
            { icon: <Users className="w-4 h-4 text-coral" />, label: 'Seats Booked', value: `${booking?.requestedSeats || booking?.seatsBooked || 1} Seat(s)` },
            { icon: <span className="text-base font-bold text-coral">₹</span>, label: 'Total Fare', value: formatCurrency(booking?.totalAmount || ((booking?.requestedSeats || booking?.seatsBooked || 1) * (travel?.pricePerSeat || 350))) },
            { icon: <Hash className="w-4 h-4 text-coral" />, label: 'Booking ID', value: `#BK-${booking?._id?.slice(-6).toUpperCase()}` },
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
    </ResponsiveShell>
  );
}

