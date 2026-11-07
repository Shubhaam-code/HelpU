import { motion } from 'framer-motion';
import { Star, Heart, ArrowRight, Calendar, Users, ShieldCheck, Car, Clock, MapPin } from 'lucide-react';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatCurrency } from '../../lib/utils';

export function RideCard({ travel, onPress, onFavorite, showFav = true }) {
  const isOffer = travel?.type === 'offer';
  const availableSeats = typeof travel?.seats === 'number' 
    ? Math.max(0, travel.seats - (travel.bookedSeats || 0)) 
    : (travel?.availableSeats || 1);

  const fromCity = travel?.source || travel?.from || 'Campus Gate';
  const toCity = travel?.destination || travel?.to || 'City Center';

  const timeDisplay = travel?.travelDate 
    ? new Date(travel.travelDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + (typeof travel.departureTime === 'number' ? ` • ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}` : '')
    : formatDate(travel?.departureTime);

  return (
    <motion.div
      onClick={onPress}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-[22px] p-4 sm:p-5 border border-[#F4E3D8]/90 shadow-xs hover:border-[#FF572E]/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Creator Info & Tags Header */}
        <div className="flex items-start justify-between mb-3.5 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar 
              avatarId={travel?.studentAvatarId || travel?.student?.avatarId || 'm1'} 
              src={travel?.student?.imageUrl || travel?.authorImage}
              size="md" 
              ring
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-[#17233C] text-sm truncate">
                  {travel?.studentName || travel?.student?.name || 'Campus Student'}
                </span>
                {Boolean(travel?.student?.isVerified) && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" title="Verified Student" />
                )}
                {(travel?.gender || travel?.student?.gender) && 
                  (travel.gender || travel.student?.gender) !== 'Prefer not to say' && (
                  <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]">
                    {travel.gender || travel.student?.gender}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#6E7587] mt-0.5">
                <span>{travel?.student?.college || 'VIT, Bhopal'}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {travel?.rating || '4.9'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {travel?.isMine && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EAF8F0] text-[#16A34A] border border-[#BCECD4]">
                Your Ride
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isOffer 
                ? 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]' 
                : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
            }`}>
              {isOffer ? '🚗 Offer' : '🙋 Request'}
            </span>
          </div>
        </div>

        {/* Matching Reason Tag */}
        {travel?.matchingReason && (
          <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-[#EDFAF3] border border-[#BCECD4] text-[10px] font-black text-[#16A34A] flex items-center gap-1">
            <span>🎯</span>
            <span className="truncate">{travel.matchingReason}</span>
          </div>
        )}

        {/* Route Details */}
        <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8] mb-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0 ring-2 ring-[#DCFCE7]" />
            <span className="font-bold text-[#17233C] truncate">{fromCity}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0 ring-2 ring-[#FFEBE0]" />
            <span className="font-bold text-[#17233C] truncate">{toCity}</span>
          </div>
        </div>

        {/* Meta badges: Time & Vehicle */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6E7587] mb-3">
          <div className="flex items-center gap-1 bg-[#F9FAFB] px-2 py-1 rounded-lg border border-gray-100 font-medium">
            <Calendar className="w-3 h-3 text-[#FF572E]" />
            <span>{timeDisplay}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#F9FAFB] px-2 py-1 rounded-lg border border-gray-100 font-medium">
            <Car className="w-3 h-3 text-[#FF572E]" />
            <span>{travel?.carModel || (isOffer ? 'Shared Car' : 'Co-traveler')}</span>
          </div>
        </div>
      </div>

      {/* Footer: Price, Seats & Action Button */}
      <div className="flex items-center justify-between pt-3 border-t border-[#F4E3D8]/70">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#6E7587] block">
            {isOffer ? 'Seat Split' : 'Seats'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-black text-sm sm:text-base text-[#17233C]">
              {formatCurrency(travel?.pricePerSeat || 350)}
            </span>
            <span className="text-[10px] text-[#6E7587]">/ seat</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            availableSeats > 0 ? 'bg-[#EAF8F0] text-[#16A34A]' : 'bg-gray-100 text-gray-500'
          }`}>
            {availableSeats} seat{availableSeats !== 1 ? 's' : ''} left
          </span>
          <button
            onClick={onPress}
            className="w-8 h-8 rounded-full bg-[#FF572E] text-white flex items-center justify-center hover:bg-[#E64A22] transition-colors shadow-xs"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default RideCard;

