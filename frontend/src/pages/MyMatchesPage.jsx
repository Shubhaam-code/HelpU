import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Users, MapPin, Clock, Calendar, ShieldCheck, Car, MessageSquare, 
  Sparkles, RefreshCw, AlertCircle, ArrowLeft, Send, Check, Ticket, ChevronRight, Compass,
  ArrowRight, IndianRupee, Eye
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { openWhatsAppChat } from '../lib/whatsapp';
import { getUserMatches, getMyTravels, getMyBookings } from '../lib/api';

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null); // { type: 'error' | 'success', text: string }
  const [userMatches, setUserMatches] = useState([]);
  const [myTravels, setMyTravels] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [hasPostedTravel, setHasPostedTravel] = useState(false);
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('all');

  // Auto-dismiss toast message
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

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

  // Fetch actual matches and current user's bookings from backend
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [matchesRes, travelsRes, bookingsRes] = await Promise.allSettled([
        getUserMatches(),
        getMyTravels(),
        getMyBookings()
      ]);

      if (matchesRes.status === 'fulfilled') {
        const data = matchesRes.value.data || {};
        const matchesList = Array.isArray(data.data) ? data.data : [];
        setUserMatches(matchesList);
        setHasPostedTravel(Boolean(data.hasPostedTravel));
        if (Array.isArray(data.myTravels) && data.myTravels.length > 0) {
          setMyTravels(data.myTravels);
        }
      } else {
        throw new Error(matchesRes.reason?.response?.data?.message || matchesRes.reason?.message || 'Failed to load matches');
      }

      if (travelsRes.status === 'fulfilled') {
        const travelsList = travelsRes.value.data?.data || travelsRes.value.data || [];
        if (Array.isArray(travelsList)) {
          setMyTravels(travelsList);
          if (travelsList.length > 0) {
            setHasPostedTravel(true);
          }
        }
      }

      if (bookingsRes.status === 'fulfilled') {
        const bList = bookingsRes.value?.data?.data || bookingsRes.value?.data?.bookings || bookingsRes.value?.data || [];
        setMyBookings(Array.isArray(bList) ? bList : []);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError(err.message || 'Unable to retrieve matches from the campus network.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Lookup map for active booking status per travel post
  const activeBookingStatusByTravelId = useMemo(() => {
    const map = {};
    if (Array.isArray(myBookings)) {
      for (const b of myBookings) {
        const tId = typeof b.travelId === 'object' ? b.travelId?._id : b.travelId;
        if (tId && ['pending', 'accepted', 'confirmed'].includes(b.status)) {
          map[String(tId)] = b.status;
        }
      }
    }
    return map;
  }, [myBookings]);

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
      const routeMatches = userMatches.filter((m) => {
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
  }, [myTravels, userMatches]);

  // Filter matches based on selected route filter
  const filteredMatches = useMemo(() => {
    if (selectedRouteFilter === 'all') {
      return userMatches;
    }
    const targetRoute = uniqueRouteFilters.find((r) => r.routeKey === selectedRouteFilter);
    if (!targetRoute) {
      return userMatches.filter(
        (m) => (m.matchedWithPostId?.toString() === selectedRouteFilter) ||
               (getRouteKey(m.source, m.destination) === selectedRouteFilter)
      );
    }
    return userMatches.filter((m) => {
      const matchedPostId = m.matchedWithPostId?.toString() || m.matchingUserPostId?.toString();
      if (matchedPostId && targetRoute.postIds.has(matchedPostId)) {
        return true;
      }
      return getRouteKey(m.source, m.destination) === targetRoute.routeKey;
    });
  }, [userMatches, selectedRouteFilter, uniqueRouteFilters]);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Matches" backTo="/match" />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* HEADER TOOLBAR & HERO BANNER WITH RESPONSIVE HELPU ILLUSTRATION           */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 border border-[#F4E3D8] shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="max-w-xl z-10 w-full">
            
            {/* Top row with Badge & Mobile-visible Illustration */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[10px] sm:text-[11px] font-black text-[#FF572E] uppercase tracking-wider mb-2 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Helpu Smart Matching</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#17233C] tracking-tight leading-tight">
                  My Travel <span className="text-[#FF572E]">Matches</span>
                </h1>
              </div>

              {/* Mobile-only Cute Illustration (Top Right Corner) */}
              <div className="flex sm:hidden shrink-0 -mt-1 -mr-1">
                <img
                  src="/match.png"
                  alt="Helpu Smart Travel Match"
                  className="w-20 h-20 object-contain drop-shadow-sm select-none pointer-events-none"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1.5 leading-relaxed">
              Verified campus peers matched with your active ride offers and travel requests.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-3.5 sm:pt-4">
              <button
                onClick={fetchMatches}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Refresh matches"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF572E]' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => navigate('/rides/offer')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black rounded-xl shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
              >
                <Car className="w-3.5 h-3.5" />
                <span>+ Offer Ride</span>
              </button>
            </div>
          </div>

          {/* Desktop-only Match Illustration (Shifted left) */}
          <div className="hidden sm:flex items-center justify-center shrink-0 relative z-10 md:-translate-x-8 lg:-translate-x-14">
            <img
              src="/match.png"
              alt="Helpu Smart Travel Match"
              className="w-auto max-w-[140px] sm:max-w-[170px] lg:max-w-[200px] max-h-[110px] sm:max-h-[130px] lg:max-h-[145px] object-contain drop-shadow-sm select-none pointer-events-none hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
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
                All Matches ({userMatches.length})
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
              onClick={fetchMatches}
              className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Fetching Matches</span>
            </button>
          </div>
        ) : !hasPostedTravel || myTravels.length === 0 ? (
          /* Case 1: Logged-in user has NOT created any offer or request */
          <div className="bg-white rounded-[32px] p-8 sm:p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-full flex justify-center items-center">
              <img
                src="/car.png"
                alt="Post a ride"
                className="w-auto max-h-[140px] sm:max-h-[160px] object-contain drop-shadow-sm select-none pointer-events-none mb-1"
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
                <span>+ Request a Ride</span>
              </button>
            </div>
          </div>
        ) : filteredMatches.length === 0 ? (
          /* Case 2: Logged-in user HAS active travel, but 0 matches found right now */
          <div className="bg-white rounded-[32px] p-8 sm:p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-full flex justify-center items-center">
              <img
                src="/match.png"
                alt="Searching campus matches"
                className="w-auto max-h-[140px] sm:max-h-[160px] object-contain drop-shadow-sm select-none pointer-events-none mb-1"
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredMatches.map((match) => {
                const student = match.student || {};
                const fromCity = match.source || match.from || 'Campus';
                const toCity = match.destination || match.to || 'City';
                const seats = match.availableSeats ?? match.seats ?? 1;
                const phone = student.phone || match.phone || '';
                const dateFormatted = formatTravelDate(match.travelDate);
                const timeFormatted = formatMinutesToTime(match.departureTime);
                const isOffer = match.type === 'offer';
                const travelId = match._id?.toString() || match.id?.toString();

                return (
                  <motion.div
                    key={travelId}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4.5 group"
                  >
                    <div className="space-y-4">
                      
                      {/* Top Header: Student Profile, Type Badge & Price (Matches Post Card UI) */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            avatarId={student.avatarId || 'm1'}
                            src={student.imageUrl}
                            name={student.name || match.authorName}
                            size="md"
                            ring
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-sm sm:text-base text-[#17233C] truncate">
                                {student.name || match.authorName || 'Campus Student'}
                              </h4>
                              <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-[#6E7587] font-semibold truncate">
                                {student.college || 'VIT, Bhopal'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isOffer
                                  ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                                  : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                              }`}>
                                {isOffer ? 'Ride Offer' : 'Request'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Price per seat if offer (Identical to Post card) */}
                        {isOffer && (
                          <div className="text-right shrink-0">
                            <span className="text-[#FF572E] font-black text-base sm:text-lg font-mono leading-none block">
                              ₹{match.pricePerSeat || 350}
                            </span>
                            <span className="text-[10px] font-bold text-[#8C93A4] block mt-0.5">
                              per seat
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Matching Reason Pill if present */}
                      {match.matchingReason && (
                        <div className="px-3.5 py-1.5 bg-[#FFF4ED] rounded-xl text-[11px] font-bold text-[#FF572E] border border-[#FDE0D0] flex items-center gap-2">
                          <span>🎯</span>
                          <span className="truncate">{match.matchingReason}</span>
                        </div>
                      )}

                      {/* Route Box with Departure, Destination, Route Arrow & Schedule Details */}
                      <div className="bg-[#FFFBF8] rounded-2xl p-3.5 sm:p-4 border border-[#F4E3D8]/80 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          {/* Pickup */}
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block mb-1">
                              Pickup
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                              <span className="font-extrabold text-[#17233C] text-sm sm:text-base truncate capitalize" title={fromCity}>
                                {fromCity}
                              </span>
                            </div>
                          </div>

                          {/* Route Arrow */}
                          <div className="flex flex-col items-center justify-center shrink-0 px-2">
                            <div className="w-8 h-8 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E] flex items-center justify-center shadow-2xs group-hover:scale-105 group-hover:border-[#FF572E]/40 transition-all">
                              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                            </div>
                          </div>

                          {/* Drop */}
                          <div className="min-w-0 flex-1 text-right">
                            <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block mb-1">
                              Drop
                            </span>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-extrabold text-[#17233C] text-sm sm:text-base truncate capitalize" title={toCity}>
                                {toCity}
                              </span>
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                            </div>
                          </div>
                        </div>

                        {/* Divider & Schedule / Seats Row */}
                        <div className="border-t border-[#F4E3D8]/60 pt-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-[#6E7587] min-w-0">
                            <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                            <span className="truncate">
                              {dateFormatted} • {timeFormatted || '08:00 AM'}
                            </span>
                          </div>

                          <div className={`font-bold shrink-0 text-xs ${isOffer ? 'text-[#16A34A]' : 'text-[#FF572E]'}`}>
                            {isOffer ? `${seats} seat(s) left` : `${match.seats || 1} seat(s) needed`}
                          </div>
                        </div>
                      </div>

                      {/* Vehicle Model indicator & Price Row */}
                      <div className="flex items-center justify-between text-xs px-1 font-semibold text-[#6E7587]">
                        <div className="flex items-center gap-1.5 truncate">
                          <Car className="w-4 h-4 text-[#8C93A4] shrink-0" />
                          <span className="truncate">{match.carModel || (isOffer ? 'Campus Carpool' : 'Peer Request')}</span>
                        </div>

                        {isOffer && (
                          <div className="text-right shrink-0">
                            <span className="text-[#FF572E] font-black text-base sm:text-lg font-mono">
                              ₹{match.pricePerSeat || 350}
                            </span>
                            <span className="text-xs text-[#8C93A4] font-medium font-sans">/seat</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row: View Details Button (Same for Offer and Request) */}
                    <div className="pt-3 border-t border-[#F4E3D8]/70">
                      <button
                        type="button"
                        onClick={() => {
                          if (travelId && /^[0-9a-fA-F]{24}$/.test(travelId)) {
                            navigate(`/rides/${travelId}`);
                          } else {
                            navigate('/rides/offer');
                          }
                        }}
                        className="w-full py-2.5 px-4 bg-[#FFF4ED] hover:bg-[#FF572E] text-[#FF572E] hover:text-white border border-[#FDE0D0] hover:border-[#FF572E] font-black text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}

