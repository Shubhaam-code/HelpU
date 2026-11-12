import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Users, MapPin, Clock, Calendar, ShieldCheck, Car, MessageSquare, 
  Sparkles, RefreshCw, AlertCircle, ArrowLeft, Send, Check, Ticket, ChevronRight, Compass,
  ArrowRight, IndianRupee, Eye
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { CompactMatchCard } from '../components/ui/CompactMatchCard';
import { openWhatsAppChat } from '../lib/whatsapp';
import { useUserMatchesData, useMyTravels, useMyBookings, useReceivedBookings } from '../hooks/useAppData';
import { invalidateRideQueries } from '../lib/queryClient';

/**
 * Format minutes from midnight (0..1439) into 12-hour AM/PM format
 */
function formatMinutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format date string nicely
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

/**
 * Normalize city names (trim spaces and lowercase)
 */
function normalizeCity(city) {
  if (!city || typeof city !== 'string') return '';
  return city.trim().toLowerCase();
}

/**
 * Generate normalized route key (directional: source->destination)
 */
function getRouteKey(source, destination) {
  const s = normalizeCity(source);
  const d = normalizeCity(destination);
  return `${s}->${d}`;
}

/**
 * Format route for display (e.g. "patna → gaya")
 */
function formatRouteDisplay(source, destination) {
  const s = normalizeCity(source);
  const d = normalizeCity(destination);
  return `${s} → ${d}`;
}

