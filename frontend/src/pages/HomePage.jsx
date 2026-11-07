import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Search, Users, ArrowRight, Calendar, Clock, 
  Sparkles, ChevronRight, Zap, SlidersHorizontal,
  CheckCircle2, MapPin
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { 
  useUserProfile, 
  useMyTravels, 
  useUserMatches, 
  useUnreadNotificationsCount,
  useConfirmedBookings,
  categorizeConfirmedRides
} from '../hooks/useAppData';

// Crisp Car Outline Icon matching reference buttons
function ButtonCarIcon({ className = "w-4 h-4 sm:w-5 sm:h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

// 3D Styled Calendar Notepad Illustration for Recent Matches empty state
function CalendarIllustration({ className = "w-14 h-14" }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* 3 Radiating Orange Spark Lines */}
      <line x1="82" y1="20" x2="88" y2="14" stroke="#FF572E" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="88" y1="28" x2="95" y2="28" stroke="#FF572E" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="85" y1="36" x2="92" y2="40" stroke="#FF572E" strokeWidth="2.5" strokeLinecap="round" />

      {/* Shadow */}
      <rect x="22" y="30" width="56" height="58" rx="14" fill="#FFE8DC" />

      {/* Main Calendar Body */}
      <rect x="20" y="24" width="56" height="58" rx="14" fill="#FFFFFF" stroke="#F4E3D8" strokeWidth="2" />
      
      {/* Orange Top Header Strip */}
      <path d="M20 36 C20 28 24 24 32 24 H64 C72 24 76 28 76 36 V38 H20 Z" fill="#FF8A48" />

      {/* Binder Rings */}
      <rect x="32" y="18" width="5" height="10" rx="2.5" fill="#E65100" />
      <rect x="59" y="18" width="5" height="10" rx="2.5" fill="#E65100" />

      {/* Lines on calendar page */}
      <rect x="28" y="47" width="22" height="4" rx="2" fill="#F4E3D8" />
      <rect x="28" y="55" width="16" height="4" rx="2" fill="#F4E3D8" />

      {/* Orange Checkmark */}
      <path d="M48 64 L56 72 L72 52" stroke="#FF572E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Format minutes from midnight (0..1439) into 12-hour AM/PM format
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
 * Format date string nicely (e.g. Thu, 6 Nov)
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

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchVal, setSearchVal] = useState('');

  // Cached global data queries (instant navigation without full-page reloads)
  const { data: profile } = useUserProfile();
  const { data: myTravels = [], isLoading: travelsLoading } = useMyTravels();
  const { data: rawMatches, isLoading: matchesLoading } = useUserMatches();
  const userMatches = Array.isArray(rawMatches) ? rawMatches : (Array.isArray(rawMatches?.matches) ? rawMatches.matches : []);
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const { data: confirmedBookings = [] } = useConfirmedBookings();

  // Automatic date-based categorization: upcoming confirmed rides whose travel date has not passed
  const { upcoming: upcomingConfirmedRides } = useMemo(() => {
    return categorizeConfirmedRides(confirmedBookings);
  }, [confirmedBookings]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchVal.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchVal.trim())}`);
    } else {
      navigate('/rides');
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      unreadCount={unreadCount}
      customMobileHeader={
        <AppHeader
          avatarId={profile?.avatarId}
          onBell={() => navigate('/notifications')}
          unreadCount={unreadCount}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-1 pb-6 sm:pt-3 sm:pb-8 space-y-2.5 sm:space-y-3">
        
        {/* ========================================================================= */}
        {/* 1. HERO CARD                                                              */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-[22px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden p-3.5 sm:p-5"
        >
          {/* Subtle warm cream background glow at top */}
          <div className="absolute top-0 right-0 left-0 h-20 bg-gradient-to-b from-[#FFF5EE]/60 to-transparent pointer-events-none" />

          {/* Top Badge */}
          <div className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
            <Sparkles className="w-3 h-3 text-[#FF572E]" />
            <span>Smart Campus Mobility</span>
          </div>

          {/* Top Row: Heading on Left & Illustration on Right */}
          <div className="relative z-10 flex items-end justify-between gap-1 sm:gap-4">
            
            {/* Left: Heading & Subtitle */}
            <div className="flex-1 min-w-0 pb-0.5 pt-0.5">
              <h1 className="font-black text-[#17233C] text-[19px] sm:text-2xl md:text-3xl leading-[1.16] tracking-tight">
                Where are you <br />
                going{' '}
                <span className="text-[#FF572E] relative inline-inline">
                  today?
                  <span className="inline-block text-[#FF572E] text-sm sm:text-base font-black ml-0.5 select-none">
                    ∿
                  </span>
                </span>
              </h1>

              <p className="text-[11px] sm:text-xs text-[#6E7587] font-medium leading-normal mt-1 max-w-[175px] sm:max-w-xs">
                Share rides, split travel costs, and commute with verified students.
              </p>
            </div>

            {/* Right: Illustration aligned cleanly to bottom right */}
            <div className="shrink-0 w-[155px] sm:w-[200px] md:w-[230px] -mr-2 -mb-1 flex justify-end items-end">
              <img
                src="/webpage.png"
                alt="Helpu Student Travel"
                className="block w-full h-auto object-contain select-none pointer-events-none drop-shadow-xs"
                style={{
                  transform: "translate(4px, -6px) scale(1.04)",
                  transformOrigin: "bottom right"
                }}
              />
            </div>

          </div>

          {/* Two Hero Action Buttons: Find a Ride & Offer a Ride */}
          <div className="relative z-10 flex items-center gap-2 pt-2.5 mt-1">
            <button
              type="button"
              onClick={() => {
                const searchEl = document.getElementById('home-search-input');
                if (searchEl) {
                  searchEl.focus();
                } else {
                  navigate('/rides');
                }
              }}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-[#FFF7F2] active:scale-[0.98] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] rounded-full font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#FF572E] stroke-[2.5]" />
              <span>Find a Ride</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/rides/offer')}
              className="flex-1 py-2.5 px-3 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.98] text-white rounded-full font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
            >
              <ButtonCarIcon className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span>Offer a Ride</span>
              <ArrowRight className="w-3 h-3 text-white stroke-[2.5]" />
            </button>
          </div>

        </motion.div>


        {/* ========================================================================= */}
        {/* 2. ROUTE SEARCH BAR WITH FILTER ICON                                      */}
        {/* ========================================================================= */}
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="bg-white rounded-xl py-2.5 px-3.5 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-2 focus-within:border-[#FF572E] focus-within:ring-2 focus-within:ring-[#FF572E]/15 transition-all">
            <Search className="w-4 h-4 text-[#8C93A4] shrink-0" />
            
            <input
              id="home-search-input"
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search rides by route, destination, or campus..."
              className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none"
            />

            <button
              type="button"
              onClick={() => navigate('/rides')}
              title="Filter Rides"
              className="p-1 text-[#FF572E] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </form>


        {/* ========================================================================= */}
        {/* 3. ACTIVITY SUMMARY (2 SIDE-BY-SIDE CARDS: MY POSTS & MY MATCHES)         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          
          {/* Card 1: My Posts */}
          <div
            onClick={() => navigate('/posts')}
            className="bg-white rounded-[18px] p-3 sm:p-3.5 border border-[#F4E3D8] shadow-xs hover:shadow-sm relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            {/* Subtle bottom wave gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[#FFEBE0]/50 to-transparent pointer-events-none" />

            {/* Top Row: Icon + Chevron */}
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                <ButtonCarIcon className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="w-5.5 h-5.5 rounded-full bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            {/* Content */}
            <div className="mt-2 relative z-10">
              <h3 className="font-extrabold text-[11px] sm:text-xs text-[#17233C] leading-none">
                My Posts
              </h3>
              <div className="font-black text-xl sm:text-2xl text-[#17233C] my-0.5 leading-none">
                {travelsLoading ? '...' : myTravels.length}
              </div>
              <p className="text-[10px] text-[#6E7587] font-medium leading-none">
                {myTravels.length === 1 ? 'Published post' : 'Published posts'}
              </p>
            </div>
          </div>

          {/* Card 2: My Matches */}
          <div
            onClick={() => navigate('/matches')}
            className="bg-white rounded-[18px] p-3 sm:p-3.5 border border-[#F4E3D8] shadow-xs hover:shadow-sm relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            {/* Subtle bottom wave gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[#EBF9F1]/60 to-transparent pointer-events-none" />

            {/* Top Row: Icon + Chevron */}
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-[#EAF8F0] text-[#16A34A] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="w-5.5 h-5.5 rounded-full bg-[#EAF8F0] text-[#16A34A] flex items-center justify-center shrink-0">
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            {/* Content */}
            <div className="mt-2 relative z-10">
              <h3 className="font-extrabold text-[11px] sm:text-xs text-[#17233C] leading-none">
                My Matches
              </h3>
              <div className="font-black text-xl sm:text-2xl text-[#17233C] my-0.5 leading-none">
                {matchesLoading ? '...' : userMatches.length}
              </div>
              <p className="text-[10px] text-[#6E7587] font-medium leading-none">
                Compatible peers
              </p>
            </div>
          </div>

        </div>


        {/* ========================================================================= */}
        {/* 4. CONFIRMED RIDES SECTION                                                */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[20px] p-3 sm:p-4 border border-[#F4E3D8] shadow-xs relative overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#F4E3D8]/60">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-xs sm:text-sm text-[#17233C]">
                Confirmed Rides {upcomingConfirmedRides.length > 0 && `(${upcomingConfirmedRides.length})`}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/confirmed-rides')}
              className="text-xs font-black text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>See All</span>
              <ArrowRight className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          {upcomingConfirmedRides.length > 0 ? (
            /* Active Confirmed Rides List (ordered nearest first) */
            <div className="space-y-2">
              {upcomingConfirmedRides.slice(0, 3).map((booking) => {
                const travel = typeof booking.travelId === 'object' ? booking.travelId : {};
                const peer = booking.peer || {};
                const peerName = peer.name || 'Campus Peer';
                const dateDisplay = formatTravelDate(travel?.travelDate || booking.travelDate);
                const timeDisplay = formatMinutesToTime(travel?.departureTime);
                const isHost = booking.userRole === 'host';

                return (
                  <div
                    key={booking._id}
                    onClick={() => navigate(`/bookings/${booking._id}`)}
                    className="p-2.5 sm:p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 flex flex-col gap-2 cursor-pointer active:scale-[0.99] transition-all"
                  >
                    {/* Top Row: Route & Confirmed Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                        <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                          {travel?.source || 'Origin'}
                        </span>
                        <span className="text-[#8C93A4] text-xs font-bold shrink-0">→</span>
                        <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                          {travel?.destination || 'Destination'}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] shrink-0">
                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                        <span>Confirmed</span>
                      </span>
                    </div>

                    {/* Bottom Row: Date & Time + Role & Peer Avatar */}
                    <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-[#F4E3D8]/40">
                      <div className="flex items-center gap-2 text-[#6E7587] font-bold text-[11px]">
                        <span className="flex items-center gap-1 text-[#17233C]">
                          <Calendar className="w-3 h-3 text-[#FF572E]" />
                          <span>{dateDisplay}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#FF572E]" />
                          <span>{timeDisplay}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Avatar
                          src={peer.imageUrl}
                          name={peerName}
                          avatarId={peer.avatarId || 'm1'}
                          size="xs"
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="text-[10px] font-bold text-[#6E7587] truncate max-w-[100px] sm:max-w-none">
                          {isHost ? `Passenger: ${peerName}` : `Host: ${peerName}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Clean Empty State */
            <div className="py-3 px-2 text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center mb-1.5">
                <CheckCircle2 className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <h4 className="font-extrabold text-xs text-[#17233C]">
                No confirmed rides yet
              </h4>
              <p className="text-[11px] text-[#8C93A4] max-w-xs mt-0.5 leading-snug">
                When you and your co-travelers confirm a ride booking, it will appear here.
              </p>
              <button
                type="button"
                onClick={() => navigate('/confirmed-rides')}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#FF572E] hover:underline cursor-pointer"
              >
                <span>View Ride History →</span>
              </button>
            </div>
          )}

        </div>


        {/* ========================================================================= */}
        {/* 5. RECENT MATCHES SECTION                                                 */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[20px] p-3 sm:p-4 border border-[#F4E3D8] shadow-xs relative overflow-hidden">
          
          {userMatches.length > 0 ? (
            /* Active Matches Found: Clean header and active connection list */
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F4E3D8]/60">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 fill-[#FF572E]/10 stroke-[2.5]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C]">
                    Recent Matches ({userMatches.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/matches')}
                  className="text-xs font-black text-[#FF572E] hover:underline cursor-pointer"
                >
                  See All →
                </button>
              </div>

              <div className="space-y-2">
                {userMatches.slice(0, 2).map((match) => {
                  const student = match.student || match.creator || {};
                  const isOffer = (match.type || 'offer') === 'offer';
                  const dateDisplay = formatTravelDate(match.travelDate);

                  return (
                    <div
                      key={match._id}
                      onClick={() => navigate('/matches')}
                      className="p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          avatarId={student?.avatarId || 'm1'}
                          src={student?.imageUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-[#17233C] truncate">
                            {student?.name || 'Campus Peer'}
                          </h4>
                          <p className="text-[10px] text-[#6E7587] truncate">
                            {match.source} → {match.destination}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isOffer ? 'bg-[#EDFAF3] text-[#16A34A]' : 'bg-[#FFF4ED] text-[#FF572E]'
                        }`}>
                          {isOffer ? 'Offer' : 'Request'}
                        </span>
                        <span className="block text-[10px] text-[#8C93A4] font-medium mt-0.5">
                          {dateDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Empty State: Compact friendly banner when no matches exist yet */
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded-md bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 fill-[#FF572E]/10 stroke-[2.5]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] leading-tight">
                    Recent Matches
                  </h3>
                </div>
                
                <p className="text-[11px] text-[#6E7587] font-medium leading-relaxed max-w-[210px] sm:max-w-xs">
                  No new matches yet. Your matching updates will appear here.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/posts')}
                  className="inline-flex items-center gap-1 text-[11px] font-black text-[#FF572E] hover:text-[#E64A22] transition-colors mt-2 cursor-pointer group"
                >
                  <span>View My Posts</span>
                  <ArrowRight className="w-3 h-3 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Right: 3D Calendar Graphic */}
              <div className="shrink-0 flex items-center justify-center">
                <CalendarIllustration className="w-14 h-14 sm:w-16 sm:h-16" />
              </div>
            </div>
          )}

        </div>

      </div>
    </ResponsiveShell>
  );
}
