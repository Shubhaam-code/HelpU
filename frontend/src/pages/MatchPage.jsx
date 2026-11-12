import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Users, MapPin, Clock, Calendar, ShieldCheck, Car, MessageSquare,
  Sparkles, RefreshCw, AlertCircle, Send, Check, Ticket, ChevronRight,
  Heart, TrendingUp, ArrowRight, ArrowLeft, CheckCircle2, GraduationCap,
  Search, Info, CarTaxiFront, CheckCircle, XCircle
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { openWhatsAppChat } from '../lib/whatsapp';
import { 
  getMyTravels, 
  getTravelMatches, 
  getMyBookings, 
  getReceivedBookings,
  directJoinSharedRideGroup,
  createGroupFromFindMatch,
  acceptGroupInvitation,
  rejectGroupInvitation
} from '../lib/api';
import { invalidateGroupQueries } from '../lib/queryClient';

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

export default function MatchPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const matchesSectionRef = useRef(null);

  // My Active Travel Posts
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState(null);
  const [myTravels, setMyTravels] = useState([]);

  // Selected Travel Post & its specific matching results
  const [selectedPost, setSelectedPost] = useState(null);
  const [matches, setMatches] = useState([]);
  const [sharedGroups, setSharedGroups] = useState([]);
  const [compatibleFinds, setCompatibleFinds] = useState([]);
  const [creatingGroupId, setCreatingGroupId] = useState(null);
  const [groupSizeModalPeer, setGroupSizeModalPeer] = useState(null);
  const [selectedGroupSize, setSelectedGroupSize] = useState(4);
  const [groupModalError, setGroupModalError] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState(null);
  const [fetchingPostId, setFetchingPostId] = useState(null);

  // Global activity stats
  const [myBookings, setMyBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);

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

  // Auto-dismiss toast message
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Handle WhatsApp contact
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

  // Fetch logged-in user's active travel posts (without aggregating matches across all posts)
  const fetchMyActivePosts = useCallback(async () => {
    setLoadingPosts(true);
    setPostsError(null);

    try {
      const [travelsRes, myBookingsRes, receivedRes] = await Promise.allSettled([
        getMyTravels(),
        getMyBookings(),
        getReceivedBookings()
      ]);

      if (travelsRes.status === 'fulfilled') {
        const travelsList = travelsRes.value?.data?.data || travelsRes.value?.data || [];
        setMyTravels(Array.isArray(travelsList) ? travelsList : []);
      } else {
        throw new Error(travelsRes.reason?.response?.data?.message || 'Unable to load your active travels');
      }

      if (myBookingsRes.status === 'fulfilled') {
        const list = myBookingsRes.value?.data?.data || myBookingsRes.value?.data?.bookings || [];
        setMyBookings(Array.isArray(list) ? list : []);
      }

      if (receivedRes.status === 'fulfilled') {
        const list = receivedRes.value?.data?.data || receivedRes.value?.data?.bookings || [];
        setReceivedBookings(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Error fetching travel posts:', err);
      setPostsError(err.message || 'Unable to load your travel posts right now.');
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    fetchMyActivePosts();
  }, [fetchMyActivePosts]);

  // Handle Find Matches for a specifically selected travel post
  const handleSelectPostForMatches = async (post) => {
    if (!post || !post._id) return;
    const postId = post._id.toString();

    // Prevent duplicate API calls on rapid clicks
    if (fetchingPostId === postId) return;

    setSelectedPost(post);
    setLoadingMatches(true);
    setMatchesError(null);
    setFetchingPostId(postId);

    try {
      const res = await getTravelMatches(postId);
      const data = res?.data?.data || [];
      const groups = res?.data?.sharedRideGroups || [];
      const rawFinds = res?.data?.compatibleFinds || [];
      
      // DEBUG: Log relationship states
      console.log('[MatchPage] Compatible finds received:', rawFinds.map(f => ({
        name: f.student?.name || f.authorName,
        relationshipState: f.relationshipState,
        proposalId: f.proposalId
      })));
      
      setMatches(Array.isArray(data) ? data : []);
      setSharedGroups(Array.isArray(groups) ? groups : []);
      setCompatibleFinds(Array.isArray(rawFinds) ? rawFinds : []);

      // Scroll smoothly to the results section
      setTimeout(() => {
        if (matchesSectionRef.current) {
          matchesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Error fetching matches for travel post:', err);
      setMatchesError(
        err.response?.data?.message || err.message || 'Could not fetch matches for this travel post.'
      );
      setMatches([]);
      setSharedGroups([]);
      setCompatibleFinds([]);
    } finally {
      setLoadingMatches(false);
      setFetchingPostId(null);
    }
  };

  // Return from matching results back to My Active Travel Posts
  const handleBackToPosts = () => {
    setSelectedPost(null);
    setMatches([]);
    setSharedGroups([]);
    setCompatibleFinds([]);
    setMatchesError(null);
  };

  // Open Group Size selector modal before creating a group with a compatible FIND student
  const handleCreateGroupWithPeer = (peerTravel) => {
    if (!selectedPost?._id || !peerTravel?._id) return;
    setSelectedGroupSize(4);
    setGroupModalError('');
    setGroupSizeModalPeer(peerTravel);
  };


  // Confirm creating group with the chosen group size - BUG 2 & 3 FIX
  const handleConfirmCreateGroupWithPeer = async () => {
    if (!selectedPost?._id || !groupSizeModalPeer?._id) return;
    const peerTravel = groupSizeModalPeer;
    const peerId = peerTravel._id.toString();
    setCreatingGroupId(peerId);
    setGroupModalError('');
    try {
      const res = await createGroupFromFindMatch({
        originatingTravelId: selectedPost._id,
        candidateTravelId: peerTravel._id,
        targetCapacity: selectedGroupSize
      });
      
      // DEBUG: Log response
      console.log('[MatchPage] Group proposal created:', {
        success: res?.data?.success,
        relationshipState: res?.data?.data?.relationshipState,
        proposalId: res?.data?.data?.proposal?._id,
        message: res?.data?.message
      });
      
      // IMMEDIATE UI UPDATE: Update the peer's relationshipState to REQUEST_SENT before refetching
      const relationshipState = res?.data?.data?.relationshipState;
      const proposalId = res?.data?.data?.proposal?._id;
      if (relationshipState && proposalId) {
        setCompatibleFinds(prevFinds =>
          prevFinds.map(find =>
            find._id === peerTravel._id
              ? { ...find, relationshipState, proposalId }
              : find
          )
        );
      }
      
      invalidateGroupQueries();
      setGroupSizeModalPeer(null);
      
      // Re-fetch matches immediately to update relationship states from server
      if (selectedPost?._id) {
        console.log('[MatchPage] Re-fetching matches after proposal creation...');
        await handleSelectPostForMatches(selectedPost);
      }
      
      const group = res?.data?.data?.group || res?.data?.group;
      if (group?._id) {
        setToastMsg({
          type: 'success',
          text: 'Group created successfully!'
        });
        setTimeout(() => {
          navigate(`/groups/${group._id}`, {
            state: { from: 'match', fromLabel: 'Back to Find Match', postId: selectedPost._id }
          });
        }, 500);
      } else {
        setToastMsg({
          type: 'success',
          text: 'Group formation request sent! Awaiting student response.'
        });
      }
    } catch (err) {
      console.error('Error creating group with peer:', err);
      const msg = err.response?.data?.message || 'Failed to create group proposal.';
      setGroupModalError(msg);
      setToastMsg({
        type: 'error',
        text: msg
      });
    } finally {
      setCreatingGroupId(null);
    }
  };

  // Compute live match activity stats
  const stats = useMemo(() => {
    const confirmedCount = myBookings.filter(b => b.status === 'confirmed').length +
      receivedBookings.filter(b => b.status === 'confirmed').length;

    const pendingCount = myBookings.filter(b => b.status === 'pending').length +
      receivedBookings.filter(b => b.status === 'pending').length;

    return {
      activePosts: myTravels.length,
      confirmed: confirmedCount,
      pending: pendingCount
    };
  }, [myTravels, myBookings, receivedBookings]);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Matches" backTo={false} />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 space-y-6 sm:space-y-8">
        
        {/* ========================================================================= */}
        {/* TOP TOOLBAR: TITLE & REFRESH                                              */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] uppercase shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
                Campus Travel Matching
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
              Campus Matches
            </h1>
            <p className="text-xs sm:text-sm text-[#6E7587] mt-0.5">
              Select your travel offer or request to discover verified peers travelling on your route.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                fetchMyActivePosts();
                if (selectedPost) handleSelectPostForMatches(selectedPost);
              }}
              disabled={loadingPosts || loadingMatches}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loadingPosts || loadingMatches) ? 'animate-spin text-[#FF572E]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => navigate('/rides/offer')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Car className="w-3.5 h-3.5" />
              <span>+ Offer Ride</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HERO SECTION: BANNER + STATS & RULES                                      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
          
          {/* HERO CARD (SPAN 8) */}
          <div className="lg:col-span-8 bg-white rounded-[28px] border border-[#F4E3D8]/90 shadow-sm relative overflow-hidden flex flex-col justify-between p-6 sm:p-8 lg:p-9">
            
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#FFF0E7]/60 via-[#FFF5EE]/40 to-transparent pointer-events-none rounded-r-[28px]" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
              
              <div className="w-full lg:max-w-[55%] flex flex-col items-center lg:items-start text-center lg:text-left">
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] font-bold text-xs mb-3">
                  <Heart className="w-3.5 h-3.5 fill-[#FF572E] text-[#FF572E]" />
                  <span>Smart Route Pairing</span>
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-black text-[#17233C] leading-[1.14] tracking-tight">
                  Find Your <br />
                  <span className="text-[#FF572E] relative inline-block">
                    Travel Match
                    <svg className="absolute -top-3.5 -right-6 w-5 h-5 text-[#FF572E] select-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="4" y1="12" x2="1" y2="10" />
                      <line x1="8" y1="5" x2="7" y2="1" />
                      <line x1="16" y1="4" x2="18" y2="1" />
                    </svg>
                  </span>
                </h2>

                <p className="mt-3 text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-md">
                  Pick any of your published travel offers or requests below to find compatible campus peers travelling on your same route, calendar date, and departure window.
                </p>

                {/* 4 Feature Badges */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-4 pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                    <MapPin className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>Same Route</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                    <Clock className="w-3.5 h-3.5 text-[#6E7587]" />
                    <span>Up to 7h Window</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F0FAF4] border border-[#C6EFD9] text-[11px] font-bold text-[#17233C]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Verified Students</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                    <GraduationCap className="w-3.5 h-3.5 text-[#17233C]" />
                    <span>Same Campus</span>
                  </span>
                </div>

              </div>

              {/* Right Illustration */}
              <div className="w-full lg:w-[45%] flex items-center justify-center relative mt-2 lg:mt-0">
                <div className="absolute top-2 left-1/3 -translate-x-1/2 z-20 w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-white border border-[#F4E3D8] shadow-md flex items-center justify-center text-[#FF572E]">
                  <Car className="w-5 h-5 fill-[#FF572E]/10 stroke-[#FF572E] stroke-[2.2]" />
                </div>

                <img
                  src="/match.png"
                  alt="Find Your Travel Match"
                  className="w-full max-h-[240px] sm:max-h-[280px] lg:max-h-[320px] object-contain drop-shadow-sm select-none pointer-events-none"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN STACK (SPAN 4) */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-4 sm:gap-5">
            
            {/* Card 1: Your Activity Stats */}
            <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs flex flex-col justify-between flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FF572E] stroke-[2.2]" />
                  <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                    Your Travel Activity
                  </h3>
                </div>
              </div>

              {/* 3 Stat Boxes */}
              <div className="grid grid-cols-3 gap-2.5">
                
                <div className="bg-[#FFF4ED] border border-[#FDE0D0] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-1.5 text-[#FF572E] mb-1">
                    <Car className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span className="font-black text-base sm:text-lg text-[#17233C]">
                      {stats.activePosts}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#6E7587]">Active Posts</span>
                </div>

                <div 
                  onClick={() => navigate('/posts')}
                  className="bg-[#EDFAF3] hover:bg-[#DDF6E8] border border-[#BCECD4] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-center gap-1.5 text-[#16A34A] mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span className="font-black text-base sm:text-lg text-[#17233C]">
                      {stats.confirmed}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#6E7587]">Confirmed</span>
                </div>

                <div 
                  onClick={() => navigate('/posts')}
                  className="bg-[#FEF9E7] hover:bg-[#FDF3CC] border border-[#FDEBB2] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
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

            {/* Card 2: Match Principles */}
            <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base select-none">💡</span>
                <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                  Matching Rules
                </h3>
              </div>
              
              <ul className="space-y-2 text-xs text-[#555E70] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF572E] font-black text-sm leading-none mt-0.5">•</span>
                  <span>Must share exact route direction &amp; same calendar date.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF572E] font-black text-sm leading-none mt-0.5">•</span>
                  <span>Departure time difference is at most 7 hours (420 mins).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF572E] font-black text-sm leading-none mt-0.5">•</span>
                  <span>Offer matches requests &amp; co-drivers; Requests match offers only.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* MAIN INTERACTIVE SECTION: MY ACTIVE POSTS OR SELECTED POST RESULTS        */}
        {/* ========================================================================= */}
        <div ref={matchesSectionRef} className="space-y-6 pt-2">

          {/* ----------------------------------------------------------------------- */}
          {/* VIEW A: NO SPECIFIC POST SELECTED -> SHOW MY ACTIVE TRAVEL POSTS        */}
          {/* ----------------------------------------------------------------------- */}
          {!selectedPost ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#17233C] tracking-tight flex items-center gap-2">
                    <Car className="w-5 h-5 text-[#FF572E]" />
                    <span>My Active Travel Posts</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#FF572E] font-black border border-[#FDE0D0]">
                      {myTravels.length}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6E7587] mt-0.5">
                    Click "Find Matches" on any post below to search for compatible peers for that specific route.
                  </p>
                </div>
              </div>

              {loadingPosts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-[24px] p-5 border border-[#F4E3D8] animate-pulse space-y-4">
                      <div className="h-6 bg-gray-200 rounded-md w-1/3" />
                      <div className="h-10 bg-gray-100 rounded-xl" />
                      <div className="h-8 bg-gray-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : postsError ? (
                <div className="bg-white rounded-[28px] p-8 text-center border border-red-200 max-w-lg mx-auto space-y-4 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-[#17233C]">Unable to Load Posts</h4>
                    <p className="text-xs text-red-600 mt-1 max-w-sm mx-auto">{postsError}</p>
                  </div>
                  <button
                    onClick={fetchMyActivePosts}
                    className="px-5 py-2 bg-[#FF572E] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : myTravels.length === 0 ? (
                /* No active posts found */
                <div className="bg-white rounded-[32px] p-6 sm:p-10 text-center border border-[#F4E3D8] max-w-xl mx-auto space-y-4 shadow-sm">
                  <div className="w-full flex justify-center items-center py-1 sm:py-2">
                    <img
                      src="/car.png"
                      alt="No active rides"
                      className="w-full max-w-[270px] min-[390px]:max-w-[310px] sm:max-w-[360px] h-auto max-h-[220px] sm:max-h-[260px] object-contain drop-shadow-md select-none pointer-events-none mb-2"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <div>
                    <h4 className="font-black text-xl text-[#17233C]">
                      No Active Ride Offer or Request Found
                    </h4>
                    <p className="text-xs sm:text-sm text-[#6E7587] mt-1.5 max-w-md mx-auto leading-relaxed">
                      Helpu matches rides based on your own actual travel plans. Publish a ride offer or passenger request to find matching students going your way!
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
                      <Send className="w-4 h-4 text-[#8B5CF6]" />
                      <span>+ Find a Ride</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Grid of Active Posts with "Find Matches" Button */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myTravels.map((travel) => {
                    const isOffer = travel.type === 'offer';
                    const booked = travel.bookedSeats || 0;
                    const availableSeats = Math.max(0, (travel.seats || 1) - booked);
                    const isCurrentlyFetching = fetchingPostId === travel._id?.toString();

                    return (
                      <div
                        key={travel._id}
                        className="bg-white rounded-[24px] border border-[#F4E3D8] p-5 shadow-xs hover:shadow-md hover:border-[#FF572E]/40 transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3.5">
                          {/* Card Header: Type Badge & Price / Vehicle */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isOffer
                                ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                                : 'bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE]'
                            }`}>
                              {isOffer ? 'Ride Offer' : 'Find Ride'}
                            </span>

                            {isOffer && travel.pricePerSeat > 0 && (
                              <span className="text-[#FF572E] font-black text-xs sm:text-sm font-mono">
                                ₹{travel.pricePerSeat}/seat
                              </span>
                            )}
                          </div>

                          {/* Route Block */}
                          <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-1.5">
                            <div className="flex items-center gap-2 font-black text-[#17233C] text-sm">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                              <span className="truncate">{travel.source}</span>
                            </div>
                            <div className="pl-1 border-l-2 border-dashed border-[#F4E3D8] ml-1 my-0.5 py-0.5">
                              <span className="text-[10px] text-[#FF572E] font-bold">Direction</span>
                            </div>
                            <div className="flex items-center gap-2 font-black text-[#17233C] text-sm">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                              <span className="truncate">{travel.destination}</span>
                            </div>
                          </div>

                          {/* Schedule & Seats Metadata */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E7587] pt-1 border-t border-[#F4E3D8]/60">
                            <div className="flex items-center gap-1.5 truncate">
                              <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                              <span className="font-bold text-[#17233C]">{formatTravelDate(travel.travelDate)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <Clock className="w-3.5 h-3.5 text-[#6E7587] shrink-0" />
                              <span>{formatMinutesToTime(travel.departureTime)}</span>
                            </div>
                          </div>

                          <div className="text-[11px] font-semibold text-[#6E7587]">
                            {isOffer ? (
                              <span className="text-[#16A34A]">
                                🟢 <strong>{availableSeats}</strong> of {travel.seats} seats available
                              </span>
                            ) : (
                              <span className="text-[#8B5CF6]">
                                🟣 <strong>{travel.seats || 1}</strong> seat(s) requested
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Primary Card Action: Find Matches for this post */}
                        <div className="pt-2 border-t border-[#F4E3D8]/70">
                          <button
                            type="button"
                            onClick={() => handleSelectPostForMatches(travel)}
                            disabled={isCurrentlyFetching}
                            className="w-full py-2.5 px-4 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {isCurrentlyFetching ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Searching Matches...</span>
                              </>
                            ) : (
                              <>
                                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Find Matches</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* --------------------------------------------------------------------- */
            /* VIEW B: POST SELECTED -> SHOW RESULTS ONLY FOR THE SELECTED POST      */
            /* --------------------------------------------------------------------- */
            <div className="space-y-5">
              
              {/* Back Navigation & Selected Post Header */}
              <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    onClick={handleBackToPosts}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#FF572E] hover:text-[#E64A22] cursor-pointer group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>← Back to My Active Travel Posts</span>
                  </button>

                  <button
                    onClick={handleBackToPosts}
                    className="px-3 py-1 bg-[#FFF4ED] hover:bg-[#FFE8DC] border border-[#FDE0D0] text-[#FF572E] text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Select Another Post
                  </button>
                </div>

                {/* Selected Post Summary Strip */}
                <div className="bg-[#FFFBF8] p-3.5 rounded-2xl border border-[#F4E3D8]/90 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      selectedPost.type === 'offer'
                        ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                        : 'bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE]'
                    }`}>
                      {selectedPost.type === 'offer' ? 'Your Offer' : 'Your Request'}
                    </span>
                    <span className="font-black text-sm sm:text-base text-[#17233C]">
                      {selectedPost.source} → {selectedPost.destination}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#6E7587]">
                    <span className="flex items-center gap-1 font-bold text-[#17233C]">
                      <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span>{formatTravelDate(selectedPost.travelDate)}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatMinutesToTime(selectedPost.departureTime)}</span>
                    </span>
                    <span>•</span>
                    <span>
                      {selectedPost.type === 'offer'
                        ? `${Math.max(0, (selectedPost.seats || 1) - (selectedPost.bookedSeats || 0))} seats avail`
                        : `${selectedPost.seats || 1} seat requested`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Toast Alert */}
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

              {/* Wait for an OFFER banner (Only when selected post is FIND/Request) */}
              {selectedPost.type === 'request' && (
                <div className="bg-gradient-to-r from-white via-[#FFFBF8] to-[#FFF5EE] rounded-[22px] sm:rounded-[26px] p-4 sm:p-5 border border-[#FDE0D0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#FFE8DC] text-[#FF572E] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Sparkles className="w-5 h-5 text-[#FF572E]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Request Active
                        </span>
                        <span className="text-[11px] font-bold text-[#17233C]">
                          Wait for an OFFER or Join a Group
                        </span>
                      </div>
                      <p className="text-xs text-[#6E7587] leading-relaxed">
                        Your passenger request is active and visible to vehicle owners on campus. You can wait for a direct vehicle offer, or join an open student cab group below!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setToastMsg({
                        type: 'success',
                        text: 'Your request is active! Drivers and peers traveling your route can connect anytime.'
                      });
                    }}
                    className="shrink-0 px-4 py-2.5 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  >
                    Keep Waiting for an Offer
                  </button>
                </div>
              )}

              {/* Match Results Content */}
              {loadingMatches ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-[24px] p-5 border border-[#F4E3D8] animate-pulse space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-full" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 bg-gray-200 rounded-md w-3/4" />
                          <div className="h-3 bg-gray-100 rounded-md w-1/2" />
                        </div>
                      </div>
                      <div className="h-14 bg-gray-100 rounded-xl" />
                      <div className="h-8 bg-gray-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : matchesError ? (
                <div className="bg-white rounded-[28px] p-8 text-center border border-red-200 max-w-lg mx-auto space-y-4 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-[#17233C]">Unable to Fetch Matches</h4>
                    <p className="text-xs text-red-600 mt-1 max-w-sm mx-auto">{matchesError}</p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => handleSelectPostForMatches(selectedPost)}
                      className="px-5 py-2 bg-[#FF572E] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                    <button
                      onClick={handleBackToPosts}
                      className="px-4 py-2 bg-white border border-[#F4E3D8] text-[#17233C] font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Back to Posts
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* ================================================================= */}
                  {/* CATEGORY A: NORMAL RIDE MATCHES (Direct Carpool Offers/Requests)    */}
                  {/* ================================================================= */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <h3 className="text-lg sm:text-xl font-black text-[#17233C] tracking-tight flex items-center gap-2">
                          <Car className="w-5 h-5 text-[#FF572E]" />
                          <span>
                            {selectedPost.type === 'request'
                              ? 'Category A: Normal Ride Matches'
                              : 'Matching Passenger Requests'}
                          </span>
                        </h3>
                        <p className="text-xs text-[#6E7587]">
                          {selectedPost.type === 'request'
                            ? 'Direct carpool offers from vehicle owners heading your way.'
                            : 'Students requesting a ride matching your carpool route.'}
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-[#EDFAF3] border border-[#BCECD4] text-[#16A34A] text-xs font-black">
                        {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
                      </span>
                    </div>

                    {matches.length === 0 ? (
                      <div className="bg-white rounded-[26px] p-6 sm:p-8 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4 shadow-xs">
                        <div className="w-14 h-14 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto shadow-2xs">
                          <Car className="w-7 h-7 text-[#FF572E]" />
                        </div>
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Request Active & Live
                          </span>
                          <h4 className="font-black text-base sm:text-lg text-[#17233C]">
                            {selectedPost.type === 'request'
                              ? 'Waiting for an Offer from a Driver'
                              : 'No Passenger Requests Yet'}
                          </h4>
                          <p className="text-xs sm:text-[13px] text-[#6E7587] leading-relaxed max-w-md mx-auto">
                            {selectedPost.type === 'request'
                              ? 'Your ride request remains active on campus! Vehicle owners heading your way can discover your post. You will receive an instant notification as soon as a driver offers a matching ride.'
                              : 'No students have requested a ride on your route yet. We will notify you when a request matches!'}
                          </p>
                        </div>
                        {selectedPost.type === 'request' && (
                          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                            <div className="px-3.5 py-1.5 rounded-xl bg-[#FFF9F5] border border-[#FDE0D0] text-[11px] font-bold text-[#17233C] inline-flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>FIND post is active (not cancelled)</span>
                            </div>
                            <div className="px-3.5 py-1.5 rounded-xl bg-[#FFF9F5] border border-[#FDE0D0] text-[11px] font-bold text-[#FF572E] inline-flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Explore groups or peers below</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {matches.map((match) => {
                          const student = match.student || match.creator || {};
                          const fromCity = match.source || match.from || 'Campus';
                          const toCity = match.destination || match.to || 'Destination';
                          const dateFormatted = formatTravelDate(match.travelDate);
                          const timeFormatted = formatMinutesToTime(match.departureTime);
                          const seats = match.availableSeats || match.seats || 1;
                          const isOffer = match.type === 'offer';
                          const travelId = match._id?.toString();

                          return (
                            <motion.div
                              key={match._id || Math.random()}
                              layout
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-[24px] border border-[#F4E3D8] p-5 shadow-xs hover:shadow-md hover:border-[#FF572E]/30 transition-all flex flex-col justify-between gap-4"
                            >
                              <div className="space-y-3.5">
                                {/* Student Profile Header */}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar
                                      name={student.name || 'Campus Student'}
                                      avatarId={student.avatarId || student.imageUrl}
                                      size="md"
                                      className="ring-2 ring-[#FF572E]/15 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <h4 className="font-extrabold text-[#17233C] text-sm truncate">
                                        {student.name || 'Campus Student'}
                                      </h4>
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A]">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Verified Student</span>
                                      </span>
                                    </div>
                                  </div>

                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                                    isOffer
                                      ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                                      : 'bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE]'
                                  }`}>
                                    {isOffer ? 'Ride Offer' : 'Find Ride'}
                                  </span>
                                </div>

                                {/* Reason Pill */}
                                {match.matchingReason && (
                                  <div className="px-3 py-1 bg-[#FFF4ED] rounded-xl text-[11px] font-bold text-[#FF572E] border border-[#FDE0D0] flex items-center gap-1.5">
                                    <span>🎯</span>
                                    <span className="truncate">{match.matchingReason}</span>
                                  </div>
                                )}

                                {/* Route & Schedule Box */}
                                <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-2">
                                  <div className="flex items-center gap-2 font-bold text-[#17233C]">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                                    <span className="truncate">{fromCity}</span>
                                    <span className="text-[#FF572E]">→</span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                                    <span className="truncate">{toCity}</span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E7587] pt-1.5 border-t border-[#F4E3D8]/60">
                                    <div className="flex items-center gap-1 truncate">
                                      <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                                      <span>{dateFormatted}</span>
                                      {timeFormatted && <span>• {timeFormatted}</span>}
                                    </div>
                                    <div className="text-right font-medium">
                                      {isOffer ? (
                                        <span className="text-[#16A34A] font-bold">{seats} seat(s) available</span>
                                      ) : (
                                        <span className="text-[#8B5CF6] font-bold">{match.seats || 1} seat requested</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Vehicle / Price */}
                                <div className="flex items-center justify-between text-xs px-1 font-semibold text-[#6E7587]">
                                  <span>{match.carModel || (isOffer ? 'Campus Carpool' : 'Needs Ride')}</span>
                                  {isOffer && match.pricePerSeat > 0 && (
                                    <span className="text-[#FF572E] font-black text-sm font-mono">
                                      ₹{match.pricePerSeat}/seat
                                    </span>
                                  )}
                                </div>

                                {/* Active Booking Status (if already booked) */}
                                {activeBookingStatusByTravelId[travelId] && (
                                  <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Booking {activeBookingStatusByTravelId[travelId]}</span>
                                  </div>
                                )}
                              </div>

                              {/* Match Card Actions: View Details + Existing Booking action */}
                              <div className="pt-2 border-t border-[#F4E3D8]/70 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (travelId && /^[0-9a-fA-F]{24}$/.test(travelId)) {
                                      navigate(`/rides/${travelId}`);
                                    } else {
                                      navigate('/rides/offer');
                                    }
                                  }}
                                  className="py-2.5 px-3 bg-white hover:bg-[#FFF7F2] text-[#17233C] hover:text-[#FF572E] border border-[#F4E3D8] hover:border-[#FF572E]/40 font-bold text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <span>View Details</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (travelId && /^[0-9a-fA-F]{24}$/.test(travelId)) {
                                      navigate(`/book/${travelId}`);
                                    } else {
                                      navigate('/rides/offer');
                                    }
                                  }}
                                  className="py-2.5 px-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs rounded-xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                >
                                  <Car className="w-3.5 h-3.5" />
                                  <span>Book Seat</span>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ================================================================= */}
                  {/* CATEGORY B: SHARED RIDE GROUPS (Only for FIND/Request posts)       */}
                  {/* ================================================================= */}
                  {selectedPost.type === 'request' && (
                    <div className="space-y-4 pt-4 border-t border-[#F4E3D8]">
                      <div className="flex items-center justify-between px-1">
                        <div>
                          <h3 className="text-lg sm:text-xl font-black text-[#17233C] tracking-tight flex items-center gap-2">
                            <CarTaxiFront className="w-5 h-5 text-[#FF572E]" />
                            <span>Category B: Shared Ride Groups</span>
                          </h3>
                          <p className="text-xs text-[#6E7587]">
                            Student groups heading on your route pooling together to split cab fares.
                          </p>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black">
                          {sharedGroups.length} {sharedGroups.length === 1 ? 'Group' : 'Groups'}
                        </span>
                      </div>

                      {sharedGroups.length === 0 ? (
                        <div className="bg-white rounded-[24px] p-8 text-center border border-[#F4E3D8] max-w-md mx-auto space-y-3 shadow-2xs">
                          <div className="w-12 h-12 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto">
                            <Users className="w-6 h-6 text-[#FF572E]" />
                          </div>
                          <div>
                            <h4 className="font-black text-base text-[#17233C]">
                              No shared ride groups found yet
                            </h4>
                            <p className="text-xs text-[#6E7587] mt-1 leading-relaxed">
                              We couldn't find any open groups on this route. You can create a new group or wait for fellow students to form one!
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate('/shared-rides')}
                            className="px-4 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <CarTaxiFront className="w-3.5 h-3.5" />
                            <span>Go to Shared Rides</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {sharedGroups.map((group) => {
                            const isJoining = joiningGroupId === group._id;
                            const hasJoined = joinedGroupIds.has(group._id);
                            const memberCount = group.confirmedMemberCount || group.members?.length || 1;
                            const capacity = group.targetCapacity || 4;
                            const availableSpots = group.availableSpots ?? Math.max(0, capacity - memberCount);

                            return (
                              <motion.div
                                key={group._id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[24px] border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md p-5 shadow-xs transition-all duration-200 flex flex-col justify-between gap-4"
                              >
                                <div className="space-y-3.5">
                                  {/* Top Header: Admin & Spots */}
                                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Avatar
                                        src={group.admin?.imageUrl}
                                        name={group.admin?.name || 'Group Organizer'}
                                        size="md"
                                        className="ring-2 ring-[#FF572E]/15 shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <h4 className="font-extrabold text-[#17233C] text-sm truncate">
                                            {group.admin?.name || 'Group Organizer'}
                                          </h4>
                                          {group.admin?.isVerified && (
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          )}
                                        </div>
                                        <span className="text-[11px] font-semibold text-[#8C93A4]">
                                          Group Organizer
                                        </span>
                                      </div>
                                    </div>

                                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black shadow-2xs">
                                      {availableSpots} {availableSpots === 1 ? 'seat offered' : 'seats offered'}
                                    </span>
                                  </div>

                                  {/* Route Box */}
                                  <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-[#17233C]">
                                      <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                                      <span className="truncate">{group.source}</span>
                                      <span className="text-[#FF572E]">→</span>
                                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                                      <span className="truncate">{group.destination}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E7587] pt-1.5 border-t border-[#F4E3D8]/60">
                                      <div className="flex items-center gap-1 truncate">
                                        <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                                        <span>{formatTravelDate(group.travelDate)}</span>
                                        <span>• {formatMinutesToTime(group.departureTime)}</span>
                                      </div>
                                      <div className="text-right font-medium text-[#17233C]">
                                        <Users className="w-3.5 h-3.5 text-[#FF572E] inline mr-1" />
                                        <span>{memberCount} / {capacity} Members</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Members Preview */}
                                  {Array.isArray(group.membersPreview) && group.membersPreview.length > 0 && (
                                    <div className="flex items-center justify-between text-xs px-1">
                                      <span className="text-[11px] font-bold text-[#6E7587]">
                                        Confirmed Members:
                                      </span>
                                      <div className="flex items-center -space-x-2">
                                        {group.membersPreview.map((m, idx) => (
                                          <div
                                            key={idx}
                                            title={m.name}
                                            className="w-6 h-6 rounded-full bg-[#FFEBE0] border-2 border-white flex items-center justify-center text-[10px] font-black text-[#FF572E] overflow-hidden"
                                          >
                                            {m.imageUrl ? (
                                              <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                            ) : (
                                              m.name?.charAt(0)?.toUpperCase() || 'M'
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Action: View Group Details (never instant direct join from card) */}
                                <div className="pt-2 border-t border-[#F4E3D8]/70">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/groups/${group._id}`, {
                                      state: { from: 'match', fromLabel: 'Back to Find Match', postId: selectedPost?._id }
                                    })}
                                    className="w-full py-2.5 px-4 bg-[#FFF0E6] hover:bg-[#FFE0D0] text-[#FF572E] border border-[#FFD9C7] font-black text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                                  >
                                    <span>View Group Details</span>
                                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ================================================================= */}
                  {/* CATEGORY C: COMPATIBLE STUDENTS (Raw Compatible FIND Posts)        */}
                  {/* ================================================================= */}
                  {selectedPost.type === 'request' && (
                    <div className="space-y-4 pt-4 border-t border-[#F4E3D8]">
                      <div className="flex items-center justify-between px-1">
                        <div>
                          <h3 className="text-lg sm:text-xl font-black text-[#17233C] tracking-tight flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-[#FF572E]" />
                            <span>Category C: Compatible Students</span>
                          </h3>
                          <p className="text-xs text-[#6E7587]">
                            Students seeking a ride on your exact route and time window. Team up and create a shared group!
                          </p>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black">
                          {compatibleFinds.length} {compatibleFinds.length === 1 ? 'Student' : 'Students'}
                        </span>
                      </div>

                      {compatibleFinds.length === 0 ? (
                        <div className="bg-white rounded-[24px] p-8 text-center border border-[#F4E3D8] max-w-md mx-auto space-y-3 shadow-2xs">
                          <div className="w-12 h-12 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto">
                            <Sparkles className="w-6 h-6 text-[#FF572E]" />
                          </div>
                          <div>
                            <h4 className="font-black text-base text-[#17233C]">
                              No compatible students found yet
                            </h4>
                            <p className="text-xs text-[#6E7587] mt-1 leading-relaxed">
                              When other students post a FIND request on your same route and date within 7 hours, they will appear here so you can create a shared ride group together!
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {compatibleFinds.map((peer) => {
                            const isCreating = creatingGroupId === peer._id;
                            const peerStudent = peer.student || {};
                            return (
                              <motion.div
                                key={peer._id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[24px] border border-[#F4E3D8] hover:border-[#FF572E]/40 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                              >
                                <div className="space-y-3.5">
                                  {/* Student Profile Header */}
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-10 h-10 rounded-full bg-[#FFEBE0] border border-[#FDD0BE] text-[#FF572E] font-black flex items-center justify-center text-sm shrink-0 overflow-hidden">
                                        {peerStudent.imageUrl ? (
                                          <img
                                            src={peerStudent.imageUrl}
                                            alt={peerStudent.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          peerStudent.name?.charAt(0)?.toUpperCase() || 'S'
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <h4 className="font-extrabold text-[#17233C] text-sm truncate">
                                            {peerStudent.name || 'Campus Student'}
                                          </h4>
                                          {peerStudent.isVerified && (
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          )}
                                        </div>
                                        <span className="text-[11px] font-semibold text-[#8C93A4] truncate block">
                                          {peerStudent.college || 'VIT, Bhopal'}
                                        </span>
                                      </div>
                                    </div>

                                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-[11px] font-black shadow-2xs">
                                      Compatible
                                    </span>
                                  </div>

                                  {/* Route Box */}
                                  <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-2">
                                    <div className="flex items-center gap-2 font-bold text-[#17233C]">
                                      <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                                      <span className="truncate">{peer.source}</span>
                                      <span className="text-[#FF572E]">→</span>
                                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                                      <span className="truncate">{peer.destination}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-[#6E7587] pt-1.5 border-t border-[#F4E3D8]/60">
                                      <div className="flex items-center gap-1 truncate">
                                        <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                                        <span>{formatTravelDate(peer.travelDate)}</span>
                                      </div>
                                      <div className="flex items-center gap-1 font-medium text-[#17233C]">
                                        <Clock className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                                        <span>{formatMinutesToTime(peer.departureTime)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Dynamic Group Relationship Actions - BUG 2 & 3 FIX */}
                                <div className="pt-2 border-t border-[#F4E3D8]/70">
                                  {peer.relationshipState === 'ACCEPTED' ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/groups/${peer.groupId}`, {
                                        state: { from: 'match', fromLabel: 'Back to Find Match', postId: selectedPost?._id }
                                      })}
                                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                      <Users className="w-3.5 h-3.5" />
                                      <span>View Group</span>
                                    </button>
                                  ) : peer.relationshipState === 'REQUEST_SENT' ? (
                                    <div className="w-full py-3 px-3 bg-amber-50 border border-amber-200 rounded-xl">
                                      <div className="flex items-center gap-2 text-amber-800 mb-1">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        <span className="font-bold text-xs">Request Pending</span>
                                      </div>
                                      <p className="text-[10px] text-amber-700 leading-tight">
                                        Your group formation request has been sent. Waiting for {peerStudent.name || 'student'} to respond.
                                      </p>
                                    </div>
                                  ) : peer.relationshipState === 'REQUEST_RECEIVED' ? (
                                    <div className="w-full py-3 px-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                                      <div className="flex items-center gap-2 text-blue-800">
                                        <Users className="w-4 h-4" />
                                        <span className="font-bold text-xs">Group Formation Request</span>
                                      </div>
                                      <p className="text-[10px] text-blue-700 leading-tight">
                                        {peerStudent.name || 'Student'} wants to form a shared ride group (Capacity {peer.proposedCapacity || 4})
                                      </p>
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="button"
                                          disabled={isCreating}
                                          onClick={async () => {
                                            try {
                                              setCreatingGroupId(peer._id);
                                              const res = await acceptGroupInvitation(peer.proposalId);
                                              invalidateGroupQueries();
                                              // Re-fetch matches to update states
                                              if (selectedPost?._id) {
                                                await handleSelectPostForMatches(selectedPost);
                                              }
                                              const gid = res?.data?.data?.group?._id || peer.groupId;
                                              if (gid) {
                                                setToastMsg({ type: 'success', text: 'Group created successfully!' });
                                                setTimeout(() => {
                                                  navigate(`/groups/${gid}`, {
                                                    state: { from: 'match', fromLabel: 'Back to Find Match', postId: selectedPost?._id }
                                                  });
                                                }, 500);
                                              }
                                            } catch (err) {
                                              setToastMsg({ type: 'error', text: err.response?.data?.message || 'Failed to accept group request.' });
                                            } finally {
                                              setCreatingGroupId(null);
                                            }
                                          }}
                                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Accept</span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isCreating}
                                          onClick={async () => {
                                            try {
                                              setCreatingGroupId(peer._id);
                                              await rejectGroupInvitation(peer.proposalId);
                                              invalidateGroupQueries();
                                              // Re-fetch matches to update states
                                              if (selectedPost?._id) {
                                                await handleSelectPostForMatches(selectedPost);
                                              }
                                              setToastMsg({ type: 'info', text: 'Group formation request declined.' });
                                            } catch (err) {
                                              setToastMsg({ type: 'error', text: err.response?.data?.message || 'Failed to decline request.' });
                                            } finally {
                                              setCreatingGroupId(null);
                                            }
                                          }}
                                          className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-[#17233C] font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </div>
                                  ) : peer.relationshipState === 'DECLINED' ? (
                                    <div className="w-full py-2 px-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Request Declined</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isCreating}
                                      onClick={() => handleCreateGroupWithPeer(peer)}
                                      className="w-full py-2.5 px-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                    >
                                      {isCreating ? (
                                        <>
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          <span>Sending Request...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Users className="w-3.5 h-3.5" />
                                          <span>Create Group Together</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Choose Group Size Modal */}
      <Modal
        isOpen={!!groupSizeModalPeer}
        onClose={() => {
          if (!creatingGroupId) {
            setGroupSizeModalPeer(null);
            setGroupModalError(null);
          }
        }}
        title="Choose Group Size"
        maxWidth="max-w-sm"
        actions={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              disabled={Boolean(creatingGroupId)}
              onClick={() => {
                setGroupSizeModalPeer(null);
                setGroupModalError(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#6E7587] bg-white border border-[#F4E3D8] hover:bg-[#FFF9F6] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(creatingGroupId)}
              onClick={handleConfirmCreateGroupWithPeer}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-[#FF572E] hover:bg-[#E84720] text-white shadow-xs cursor-pointer disabled:opacity-60"
            >
              {creatingGroupId ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>{`Create Group (${selectedGroupSize})`}</span>
              )}
            </button>
          </div>
        }
      >
        {groupSizeModalPeer && (
          <div className="space-y-4">
            <p className="text-xs text-[#6E7587] leading-relaxed">
              Choose total group size with <span className="font-bold text-[#17233C]">{groupSizeModalPeer.student?.name || 'this student'}</span>. Remaining empty seats are offered automatically in Matches.
            </p>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-wider text-[#17233C] mb-2">
                Group Size (Total Members)
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((size) => {
                  const active = selectedGroupSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={Boolean(creatingGroupId)}
                      onClick={() => {
                        setSelectedGroupSize(size);
                        setGroupModalError(null);
                      }}
                      className={`py-2.5 rounded-xl text-sm font-black border transition-all cursor-pointer disabled:opacity-60 ${
                        active
                          ? 'bg-[#FF572E] text-white border-[#FF572E] shadow-xs'
                          : 'bg-[#FFFDFB] text-[#17233C] border-[#F4E3D8] hover:border-[#FF572E]/50'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
            {groupModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {groupModalError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </ResponsiveShell>
  );
}
