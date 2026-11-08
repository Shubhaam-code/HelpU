import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Search, Users, ArrowRight, Calendar, Clock, 
  Sparkles, ChevronRight, Zap, SlidersHorizontal,
  CheckCircle2, MapPin, Car, ShieldCheck, CarTaxiFront,
  FileText, History
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
  useUserProfile, 
  useMyTravels, 
  useUserMatches, 
  useUnreadNotificationsCount,
  useConfirmedBookings
} from '../hooks/useAppData';
import { categorizeConfirmedRides } from '../lib/utils';

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
  const { user } = useUser();
  const [searchVal, setSearchVal] = useState('');

  // Cached global data queries (real backend data)
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
      navigate(`/rides/offer?search=${encodeURIComponent(searchVal.trim())}`);
    } else {
      navigate('/rides/offer');
    }
  };

  const firstName = profile?.name ? profile.name.split(' ')[0] : (user?.firstName || 'Student');

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
      <div className="w-full max-w-xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-2 pb-6 sm:pt-4 sm:pb-10 space-y-4 sm:space-y-6">

        {/* ========================================================================= */}
        {/* 1. WELCOME GREETING BANNER (COMPACT & MODERN)                              */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-black text-[#17233C] text-lg sm:text-xl md:text-2xl tracking-tight">
                Welcome back, {firstName}
              </h2>
              <span className="text-lg">👋</span>
            </div>
            <p className="text-xs text-[#6E7587] font-medium flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#FF572E]" />
              <span>{profile?.college || 'VIT, Bhopal Campus'}</span>
              {profile?.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline ml-0.5" />
              )}
            </p>
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
        {/* MAIN DASHBOARD GRID (2 Columns on Desktop, Single Column on Mobile)       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          
          {/* ======================================================================= */}
          {/* LEFT COLUMN: HERO ACTION CARD, SEARCH, CONFIRMED RIDES & MATCHES (8 COLS) */}
          {/* ======================================================================= */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-5">
            
            {/* HERO ACTION CARD */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-[22px] min-[360px]:rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden p-3 min-[360px]:p-3.5 sm:p-5"
            >
              {/* Subtle warm glow background */}
              <div className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-[#FFF5EE] to-transparent pointer-events-none" />

              {/* Content Row: Text + Visual Hero Illustration */}
              <div className="relative z-10 flex items-center justify-between gap-1.5 min-[360px]:gap-2 sm:gap-4">
                <div className="flex-1 min-w-0 pr-0.5 sm:pr-1">
                  {/* Tag / Badge */}
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[9.5px] min-[360px]:text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1.5 min-[360px]:mb-2 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-[#FF572E]" />
                    <span>Peer-to-Peer Campus Travel</span>
                  </div>

                  <h1 className="font-black text-[#17233C] text-[17px] min-[360px]:text-[18.5px] min-[390px]:text-[20px] sm:text-2xl md:text-3xl leading-[1.15] tracking-tight">
                    Where are you <br />
                    heading <span className="text-[#FF572E]">today?</span>
                  </h1>
                  <p className="text-[11px] min-[360px]:text-[11.5px] sm:text-xs md:text-sm text-[#6E7587] font-medium leading-relaxed mt-1 sm:mt-1.5 line-clamp-3">
                    Connect with fellow students, share vehicle rides, and split cab fares seamlessly.
                  </p>
                </div>

                {/* Right Illustration: Prominent, Crisp & Visually Balanced (1.5x-1.8x Presence) */}
                <div 
                  className="shrink-0 w-[145px] min-[360px]:w-[165px] min-[375px]:w-[180px] min-[390px]:w-[195px] min-[470px]:w-[220px] sm:w-[260px] md:w-[300px] lg:w-[340px] -mr-1 min-[360px]:-mr-2 sm:-mr-4 flex justify-end items-center"
                  style={{ maxWidth: '58%' }}
                >
                  <img
                    src="/webpage.png"
                    alt="Helpu Student Travel"
                    className="w-full h-auto max-h-[140px] sm:max-h-[195px] object-contain select-none pointer-events-none drop-shadow-xs"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* 2 Primary Action Buttons: Offer a Ride & Find a Ride */}
              <div className="relative z-10 grid grid-cols-2 gap-2 min-[360px]:gap-2.5 sm:gap-3.5 pt-3 mt-2 border-t border-[#F4E3D8]/60">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/rides/offer?mode=offer')}
                  leftIcon={<Car className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />}
                >
                  Offer a Ride
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate('/rides/offer?mode=find')}
                  leftIcon={<Search className="w-4 h-4 text-[#FF572E]" />}
                >
                  Find a Ride
                </Button>
              </div>
            </motion.div>

            {/* ROUTE SEARCH BAR */}
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <div className="bg-white rounded-xl py-2.5 px-3.5 sm:px-4 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-2.5 focus-within:border-[#FF572E] focus-within:ring-2 focus-within:ring-[#FF572E]/15 transition-all">
                <Search className="w-4 h-4 text-[#8C93A4] shrink-0" />
                <input
                  id="home-search-input"
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search destination, airport, railway station, or campus route..."
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#17233C] placeholder:text-[#8C93A4] placeholder:font-normal focus:outline-none"
                />
                <button
                  type="submit"
                  title="Search Routes"
                  className="px-3 py-1 bg-[#FFF4ED] hover:bg-[#FFEBE0] text-[#FF572E] text-xs font-black rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Search
                </button>
              </div>
            </form>

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

          {/* ======================================================================= */}
          {/* RIGHT COLUMN: TRAVEL STATS, QUICK SHORTCUTS & POOLING BANNER (4 COLS)   */}
          {/* ======================================================================= */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-5">
            
            {/* REAL ACTIVITY STATS CARD */}
            <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
                <h3 className="font-black text-sm text-[#17233C]">
                  Your Travel Activity
                </h3>
                <span className="text-[11px] font-bold text-[#FF572E]">Live Sync</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Stat 1: My Posts */}
                <div
                  onClick={() => navigate('/posts')}
                  className="bg-[#FFF8F3] border border-[#F4E3D8] rounded-2xl p-2.5 text-center cursor-pointer hover:border-[#FF572E]/40 transition-colors"
                >
                  <div className="font-black text-lg text-[#17233C]">
                    {travelsLoading ? '...' : myTravels.length}
                  </div>
                  <div className="text-[10px] font-bold text-[#6E7587] mt-0.5 leading-tight">
                    Published
                  </div>
                </div>

                {/* Stat 2: Active Matches */}
                <div
                  onClick={() => navigate('/match')}
                  className="bg-[#FFF8F3] border border-[#F4E3D8] rounded-2xl p-2.5 text-center cursor-pointer hover:border-[#FF572E]/40 transition-colors"
                >
                  <div className="font-black text-lg text-[#17233C]">
                    {matchesLoading ? '...' : userMatches.length}
                  </div>
                  <div className="text-[10px] font-bold text-[#6E7587] mt-0.5 leading-tight">
                    Matches
                  </div>
                </div>

                {/* Stat 3: Confirmed Rides */}
                <div
                  onClick={() => navigate('/confirmed-rides')}
                  className="bg-[#EDFAF3] border border-[#BCECD4] rounded-2xl p-2.5 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                >
                  <div className="font-black text-lg text-[#16A34A]">
                    {upcomingConfirmedRides.length}
                  </div>
                  <div className="text-[10px] font-bold text-[#16A34A] mt-0.5 leading-tight">
                    Confirmed
                  </div>
                </div>
              </div>
            </div>

            {/* QUICK SHORTCUTS GRID */}
            <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
              <h3 className="font-black text-sm text-[#17233C] pb-2 border-b border-[#F4E3D8]/60">
                Quick Shortcuts
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Shortcut 1: Offer Ride */}
                <button
                  type="button"
                  onClick={() => navigate('/rides/offer?mode=offer')}
                  className="p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-left transition-all cursor-pointer active:scale-95 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mb-2">
                    <Car className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div className="font-black text-xs text-[#17233C] group-hover:text-[#FF572E]">
                    Offer Ride
                  </div>
                  <div className="text-[10px] text-[#6E7587] font-medium mt-0.5">
                    Share vehicle seats
                  </div>
                </button>

                {/* Shortcut 2: Find Ride */}
                <button
                  type="button"
                  onClick={() => navigate('/rides/offer?mode=find')}
                  className="p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-left transition-all cursor-pointer active:scale-95 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mb-2">
                    <Search className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div className="font-black text-xs text-[#17233C] group-hover:text-[#FF572E]">
                    Find Ride
                  </div>
                  <div className="text-[10px] text-[#6E7587] font-medium mt-0.5">
                    Post passenger trip
                  </div>
                </button>

                {/* Shortcut 3: Shared Groups */}
                <button
                  type="button"
                  onClick={() => navigate('/shared-rides')}
                  className="p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-left transition-all cursor-pointer active:scale-95 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mb-2">
                    <CarTaxiFront className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div className="font-black text-xs text-[#17233C] group-hover:text-[#FF572E]">
                    Shared Groups
                  </div>
                  <div className="text-[10px] text-[#6E7587] font-medium mt-0.5">
                    Split cab fares
                  </div>
                </button>

                {/* Shortcut 4: My Posts */}
                <button
                  type="button"
                  onClick={() => navigate('/posts')}
                  className="p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-left transition-all cursor-pointer active:scale-95 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div className="font-black text-xs text-[#17233C] group-hover:text-[#FF572E]">
                    My Posts
                  </div>
                  <div className="text-[10px] text-[#6E7587] font-medium mt-0.5">
                    Manage active rides
                  </div>
                </button>
              </div>
            </div>

            {/* SHARED CAB POOLING PROMO CARD */}
            <div className="bg-gradient-to-br from-[#FF572E] to-[#E64A22] rounded-[24px] p-5 text-white shadow-md shadow-[#FF572E]/25 space-y-3 relative overflow-hidden">
              <div className="relative z-10">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider mb-2">
                  Cab Pooling
                </span>
                <h4 className="font-black text-base text-white leading-tight">
                  Travelling to the airport or station?
                </h4>
                <p className="text-xs text-white/90 leading-relaxed mt-1 font-medium">
                  Team up in Shared Ride Groups to pool a commercial cab and split costs equally!
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/shared-rides')}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-white text-[#FF572E] font-black text-xs rounded-xl shadow-xs hover:bg-[#FFF9F5] transition-all cursor-pointer active:scale-95"
                >
                  <span>Explore Shared Groups</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </ResponsiveShell>
  );
}
