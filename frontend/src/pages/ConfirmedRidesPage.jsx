import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Clock, Calendar, MapPin, ArrowRight, 
  Car, Users, Sparkles, History, ArrowLeft
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { 
  useConfirmedBookings, 
  useUnreadNotificationsCount 
} from '../hooks/useAppData';
import { openWhatsAppChat } from '../lib/whatsapp';
import { formatCurrency, categorizeConfirmedRides } from '../lib/utils';

/**
 * Format minutes from midnight into 12-hour AM/PM format (e.g. 08:30 AM)
 */
function formatMinutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return 'Flexible Time';
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
  if (!dateStr) return 'Upcoming';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Upcoming';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export default function ConfirmedRidesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed'

  const { data: confirmedList = [], isLoading } = useConfirmedBookings();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();

  // Categorize confirmed rides into Upcoming and Completed history based on local date
  const { upcoming, completed } = useMemo(() => {
    return categorizeConfirmedRides(confirmedList);
  }, [confirmedList]);

  const currentList = activeTab === 'upcoming' ? upcoming : completed;

  // WhatsApp coordination click handler
  const handleOpenWhatsApp = (e, booking) => {
    e.stopPropagation();
    const peer = booking.peer || {};
    const travel = typeof booking.travelId === 'object' ? booking.travelId : {};
    const rawPhone = peer.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const peerName = peer.name || 'Campus Student';
    const fromCity = travel.source || 'Campus';
    const toCity = travel.destination || 'Destination';

    if (!cleanPhone || cleanPhone.length < 10) {
      alert(`${peerName} has not shared a valid WhatsApp contact number.`);
      return;
    }

    const defaultMsg = `Hi ${peerName}! We have a confirmed ride on HelpU from ${fromCity} to ${toCity}. Looking forward to coordinating our travel!`;

    openWhatsAppChat({
      phone: cleanPhone,
      name: peerName,
      route: `${fromCity} → ${toCity}`,
      message: defaultMsg,
      isOwn: false
    });
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      unreadCount={unreadCount}
      customMobileHeader={
        <AppHeader
          title="Confirmed Rides"
          backTo="/home"
          onBell={() => navigate('/notifications')}
          unreadCount={unreadCount}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 pb-12 sm:pt-4 space-y-4">
        
        {/* ========================================================================= */}
        {/* HEADER & TAB SWITCHER                                                     */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="hidden sm:flex p-1.5 -ml-1 text-[#17233C] hover:bg-[#FFF7F2] rounded-xl transition cursor-pointer"
                aria-label="Back to Home"
              >
                <ArrowLeft className="w-5 h-5 text-[#17233C]" />
              </button>
              <div>
                <h1 className="font-black text-xl sm:text-2xl text-[#17233C] tracking-tight">
                  Confirmed Rides
                </h1>
                <p className="text-xs text-[#6E7587] font-medium mt-0.5">
                  Your confirmed travel bookings and permanent ride history.
                </p>
              </div>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDFAF3] border border-[#BCECD4] text-[11px] font-black text-[#16A34A]">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{upcoming.length} Upcoming</span>
            </div>
          </div>

          {/* Pill Tabs: Upcoming vs Completed */}
          <div className="grid grid-cols-2 p-1 bg-[#FFF5EE] rounded-2xl border border-[#FDE0D0]/80">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-white text-[#FF572E] shadow-xs'
                  : 'text-[#6E7587] hover:text-[#17233C]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Upcoming</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === 'upcoming'
                  ? 'bg-[#FF572E] text-white'
                  : 'bg-[#F4E3D8] text-[#6E7587]'
              }`}>
                {upcoming.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-white text-[#FF572E] shadow-xs'
                  : 'text-[#6E7587] hover:text-[#17233C]'
              }`}
            >
              <History className="w-4 h-4 stroke-[2.2]" />
              <span>Completed</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === 'completed'
                  ? 'bg-[#FF572E] text-white'
                  : 'bg-[#F4E3D8] text-[#6E7587]'
              }`}>
                {completed.length}
              </span>
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIDES LIST / EMPTY STATE                                                  */}
        {/* ========================================================================= */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            /* Loading Skeleton */
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((n) => (
                <div key={n} className="h-44 bg-white rounded-[24px] border border-[#F4E3D8]" />
              ))}
            </div>
          ) : currentList.length > 0 ? (
            /* Rides Found */
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {currentList.map((booking) => {
                const travel = typeof booking.travelId === 'object' ? booking.travelId : {};
                const peer = booking.peer || {};
                const isHost = booking.userRole === 'host';
                const dateDisplay = formatTravelDate(travel?.travelDate || booking.travelDate);
                const timeDisplay = formatMinutesToTime(travel?.departureTime);
                const peerName = peer.name || (isHost ? 'Campus Passenger' : 'Ride Host');
                const seats = booking.requestedSeats || 1;
                const price = booking.totalPrice || travel?.pricePerSeat || 0;
                const isCompleted = activeTab === 'completed' || booking.status === 'completed';

                return (
                  <div
                    key={booking._id}
                    onClick={() => navigate(`/bookings/${booking._id}`)}
                    className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col gap-3.5 relative overflow-hidden group"
                  >
                    {/* Top Header: Role badge, Status pill & Price */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Host / Passenger pill */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                          isHost 
                            ? 'bg-[#FFF0E6] text-[#FF572E] border border-[#FFD9C7]' 
                            : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        }`}>
                          <Car className="w-3 h-3 stroke-[2.5]" />
                          <span>{isHost ? 'Hosting Ride' : 'Traveling as Passenger'}</span>
                        </span>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                          isCompleted
                            ? 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                            : 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                        }`}>
                          <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                          <span>{isCompleted ? 'Completed' : 'Confirmed'}</span>
                        </span>
                      </div>

                      {price > 0 && (
                        <div className="font-black text-sm sm:text-base text-[#17233C] shrink-0">
                          {formatCurrency(price)}
                        </div>
                      )}
                    </div>

                    {/* Route Section */}
                    <div className="flex items-start gap-3 my-0.5">
                      <div className="flex flex-col items-center pt-1 shrink-0">
                        <div className="w-3 h-3 rounded-full border-2 border-[#16A34A] bg-white ring-2 ring-[#DCFCE7]" />
                        <div className="w-0.5 h-6 border-l-2 border-dashed border-[#CBD5E1] my-1" />
                        <MapPin className="w-3.5 h-3.5 text-[#FF572E] fill-[#FF572E]" />
                      </div>

                      <div className="flex flex-col justify-between gap-2 min-w-0 flex-1">
                        <div className="font-black text-[#17233C] text-sm sm:text-base truncate leading-tight capitalize">
                          {travel?.source || 'Origin'}
                        </div>
                        <div className="font-black text-[#17233C] text-sm sm:text-base truncate leading-tight capitalize">
                          {travel?.destination || 'Destination'}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Divider */}
                    <div className="border-t border-[#F4E3D8]/80" />

                    {/* Schedule: Date | Time | Seats */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 text-[#17233C] font-black">
                        <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                        <span>{dateDisplay}</span>
                      </div>

                      <span className="text-gray-300 font-light select-none">|</span>

                      <div className="flex items-center gap-1.5 text-[#17233C] font-black">
                        <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                        <span>{timeDisplay}</span>
                      </div>

                      <span className="text-gray-300 font-light select-none">|</span>

                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6E7587]">
                        <Users className="w-3 h-3" />
                        <span>{seats} {seats === 1 ? 'seat reserved' : 'seats reserved'}</span>
                      </div>
                    </div>

                    {/* Footer: Peer Details + Action Buttons */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      
                      {/* Peer info */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={peer.imageUrl}
                          name={peerName}
                          avatarId={peer.avatarId || 'm1'}
                          size="sm"
                          className="w-8 h-8 rounded-full border border-[#F4E3D8] shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate block leading-tight">
                            {peerName}
                          </span>
                          <span className="text-[10px] text-[#8C93A4] font-medium block leading-none mt-0.5">
                            {isHost ? 'Co-traveler' : 'Trip Host'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* WhatsApp Coordination Button */}
                        {!isCompleted && peer.phone && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenWhatsApp(e, booking)}
                            className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                            title="Chat on WhatsApp"
                          >
                            <img 
                              src="/whatsapp.png" 
                              alt="WhatsApp" 
                              className="w-4 h-4 object-contain" 
                              onError={(ev) => { ev.currentTarget.src = '/whatsapp.svg'; }} 
                            />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>
                        )}

                        {/* View Booking Details Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/bookings/${booking._id}`);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-black text-xs bg-[#FFF0E6] hover:bg-[#FFE0D0] text-[#FF572E] border border-[#FFD9C7] transition-all cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <span>Details</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}
            </motion.div>
          ) : (
            /* Clean Empty State */
            <motion.div
              key={activeTab + '-empty'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[28px] p-8 sm:p-12 text-center border border-[#F4E3D8] shadow-xs space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mx-auto shadow-2xs">
                {activeTab === 'upcoming' ? (
                  <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
                ) : (
                  <History className="w-7 h-7 stroke-[2.2]" />
                )}
              </div>

              <div>
                <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                  {activeTab === 'upcoming' 
                    ? 'No Upcoming Confirmed Rides' 
                    : 'No Past Rides Yet'}
                </h3>
                <p className="text-xs sm:text-sm text-[#6E7587] max-w-sm mx-auto mt-1 leading-relaxed">
                  {activeTab === 'upcoming'
                    ? 'When you and a student confirm a ride booking, your trip details and coordination links will appear here.'
                    : 'Your completed travel history is permanently archived here once the travel date passes.'}
                </p>
              </div>

              {activeTab === 'upcoming' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/rides/offer')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Explore Available Rides</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}

