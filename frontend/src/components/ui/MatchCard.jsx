import { motion } from 'framer-motion';
import { Star, Calendar, ArrowRight, ShieldCheck, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { formatDate, formatCurrency } from '../../lib/utils';

export function MatchCard({ match, onPress }) {
  const isOffer = match?.type === 'offer';
  const fromCity = match?.from || match?.source || 'Campus';
  const toCity = match?.to || match?.destination || 'Destination';
  const seats = match?.availableSeats || match?.seats || 1;
  const student = match?.student || match?.creator || {};
  const studentName = student.name || match?.name || 'Campus Student';
  const avatar = student.avatarId || student.imageUrl || match?.avatarId || 'f1';

  return (
    <motion.div
      onClick={onPress}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#F4E3D8] hover:border-[#FF572E]/30 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3.5"
    >
      <div className="space-y-3">
        {/* Student & Type Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar avatarId={avatar} name={studentName} size="md" className="ring-2 ring-[#FF572E]/10 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-[#17233C] text-sm truncate">{studentName}</span>
                {Boolean(student?.isVerified) && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" title="Verified Student" />
                )}
                {(match?.gender || student?.gender) && 
                  (match.gender || student.gender) !== 'Prefer not to say' && (
                  <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]">
                    {match.gender || student.gender}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#6E7587]">
                <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{match?.rating || '4.9'}</span>
                </span>
                {Boolean(student?.isVerified) && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5 text-[#16A34A] font-bold">
                      <span>Verified</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
            isOffer
              ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
              : 'bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE]'
          }`}>
            {isOffer ? 'Ride Offer' : 'Request'}
          </span>
        </div>

        {/* Route */}
        <div className="bg-[#FFFBF8] rounded-xl p-2.5 border border-[#F4E3D8]/80 text-xs font-bold text-[#17233C] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
            <span className="truncate">{fromCity}</span>
            <span className="text-[#FF572E]">→</span>
            <span className="w-2 h-2 rounded-full bg-[#FF572E] shrink-0" />
            <span className="truncate">{toCity}</span>
          </div>
          {isOffer && match?.pricePerSeat > 0 && (
            <span className="text-[#FF572E] font-black shrink-0 font-mono">
              {formatCurrency(match.pricePerSeat)}
            </span>
          )}
        </div>

        {/* Date & Seats Info */}
        <div className="flex items-center justify-between text-[11px] text-[#6E7587] px-0.5">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
            <span>{formatDate(match?.departureTime || match?.travelDate)}</span>
          </div>
          <div className="flex items-center gap-1 font-semibold text-[#17233C]">
            <Users className="w-3.5 h-3.5 text-[#6E7587]" />
            <span>{isOffer ? `${seats} seat(s) avail` : `${seats} seat(s) needed`}</span>
          </div>
        </div>
      </div>

      {/* View Details Button */}
      <div className="pt-2 border-t border-[#F4E3D8]/60">
        <button
          type="button"
          onClick={onPress}
          className="w-full py-2.5 px-3 bg-[#FFF4ED] hover:bg-[#FF572E] text-[#FF572E] hover:text-white border border-[#FDE0D0] hover:border-[#FF572E] font-extrabold text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </motion.div>
  );
}

export default MatchCard;

