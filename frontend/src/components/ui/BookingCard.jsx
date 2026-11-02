import { motion } from 'framer-motion';
import { Calendar, MapPin, CheckCircle } from 'lucide-react';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatCurrency } from '../../lib/utils';

export function BookingCard({ booking, onPress }) {
  return (
    <motion.div
      onClick={onPress}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar avatarId={booking?.driverAvatarId || 'm1'} size="sm" />
          <div className="text-sm font-medium text-navy">{booking?.driverName || 'Driver'}</div>
        </div>
        <StatusBadge status={booking?.status || 'pending'} />
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-2 h-2 rounded-full bg-coral" />
          <div className="w-0.5 h-4 bg-gray-200" />
          <div className="w-2 h-2 rounded-full bg-navy" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-navy">{booking?.travelId?.source || booking?.travel?.source || booking?.travel?.from || booking?.from || 'Campus'}</span>
          <span className="text-sm text-text-secondary">{booking?.travelId?.destination || booking?.travel?.destination || booking?.travel?.to || booking?.to || 'Destination'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(booking?.travel?.departureTime)}</span>
        </div>
        <span className="font-bold text-navy">{formatCurrency(booking?.totalAmount)}</span>
      </div>
    </motion.div>
  );
}

export default BookingCard;

