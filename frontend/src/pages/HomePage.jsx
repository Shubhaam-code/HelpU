import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Search, Car, Users, ArrowRight, Calendar, Clock, 
  ShieldCheck, Sparkles, ChevronRight, RefreshCw, AlertCircle
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { 
  getProfile, 
  getMyTravels,
  getUserMatches,
  getUnreadCount
} from '../lib/api';

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
  
  const [profile, setProfile] = useState(null);
  const [myTravels, setMyTravels] = useState([]);
  const [userMatches, setUserMatches] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchVal, setSearchVal] = useState('');

  // Fetch real authenticated user dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, travelsRes, matchesRes, notifRes] = await Promise.allSettled([
        getProfile(),
        getMyTravels(),
        getUserMatches(),
        getUnreadCount()
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data || null);
      }
      if (travelsRes.status === 'fulfilled') {
        const tList = travelsRes.value.data?.data || travelsRes.value.data?.travels || travelsRes.value.data || [];
        setMyTravels(Array.isArray(tList) ? tList : []);
      }
      if (matchesRes.status === 'fulfilled') {
        const mData = matchesRes.value.data || {};
        const mList = Array.isArray(mData.data) ? mData.data : [];
        setUserMatches(mList);
      }
      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.data?.data?.count || 0);
      }
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err.message || 'Failed to refresh your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchVal.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchVal.trim())}`);
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. HERO SECTION                                                           */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative bg-gradient-to-br from-white via-[#FFFDF9] to-[#FFF4ED] rounded-[32px] border border-[#F4E3D8] shadow-xs overflow-hidden p-6 sm:p-8 lg:p-10"
        >
          {/* Subtle warm ambient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#FFEBD9]/40 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left: Text & Action Buttons */}
            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black uppercase tracking-wider shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart Campus Mobility</span>
              </div>

              <h1 className="font-black text-[#17233C] text-3xl sm:text-4xl lg:text-[44px] leading-[1.15] tracking-tight">
                Where are you going today?
              </h1>

              <p className="text-sm sm:text-base text-[#6E7587] font-medium max-w-lg leading-relaxed">
                Connect with verified college peers to share rides, split travel expenses, and commute safely to campus or home.
              </p>

              {/* Action Buttons: Find a Ride & Offer a Ride */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  onClick={() => {
                    const searchEl = document.getElementById('home-search-input');
                    if (searchEl) {
                      searchEl.focus();
                    } else {
                      navigate('/rides/offer');
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 bg-white hover:bg-[#FFF7F2] active:scale-[0.98] border-2 border-[#F4E3D8] text-[#17233C] hover:text-[#FF572E] rounded-full font-black text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4 text-[#FF572E]" />
                  <span>Find a Ride</span>
                </button>

                <button
                  onClick={() => navigate('/rides/offer')}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.98] text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                >
                  <Car className="w-4 h-4 stroke-[2.5]" />
                  <span>Offer a Ride</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Trust Badge */}
              <div className="flex items-center gap-2 pt-1 text-xs text-[#8C93A4] font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>100% verified college student community</span>
              </div>
            </div>

            {/* Right: Attractive Illustration */}
            <div className="md:col-span-6 flex items-center justify-center md:justify-end">
              <div className="relative w-full max-w-[540px] lg:max-w-[620px] xl:max-w-[680px] -translate-y-4 md:scale-105 lg:scale-110 origin-right transition-transform">
                <img
                  src="/webpage.png"
                  alt="Helpu Student Travel"
                  className="w-full h-auto object-contain drop-shadow-md select-none pointer-events-none hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 2. ROUTE SEARCH BAR                                                       */}
        {/* ========================================================================= */}
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#8C93A4]" />
          <input
            id="home-search-input"
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search rides by route, destination, or campus..."
            className="w-full bg-white rounded-full py-3.5 pl-12 pr-5 text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#8C93A4] border border-[#F4E3D8] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 focus:border-[#FF572E] transition-all"
          />
        </form>

        {/* ========================================================================= */}
        {/* 3. ACTIVITY SUMMARY (2 CLEAN CARDS: MY POSTS & MY MATCHES)                */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Card 1: My Posts */}
          <div
            onClick={() => navigate('/posts')}
            className="group bg-white hover:bg-[#FFFBF8] rounded-[28px] p-6 border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Car className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#FF572E] block">
                  Your Travels
                </span>
                <h3 className="font-black text-xl text-[#17233C] leading-snug">
                  My Posts
                </h3>
                <p className="text-xs text-[#6E7587] font-medium mt-0.5 truncate">
                  {loading ? 'Loading...' : `${myTravels.length} published ${myTravels.length === 1 ? 'post' : 'posts'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-2xl sm:text-3xl font-black text-[#17233C] group-hover:text-[#FF572E] transition-colors">
                {loading ? '...' : myTravels.length}
              </span>
              <div className="w-9 h-9 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center group-hover:bg-[#FF572E] group-hover:text-white transition-colors">
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Card 2: My Matches */}
          <div
            onClick={() => navigate('/matches')}
            className="group bg-white hover:bg-[#FFFBF8] rounded-[28px] p-6 border border-[#F4E3D8] hover:border-[#16A34A]/40 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-[#EDFAF3] border border-[#BCECD4] text-[#16A34A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#16A34A] block">
                  Smart Peer Discovery
                </span>
                <h3 className="font-black text-xl text-[#17233C] leading-snug">
                  My Matches
                </h3>
                <p className="text-xs text-[#6E7587] font-medium mt-0.5 truncate">
                  {loading ? 'Finding matches...' : `${userMatches.length} compatible ${userMatches.length === 1 ? 'peer' : 'peers'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-2xl sm:text-3xl font-black text-[#17233C] group-hover:text-[#16A34A] transition-colors">
                {loading ? '...' : userMatches.length}
              </span>
              <div className="w-9 h-9 rounded-full bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center group-hover:bg-[#16A34A] group-hover:text-white transition-colors">
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. RECENT MATCHES SECTION                                                 */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#F4E3D8]/90 shadow-xs space-y-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F4E3D8]/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[10px] font-black text-[#FF572E] uppercase">
                  <Sparkles className="w-3 h-3" />
                  Live Matches
                </span>
                <h2 className="font-black text-[#17233C] text-lg sm:text-xl">
                  Recent Matches
                </h2>
              </div>
              <p className="text-xs text-[#6E7587] font-medium mt-1">
                Verified peers heading along your exact route and schedule.
              </p>
            </div>

            <button
              onClick={() => navigate('/matches')}
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#FF572E] hover:text-[#E64A22] transition-colors cursor-pointer self-start sm:self-auto group"
            >
              <span>See All ({userMatches.length})</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Matches List or Empty/Loading State */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <LoadingSkeleton count={3} />
            </div>
          ) : error ? (
            <div className="py-8 px-4 text-center bg-red-50/40 rounded-2xl border border-red-200 space-y-2">
              <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
              <p className="text-xs font-bold text-red-700">{error}</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-xs font-bold text-[#17233C] rounded-xl border border-gray-200 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          ) : userMatches.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto shadow-2xs">
                <Users className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#17233C] text-sm sm:text-base">
                  {myTravels.length === 0 ? 'No Active Travel Posts Yet' : 'No New Matches Found Yet'}
                </h4>
                <p className="text-xs text-[#6E7587] max-w-md mx-auto leading-relaxed">
                  {myTravels.length === 0
                    ? 'Publish a ride offer or request to discover verified peers travelling on your route!'
                    : 'We compare route direction, calendar date, and departure window. You will see matches as soon as a classmate shares a trip.'}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => navigate(myTravels.length === 0 ? '/rides/offer' : '/posts')}
                  className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {myTravels.length === 0 ? '+ Offer a Ride' : 'View My Posts'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userMatches.slice(0, 3).map((match) => {
                const student = match.student || match.creator || {};
                const isOffer = (match.type || 'offer') === 'offer';
                const dateDisplay = formatTravelDate(match.travelDate);
                const timeDisplay = formatMinutesToTime(match.departureTime);
                const availSeats = typeof match.availableSeats === 'number' ? match.availableSeats : (match.seats || 1);

                return (
                  <div
                    key={match._id}
                    className="p-5 rounded-2xl bg-[#FFFBF8] hover:bg-white border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3.5">
                      {/* Peer Profile & Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            avatarId={student?.avatarId || 'm1'}
                            src={student?.imageUrl}
                            size="sm"
                            ring
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                                {student?.name || 'Campus Peer'}
                              </h4>
                              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                            </div>
                            <span className="text-[10px] text-[#6E7587] block truncate">
                              {student?.college || 'VIT, Bhopal'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isOffer
                              ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                              : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                          }`}>
                            {isOffer ? 'Ride Offer' : 'Ride Request'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[9px] font-black uppercase">
                            Active Match
                          </span>
                        </div>
                      </div>

                      {/* Route */}
                      <div className="p-3 bg-white rounded-xl border border-gray-100 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-black text-[#17233C]">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                          <span className="truncate">{match.source}</span>
                          <span className="text-[#FF572E]">→</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                          <span className="truncate">{match.destination}</span>
                        </div>
                        {match.matchedWithRoute && (
                          <p className="text-[10px] text-[#8C93A4] font-medium truncate">
                            Matched with your {match.matchedWithRoute} post
                          </p>
                        )}
                      </div>

                      {/* Schedule & Seats */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[9px] text-[#8C93A4] block uppercase font-bold">Date</span>
                            <span className="font-bold text-[#17233C] text-[11px] truncate block">{dateDisplay}</span>
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[9px] text-[#8C93A4] block uppercase font-bold">Time</span>
                            <span className="font-bold text-[#17233C] text-[11px] truncate block">{timeDisplay}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Seats & Action */}
                    <div className="pt-3 border-t border-[#F4E3D8]/70 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-[#17233C]">
                        {isOffer ? (
                          <span className="text-[#16A34A]">{availSeats} seat(s) avail.</span>
                        ) : (
                          <span className="text-[#FF572E]">{match.requestedSeats || 1} seat(s) req.</span>
                        )}
                        {typeof match.pricePerSeat === 'number' && (
                          <span className="text-[11px] text-[#8C93A4] block font-normal">₹{match.pricePerSeat}/seat</span>
                        )}
                      </div>

                      <button
                        onClick={() => navigate('/matches')}
                        className="px-3.5 py-1.5 rounded-full bg-[#17233C] hover:bg-[#FF572E] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </ResponsiveShell>
  );
}
