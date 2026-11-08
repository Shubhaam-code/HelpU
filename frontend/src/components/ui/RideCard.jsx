import { motion } from 'framer-motion';
import { 
  ShieldCheck, MapPin, Calendar, Clock, 
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
 * Format travel date into bold friendly format (e.g. Sat, 14 Nov)
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
 * Normal Travel Post Card Component
 * Strictly follows the Reference Card Design for Normal Travel Posts:
 * - Displays ONLY actual post type: "OFFER" or "REQUEST" (Never "Matching Offer/Request")
 * - Verified badge when student is verified
 * - Peach-colored price box (₹350 per seat)
 * - Green hollow circle -> vertical dashed line -> Orange map pin
 * - Bold location names
 * - Bold date and departure time with orange icons
 * - Green pill for available seats
 * - Student profile picture and bold name
 * - Peach-colored View Details button
 * - NO vehicle names (Creta, Omni, etc.) displayed
 */
export function RideCard({ travel, onPress }) {
  if (!travel) return null;

  const isOffer = travel.type === 'offer';
  const student = travel.student || travel.creator || {};
  const studentName = travel.studentName || student.name || travel.authorName || 'Campus Student';
  const isVerified = Boolean(student.isVerified || travel.isVerified);
  const isFulfilled = !isOffer && Boolean(
    travel.isFulfilled ||
    (travel.bookedSeats || 0) >= 1 ||
    travel.status === 'completed' ||
    (travel.confirmedBookingsCount || 0) > 0
  );

  const availableSeats = typeof travel.seats === 'number'
    ? Math.max(0, travel.seats - (travel.bookedSeats || 0))
    : (travel.availableSeats || 1);

  const fromCity = travel.source || travel.from || 'Campus Gate';
  const toCity = travel.destination || travel.to || 'City Destination';
  const pricePerSeat = travel.pricePerSeat ?? 350;

  const dateFormatted = formatTravelDate(travel.travelDate);
  const timeFormatted = formatMinutesToTime(travel.departureTime);

  return (
    <motion.div
      onClick={onPress}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className="bg-white rounded-[26px] sm:rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4"
    >
      {/* 1. TOP HEADER: OFFER / REQUEST Badge | Verified & Peach Price Box */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: OFFER or REQUEST pill + Optional Verified Status */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 ${
            isOffer
              ? 'bg-[#FFF0E6] text-[#FF572E] border border-[#FFD9C7]'
              : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
          }`}>
            <span>{isOffer ? 'OFFER' : 'FIND'}</span>
          </div>

          {travel.isMine && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EAF8F0] text-[#16A34A] border border-[#BCECD4] shrink-0">
              Your Ride
            </span>
          )}

          {isVerified && (
            <>
              <span className="text-gray-300 font-light select-none">|</span>
              <div className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A] shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] fill-[#EDFAF3]" />
                <span>Verified</span>
              </div>
            </>
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
              <div className="text-sm font-black text-[#2563EB] leading-none">
                {isFulfilled ? 'Found' : 'Seeking'}
              </div>
              <div className="text-[10px] font-bold text-[#6E7587] mt-1">
                {isFulfilled ? 'Ride Found' : 'Find Ride'}
              </div>
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

        {/* Route text with bold location names */}
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
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shrink-0 ${
          isFulfilled || isOffer
            ? 'bg-[#EDFAF3] text-[#16A34A] border-[#BCECD4]'
            : 'bg-[#FFF4ED] text-[#FF572E] border-[#FDE0D0]'
        }`}>
          <svg className="w-3.5 h-3.5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
            <path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0z" />
            <path d="M5 18v2" />
            <path d="M19 18v2" />
          </svg>
          <span>
            {isOffer
              ? `${availableSeats} ${availableSeats === 1 ? 'seat left' : 'seats left'}`
              : (isFulfilled ? '1 seat found' : '1 seat needed')}
          </span>
        </div>
      </div>

      {/* 5. FOOTER: Student Profile & Peach View Details Button */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Student Avatar + Full Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            avatarId={travel.studentAvatarId || student.avatarId || 'm1'}
            src={student.imageUrl || travel.authorImage}
            name={studentName}
            email={student.email}
            size="sm"
            className="w-9 h-9 aspect-square rounded-full border border-[#F4E3D8] shrink-0"
          />
          <span className="font-black text-sm sm:text-base text-[#17233C] truncate">
            {studentName}
          </span>
        </div>

        {/* Peach-colored View Details Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onPress) onPress();
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-black text-xs sm:text-sm bg-[#FFF0E6] hover:bg-[#FFE0D0] text-[#FF572E] border border-[#FFD9C7] transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0"
        >
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </motion.div>
  );
}

export default RideCard;
