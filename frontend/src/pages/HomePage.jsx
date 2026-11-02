import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Search, Car, MapPin, Users, Wrench, MessageSquare, 
  ArrowRight, Heart, Calendar, Clock, CheckCircle2, 
  Star, MessageCircle, ShieldCheck
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { 
  getProfile, 
  getMyBookings, 
  getReceivedBookings, 
  getUnreadCount, 
  getTravels,
  getCommunityPosts,
  toggleLikePost
} from '../lib/api';

// Miniature Car SVG for Upcoming Ride Card
function MiniCarIcon({ className = "w-12 h-7" }) {
  return (
    <svg viewBox="0 0 64 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M6 18 L12 8 L24 4 H42 L52 10 L58 16 V24 H6 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      <path d="M14 9 L22 6 H34 V15 H11 Z" fill="#1E293B" opacity="0.85" />
      <path d="M37 6 H43 L49 11 V15 H37 Z" fill="#1E293B" opacity="0.85" />
      <rect x="54" y="17" width="3" height="3" rx="1" fill="#3B82F6" />
      <circle cx="15" cy="26" r="5.5" fill="#1E293B" />
      <circle cx="15" cy="26" r="2.5" fill="#94A3B8" />
      <circle cx="47" cy="26" r="5.5" fill="#1E293B" />
      <circle cx="47" cy="26" r="2.5" fill="#94A3B8" />
    </svg>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [rides, setRides] = useState([]);
  const [latestPost, setLatestPost] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');

  // Fetch real authenticated user dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, bookingsRes, receivedRes, notifRes, travelsRes, postRes] = await Promise.allSettled([
        getProfile(),
        getMyBookings(),
        getReceivedBookings(),
        getUnreadCount(),
        getTravels({ limit: 6 }),
        getCommunityPosts({ limit: 1 })
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data || null);
      }
      if (bookingsRes.status === 'fulfilled') {
        const bList = bookingsRes.value.data?.data || bookingsRes.value.data?.bookings || bookingsRes.value.data || [];
        setBookings(Array.isArray(bList) ? bList : []);
      }
      if (receivedRes.status === 'fulfilled') {
        const rList = receivedRes.value.data?.data || receivedRes.value.data?.bookings || receivedRes.value.data || [];
        setReceivedBookings(Array.isArray(rList) ? rList : []);
      }
      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.data?.data?.count || 0);
      }
      if (travelsRes.status === 'fulfilled') {
        const tList = travelsRes.value.data?.data || travelsRes.value.data?.travels || travelsRes.value.data || [];
        setRides(Array.isArray(tList) ? tList : []);
      }
      if (postRes.status === 'fulfilled') {
        const pList = postRes.value.data?.data || [];
        setLatestPost(pList[0] || null);
      }
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Authenticated user's real first name
  const firstName = useMemo(() => {
    if (profile?.name) {
      return profile.name.split(' ')[0];
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.fullName) {
      return user.fullName.split(' ')[0];
    }
    return 'Student';
  }, [profile, user]);

  // Compute live match activity statistics from real database records
  const stats = useMemo(() => {
    const totalCount = bookings.length + receivedBookings.length;
    const confirmedCount = bookings.filter(b => b.status === 'confirmed').length +
      receivedBookings.filter(b => b.status === 'confirmed').length;
    const pendingCount = bookings.filter(b => b.status === 'pending').length +
      receivedBookings.filter(b => b.status === 'pending').length;

    return {
      total: totalCount,
      confirmed: confirmedCount,
      pending: pendingCount
    };
  }, [bookings, receivedBookings]);

  // First upcoming ride from real bookings
  const upcomingRide = useMemo(() => {
    if (!bookings || bookings.length === 0) return null;
    // Prefer confirmed bookings first, otherwise earliest booking
    const confirmed = bookings.find(b => b.status === 'confirmed');
    return confirmed || bookings[0];
  }, [bookings]);

  // Featured ride near you from real travels
  const featuredRide = useMemo(() => {
    if (!rides || rides.length === 0) return null;
    return rides[0];
  }, [rides]);

  // Potential smart match peer from real travels
  const matchPeer = useMemo(() => {
    if (!rides || rides.length === 0) return null;
    // If there are multiple rides, take the second or first
    return rides.length > 1 ? rides[1] : rides[0];
  }, [rides]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchVal.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const toggleCommunityLike = async () => {
    if (!latestPost) return;
    const postId = latestPost._id || latestPost.id;
    const nowLiked = !latestPost.isLiked;
    setLatestPost(prev => ({
      ...prev,
      isLiked: nowLiked,
      likeCount: nowLiked ? ((prev.likeCount || 0) + 1) : Math.max(0, (prev.likeCount || 0) - 1)
    }));
    try {
      await toggleLikePost(postId);
    } catch (e) {
      console.error('Like toggle error:', e);
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* ========================================================================= */}
        {/* MAIN DASHBOARD GRID: 8 COLS (LEFT) + 4 COLS (RIGHT)                        */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          
          {/* ======================================================================= */}
          {/* LEFT MAIN COLUMN (SPAN 8)                                               */}
          {/* ======================================================================= */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-5">
            
            {/* 1. WELCOME HERO BANNER */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-[32px] border border-[#F4E3D8]/90 shadow-xs relative overflow-hidden p-6 sm:p-8 lg:p-9 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              {/* Subtle warm decorative glow */}
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#FFF0E7]/80 via-[#FFF5EE]/40 to-transparent pointer-events-none rounded-r-[32px]" />

              {/* Left Content */}
              <div className="relative z-10 flex-1 flex flex-col items-start text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] mb-2.5 shadow-2xs">
                  🎓 Verified Campus Ride Sharing
                </span>

                <h1 className="font-black text-[#17233C] text-2xl sm:text-3xl lg:text-[38px] tracking-tight leading-tight">
                  Hey {firstName}! 👋
                </h1>
                
                <p className="mt-2 text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-sm">
                  Find rides, share journeys, meet verified campus peers, and split travel expenses easily.
                </p>

                {/* Two Action CTA Buttons */}
                <div className="flex flex-wrap items-center gap-3 mt-5">
                  <button
                    onClick={() => navigate('/rides/offer')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                  >
                    <span>Offer a Ride</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <button
                    onClick={() => navigate('/match')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-[#FFF7F2] active:scale-[0.99] border border-[#F4E3D8] text-[#17233C] hover:text-[#FF572E] rounded-full font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>Find a Match</span>
                  </button>
                </div>
              </div>

              {/* Right Illustration: webpage.png */}
              <div className="relative z-10 w-full md:w-[50%] flex items-center justify-center md:justify-end shrink-0">
                <img
                  src="/webpage.png"
                  alt="HelpU Campus Students"
                  className="w-full max-h-[190px] sm:max-h-[230px] lg:max-h-[250px] object-contain drop-shadow-sm select-none pointer-events-none"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </motion.div>


            {/* 2. FULL-WIDTH SEARCH BAR */}
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#8C93A4]" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search rides, people, or places..."
                className="w-full bg-white rounded-full py-3.5 pl-12 pr-5 text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#8C93A4] border border-[#F4E3D8] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 focus:border-[#FF572E] transition-all"
              />
            </form>


            {/* 3. 5 QUICK ACTION WIDGETS IN A ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              
              {/* 1. Offer a Ride */}
              <div
                onClick={() => navigate('/rides/offer')}
                className="bg-[#FFF4ED] hover:bg-white rounded-2xl p-3.5 border border-[#FDE0D0] hover:border-[#FF572E]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#FFE4D4] text-[#FF572E] flex items-center justify-center mb-2.5">
                    <Car className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#FF572E] transition-colors leading-tight">
                    Offer a Ride
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#6E7587] mt-0.5 leading-tight">
                    Share your journey
                  </p>
                </div>
                <div className="self-end mt-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#FDE0D0] text-[#17233C] group-hover:text-[#FF572E] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* 2. Request a Ride */}
              <div
                onClick={() => navigate('/rides/request')}
                className="bg-[#F5F3FF] hover:bg-white rounded-2xl p-3.5 border border-[#DDD6FE] hover:border-[#8B5CF6]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#8B5CF6] flex items-center justify-center mb-2.5">
                    <MapPin className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#8B5CF6] transition-colors leading-tight">
                    Request a Ride
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#6E7587] mt-0.5 leading-tight">
                    Find a ride easily
                  </p>
                </div>
                <div className="self-end mt-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#DDD6FE] text-[#17233C] group-hover:text-[#8B5CF6] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* 3. Find a Match */}
              <div
                onClick={() => navigate('/match')}
                className="bg-[#FFF7ED] hover:bg-white rounded-2xl p-3.5 border border-[#FED7AA] hover:border-[#F97316]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center mb-2.5">
                    <Users className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#EA580C] transition-colors leading-tight">
                    Find a Match
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#6E7587] mt-0.5 leading-tight">
                    Get travel buddies
                  </p>
                </div>
                <div className="self-end mt-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#FED7AA] text-[#17233C] group-hover:text-[#EA580C] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* 4. Get Help */}
              <div
                onClick={() => navigate('/help')}
                className="bg-[#F0FDF4] hover:bg-white rounded-2xl p-3.5 border border-[#BBF7D0] hover:border-[#16A34A]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mb-2.5">
                    <Wrench className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#16A34A] transition-colors leading-tight">
                    Get Help
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#6E7587] mt-0.5 leading-tight">
                    Campus services
                  </p>
                </div>
                <div className="self-end mt-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#BBF7D0] text-[#17233C] group-hover:text-[#16A34A] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* 5. Community */}
              <div
                onClick={() => navigate('/community')}
                className="bg-[#EFF6FF] hover:bg-white rounded-2xl p-3.5 border border-[#BFDBFE] hover:border-[#2563EB]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group col-span-2 sm:col-span-1"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center mb-2.5">
                    <MessageSquare className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#2563EB] transition-colors leading-tight">
                    Community
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#6E7587] mt-0.5 leading-tight">
                    Meet & connect
                  </p>
                </div>
                <div className="self-end mt-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-[#BFDBFE] text-[#17233C] group-hover:text-[#2563EB] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

            </div>


            {/* 4. BOTTOM TWO-COLUMN ROW: SMART MATCH & AVAILABLE RIDES NEAR YOU */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
              
              {/* SMART MATCH CARD (SPAN 5) */}
              <div className="md:col-span-5 bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-navy text-sm sm:text-base flex items-center gap-1.5">
                    <span>Smart Match</span>
                    <span>🔥</span>
                  </h3>
                  <button
                    onClick={() => navigate('/match')}
                    className="text-xs font-bold text-[#FF572E] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Matches</span>
                    <span>→</span>
                  </button>
                </div>

                {/* Linked Avatars Graphic */}
                <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center gap-2.5 relative mb-2.5">
                    {/* User's own Avatar */}
                    <div className="relative">
                      <Avatar 
                        avatarId={profile?.avatarId || 'm1'} 
                        src={user?.imageUrl} 
                        size="md" 
                        ring 
                      />
                    </div>

                    {/* Connecting Link */}
                    <div className="w-7 h-7 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-sm shadow-[#FF572E]/30 z-10 -mx-1 text-xs">
                      🔗
                    </div>

                    {/* Matching Peer Avatar */}
                    <div className="relative">
                      <Avatar 
                        avatarId={matchPeer?.student?.avatarId || 'f1'} 
                        size="md" 
                        ring 
                      />
                    </div>
                  </div>

                  <h4 className="font-extrabold text-[#17233C] text-sm">
                    {matchPeer?.student?.name ? `${matchPeer.student.name} matched!` : 'Campus Route Matching'}
                  </h4>
                  
                  <p className="text-[11px] text-[#6E7587] mt-0.5 max-w-[210px] leading-relaxed">
                    {matchPeer 
                      ? `${matchPeer.source || matchPeer.from} → ${matchPeer.destination || matchPeer.to}`
                      : 'Connect with verified students heading your way.'}
                  </p>
                </div>

                {/* Bottom Action Button */}
                <button
                  onClick={() => navigate('/match')}
                  className="w-full mt-2 py-2 bg-[#FFF4ED] hover:bg-[#FFEAE0] text-[#FF572E] font-extrabold text-xs rounded-xl border border-[#FDE0D0] transition-colors cursor-pointer text-center"
                >
                  Explore Matches →
                </button>
              </div>


              {/* AVAILABLE RIDES NEAR YOU CARD (SPAN 7) */}
              <div className="md:col-span-7 bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-[#FF572E]" />
                    <h3 className="font-black text-navy text-sm sm:text-base">
                      Available Rides Near You
                    </h3>
                  </div>
                  <button
                    onClick={() => navigate('/rides')}
                    className="text-xs font-bold text-[#FF572E] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View All</span>
                    <span>→</span>
                  </button>
                </div>

                {/* Ride Item or Empty State */}
                {featuredRide ? (
                  <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] flex items-center justify-between gap-3">
                    
                    {/* Driver Avatar & Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar 
                        avatarId={featuredRide.student?.avatarId || 'm2'} 
                        size="md" 
                        ring 
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-[#17233C] text-xs sm:text-sm truncate">
                            {featuredRide.student?.name || 'Campus Student'}
                          </span>
                          <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#6E7587] mt-0.5">
                          <span>Student</span>
                          <span>•</span>
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-[#17233C]">4.8</span>
                        </div>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="hidden sm:flex flex-col text-xs font-bold text-[#17233C]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                        <span className="truncate max-w-[100px]">{featuredRide.source || featuredRide.from || 'Bhopal'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full bg-[#FF572E]" />
                        <span className="truncate max-w-[100px]">{featuredRide.destination || featuredRide.to || 'Railway Station'}</span>
                      </div>
                    </div>

                    {/* Request Action Button */}
                    <button
                      onClick={() => navigate(`/rides/${featuredRide._id || featuredRide.id}`)}
                      className="px-4 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-full shadow-xs transition-all shrink-0 cursor-pointer"
                    >
                      Request
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] text-center my-auto">
                    <p className="text-xs text-[#6E7587] font-medium">No active rides posted right now.</p>
                    <button
                      onClick={() => navigate('/rides/offer')}
                      className="mt-2 text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
                    >
                      Be the first to offer a ride →
                    </button>
                  </div>
                )}

                {/* Subtitle / Footer info */}
                <div className="flex items-center justify-between text-[11px] text-[#6E7587] mt-3 pt-2 border-t border-[#F4E3D8]/60">
                  <span>Verified College Peers Only</span>
                  <button 
                    onClick={() => navigate('/rides')} 
                    className="font-bold text-[#FF572E] hover:underline"
                  >
                    Browse All Rides
                  </button>
                </div>
              </div>

            </div>

          </div>


          {/* ======================================================================= */}
          {/* RIGHT COLUMN (SPAN 4)                                                   */}
          {/* ======================================================================= */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-5">
            
            {/* 1. YOUR MATCH ACTIVITY CARD */}
            <div className="bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs">
              <div 
                onClick={() => navigate('/match')}
                className="flex items-center justify-between mb-4 cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-4.5 h-4.5 text-[#FF572E] fill-[#FF572E]" />
                  <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base group-hover:text-[#FF572E] transition-colors">
                    Your Match Activity
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-[#FF572E] group-hover:translate-x-0.5 transition-transform" />
              </div>

              {/* 3 Stat Boxes in a Row */}
              <div className="grid grid-cols-3 gap-2">
                
                {/* Bookings */}
                <div className="bg-[#FFF4ED] border border-[#FDE0D0] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-1 text-[#FF572E] mb-0.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-black text-base text-[#17233C]">{stats.total}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#6E7587]">Bookings</span>
                </div>

                {/* Confirmed */}
                <div className="bg-[#EDFAF3] border border-[#BCECD4] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-1 text-[#16A34A] mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-black text-base text-[#17233C]">{stats.confirmed}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#6E7587]">Confirmed</span>
                </div>

                {/* Pending */}
                <div className="bg-[#FEF9E7] border border-[#FDEBB2] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-1 text-[#CA8A04] mb-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-black text-base text-[#17233C]">{stats.pending}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#6E7587]">Pending</span>
                </div>

              </div>
            </div>


            {/* 2. UPCOMING RIDES CARD */}
            <div className="bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF572E]" />
                  <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                    Upcoming Rides
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/bookings')}
                  className="text-xs font-bold text-[#FF572E] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View All</span>
                  <span>→</span>
                </button>
              </div>

              {/* Ride Card or Empty State */}
              {upcomingRide ? (
                <div 
                  onClick={() => navigate(`/bookings/${upcomingRide._id || upcomingRide.id}`)}
                  className="p-3 bg-[#FFFBF8] hover:bg-white rounded-2xl border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#F4E3D8] flex items-center justify-center shrink-0">
                      <MiniCarIcon className="w-8 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-[#17233C] text-xs sm:text-sm truncate group-hover:text-[#FF572E] transition-colors">
                        {upcomingRide.from || upcomingRide.source || 'Bhopal'} → {upcomingRide.to || upcomingRide.destination || 'Station'}
                      </div>
                      <div className="text-[11px] text-[#6E7587] mt-0.5 flex items-center gap-1.5">
                        <span>Today, 4:30 PM</span>
                        <span>•</span>
                        <span>{upcomingRide.seats || 2} seats</span>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#EDFAF3] border border-[#BCECD4] text-[#16A34A] text-[10px] font-bold">
                        {upcomingRide.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="w-6 h-6 rounded-full bg-white border border-[#F4E3D8] text-[#17233C] group-hover:text-[#FF572E] flex items-center justify-center shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] text-center">
                  <p className="text-xs text-[#6E7587] font-medium">No upcoming rides scheduled.</p>
                  <button
                    onClick={() => navigate('/rides')}
                    className="mt-2 text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
                  >
                    Find a campus ride →
                  </button>
                </div>
              )}
            </div>


            {/* 3. COMMUNITY CARD */}
            <div className="bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF572E]" />
                  <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                    Community
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/community')}
                  className="text-xs font-bold text-[#FF572E] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View All</span>
                  <span>→</span>
                </button>
              </div>

              {/* Student Community Post or Empty State */}
              {latestPost ? (
                <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar 
                      avatarId={latestPost.authorAvatar || 'm1'} 
                      src={latestPost.authorImage}
                      size="sm" 
                    />
                    <div>
                      <h4 className="font-extrabold text-[#17233C] text-xs">
                        {latestPost.authorName || 'Campus Student'}
                      </h4>
                      <span className="text-[10px] text-[#6E7587]">
                        {latestPost.createdAt ? new Date(latestPost.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#17233C] font-medium leading-relaxed mb-3 line-clamp-2">
                    {latestPost.content}
                  </p>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#F4E3D8]">
                    <div className="flex items-center gap-3 text-xs text-[#6E7587]">
                      <button
                        onClick={toggleCommunityLike}
                        className={`flex items-center gap-1 transition-colors cursor-pointer ${
                          latestPost.isLiked ? 'text-[#FF572E] font-bold' : 'hover:text-[#FF572E]'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${latestPost.isLiked ? 'fill-[#FF572E] text-[#FF572E]' : ''}`} />
                        <span>{latestPost.likeCount ?? latestPost.likes?.length ?? 0}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{latestPost.commentCount ?? latestPost.comments?.length ?? 0}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate('/community')}
                      className="px-3 py-1 bg-[#FF572E] hover:bg-[#E64A22] text-white text-[11px] font-bold rounded-full shadow-xs transition-colors cursor-pointer"
                    >
                      Explore
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] text-center">
                  <p className="text-xs text-[#6E7587] font-medium">No community posts yet.</p>
                  <button
                    onClick={() => navigate('/community')}
                    className="mt-2 text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
                  >
                    Start the first discussion →
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </ResponsiveShell>
  );
}
