import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Search, Users, ArrowRight, Calendar, Clock, 
  Sparkles, ChevronRight, Zap, SlidersHorizontal,
  CheckCircle2, MapPin, Car, ShieldCheck, CarTaxiFront,
  FileText, History, CalendarDays
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { ServiceSwitcher } from '../components/layout/ServiceSwitcher';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { GuestAuthPromptModal } from '../components/auth/GuestAuthPromptModal';
import { 
  useUserProfile, 
  useMyTravels, 
  useUserMatches, 
  useUnreadNotificationsCount,
  useConfirmedBookings
} from '../hooks/useAppData';
import { categorizeConfirmedRides } from '../lib/utils';
import { useScrollRestoration } from '../hooks/useScrollRestoration';

/**
 * Format minutes from midnight into 12-hour AM/PM format
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
  const { user, isSignedIn } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authReturnPath, setAuthReturnPath] = useState('/home');

  // Phase 4: Preserve scroll position when navigating away and returning
  useScrollRestoration();

  const handleProtectedNavigate = (path) => {
    if (!isSignedIn) {
      setAuthReturnPath(path);
      setShowAuthModal(true);
      return;
    }
    navigate(path);
  };

  // Cached global data queries (real backend data)
  const { data: profile } = useUserProfile();
  const { data: myTravels = [], isLoading: travelsLoading } = useMyTravels();
  const { data: rawMatches, isLoading: matchesLoading } = useUserMatches();
  const userMatches = Array.isArray(rawMatches) ? rawMatches : (Array.isArray(rawMatches?.matches) ? rawMatches.matches : []);
  const { data: unreadCount = 0 } = useUnreadNotificationsCount({ module: 'poolmate' });
  const { data: confirmedBookings = [] } = useConfirmedBookings();

  // Automatic date-based categorization: upcoming confirmed rides whose travel date has not passed
  const { upcoming: upcomingConfirmedRides } = useMemo(() => {
    return categorizeConfirmedRides(confirmedBookings);
  }, [confirmedBookings]);

  const firstName = profile?.name ? profile.name.split(' ')[0] : (user?.firstName || 'Student');

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      unreadCount={unreadCount}
      customMobileHeader={
        <AppHeader
          avatarId={profile?.avatarId}
          onBell={() => handleProtectedNavigate('/notifications')}
          unreadCount={unreadCount}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-2 pb-6 sm:pt-4 sm:pb-10 space-y-4 sm:space-y-6">

        {/* ========================================================================= */}
        {/* 1. WELCOME GREETING (COMPACT & MODERN)                                    */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-black text-[#17233C] text-lg sm:text-xl md:text-2xl tracking-tight">
              Welcome back, {firstName}
            </h2>
            <span className="text-lg">👋</span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-[#F4E3D8] hover:border-[#FF572E]/40 rounded-full text-xs font-bold text-[#17233C] shadow-2xs transition-all cursor-pointer"
          >
            <span>My Profile</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#FF572E]" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. FLIPKART-STYLE TOP SERVICE SWITCHER: [ PoolMate ]   [ SlotMate ]       */}
        {/* ========================================================================= */}
        <ServiceSwitcher activeService="poolmate" />

        {/* ========================================================================= */}
        {/* 3. QUICK SERVICE SHORTCUTS (4 COMPACT ITEMS IN ONE ROW)                   */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-4 gap-2 min-[360px]:gap-2.5 sm:gap-4 py-1">
          {/* 1. Offer Ride */}
          <button
            type="button"
            onClick={() => navigate('/rides/offer?mode=offer')}
            className="flex flex-col items-center justify-center gap-1.5 p-1 sm:p-2 rounded-2xl hover:bg-white/80 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shadow-2xs group-hover:shadow-xs group-hover:scale-105 transition-all">
              <Car className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.4]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-black text-[#17233C] text-center whitespace-nowrap group-hover:text-[#FF572E] transition-colors">
              Offer Ride
            </span>
          </button>

          {/* 2. Find Ride */}
          <button
            type="button"
            onClick={() => navigate('/rides/offer?mode=find')}
            className="flex flex-col items-center justify-center gap-1.5 p-1 sm:p-2 rounded-2xl hover:bg-white/80 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#EAF5FF] text-[#0284C7] flex items-center justify-center shadow-2xs group-hover:shadow-xs group-hover:scale-105 transition-all">
              <Search className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.4]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-black text-[#17233C] text-center whitespace-nowrap group-hover:text-[#0284C7] transition-colors">
              Find Ride
            </span>
          </button>

          {/* 3. Shared Groups */}
          <button
            type="button"
            onClick={() => handleProtectedNavigate('/shared-rides')}
            className="flex flex-col items-center justify-center gap-1.5 p-1 sm:p-2 rounded-2xl hover:bg-white/80 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center shadow-2xs group-hover:shadow-xs group-hover:scale-105 transition-all">
              <Users className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.4]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-black text-[#17233C] text-center whitespace-nowrap group-hover:text-[#9333EA] transition-colors">
              Shared Groups
            </span>
          </button>

          {/* 4. My Posts */}
          <button
            type="button"
            onClick={() => handleProtectedNavigate('/posts')}
            className="flex flex-col items-center justify-center gap-1.5 p-1 sm:p-2 rounded-2xl hover:bg-white/80 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shadow-2xs group-hover:shadow-xs group-hover:scale-105 transition-all">
              <FileText className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.4]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-black text-[#17233C] text-center whitespace-nowrap group-hover:text-[#16A34A] transition-colors">
              My Posts
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 4. REDESIGNED HERO BANNER (COMPACT FLIPKART-INSPIRED)                     */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-gradient-to-r from-[#FFF5EE] via-[#FFF9F5] to-[#FFF2EB] rounded-[22px] min-[360px]:rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden p-3.5 min-[360px]:p-4 sm:p-5"
        >
          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex-1 min-w-0 pr-0.5 sm:pr-1 space-y-1 sm:space-y-1.5">
              <h1 className="font-black text-[#17233C] text-[18px] min-[360px]:text-[20px] sm:text-2xl md:text-3xl leading-[1.18] tracking-tight">
                Travel Together <br />
                with <span className="text-[#FF572E]">PoolMate</span>
              </h1>
              <p className="text-[11px] min-[360px]:text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-xs sm:max-w-md">
                Share rides, split costs and make campus travel easier.
              </p>
            </div>

            {/* Right Illustration: Crisp, prominent & balanced */}
            <div 
              className="shrink-0 w-[145px] min-[360px]:w-[165px] min-[375px]:w-[180px] min-[390px]:w-[195px] min-[470px]:w-[220px] sm:w-[260px] md:w-[300px] lg:w-[340px] -mr-1 min-[360px]:-mr-2 sm:-mr-3 flex justify-end items-center"
              style={{ maxWidth: '54%' }}
            >
              <img
                src="/webpage.png"
                alt="PoolMate Campus Travel"
                className="w-full h-auto max-h-[125px] sm:max-h-[165px] object-contain select-none pointer-events-none drop-shadow-xs"
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 5. YOUR TRAVEL ACTIVITY CARD (PLACED DIRECTLY AFTER HERO BANNER)           */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[22px] min-[360px]:rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
            <h3 className="font-black text-sm sm:text-base text-[#17233C]">
              Your Travel Activity
            </h3>
            <span className="text-[11px] font-bold text-[#FF572E]">
              {(travelsLoading || matchesLoading) && myTravels.length === 0 ? 'Data loading...' : 'Live Sync'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Stat 1: My Posts */}
            <div
              onClick={() => navigate('/posts')}
              className="bg-[#FFF8F3] border border-[#F4E3D8] rounded-2xl p-2.5 sm:p-3 text-center cursor-pointer hover:border-[#FF572E]/40 active:scale-95 transition-all"
            >
              <div className="font-black text-lg sm:text-xl text-[#17233C]">
                {travelsLoading ? '...' : myTravels.length}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] mt-0.5 leading-tight">
                Published
              </div>
            </div>

            {/* Stat 2: Active Matches */}
            <div
              onClick={() => navigate('/match')}
              className="bg-[#FFF8F3] border border-[#F4E3D8] rounded-2xl p-2.5 sm:p-3 text-center cursor-pointer hover:border-[#FF572E]/40 active:scale-95 transition-all"
            >
              <div className="font-black text-lg sm:text-xl text-[#17233C]">
                {matchesLoading ? '...' : userMatches.length}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] mt-0.5 leading-tight">
                Matches
              </div>
            </div>

            {/* Stat 3: Confirmed Rides */}
            <div
              onClick={() => navigate('/confirmed-rides')}
              className="bg-[#EDFAF3] border border-[#BCECD4] rounded-2xl p-2.5 sm:p-3 text-center cursor-pointer hover:border-emerald-400 active:scale-95 transition-all"
            >
              <div className="font-black text-lg sm:text-xl text-[#16A34A]">
                {upcomingConfirmedRides.length}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-[#16A34A] mt-0.5 leading-tight">
                Confirmed
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. CAB POOLING PROMO BANNER WITH FLIGHT.PNG (MATCHING IMAGE 3)            */}
        {/* ========================================================================= */}
        <div
          onClick={() => navigate('/shared-rides')}
          className="relative bg-gradient-to-r from-[#FF572E] via-[#FF6030] to-[#FF451A] rounded-[22px] min-[360px]:rounded-[24px] sm:rounded-[28px] border border-[#FF572E]/30 shadow-md shadow-[#FF572E]/20 overflow-hidden p-3.5 min-[360px]:p-4 sm:p-5 cursor-pointer active:scale-[0.99] transition-all group"
        >
          <div className="relative z-10 flex items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex-1 min-w-0 pr-1 space-y-1 sm:space-y-1.5">
              <span className="inline-block px-3 py-0.5 sm:py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-0.5 sm:mb-1">
                CAB POOLING
              </span>
              <h3 className="font-black text-white text-[17px] min-[360px]:text-[19px] sm:text-2xl md:text-3xl leading-[1.18] tracking-tight">
                Travelling to the airport or station?
              </h3>
              <p className="text-white/95 text-[11px] min-[360px]:text-xs sm:text-sm font-medium leading-relaxed max-w-[210px] min-[390px]:max-w-[250px] sm:max-w-md">
                Team up in Shared Ride Groups to pool a commercial cab and split costs equally!
              </p>
            </div>

            {/* Right Illustration: flight.png */}
            <div 
              className="shrink-0 w-[135px] min-[360px]:w-[155px] min-[390px]:w-[170px] sm:w-[220px] md:w-[270px] -mr-1 min-[360px]:-mr-2 sm:-mr-3 flex justify-end items-center"
              style={{ maxWidth: '52%' }}
            >
              <img
                src="/flight.png"
                alt="Cab Pooling - Airport and Station"
                className="w-full h-auto max-h-[110px] sm:max-h-[155px] object-contain select-none pointer-events-none drop-shadow-sm group-hover:scale-105 transition-transform"
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7. CONFIRMED RIDES & RECENT MATCHES GRID (2 Cols on Desktop, 1 on Mobile)  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          
          {/* UPCOMING CONFIRMED RIDES */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#F4E3D8]/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />
                </div>
                <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                  Upcoming Confirmed Rides {upcomingConfirmedRides.length > 0 && `(${upcomingConfirmedRides.length})`}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => navigate('/confirmed-rides')}
                className="text-xs font-extrabold text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>See All</span>
                <ArrowRight className="w-3 h-3 stroke-[2.4]" />
              </button>
            </div>

            {upcomingConfirmedRides.length > 0 ? (
              <div className="space-y-2.5">
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
                      className="p-3 sm:p-3.5 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 flex flex-col gap-2.5 cursor-pointer active:scale-[0.99] transition-all group"
                    >
                      {/* Top: Route & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                          <span className="font-black text-xs sm:text-sm text-[#17233C] truncate">
                            {travel?.source || 'Origin'}
                          </span>
                          <span className="text-[#FF572E] text-xs font-bold shrink-0">→</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                          <span className="font-black text-xs sm:text-sm text-[#17233C] truncate">
                            {travel?.destination || 'Destination'}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] shrink-0">
                          <CheckCircle2 className="w-3 h-3 stroke-[2.4]" />
                          <span>Confirmed</span>
                        </span>
                      </div>

                      {/* Bottom: Date/Time + Peer Info */}
                      <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-[#F4E3D8]/50">
                        <div className="flex items-center gap-2 text-[#6E7587] font-bold text-[11px]">
                          <span className="flex items-center gap-1 text-[#17233C]">
                            <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{dateDisplay}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
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
                          <span className="text-[11px] font-bold text-[#6E7587] truncate max-w-[120px] sm:max-w-none">
                            {isHost ? `Passenger: ${peerName}` : `Driver: ${peerName}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 px-2 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-2xl bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h4 className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                  No confirmed rides yet
                </h4>
                <p className="text-[11px] text-[#6E7587] max-w-xs mt-1 leading-relaxed">
                  When you confirm a ride offer or request with another student, your trip itinerary will appear right here.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/confirmed-rides')}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-black text-[#FF572E] hover:underline cursor-pointer"
                >
                  <span>View Completed Trip History →</span>
                </button>
              </div>
            )}
          </div>

          {/* RECENT MATCHES & ACTIVITY */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#F4E3D8]/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 fill-[#FF572E]/10 stroke-[2.4]" />
                </div>
                <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                  Recent Relevant Matches {userMatches.length > 0 && `(${userMatches.length})`}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => navigate('/match')}
                className="text-xs font-extrabold text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Explore Matches</span>
                <ArrowRight className="w-3 h-3 stroke-[2.4]" />
              </button>
            </div>

            {userMatches.length > 0 ? (
              <div className="space-y-2.5">
                {userMatches.slice(0, 3).map((match) => {
                  const student = match.student || match.creator || {};
                  const isOffer = (match.type || 'offer') === 'offer';
                  const dateDisplay = formatTravelDate(match.travelDate);

                  return (
                    <div
                      key={match._id}
                      onClick={() => navigate('/match')}
                      className="p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          avatarId={student?.avatarId || 'm1'}
                          src={student?.imageUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-black text-xs sm:text-sm text-[#17233C] truncate">
                              {student?.name || 'Campus Student'}
                            </h4>
                            {student?.isVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#6E7587] truncate font-medium">
                            {match.source} → {match.destination}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          isOffer ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]' : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                        }`}>
                          {isOffer ? 'Car Offer' : 'Passenger'}
                        </span>
                        <span className="block text-[11px] text-[#8C93A4] font-semibold mt-1">
                          {dateDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 px-2 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h4 className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                  No active matches yet
                </h4>
                <p className="text-[11px] text-[#6E7587] max-w-xs mt-1 leading-relaxed">
                  Publish your own travel offer or request to let Helpu instantly discover compatible campus co-travelers!
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-2.5"
                  onClick={() => navigate('/rides/offer')}
                >
                  Publish Travel Post
                </Button>
              </div>
            )}
          </div>

        </div>

      </div>

      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="Helpu"
        returnPath={authReturnPath}
      />
    </ResponsiveShell>
  );
}
