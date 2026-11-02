import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Compass, Users, SlidersHorizontal, MapPin, Clock, 
  CheckCircle2, GraduationCap, Heart, TrendingUp, ArrowRight,
  Car, MessageSquare, Phone, ShieldCheck, ArrowLeft, Search, Calendar
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { openWhatsAppChat } from '../lib/whatsapp';
import { getTravels, getMyTravels, getMyBookings, getReceivedBookings } from '../lib/api';

export default function MatchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Discover'); // 'Discover' | 'My Matches'
  const [loading, setLoading] = useState(true);
  
  // Real dynamic backend data state
  const [allTravels, setAllTravels] = useState([]);
  const [myTravels, setMyTravels] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);

  // Fetch real data on mount
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.allSettled([
      getTravels(),
      getMyTravels(),
      getMyBookings(),
      getReceivedBookings()
    ]).then(([travelsRes, myTravelsRes, myBookingsRes, receivedRes]) => {
      if (!isMounted) return;

      const travelsList = travelsRes.status === 'fulfilled' 
        ? (travelsRes.value.data?.data || travelsRes.value.data?.travels || travelsRes.value.data || [])
        : [];
      const myTravelsList = myTravelsRes.status === 'fulfilled'
        ? (myTravelsRes.value.data?.data || myTravelsRes.value.data?.travels || myTravelsRes.value.data || [])
        : [];
      const myBookingsList = myBookingsRes.status === 'fulfilled'
        ? (myBookingsRes.value.data?.data || myBookingsRes.value.data?.bookings || myBookingsRes.value.data || [])
        : [];
      const receivedList = receivedRes.status === 'fulfilled'
        ? (receivedRes.value.data?.data || receivedRes.value.data?.bookings || receivedRes.value.data || [])
        : [];

      setAllTravels(Array.isArray(travelsList) ? travelsList : []);
      setMyTravels(Array.isArray(myTravelsList) ? myTravelsList : []);
      setMyBookings(Array.isArray(myBookingsList) ? myBookingsList : []);
      setReceivedBookings(Array.isArray(receivedList) ? receivedList : []);
    }).catch((err) => {
      console.error('Error fetching match data:', err);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Compute live match activity stats without hardcoded numbers
  const stats = useMemo(() => {
    const confirmedCount = myBookings.filter(b => b.status === 'confirmed').length +
      receivedBookings.filter(b => b.status === 'confirmed').length;

    const pendingCount = myBookings.filter(b => b.status === 'pending').length +
      receivedBookings.filter(b => b.status === 'pending').length;

    // Matches count: total active travels available in the campus network matching user's location or active rides
    const matchesCount = allTravels.length;

    return {
      matches: matchesCount,
      confirmed: confirmedCount,
      pending: pendingCount
    };
  }, [allTravels, myBookings, receivedBookings]);

  // Dynamic Popular Routes: purely aggregated from real database entries (zero hardcoded routes)
  const popularRoutes = useMemo(() => {
    if (!Array.isArray(allTravels) || allTravels.length === 0) {
      return [];
    }

    const routeMap = new Map();

    allTravels.forEach((t) => {
      const from = (t.source || t.from || '').trim();
      const to = (t.destination || t.to || '').trim();
      if (!from || !to) return;

      const key = `${from.toLowerCase()}___${to.toLowerCase()}`;
      
      let scheduleText = 'Active Ride';
      if (t.travelDate) {
        const d = new Date(t.travelDate);
        if (!isNaN(d.getTime())) {
          scheduleText = d.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
        }
      }

      if (!routeMap.has(key)) {
        routeMap.set(key, {
          from,
          to,
          activeCount: 1,
          schedule: scheduleText,
        });
      } else {
        const existing = routeMap.get(key);
        existing.activeCount += 1;
      }
    });

    return Array.from(routeMap.values())
      .filter((r) => r.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount)
      .slice(0, 6);
  }, [allTravels]);

  // Handle route click -> navigate to rides with filters
  const handleRouteClick = (route) => {
    navigate(`/rides?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}`);
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Match" backTo={false} />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6">
        
        {/* ========================================================================= */}
        {/* SUB-HEADER TOOLBAR: TABS SWITCHER & PREFERENCES BUTTON                     */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          
          {/* Left Pill Switcher: Discover vs My Matches */}
          <div className="inline-flex bg-white/90 p-1 rounded-full border border-[#F4E3D8]/90 shadow-xs backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('Discover')}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'Discover'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'text-[#17233C] hover:text-[#FF572E] hover:bg-[#FFF7F2]'
              }`}
            >
              <Compass className="w-4 h-4 stroke-[2.2]" />
              <span>Discover</span>
            </button>

            <button
              onClick={() => setActiveTab('My Matches')}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'My Matches'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'text-[#17233C] hover:text-[#FF572E] hover:bg-[#FFF7F2]'
              }`}
            >
              <Users className="w-4 h-4 stroke-[2.2]" />
              <span>My Matches</span>
            </button>
          </div>

          {/* Right Button: Preferences */}
          <button
            onClick={() => navigate('/match/preferences')}
            className="inline-flex items-center gap-2 px-4 sm:px-4.5 py-2 bg-white rounded-2xl border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] hover:text-[#FF572E] text-xs sm:text-sm font-bold shadow-xs hover:bg-[#FFF7F2] transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#FF572E] stroke-[2.2]" />
            <span>Preferences</span>
          </button>
        </div>


        {/* ========================================================================= */}
        {/* MAIN BODY: DISCOVER VIEW vs MY MATCHES VIEW                               */}
        {/* ========================================================================= */}
        <AnimatePresence mode="wait">
          {activeTab === 'Discover' ? (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 sm:space-y-7"
            >
              
              {/* ------------------------------------------------------------------- */}
              {/* TOP HERO SECTION: LEFT CARD + RIGHT STACK CARDS                     */}
              {/* ------------------------------------------------------------------- */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
                
                {/* HERO CARD (SPAN 8) */}
                <div className="lg:col-span-8 bg-white rounded-[28px] border border-[#F4E3D8]/90 shadow-sm relative overflow-hidden flex flex-col justify-between p-6 sm:p-8 lg:p-9">
                  
                  {/* Subtle warm decorative glow */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#FFF0E7]/60 via-[#FFF5EE]/40 to-transparent pointer-events-none rounded-r-[28px]" />

                  <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-center justify-between gap-6 lg:gap-8">
                    
                    {/* Left content inside Hero Card */}
                    <div className="w-full lg:max-w-[55%] flex flex-col items-center lg:items-start text-center lg:text-left">
                      
                      {/* Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] font-bold text-xs mb-3">
                        <Heart className="w-3.5 h-3.5 fill-[#FF572E] text-[#FF572E]" />
                        <span>Travel Match</span>
                      </div>

                      {/* Main Headline */}
                      <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-[#17233C] leading-[1.14] tracking-tight">
                        Find Your <br />
                        <span className="text-[#FF572E] relative inline-block">
                          Travel Match
                          {/* Cartoon burst decorative rays */}
                          <svg className="absolute -top-3.5 -right-6 w-5 h-5 text-[#FF572E] select-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="4" y1="12" x2="1" y2="10" />
                            <line x1="8" y1="5" x2="7" y2="1" />
                            <line x1="16" y1="4" x2="18" y2="1" />
                          </svg>
                        </span>
                      </h1>

                      <p className="mt-3 text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-md">
                        Get matched with campus peers travelling on the same route, date and time. Safe, verified and cost-effective.
                      </p>

                      {/* 4 Feature Badges in a row */}
                      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-4 pt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                          <MapPin className="w-3.5 h-3.5 text-[#FF572E]" />
                          <span>Same Route</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                          <Clock className="w-3.5 h-3.5 text-[#6E7587]" />
                          <span>Similar Time</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F0FAF4] border border-[#C6EFD9] text-[11px] font-bold text-[#17233C]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Verified Users</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                          <GraduationCap className="w-3.5 h-3.5 text-[#17233C]" />
                          <span>Same College</span>
                        </span>
                      </div>

                      {/* Big Orange Action CTA Button */}
                      <div className="mt-6 pt-1">
                        <button
                          onClick={() => navigate('/match/preferences')}
                          className="inline-flex items-center gap-2 px-6 sm:px-7 py-3.5 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-[#FF572E]/25 transition-all cursor-pointer group"
                        >
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                          <span>Find a Match →</span>
                        </button>
                      </div>

                    </div>

                    {/* Right Illustration Column with Floating Car Pin */}
                    <div className="w-full lg:w-[45%] flex items-center justify-center relative mt-2 lg:mt-0">
                      
                      {/* Floating Car Pin above the illustration */}
                      <div className="absolute top-2 left-1/3 -translate-x-1/2 z-20 w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-white border border-[#F4E3D8] shadow-md flex items-center justify-center text-[#FF572E]">
                        <Car className="w-5 h-5 fill-[#FF572E]/10 stroke-[#FF572E] stroke-[2.2]" />
                      </div>

                      {/* Main Illustration: match.png from public folder */}
                      <img
                        src="/match.png"
                        alt="Find Your Travel Match"
                        className="w-full max-h-[260px] sm:max-h-[300px] lg:max-h-[340px] object-contain drop-shadow-sm select-none pointer-events-none"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                  </div>
                </div>


                {/* RIGHT COLUMN STACK (SPAN 4) */}
                <div className="lg:col-span-4 flex flex-col justify-between gap-4 sm:gap-5">
                  
                  {/* Card 1: Your Match Activity */}
                  <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs flex flex-col justify-between flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#FF572E] stroke-[2.2]" />
                        <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                          Your Match Activity
                        </h3>
                      </div>
                      <button 
                        onClick={() => setActiveTab('My Matches')}
                        className="text-[#FF572E] hover:translate-x-0.5 transition-transform p-1 cursor-pointer"
                        title="View My Matches"
                      >
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* 3 Stat Boxes in Row */}
                    <div className="grid grid-cols-3 gap-2.5">
                      
                      {/* Matches */}
                      <div className="bg-[#FFF4ED] border border-[#FDE0D0] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1.5 text-[#FF572E] mb-1">
                          <Users className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span className="font-black text-base sm:text-lg text-[#17233C]">
                            {stats.matches}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#6E7587]">Matches</span>
                      </div>

                      {/* Confirmed */}
                      <div className="bg-[#EDFAF3] border border-[#BCECD4] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1.5 text-[#16A34A] mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span className="font-black text-base sm:text-lg text-[#17233C]">
                            {stats.confirmed}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#6E7587]">Confirmed</span>
                      </div>

                      {/* Pending */}
                      <div className="bg-[#FEF9E7] border border-[#FDEBB2] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1.5 text-[#CA8A04] mb-1">
                          <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span className="font-black text-base sm:text-lg text-[#17233C]">
                            {stats.pending}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#6E7587]">Pending</span>
                      </div>

                    </div>
                  </div>

                  {/* Card 2: Match Tips for Campus */}
                  <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs flex-1">
                    <div className="flex items-center gap-2 mb-3.5">
                      <span className="text-base select-none">💡</span>
                      <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                        Match Tips for Campus
                      </h3>
                    </div>
                    
                    <ul className="space-y-2.5 text-xs text-[#555E70] leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="text-[#FF572E] font-black text-sm leading-none mt-0.5">•</span>
                        <span>Set a flexible time window of ±30 mins to get 3× more potential matches.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#FF572E] font-black text-sm leading-none mt-0.5">•</span>
                        <span>Always check verified student badges and mutual rides before confirming.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#FF572E] font-black text-sm leading-none mt-0.5">•</span>
                        <span>Use in-app messaging to coordinate pickup spots like Campus Main Gate.</span>
                      </li>
                    </ul>
                  </div>

                </div>

              </div>


              {/* ------------------------------------------------------------------- */}
              {/* BOTTOM SECTION: POPULAR TRAVEL MATCH ROUTES (Rendered only on real entries) */}
              {/* ------------------------------------------------------------------- */}
              {popularRoutes.length > 0 && (
                <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#F4E3D8]/90 shadow-xs">
                  <h2 className="text-lg sm:text-xl font-black text-[#17233C] mb-4 tracking-tight">
                    Popular Travel Match Routes
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                    {popularRoutes.map((route, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleRouteClick(route)}
                        className="bg-[#FFFBF8] hover:bg-white rounded-2xl p-4 border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-extrabold text-[#17233C] text-sm sm:text-base group-hover:text-[#FF572E] transition-colors flex items-center gap-1.5">
                            <span>{route.from}</span>
                            <span className="text-[#FF572E]">→</span>
                            <span>{route.to}</span>
                          </div>
                          <div className="text-xs text-[#6E7587] mt-0.5 font-medium">
                            {route.schedule}
                          </div>
                        </div>

                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAF8F0] border border-[#BCECD4] text-[#16A34A] text-xs font-black shrink-0">
                          {route.activeCount} Active
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          ) : (
            /* =================================================================== */
            /* MY MATCHES VIEW                                                     */
            /* =================================================================== */
            <motion.div
              key="my-matches"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#17233C]">
                    Your Match Connections
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6E7587]">
                    Peers matched with your campus route and travel schedules.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('Discover')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Discover</span>
                </button>
              </div>

              {/* If no matches yet */}
              {allTravels.length === 0 && myBookings.length === 0 ? (
                <div className="bg-white rounded-[28px] p-10 border border-[#F4E3D8] text-center max-w-lg mx-auto">
                  <div className="w-14 h-14 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7" />
                  </div>
                  <h3 className="font-black text-lg text-[#17233C] mb-1">No Matches Found Yet</h3>
                  <p className="text-xs text-[#6E7587] mb-5">
                    Set your ride preferences or offer a ride to automatically match with campus peers going your way.
                  </p>
                  <button
                    onClick={() => navigate('/match/preferences')}
                    className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer"
                  >
                    Set Match Preferences
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allTravels.map((travel) => {
                    const student = travel.student || {};
                    const fromCity = travel.source || travel.from || 'VIT, Bhopal';
                    const toCity = travel.destination || travel.to || 'Bhopal City';
                    const seats = travel.seats || travel.availableSeats || 1;
                    const phone = student.phone || travel.phone || '';
                    const dateFormatted = travel.travelDate 
                      ? new Date(travel.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : 'Today';

                    return (
                      <div
                        key={travel._id || travel.id}
                        className="bg-white rounded-[24px] p-5 border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Student Info Header */}
                          <div className="flex items-center justify-between mb-3.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar avatarId={student.avatarId || 'm1'} size="md" ring />
                              <div>
                                <h4 className="font-extrabold text-sm text-[#17233C]">
                                  {student.name || 'Campus Student'}
                                </h4>
                                <span className="inline-flex items-center gap-1 text-[11px] text-[#16A34A] font-semibold">
                                  <ShieldCheck className="w-3 h-3" />
                                  Verified Student
                                </span>
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-full bg-[#FFF4ED] text-[#FF572E] text-xs font-black">
                              {seats} seat{seats > 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Route box */}
                          <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-1.5 mb-3.5">
                            <div className="flex items-center gap-2 text-[#17233C] font-bold">
                              <MapPin className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                              <span className="truncate">{fromCity} → {toCity}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#6E7587]">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>{dateFormatted}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-[#F4E3D8]">
                          <button
                            onClick={() => openWhatsAppChat({
                              phone,
                              name: student.name || 'Campus Peer',
                              route: `${fromCity} → ${toCity}`
                            })}
                            className="flex-1 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#128C7E] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => navigate(`/book/${travel._id || travel.id}`)}
                            className="flex-1 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                          >
                            Book Seat
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}
