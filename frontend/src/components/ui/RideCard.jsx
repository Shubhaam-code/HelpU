import { motion } from 'framer-motion';
import { Star, Heart, ArrowRight, Calendar, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatCurrency } from '../../lib/utils';

export function RideCard({ travel, onPress, onFavorite, showFav = true }) {
  const isOffer = travel?.type === 'offer';

  return (
    <motion.div
      onClick={onPress}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar avatarId={travel?.studentAvatarId || travel?.student?.avatarId || 'm1'} size="md" />
          <div>
            <div className="font-semibold text-navy text-sm">
              {travel?.studentName || travel?.student?.name || 'Campus Student'}
            </div>
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{travel?.rating || '4.8'}</span>
              <span className="mx-1">•</span>
              <StatusBadge status={isOffer ? 'offer' : 'request'} className="text-[10px] py-0.5 px-2" />
            </div>
          </div>
        </div>
        {showFav && (
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite?.(); }}
            className="text-gray-300 hover:text-coral transition-colors p-1"
          >
            <Heart className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-2 h-2 rounded-full bg-coral" />
          <div className="w-0.5 h-4 bg-gray-200" />
          <div className="w-2 h-2 rounded-full bg-navy" />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-sm font-medium text-navy">{travel?.source || travel?.from || 'Campus'}</span>
          <span className="text-sm text-text-secondary">{travel?.destination || travel?.to || 'Destination'}</span>
        </div>
        {(travel?.seats != null || travel?.availableSeats != null) && (
          <span className="bg-navy text-white text-xs px-2.5 py-1 rounded-full font-semibold">
            {typeof travel?.seats === 'number' ? Math.max(0, travel.seats - (travel.bookedSeats || 0)) : travel.availableSeats} seat{((travel?.seats || travel?.availableSeats) !== 1) ? 's' : ''}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {travel?.travelDate 
              ? new Date(travel.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + (typeof travel.departureTime === 'number' ? ` ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}` : '')
              : formatDate(travel?.departureTime)}
          </span>
        </div>
        <span className="font-bold text-coral text-sm">{formatCurrency(travel?.pricePerSeat || 350)}</span>
      </div>
    </motion.div>
  );
}

export default RideCard;