export default function MyMatchesPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const isAndroid = Capacitor.getPlatform() === 'android';

  const [toastMsg, setToastMsg] = useState(null); // { type: 'error' | 'success', text: string }
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('all');

  // TanStack Query cached data flow (Instant navigation, zero full-page spinners on return visits)
  const { 
    data: matchesPayload, 
    isLoading: matchesLoading, 
    isFetching: isFetchingMatches,
    error: matchesError,
    refetch: refetchMatches 
  } = useUserMatchesData();

  const { 
    data: userTravels = [], 
    isLoading: travelsLoading, 
    refetch: refetchTravels 
  } = useMyTravels();

  const { 
    data: myBookings = [] 
  } = useMyBookings();

  const { 
    data: receivedBookings = [],
    refetch: refetchReceived 
  } = useReceivedBookings();

  const userMatches = Array.isArray(matchesPayload)
    ? matchesPayload
    : (Array.isArray(matchesPayload?.matches) ? matchesPayload.matches : []);
  const compatibleFinds = useMemo(() => {
    const raw = Array.isArray(matchesPayload?.compatibleFinds) ? matchesPayload.compatibleFinds : [];
    return raw.map((peer) => ({
      ...peer,
      isCompatibleFindPeer: true,
      matchedWithPostId: peer.matchedWithTravelId || peer.matchedWithPostId
    }));
  }, [matchesPayload?.compatibleFinds]);
  const allCombinedMatches = useMemo(() => {
    const map = new Map();
    for (const m of userMatches) {
      const id = m._id?.toString() || m.id?.toString();
      if (id) map.set(id, m);
    }
    for (const p of compatibleFinds) {
      const id = p._id?.toString() || p.id?.toString();
      if (id && !map.has(id)) map.set(id, p);
    }
    return Array.from(map.values());
  }, [userMatches, compatibleFinds]);
  const hasPostedTravel = Boolean(matchesPayload?.hasPostedTravel || userTravels.length > 0 || allCombinedMatches.length > 0);
  const myTravels = userTravels.length > 0 ? userTravels : (Array.isArray(matchesPayload?.myTravels) ? matchesPayload.myTravels : []);

  // Show loading skeleton ONLY on initial mount when NO cached data is in memory yet
  const loading = (matchesLoading || travelsLoading) && userMatches.length === 0 && userTravels.length === 0;
  const error = matchesError ? (matchesError.response?.data?.message || matchesError.message || 'Unable to retrieve matches.') : null;
  const isRefreshing = isFetchingMatches;

  // Auto-dismiss toast message
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    try {
      await Promise.all([refetchMatches(), refetchTravels(), refetchReceived()]);
      setToastMsg({ type: 'success', text: 'Matches updated from campus network.' });
    } catch {
      setToastMsg({ type: 'error', text: 'Failed to refresh matches. Please try again.' });
    }
  };

  // Handle direct WhatsApp coordination
  const handleContactWhatsApp = (match) => {
    const rawPhone = match?.student?.phone || match?.creator?.phone || match?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const peerName = match?.student?.name || match?.creator?.name || match?.authorName || 'Campus Peer';
    const fromCity = match?.source || 'Origin';
    const toCity = match?.destination || 'Destination';
    const isOffer = match?.type === 'offer';

    if (!cleanPhone || cleanPhone.length < 10) {
      setToastMsg({
        type: 'error',
        text: `${peerName} has not provided a valid WhatsApp contact number.`
      });
      return;
    }

    const defaultMsg = isOffer
      ? `Hi ${peerName}! I saw your ride offer on HelpU from ${fromCity} to ${toCity}. I'd like to coordinate and travel together!`
      : `Hi ${peerName}! I saw your ride request on HelpU from ${fromCity} to ${toCity}. I am traveling the same way and can offer a ride!`;

    const opened = openWhatsAppChat({
      phone: cleanPhone,
      name: peerName,
      route: `${fromCity} → ${toCity}`,
      message: defaultMsg,
      isOwn: false
    });

    if (!opened) {
      setToastMsg({
        type: 'error',
        text: 'Could not open WhatsApp. Please check the contact number.'
      });
    }
  };

  // Lookup map for active booking status per travel post (both incoming requests and outgoing bookings)
  const activeBookingStatusByTravelId = useMemo(() => {
    const map = {};
    if (Array.isArray(myBookings)) {
      for (const b of myBookings) {
        const tId = typeof b.travelId === 'object' ? b.travelId?._id : b.travelId;
        if (tId && ['pending', 'accepted', 'confirmed'].includes(b.status)) {
          map[String(tId)] = { status: b.status, direction: 'outgoing', bookingId: b._id };
        }
      }
    }
    if (Array.isArray(receivedBookings)) {
      for (const b of receivedBookings) {
        if (!['pending', 'accepted', 'confirmed'].includes(b.status)) continue;
        const pId = b.passengerId;
        if (pId) {
          map[`sender_${pId}`] = { status: b.status, direction: 'incoming', bookingId: b._id };
        }
        if (b.matchedTravelId) {
          map[String(b.matchedTravelId)] = { status: b.status, direction: 'incoming', bookingId: b._id };
        }
      }
    }
    return map;
  }, [myBookings, receivedBookings]);

  // Group user's active travel posts by normalized route direction
  // ("patna -> gaya" and "Patna -> Gaya" are unified into a single route filter)
  const uniqueRouteFilters = useMemo(() => {
    const routeMap = new Map();

    for (const travel of myTravels) {
      const s = travel.source;
      const d = travel.destination;
      const key = getRouteKey(s, d);
      if (!key || key === '->') continue;

      if (!routeMap.has(key)) {
        routeMap.set(key, {
          routeKey: key,
          source: s,
          destination: d,
          displayRoute: formatRouteDisplay(s, d),
          postIds: new Set()
        });
      }
      if (travel._id) {
        routeMap.get(key).postIds.add(travel._id.toString());
      }
    }

    return Array.from(routeMap.values()).map((route) => {
      // Find matches corresponding to any post ID of this route, or matching normalized route key
      const routeMatches = allCombinedMatches.filter((m) => {
        const matchedPostId = m.matchedWithPostId?.toString() || m.matchingUserPostId?.toString();
        if (matchedPostId && route.postIds.has(matchedPostId)) {
          return true;
        }
        return getRouteKey(m.source, m.destination) === route.routeKey;
      });

      // Combine count of unique matches for this route
      const uniqueIds = new Set(routeMatches.map((m) => m._id?.toString() || m.id?.toString()));

      return {
        ...route,
        matchCount: uniqueIds.size
      };
    });
  }, [myTravels, allCombinedMatches]);

  // Filter matches based on selected route filter
  const filteredMatches = useMemo(() => {
    if (selectedRouteFilter === 'all') {
      return allCombinedMatches;
    }
    const targetRoute = uniqueRouteFilters.find((r) => r.routeKey === selectedRouteFilter);
    if (!targetRoute) {
      return allCombinedMatches.filter(
        (m) => (m.matchedWithPostId?.toString() === selectedRouteFilter) ||
               (getRouteKey(m.source, m.destination) === selectedRouteFilter)
      );
    }
    return allCombinedMatches.filter((m) => {
      const matchedPostId = m.matchedWithPostId?.toString() || m.matchingUserPostId?.toString();
      if (matchedPostId && targetRoute.postIds.has(matchedPostId)) {
        return true;
      }
      return getRouteKey(m.source, m.destination) === targetRoute.routeKey;
    });
  }, [allCombinedMatches, selectedRouteFilter, uniqueRouteFilters]);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Matches" backTo="/match" />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* HEADER TOOLBAR & HERO BANNER WITH RESPONSIVE HELPU ILLUSTRATION           */}
        {/* ========================================================================= */}
        <div className="relative bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden p-4 sm:p-5">
          {/* Subtle warm cream background glow at top */}
          <div className="absolute top-0 right-0 left-0 h-24 bg-gradient-to-b from-[#FFF5EE]/70 to-transparent pointer-events-none" />

          {/* Content Row: Heading, Subtitle & Actions on Left, Prominent Illustration on Right */}
          <div className="relative z-10 flex items-center justify-between gap-2.5 sm:gap-5">
            
            {/* Left Column */}
            <div className="flex-1 min-w-0">
              <h1 className="text-[21px] min-[390px]:text-[23px] sm:text-3xl font-black text-[#17233C] tracking-tight leading-[1.18]">
                My Travel <span className="text-[#FF572E]">Matches</span>
              </h1>

              <p className="text-xs sm:text-[13px] text-[#6E7587] font-medium mt-1.5 leading-relaxed max-w-[195px] min-[390px]:max-w-[230px] sm:max-w-md">
                Verified campus peers matched with your active ride offers and travel requests.
              </p>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-[#FFF7F2] active:scale-[0.98] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] text-xs font-bold rounded-full shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh matches"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF572E]' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                <button
                  onClick={() => navigate('/match/explore')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-[#FFF7F2] active:scale-[0.98] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] text-xs font-bold rounded-full shadow-2xs transition-all cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-[#FF572E]" />
                  <span>By Post</span>
                </button>

                <button
                  onClick={() => navigate('/rides/offer')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.98] text-white text-xs font-black rounded-full shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>+ Offer Ride</span>
                </button>
              </div>
            </div>

            {/* Right Column: Prominent Unified Illustration */}
            <div className="shrink-0 w-[125px] min-[380px]:w-[142px] min-[410px]:w-[155px] sm:w-[175px] md:w-[200px] -mr-1 sm:-mr-1 flex justify-end items-center">
              <img
                src="/match.png"
                alt="Helpu Smart Travel Match"
                className="w-full h-auto object-contain drop-shadow-xs select-none pointer-events-none"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>

          </div>
        </div>

        {/* WhatsApp Error / Notification Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold border shadow-xs ${
                toastMsg.type === 'error'
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-[#EDFAF3] text-[#16A34A] border-[#BCECD4]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{toastMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="text-[#6E7587] hover:text-[#17233C] text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Smart FIND Matching & Shared Groups Callout Banner */}
        {myTravels.some((t) => t.type === 'request') && (
          <div className="bg-gradient-to-r from-white via-[#FFFBF8] to-[#FFF5EE] rounded-[22px] sm:rounded-[26px] p-4 sm:p-5 border border-[#FDE0D0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#FFE8DC] text-[#FF572E] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Sparkles className="w-5 h-5 text-[#FF572E]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    FIND Requests Active
                  </span>
                  <span className="text-[11px] font-bold text-[#17233C]">
                    Offers, Shared Groups &amp; Compatible Students
                  </span>
                </div>
                <p className="text-xs text-[#6E7587] leading-relaxed">
                  Discover direct ride offers, join open cab groups, or team up with compatible peers heading your way.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/match/explore')}
              className="shrink-0 px-4 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-1.5"
            >
              <span>Explore by Post</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACTIVE TRAVELS CONTEXT & FILTER BAR                                       */}
        {/* ========================================================================= */}
        {myTravels.length > 0 && (
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8]/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black text-[#17233C] flex items-center gap-1.5">
                <Car className="w-4 h-4 text-[#FF572E]" />
                <span>Your Active Travel Posts ({myTravels.length}):</span>
              </span>
              <span className="text-[11px] text-[#6E7587]">
                Matches are evaluated strictly for the same route, calendar date, and 4–5h departure window.
              </span>
            </div>

            {/* Filter Pills with Normalized Unique Routes */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedRouteFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedRouteFilter === 'all'
                    ? 'bg-[#17233C] text-white shadow-xs font-black'
                    : 'bg-[#FFFBF8] text-[#6E7587] border border-[#F4E3D8] hover:bg-[#FFF4ED]'
                }`}
              >
                All Matches ({allCombinedMatches.length})
              </button>
              {uniqueRouteFilters.map((route) => {
                const isSel = selectedRouteFilter === route.routeKey;
                return (
                  <button
                    key={route.routeKey}
                    type="button"
                    onClick={() => setSelectedRouteFilter(route.routeKey)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer truncate max-w-[280px] ${
                      isSel
                        ? 'bg-[#FF572E] text-white shadow-xs font-black'
                        : 'bg-[#FFFBF8] text-[#6E7587] border border-[#F4E3D8] hover:bg-[#FFF4ED]'
                    }`}
                  >
                    <span className="truncate capitalize">{route.displayRoute}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isSel ? 'bg-white text-[#FF572E]' : 'bg-[#FFF4ED] text-[#FF572E]'
                    }`}>
                      {route.matchCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN MATCHES CONTENT: LOADING, ERROR, EMPTY OR LIST                       */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8] animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-gray-200 rounded-md w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-md w-1/2" />
                  </div>
                </div>
                <div className="h-16 bg-gray-100 rounded-2xl" />
                <div className="h-9 bg-gray-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-[32px] p-10 border border-red-200 text-center max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-lg text-[#17233C]">Failed to Load Matches</h3>
              <p className="text-xs text-red-600 mt-1 max-w-sm mx-auto leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => refetchMatches()}
              className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Fetching Matches</span>
            </button>
          </div>
        ) : !hasPostedTravel || myTravels.length === 0 ? (
          /* Case 1: Logged-in user has NOT created any offer or request */
          <div className="bg-white rounded-[32px] p-6 sm:p-10 text-center border border-[#F4E3D8] max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="w-full flex justify-center items-center py-1 sm:py-2">
              <img
                src="/car.png"
                alt="Post a ride"
                className="w-full max-w-[270px] min-[390px]:max-w-[310px] sm:max-w-[360px] h-auto max-h-[220px] sm:max-h-[260px] object-contain drop-shadow-md select-none pointer-events-none mb-2"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 className="font-black text-xl text-[#17233C]">
                No Active Ride Offer or Request Found
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-1.5 max-w-sm mx-auto leading-relaxed">
                Helpu matches rides based on your actual travel plans. Post a ride offer or request first to see matching campus peers going your way!
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <Car className="w-4 h-4" />
                <span>+ Offer a Ride</span>
              </button>
              <button
                onClick={() => navigate('/rides/request')}
                className="px-6 py-3 bg-white border border-[#F4E3D8] hover:bg-[#FFF7F2] text-[#17233C] font-bold text-xs sm:text-sm rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-2"
              >
                <Send className="w-4 h-4 text-[#FF572E]" />
                <span>+ Find a Ride</span>
              </button>
            </div>
          </div>
        ) : filteredMatches.length === 0 ? (
          /* Case 2: Logged-in user HAS active travel, but 0 matches found right now */
          <div className="bg-white rounded-[32px] p-6 sm:p-10 text-center border border-[#F4E3D8] max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="w-full flex justify-center items-center py-1 sm:py-2">
              <img
                src="/match.png"
                alt="Searching campus matches"
                className="w-full max-w-[270px] min-[390px]:max-w-[310px] sm:max-w-[360px] h-auto max-h-[220px] sm:max-h-[260px] object-contain drop-shadow-md select-none pointer-events-none mb-2"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 className="font-black text-xl text-[#17233C]">
                No Matching Rides Found Right Now
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-2 max-w-md mx-auto leading-relaxed">
                We checked our campus network for rides matching your route{' '}
                <strong className="text-[#17233C]">
                  {myTravels[0]?.source} → {myTravels[0]?.destination}
                </strong>{' '}
                on{' '}
                <strong className="text-[#17233C]">
                  {formatTravelDate(myTravels[0]?.travelDate)}
                </strong>
                . Currently no students are travelling in that direction within the departure window.
              </p>
              <div className="mt-3 inline-block text-[11px] text-[#CA8A04] bg-[#FEF9E7] border border-[#FDEBB2] rounded-full px-4 py-1 font-bold">
                🔔 Helpu will automatically pair you as soon as a student posts!
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                + Offer Another Route
              </button>
              <button
                onClick={() => navigate('/posts')}
                className="px-5 py-2.5 bg-white border border-[#F4E3D8] text-[#17233C] font-bold text-xs rounded-xl shadow-2xs hover:bg-[#FFF7F2] transition-colors cursor-pointer"
              >
                View My Posts
              </button>
            </div>
          </div>
        ) : (
          /* Case 3: Matched Cards Grid */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-[#17233C] px-1">
              <span>
                Found {filteredMatches.length} Eligible Campus {filteredMatches.length === 1 ? 'Match' : 'Matches'}:
              </span>
              <span className="text-[11px] text-[#16A34A] font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Verified Travel Direction, Date &amp; Time Window
              </span>
            </div>

            {/* Unified Compact Vertical List for Both Android and Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredMatches.map((match) => {
                const travelId = match._id?.toString() || match.id?.toString();
                return (
                  <CompactMatchCard
                    key={travelId}
                    match={match}
                    onContactWhatsApp={handleContactWhatsApp}
                    activeBookingStatusByTravelId={activeBookingStatusByTravelId}
                  />
                );
              })}
            </div>
          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}

