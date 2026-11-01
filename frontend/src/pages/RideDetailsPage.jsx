import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Car, MapPin, Calendar, Users } from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { getTravelById } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';

export default function RideDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [travel, setTravel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTravelById(id)
      .then((res) => setTravel(res.data?.data || res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-cream">
        <AppHeader title="Ride Details" backTo={-1} />
        <div className="px-5"><LoadingSkeleton type="full" /></div>
      </div>
    );
  }

  if (!travel) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🚫</div>
          <div className="text-navy font-bold">Ride not found</div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Ride Details" backTo={-1} />}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-5">
        {/* Driver card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <Avatar avatarId={travel.student?.avatarId || travel.studentAvatarId || 'm1'} size="xl" />
            <div className="flex-1">
              <div className="font-bold text-navy text-lg">{travel.student?.name || travel.studentName || 'Unknown'}</div>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold text-navy">{travel.rating || '4.8'}</span>
                <span className="text-text-secondary text-sm ml-1">• {travel.type === 'offer' ? 'Car' : 'Request'}</span>
              </div>
              <div className="text-text-secondary text-sm mt-1">
                {travel.carModel || 'Hyundai i20'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Route */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <h3 className="font-bold text-navy mb-4">Route Details</h3>
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-coral" />
              <div className="w-0.5 flex-1 bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-navy" />
            </div>
            <div className="flex flex-col justify-between py-0.5 flex-1">
              <div>
                <div className="font-semibold text-navy">{travel.from}</div>
                <div className="text-text-secondary text-xs">Departure</div>
              </div>
              <div className="my-3" />
              <div>
                <div className="font-semibold text-navy">{travel.to}</div>
                <div className="text-text-secondary text-xs">Destination</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-cream rounded-xl p-3 text-center">
              <Calendar className="w-4 h-4 text-coral mx-auto mb-1" />
              <div className="text-xs text-text-secondary">Date & Time</div>
              <div className="text-xs font-semibold text-navy mt-1">{formatDate(travel.departureTime)}</div>
            </div>
            <div className="bg-cream rounded-xl p-3 text-center">
              <Users className="w-4 h-4 text-coral mx-auto mb-1" />
              <div className="text-xs text-text-secondary">Seats</div>
              <div className="text-xs font-semibold text-navy mt-1">{travel.availableSeats} available</div>
            </div>
            <div className="bg-cream rounded-xl p-3 text-center">
              <Car className="w-4 h-4 text-coral mx-auto mb-1" />
              <div className="text-xs text-text-secondary">Price</div>
              <div className="text-xs font-semibold text-navy mt-1">{formatCurrency(travel.pricePerSeat)}/seat</div>
            </div>
          </div>
        </motion.div>

        {/* Book button */}
        <PrimaryButton
          variant="coral"
          onClick={() => navigate(`/book/${id}`, { state: { travel } })}
        >
          Book Seat →
        </PrimaryButton>

        <PrimaryButton variant="outlineNavy" onClick={() => navigate(-1)}>
          Go Back
        </PrimaryButton>
      </div>
    </ResponsiveShell>
  );
}

