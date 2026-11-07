import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Target, ShieldCheck, MapPin, Calendar, Clock, 
  ArrowRight 
} from 'lucide-react';
import { Avatar } from './Avatar';

/**
 * Format minutes from midnight (0..1439) into 12-hour AM/PM format (e.g. 08:00 AM)
 */
function formatMinutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '08:00 AM';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format date string into friendly bold format (e.g. Sat, 14 Nov)
 */
function formatTravelDate(dateStr) {
  if (!dateStr) return 'Upcoming Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Upcoming Date';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Matching Card component recreating Reference Image 2
 * 
 * Features:
 * - Top Left: Matching Offer / Matching Request + Verification status (Verified)
 * - Top Right: Peach price pill (e.g. ₹350 per seat)
 * - Route: Green hollow circle -> dashed line -> Orange map pin
 * - Metadata: Date (bold) | Time (bold) | Available seats in green pill
 * - Footer: Student avatar + name and "View Details →" button
 * - NO vehicle model/car name (Creta/Omni) displayed as strictly required
 */
export function MatchCard({ match, onPress, bookingStatus }) {
  const navigate = useNavigate();
  if (!match) return null;

  const travelId = match._id?.toString() || match.id?.toString();
  const isOffer = match.type === 'offer';
  const student = match.student || match.creator || {};
  const studentName = student.name || match.authorName || 'Campus Student';
  const isVerified = Boolean(student.isVerified);

  const bDirection = typeof bookingStatus === 'object' ? bookingStatus?.direction : null;
  const bStatus = typeof bookingStatus === 'object' ? bookingStatus?.status : bookingStatus;
  const isIncoming = bDirection === 'incoming';
  const isOutgoing = bDirection === 'outgoing' || (bStatus && !bDirection);
  
  const fromCity = match.source || match.from || 'Campus Gate';
  const toCity = match.destination || match.to || 'City Destination';
  const seats = match.availableSeats ?? match.seats ?? 1;
  const pricePerSeat = match.pricePerSeat ?? 350;

  const dateFormatted = formatTravelDate(match.travelDate);
  const timeFormatted = formatMinutesToTime(match.departureTime);

  const handleCardClick = () => {
    if (onPress) {
      onPress(match);
    } else if (travelId) {
      navigate(`/rides/${travelId}`);
    }
  };

  return (
    <motion.div
      onClick={handleCardClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className="bg-white rounded-[26px] sm:rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4"
    >
      {/* 1. TOP HEADER: Matching Badge | Verified & Price Pill */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: Matching Offer / Request pill + Optional Verified */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF0E6] text-[#FF572E] border border-[#FFD9C7] shrink-0">
            <Target className="w-3.5 h-3.5 text-[#FF572E] stroke-[2.5]" />
            <span>{isOffer ? 'Matching Offer' : 'Matching Request'}</span>
          </div>

          {isVerified && (
            <>
              <span className="text-gray-300 font-light select-none">|</span>
              <div className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A] shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] fill-[#EDFAF3]" />
                <span>Verified</span>
              </div>
            </>
          )}

          {isIncoming && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shrink-0 shadow-2xs">
              Request Received
            </div>
          )}
          {!isIncoming && isOutgoing && bStatus === 'pending' && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] shrink-0 shadow-2xs">
              Request Sent
            </div>
          )}
          {!isIncoming && isOutgoing && (bStatus === 'confirmed' || bStatus === 'accepted') && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] shrink-0 shadow-2xs">
              Booked
            </div>
          )}
        </div>

        {/* Right: Peach Price Box */}
        <div className="shrink-0">
          {isOffer ? (
            pricePerSeat > 0 ? (
              <div className="bg-[#FFF4ED] rounded-2xl px-4 py-2 text-center border border-[#FDE0D0]">
                <div className="text-xl sm:text-2xl font-black text-[#FF572E] leading-none">
                  ₹{pricePerSeat}
                </div>
                <div className="text-[10.5px] font-bold text-[#8C93A4] mt-1">
                  per seat
                </div>
              </div>
            ) : (
              <div className="bg-[#EDFAF3] rounded-2xl px-3.5 py-2 text-center border border-[#BCECD4]">
                <div className="text-base font-black text-[#16A34A] leading-none">Free</div>
                <div className="text-[10px] font-bold text-[#16A34A]/80 mt-1">Ride Share</div>
              </div>
            )
          ) : (
            <div className="bg-[#EFF6FF] rounded-2xl px-3.5 py-2 text-center border border-[#DBEAFE]">
              <div className="text-sm font-black text-[#2563EB] leading-none">Seeking</div>
              <div className="text-[10px] font-bold text-[#6E7587] mt-1">Ride Request</div>
            </div>
          )}
        </div>
      </div>

      {/* 2. ROUTE SECTION: Green Circle -> Dashed Line -> Orange Pin */}
      <div className="flex items-start gap-3 my-1">
        {/* Route dots & dashed line */}
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className="w-3.5 h-3.5 rounded-full border-[2.5px] border-[#16A34A] bg-white ring-2 ring-[#DCFCE7]" />
          <div className="w-0.5 h-7 border-l-2 border-dashed border-[#CBD5E1] my-1" />
          <MapPin className="w-4 h-4 text-[#FF572E] fill-[#FF572E]" />
        </div>

        {/* Route text */}
        <div className="flex flex-col justify-between gap-3 min-w-0 flex-1">
          <div className="font-black text-[#17233C] text-base sm:text-lg truncate leading-tight capitalize">
            {fromCity}
          </div>
          <div className="font-black text-[#17233C] text-base sm:text-lg truncate leading-tight capitalize">
            {toCity}
          </div>
        </div>
      </div>

      {/* 3. SUBTLE HORIZONTAL DIVIDER */}
      <div className="border-t border-[#F4E3D8]/80 my-0.5" />

      {/* 4. METADATA ROW: Date (bold) | Time (bold) | Available Seats (green pill) */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
        {/* Date */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar className="w-4 h-4 text-[#FF572E]" />
          <span className="font-black text-[#17233C] text-xs sm:text-sm">
            {dateFormatted}
          </span>
        </div>

        <span className="text-gray-300 font-light select-none">|</span>

        {/* Time */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="w-4 h-4 text-[#FF572E]" />
          <span className="font-black text-[#17233C] text-xs sm:text-sm">
            {timeFormatted}
          </span>
        </div>

        <span className="text-gray-300 font-light select-none">|</span>

        {/* Seat count in green pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] shrink-0">
          <svg className="w-3.5 h-3.5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
            <path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0z" />
            <path d="M5 18v2" />
            <path d="M19 18v2" />
          </svg>
          <span>
            {seats} {isOffer ? (seats === 1 ? 'seat left' : 'seats left') : (seats === 1 ? 'seat needed' : 'seats needed')}
          </span>
        </div>
      </div>

      {/* 5. FOOTER: Student Profile & View Details Button */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Student Avatar + Full Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            src={student.imageUrl}
            name={studentName}
            email={student.email}
            size="sm"
            className="w-9 h-9 aspect-square rounded-full border border-[#F4E3D8] shrink-0"
          />
          <span className="font-black text-sm sm:text-base text-[#17233C] truncate">
            {studentName}
          </span>
        </div>

        {/* View Details / View Request Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-black text-xs sm:text-sm border transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0 ${
            isIncoming 
              ? 'bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#1D4ED8]' 
              : 'bg-[#FFF0E6] hover:bg-[#FFE0D0] text-[#FF572E] border-[#FFD9C7]'
          }`}
        >
          <span>{isIncoming ? 'View Request' : 'View Details'}</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </motion.div>
  );
}

export default MatchCard;
