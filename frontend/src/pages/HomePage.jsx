import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Search, Car, MapPin, Users, Wrench, MessageSquare, 
  ArrowRight, Calendar, Clock, CheckCircle2, XCircle,
  Star, ShieldCheck, Check, X, Send, Inbox, Ticket,
  RefreshCw, AlertCircle, ChevronRight, Phone
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { 
  getProfile, 
  getMyTravels,
  getMyBookings, 
  getReceivedBookings, 
  getUnreadCount,
  respondBooking,
  cancelBooking,
  getWhatsAppDetails
} from '../lib/api';
import { openWhatsAppChat, getWhatsAppUrl } from '../lib/whatsapp';
import { formatDate, formatCurrency } from '../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  
  const [profile, setProfile] = useState(null);
  const [myTravels, setMyTravels] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  
  // Modal state for viewing & managing received requests on a specific ride offer
  const [selectedOfferForRequests, setSelectedOfferForRequests] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch real authenticated user dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, travelsRes, bookingsRes, receivedRes, notifRes] = await Promise.allSettled([
        getProfile(),
        getMyTravels(),
        getMyBookings(),
        getReceivedBookings(),
        getUnreadCount()
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data || null);
      }
      if (travelsRes.status === 'fulfilled') {
        const tList = travelsRes.value.data?.data || travelsRes.value.data?.travels || travelsRes.value.data || [];
        setMyTravels(Array.isArray(tList) ? tList : []);
      }
      if (bookingsRes.status === 'fulfilled') {
        const bList = bookingsRes.value.data?.data || bookingsRes.value.data?.bookings || bookingsRes.value.data || [];
        setMyRequests(Array.isArray(bList) ? bList : []);
      }
      if (receivedRes.status === 'fulfilled') {
        const rList = receivedRes.value.data?.data || receivedRes.value.data?.bookings || receivedRes.value.data || [];
        setReceivedBookings(Array.isArray(rList) ? rList : []);
      }
      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.data?.data?.count || 0);
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

  // First name
  const firstName = useMemo(() => {
    if (profile?.name) return profile.name.split(' ')[0];
    if (user?.firstName) return user.firstName;
    if (user?.fullName) return user.fullName.split(' ')[0];
    return 'Student';
  }, [profile, user]);

  // 1. My Ride Offers (Travel posts where type === 'offer')
  const rideOffers = useMemo(() => {
    return myTravels.filter(t => (t.type || 'offer') === 'offer');
  }, [myTravels]);

  // 2. Pending Requests Received across all user's offered rides
  const pendingReceivedRequests = useMemo(() => {
    return receivedBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
  }, [receivedBookings]);

  // 3. Requests received grouped by travelId for easy lookup
  const receivedByTravelId = useMemo(() => {
    const map = new Map();
    receivedBookings.forEach(b => {
      const tid = (b.travelId?._id || b.travelId)?.toString();
      if (tid) {
        if (!map.has(tid)) map.set(tid, []);
        map.get(tid).push(b);
      }
    });
    return map;
  }, [receivedBookings]);

  // Host Action: Accept or Reject Pending Request directly from dashboard
  const handleHostRespond = async (bookingId, action) => {
    setActionLoadingId(bookingId);
    try {
      await respondBooking(bookingId, { action });
      await fetchData();
    } catch (err) {
      console.error('Respond booking error:', err);
      alert(err.message || `Failed to ${action} booking request.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Passenger Action: Withdraw pending ride request
  const handleWithdrawRequest = async (bookingId) => {
    if (!window.confirm('Are you sure you want to withdraw this ride request?')) return;
    setActionLoadingId(bookingId);
    try {
      await cancelBooking(bookingId);
      await fetchData();
    } catch (err) {
      console.error('Withdraw request error:', err);
      alert(err.message || 'Failed to withdraw request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open WhatsApp
  const handleWhatsApp = async (booking, role = 'passenger') => {
    try {
      const travel = booking.travelId || booking.travel || {};
      const routeText = `${travel.source || travel.from || 'Campus'} → ${travel.destination || travel.to || 'Destination'}`;
      const partner = role === 'passenger' ? booking.owner : booking.passenger;
      const partnerName = partner?.name || (role === 'passenger' ? booking.ownerName : booking.passengerName) || 'Campus Peer';
      const directPhone = partner?.phone || (role === 'host' ? booking.passengerPhone : '');

      // 1. If direct phone number is already known locally, open immediately (prevents browser popup blocking)
      if (directPhone) {
        openWhatsAppChat({
          phone: directPhone,
          name: partnerName,
          route: routeText,
          message: `Hi ${partnerName}! Connecting regarding HelpU Booking #${booking._id?.slice(-6)?.toUpperCase()} for route ${routeText}. Let's coordinate pickup!`
        });
        return;
      }

      // 2. Otherwise open a window right away before async call to avoid popup blocking
      const newWin = window.open('about:blank', '_blank');

      try {
        const res = await getWhatsAppDetails(booking._id);
        const data = res?.data?.data || res?.data;
        if (data?.whatsappUrl) {
          if (newWin) {
            newWin.location.href = data.whatsappUrl;
          } else {
            window.location.href = data.whatsappUrl;
          }
          return;
        }
        if (data?.normalizedPhone || data?.phone) {
          const directUrl = getWhatsAppUrl({
            phone: data.normalizedPhone || data.phone,
            name: data.name || partnerName,
            route: routeText
          });
          if (newWin && directUrl) {
            newWin.location.href = directUrl;
          } else if (directUrl) {
            window.location.href = directUrl;
          }
          return;
        }
      } catch (apiErr) {
        console.warn('getWhatsAppDetails failed:', apiErr?.response?.data || apiErr);
      }

      if (newWin) newWin.close();
      alert('Phone number is not available to start WhatsApp chat. Please ensure contact details are updated.');
    } catch (err) {
      console.error('WhatsApp error:', err);
    }
  };

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
        
        {/* 1. WELCOME HERO BANNER */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-[32px] border border-[#F4E3D8]/90 shadow-xs relative overflow-hidden p-6 sm:p-8 lg:p-9 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#FFF0E7]/80 via-[#FFF5EE]/40 to-transparent pointer-events-none rounded-r-[32px]" />

              <div className="relative z-10 flex-1 flex flex-col items-start text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] mb-2.5 shadow-2xs">
                  🎓 Verified Campus Ride Sharing
                </span>

                <h1 className="font-black text-[#17233C] text-2xl sm:text-3xl lg:text-[38px] tracking-tight leading-tight">
                  Hey {firstName}! 👋
                </h1>
                
                <p className="mt-2 text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-sm">
                  Manage your offered rides, approve incoming passenger requests, and track your travel bookings in real time.
                </p>

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
                    <Car className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>Find Matches</span>
                  </button>
                </div>
              </div>

              <div className="relative z-10 w-full md:w-[48%] flex items-center justify-center md:justify-end shrink-0">
                <img
                  src="/webpage.png"
                  alt="HelpU Students"
                  className="w-full max-h-[180px] sm:max-h-[220px] object-contain drop-shadow-sm select-none pointer-events-none"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </motion.div>

            {/* 2. SEARCH BAR */}
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#8C93A4]" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search rides by route, source, or destination..."
                className="w-full bg-white rounded-full py-3.5 pl-12 pr-5 text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#8C93A4] border border-[#F4E3D8] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 focus:border-[#FF572E] transition-all"
              />
            </form>

            {/* 3. QUICK ACTIONS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => navigate('/rides/offer')}
                className="bg-[#FFF4ED] hover:bg-white rounded-2xl p-4 border border-[#FDE0D0] hover:border-[#FF572E]/40 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#FFE4D4] text-[#FF572E] flex items-center justify-center mb-2">
                    <Car className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#FF572E] transition-colors leading-tight">
                    Offer a Ride
                  </h3>
                  <p className="text-[10px] text-[#6E7587] mt-0.5">Share your ride &amp; carpool</p>
                </div>
                <div className="self-end mt-2">
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF572E] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => navigate('/bookings?tab=received')}
                className="bg-[#FFF7ED] hover:bg-white rounded-2xl p-4 border border-[#FED7AA] hover:border-[#F97316]/40 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center mb-2">
                    <Inbox className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#EA580C] transition-colors leading-tight">
                    Received Requests
                  </h3>
                  <p className="text-[10px] text-[#6E7587] mt-0.5">
                    {pendingReceivedRequests.length > 0 ? `${pendingReceivedRequests.length} pending action` : 'Review passenger requests'}
                  </p>
                </div>
                <div className="self-end mt-2">
                  <ArrowRight className="w-3.5 h-3.5 text-[#EA580C] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => navigate('/bookings?tab=confirmed')}
                className="bg-[#EDFAF3] hover:bg-white rounded-2xl p-4 border border-[#BCECD4] hover:border-[#16A34A]/40 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mb-2">
                    <Ticket className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#16A34A] transition-colors leading-tight">
                    My Bookings
                  </h3>
                  <p className="text-[10px] text-[#6E7587] mt-0.5">Confirmed tickets</p>
                </div>
                <div className="self-end mt-2">
                  <ArrowRight className="w-3.5 h-3.5 text-[#16A34A] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>

        {/* ========================================================================= */}
        {/* SIDE-BY-SIDE GRID: LEFT (MY RIDE OFFERS) & RIGHT (MY RIDE REQUESTS)       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">

            {/* =================================================================== */}
            {/* 4. SECTION: MY RIDE OFFERS (POSTED BY THIS USER)                   */}
            {/* =================================================================== */}
            <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center">
                    <Car className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="font-black text-[#17233C] text-base sm:text-lg">
                      My Ride Offers
                    </h2>
                    <span className="text-[11px] text-[#6E7587] block font-medium">
                      Rides you posted to share with campus peers
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black">
                    {rideOffers.length} {rideOffers.length === 1 ? 'Ride' : 'Rides'}
                  </span>
                  <button
                    onClick={() => navigate('/rides/offer')}
                    className="px-3.5 py-1.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    + Offer Ride
                  </button>
                </div>
              </div>

              {loading ? (
                <LoadingSkeleton count={2} />
              ) : rideOffers.length === 0 ? (
                <div className="py-8 px-4 text-center bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] space-y-2.5">
                  <Car className="w-8 h-8 text-[#FF572E] mx-auto opacity-70" />
                  <h4 className="font-bold text-[#17233C] text-sm">No Active Ride Offers</h4>
                  <p className="text-xs text-[#6E7587] max-w-sm mx-auto">
                    Heading somewhere? Post a ride offer to carpool with verified students and share travel expenses!
                  </p>
                  <button
                    onClick={() => navigate('/rides/offer')}
                    className="mt-2 px-5 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Offer a Ride Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {rideOffers.map((offer) => {
                    const tid = offer._id?.toString();
                    const reqList = receivedByTravelId.get(tid) || [];
                    const requestsCount = offer.requestsCount ?? reqList.length;
                    const pendingCount = offer.pendingRequestsCount ?? reqList.filter(r => (r.status || 'pending').toLowerCase() === 'pending').length;
                    
                    const booked = offer.bookedSeats || 0;
                    const totalSeats = offer.seats || 1;
                    const availableSeats = Math.max(0, totalSeats - booked);

                    const timeDisplay = offer.travelDate
                      ? new Date(offer.travelDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) +
                        (typeof offer.departureTime === 'number'
                          ? ` • ${String(Math.floor(offer.departureTime / 60)).padStart(2, '0')}:${String(offer.departureTime % 60).padStart(2, '0')}`
                          : '')
                      : 'Upcoming';

                    return (
                      <div
                        key={offer._id}
                        className="p-4 sm:p-5 rounded-2xl bg-[#FFFBF8] hover:bg-white border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-xs transition-all space-y-3"
                      >
                        {/* Route & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-extrabold text-[#17233C]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                            <span className="truncate">{offer.source}</span>
                            <span className="text-[#FF572E]">→</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                            <span className="truncate">{offer.destination}</span>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              offer.status === 'active' && availableSeats > 0
                                ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {availableSeats > 0 ? `${availableSeats} Seats Available` : 'Ride Full'}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-[#8C93A4]">
                              ₹{offer.pricePerSeat || 350}/seat
                            </span>
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <span className="text-[10px] text-[#6E7587] block font-bold">Schedule</span>
                            <span className="font-bold text-[#17233C] text-[11px] truncate block">{timeDisplay}</span>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <span className="text-[10px] text-[#6E7587] block font-bold">Seats Occupied</span>
                            <span className="font-bold text-[#FF572E] text-[11px] truncate block">
                              {booked} / {totalSeats} Booked
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-[#6E7587] block font-bold">Vehicle</span>
                            <span className="font-bold text-[#17233C] text-[11px] truncate block">
                              {offer.carModel || 'Campus Carpool'}
                            </span>
                          </div>
                        </div>

                        {/* Action Bar: Received Requests count + Manage Button */}
                        <div className="pt-2 border-t border-[#F4E3D8]/60 flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#17233C]">
                              {requestsCount} {requestsCount === 1 ? 'Request' : 'Requests'} Received
                            </span>
                            {pendingCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[10px] font-black animate-pulse">
                                <Clock className="w-3 h-3" />
                                {pendingCount} Pending Action
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => setSelectedOfferForRequests({ offer, requests: reqList })}
                            className="px-4 py-1.5 rounded-xl bg-[#17233C] hover:bg-[#2A3752] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <Inbox className="w-3.5 h-3.5" />
                            <span>Manage Requests ({requestsCount})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* =================================================================== */}
            {/* 5. SECTION: MY RIDE REQUESTS (SENT BY THIS USER)                   */}
            {/* =================================================================== */}
            <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#8B5CF6] flex items-center justify-center">
                    <Send className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="font-black text-[#17233C] text-base sm:text-lg">
                      My Ride Requests
                    </h2>
                    <span className="text-[11px] text-[#6E7587] block font-medium">
                      Requests you sent to travel with other campus drivers
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#8B5CF6] text-xs font-black">
                    {myRequests.length} Sent
                  </span>
                  <button
                    onClick={() => navigate('/rides/request')}
                    className="px-3.5 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Request Ride
                  </button>
                </div>
              </div>

              {loading ? (
                <LoadingSkeleton count={2} />
              ) : myRequests.length === 0 ? (
                <div className="py-8 px-4 text-center bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] space-y-2.5">
                  <Send className="w-8 h-8 text-[#8B5CF6] mx-auto opacity-70" />
                  <h4 className="font-bold text-[#17233C] text-sm">No Ride Requests Sent</h4>
                  <p className="text-xs text-[#6E7587] max-w-sm mx-auto">
                    Need a ride? Search available routes and request seats from verified campus drivers.
                  </p>
                  <button
                    onClick={() => navigate('/rides/request')}
                    className="mt-2 px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Request a Ride
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req) => {
                    const travel = req.travelId || req.travel || {};
                    const owner = req.owner || {};
                    const status = (req.status || 'pending').toLowerCase();
                    const isPending = status === 'pending';
                    const isConfirmed = ['confirmed', 'accepted'].includes(status);
                    const isRejected = ['rejected', 'cancelled'].includes(status);

                    const timeDisplay = travel.travelDate
                      ? new Date(travel.travelDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) +
                        (typeof travel.departureTime === 'number'
                          ? ` • ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}`
                          : '')
                      : 'Upcoming';

                    return (
                      <div
                        key={req._id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                          isPending
                            ? 'bg-[#FFFDFB] border-[#FED7AA]'
                            : isConfirmed
                            ? 'bg-white border-[#BCECD4] shadow-xs'
                            : 'bg-red-50/20 border-red-200'
                        }`}
                      >
                        {/* Top: Driver Info & Status Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              avatarId={owner?.avatarId || 'm1'}
                              src={owner?.imageUrl}
                              size="sm"
                              ring
                            />
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-[#17233C] text-xs sm:text-sm truncate">
                                {owner?.name || 'Student Driver'}
                              </h4>
                              <span className="text-[10px] text-[#6E7587] block">
                                Host • {owner?.college || 'VIT, Bhopal'}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[11px] font-black">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                Pending Approval
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[11px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Confirmed Booking
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-[11px] font-black">
                                <XCircle className="w-3.5 h-3.5" />
                                {status === 'rejected' ? 'Declined by Host' : 'Cancelled'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Route Line */}
                        <div className="bg-[#FFFBF8] p-3 rounded-xl border border-[#F4E3D8] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 font-bold text-[#17233C] truncate">
                            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                            <span className="truncate">{travel.source || travel.from || 'Campus'}</span>
                            <span className="text-[#FF572E]">→</span>
                            <span className="w-2 h-2 rounded-full bg-[#FF572E]" />
                            <span className="truncate">{travel.destination || travel.to || 'Destination'}</span>
                          </div>

                          <span className="text-[#6E7587] font-semibold text-[11px] shrink-0 ml-2">
                            {timeDisplay}
                          </span>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                          <div className="text-xs text-[#6E7587] font-medium">
                            Requested: <strong className="text-[#17233C]">{req.requestedSeats || 1} seat(s)</strong> • Total: <strong className="text-[#17233C]">{formatCurrency((req.requestedSeats || 1) * (travel.pricePerSeat || 350))}</strong>
                          </div>

                          <div className="flex items-center gap-2">
                            {isPending && (
                              <button
                                onClick={() => handleWithdrawRequest(req._id)}
                                disabled={actionLoadingId === req._id}
                                className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {actionLoadingId === req._id ? 'Cancelling...' : 'Withdraw Request'}
                              </button>
                            )}

                            {isConfirmed && (
                              <button
                                onClick={() => handleWhatsApp(req, 'passenger')}
                                className="px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp Host</span>
                              </button>
                            )}

                            {isRejected && (
                              <button
                                onClick={() => navigate('/match')}
                                className="px-3 py-1.5 rounded-xl bg-[#FF572E] text-white font-bold text-xs transition-colors cursor-pointer"
                              >
                                Find Other Matches
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

        </div>

        {/* ========================================================================= */}
        {/* BOTTOM ROW: REQUESTS AWAITING APPROVAL (LEFT) & OVERVIEW / SAFETY (RIGHT)  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          
          {/* LEFT (SPAN 8): RECEIVED REQUESTS AWAITING YOUR DECISION */}
          <div className="lg:col-span-8 bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center">
                  <Inbox className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                    Requests Awaiting Approval
                  </h3>
                  <span className="text-[11px] text-[#6E7587] block">
                    Review and accept or reject passenger seat requests for your offered rides
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/bookings?tab=received')}
                className="text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
              >
                View All ({receivedBookings.length})
              </button>
            </div>

            {pendingReceivedRequests.length === 0 ? (
              <div className="py-6 px-4 bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] text-center space-y-1.5">
                <CheckCircle2 className="w-7 h-7 text-[#16A34A] mx-auto opacity-80" />
                <p className="text-xs font-bold text-[#17233C]">All Caught Up!</p>
                <p className="text-[11px] text-[#6E7587]">
                  No pending passenger requests waiting for your approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingReceivedRequests.map((req) => {
                  const passenger = req.passenger || {};
                  const travel = req.travelId || req.travel || {};

                  return (
                    <div
                      key={req._id}
                      className="p-4 bg-[#FFFDFB] rounded-2xl border border-[#FED7AA] space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            avatarId={passenger?.avatarId || 'm1'}
                            src={passenger?.imageUrl || req.passengerImage || (passenger?.clerkId === user?.id || req.passengerId === user?.id ? user?.imageUrl : null)}
                            size="sm"
                            ring
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-xs text-[#17233C] truncate">
                              {passenger?.name || req.passengerName || 'Student Peer'}
                            </h4>
                            <span className="text-[10px] text-[#6E7587] block">
                              Requested {req.requestedSeats || 1} seat(s) • {passenger?.college || 'VIT, Bhopal'}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-[#17233C] font-semibold bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-between">
                          <span className="truncate">{travel.source} → {travel.destination}</span>
                          <span className="text-[#FF572E] font-black">{formatCurrency((req.requestedSeats || 1) * (travel.pricePerSeat || 350))}</span>
                        </div>
                      </div>

                      {/* 1-Click Accept & Reject */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#F4E3D8]/50">
                        <button
                          onClick={() => handleHostRespond(req._id, 'accept')}
                          disabled={actionLoadingId === req._id}
                          className="flex-1 py-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{actionLoadingId === req._id ? 'Accepting...' : 'Accept'}</span>
                        </button>
                        <button
                          onClick={() => handleHostRespond(req._id, 'reject')}
                          disabled={actionLoadingId === req._id}
                          className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT (SPAN 4): OVERVIEW & VERIFIED BADGE */}
          <div className="lg:col-span-4 space-y-4">
            {/* 1. OVERALL ACTIVITY SUMMARY */}
            <div className="bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base flex items-center gap-2">
                  <span>Ride Sharing Overview</span>
                </h3>
                <button
                  onClick={() => navigate('/bookings')}
                  className="text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
                >
                  Manage →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#FFF4ED] border border-[#FDE0D0] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <span className="font-black text-lg text-[#FF572E]">{rideOffers.length}</span>
                  <span className="text-[10px] font-bold text-[#6E7587] mt-0.5">Offered</span>
                </div>

                <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <span className="font-black text-lg text-[#8B5CF6]">{myRequests.length}</span>
                  <span className="text-[10px] font-bold text-[#6E7587] mt-0.5">Requested</span>
                </div>

                <div className="bg-[#FEF9E7] border border-[#FDEBB2] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
                  <span className="font-black text-lg text-[#CA8A04]">{pendingReceivedRequests.length}</span>
                  <span className="text-[10px] font-bold text-[#6E7587] mt-0.5">Action Req.</span>
                </div>
              </div>
            </div>

            {/* 2. SAFETY ASSURANCE CARD */}
            <div className="bg-[#FFFBF8] rounded-[26px] p-5 border border-[#F4E3D8] space-y-2">
              <div className="flex items-center gap-2 text-[#16A34A]">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                <h4 className="font-extrabold text-[#17233C] text-xs sm:text-sm">
                  100% Verified Campus Pool
                </h4>
              </div>
              <p className="text-[11px] text-[#6E7587] leading-relaxed">
                Every member on HelpU is authenticated with official college credentials. Always coordinate pickup points in safe public campus areas.
              </p>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* MODAL: MANAGE RECEIVED REQUESTS FOR A SPECIFIC RIDE OFFER                 */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {selectedOfferForRequests && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[32px] p-6 sm:p-7 max-w-xl w-full border border-[#F4E3D8] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-[#F4E3D8]">
                  <div>
                    <span className="text-[11px] font-black text-[#FF572E] uppercase">
                      Manage Ride Passengers
                    </span>
                    <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                      {selectedOfferForRequests.offer.source} → {selectedOfferForRequests.offer.destination}
                    </h3>
                    <p className="text-xs text-[#6E7587] mt-0.5">
                      {selectedOfferForRequests.offer.seats - (selectedOfferForRequests.offer.bookedSeats || 0)} of {selectedOfferForRequests.offer.seats} seats available
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedOfferForRequests(null)}
                    className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* List of Requests for this ride */}
                {selectedOfferForRequests.requests.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Inbox className="w-8 h-8 text-[#8C93A4] mx-auto opacity-60" />
                    <p className="text-xs font-bold text-[#17233C]">No Requests Received Yet</p>
                    <p className="text-[11px] text-[#6E7587] max-w-xs mx-auto">
                      As soon as students send booking requests for this ride, they will appear here for you to accept or reject.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedOfferForRequests.requests.map((b) => {
                      const passenger = b.passenger || {};
                      const status = (b.status || 'pending').toLowerCase();
                      const isPending = status === 'pending';
                      const isAccepted = ['confirmed', 'accepted'].includes(status);
                      const isRejected = ['rejected', 'cancelled'].includes(status);

                      return (
                        <div
                          key={b._id}
                          className="p-4 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                avatarId={passenger?.avatarId || 'm1'}
                                src={passenger?.imageUrl || b.passengerImage || (passenger?.clerkId === user?.id || b.passengerId === user?.id ? user?.imageUrl : null)}
                                size="md"
                                ring
                              />
                              <div className="min-w-0">
                                <h4 className="font-bold text-[#17233C] text-sm truncate">
                                  {passenger?.name || b.passengerName || 'Student Peer'}
                                </h4>
                                <span className="text-[11px] text-[#6E7587] block">
                                  {passenger?.college || 'VIT, Bhopal'}
                                </span>
                              </div>
                            </div>

                            <div>
                              {isPending && (
                                <span className="px-2.5 py-1 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[10px] font-black">
                                  Pending
                                </span>
                              )}
                              {isAccepted && (
                                <span className="px-2.5 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[10px] font-black">
                                  Accepted
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black">
                                  Declined
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-[#596277] bg-white p-2.5 rounded-xl border border-gray-100">
                            <span>Requested: <strong>{b.requestedSeats || 1} seat(s)</strong></span>
                            <span>Fare: <strong className="text-[#17233C]">{formatCurrency((b.requestedSeats || 1) * (selectedOfferForRequests.offer.pricePerSeat || 350))}</strong></span>
                          </div>

                          {/* Decision buttons */}
                          {isPending && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={async () => {
                                  await handleHostRespond(b._id, 'accept');
                                  setSelectedOfferForRequests(null);
                                }}
                                disabled={actionLoadingId === b._id}
                                className="flex-1 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept Passenger</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await handleHostRespond(b._id, 'reject');
                                  setSelectedOfferForRequests(null);
                                }}
                                disabled={actionLoadingId === b._id}
                                className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}

                          {isAccepted && (
                            <button
                              onClick={() => handleWhatsApp(b, 'host')}
                              className="w-full py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp Passenger</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-[#F4E3D8] flex items-center justify-end">
                  <button
                    onClick={() => {
                      setSelectedOfferForRequests(null);
                      navigate('/bookings?tab=received');
                    }}
                    className="text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
                  >
                    View All in Bookings &amp; Requests →
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}
