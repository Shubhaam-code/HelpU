import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Calendar, MapPin, Users, CheckCircle2, Clock, XCircle, 
  AlertCircle, ArrowRight, Car, Plus, Search, MessageSquare, 
  ShieldCheck, RefreshCw, ChevronRight, Check, X, Phone
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { 
  getMyBookings, 
  getReceivedBookings, 
  cancelBooking, 
  respondBooking, 
  confirmBooking, 
  getWhatsAppDetails 
} from '../lib/api';
import { openWhatsAppChat } from '../lib/whatsapp';
import { formatDate, formatCurrency } from '../lib/utils';

const STATUS_TABS = [
  { id: 'all', label: 'All Bookings' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' }
];

export default function BookingsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();

  // Role toggle: 'passenger' (rides I booked) vs 'host' (requests received for my rides)
  const [activeRole, setActiveRole] = useState('passenger');
  const [activeStatusTab, setActiveStatusTab] = useState('all');
  
  const [myBookings, setMyBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch both passenger bookings and host received bookings
  const fetchAllBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [myRes, recRes] = await Promise.allSettled([
        getMyBookings(),
        getReceivedBookings()
      ]);

      if (myRes.status === 'fulfilled') {
        const list = myRes.value.data?.data || myRes.value.data?.bookings || myRes.value.data || [];
        setMyBookings(Array.isArray(list) ? list : []);
      }
      if (recRes.status === 'fulfilled') {
        const list = recRes.value.data?.data || recRes.value.data?.bookings || recRes.value.data || [];
        setReceivedBookings(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Bookings fetch error:', err);
      setError(err.message || 'Could not load bookings. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllBookings();
  }, [fetchAllBookings]);

  // Current raw list depending on selected role
  const currentRoleBookings = useMemo(() => {
    return activeRole === 'passenger' ? myBookings : receivedBookings;
  }, [activeRole, myBookings, receivedBookings]);

  // Dynamic counts for each status tab
  const statusCounts = useMemo(() => {
    const counts = { all: currentRoleBookings.length, upcoming: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    const now = new Date();

    currentRoleBookings.forEach((b) => {
      const status = (b.status || 'pending').toLowerCase();
      const travelDate = b.travelId?.travelDate ? new Date(b.travelId.travelDate) : null;
      const isFutureOrToday = !travelDate || travelDate >= new Date(now.setHours(0, 0, 0, 0));

      if (status === 'pending') counts.pending += 1;
      if (status === 'confirmed') counts.confirmed += 1;
      if (status === 'cancelled' || status === 'rejected') counts.cancelled += 1;
      if (status === 'completed' || (!isFutureOrToday && status === 'confirmed')) counts.completed += 1;
      if ((status === 'confirmed' || status === 'accepted') && isFutureOrToday) counts.upcoming += 1;
    });

    return counts;
  }, [currentRoleBookings]);

  // Filtered list based on selected status tab
  const filteredBookings = useMemo(() => {
    if (activeStatusTab === 'all') return currentRoleBookings;
    const now = new Date();

    return currentRoleBookings.filter((b) => {
      const status = (b.status || 'pending').toLowerCase();
      const travelDate = b.travelId?.travelDate ? new Date(b.travelId.travelDate) : null;
      const isFutureOrToday = !travelDate || travelDate >= new Date(now.setHours(0, 0, 0, 0));

      if (activeStatusTab === 'pending') return status === 'pending';
      if (activeStatusTab === 'confirmed') return status === 'confirmed';
      if (activeStatusTab === 'cancelled') return status === 'cancelled' || status === 'rejected';
      if (activeStatusTab === 'completed') return status === 'completed' || (!isFutureOrToday && status === 'confirmed');
      if (activeStatusTab === 'upcoming') return (status === 'confirmed' || status === 'accepted') && isFutureOrToday;
      return true;
    });
  }, [currentRoleBookings, activeStatusTab]);

  // Handle Booking Cancellation
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will release reserved seats.')) {
      return;
    }
    setActionLoadingId(bookingId);
    try {
      await cancelBooking(bookingId);
      // Optimistic state update
      const updater = (list) => list.map(b => b._id === bookingId ? { ...b, status: 'cancelled' } : b);
      setMyBookings(updater);
      setReceivedBookings(updater);
    } catch (err) {
      console.error('Cancel booking error:', err);
      alert(err.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Host Action: Accept or Reject Pending Request
  const handleHostRespond = async (bookingId, action) => {
    setActionLoadingId(bookingId);
    try {
      await respondBooking(bookingId, { action });
      // If accepted, immediately confirm to reserve seats atomically
      if (action === 'accept') {
        try {
          await confirmBooking(bookingId);
        } catch (e) {
          console.warn('Confirm booking step note:', e);
        }
      }
      fetchAllBookings();
    } catch (err) {
      console.error('Respond booking error:', err);
      alert(err.message || `Failed to ${action} booking.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Direct WhatsApp Connection
  const handleWhatsAppChat = async (booking) => {
    try {
      // First try to fetch specific WhatsApp details if endpoint available
      const travel = booking.travelId || booking.travel || {};
      const routeText = `${travel.source || travel.from || 'Campus'} → ${travel.destination || travel.to || 'Destination'}`;
      const partner = activeRole === 'passenger' ? booking.owner : booking.passenger;

      openWhatsAppChat({
        phone: partner?.phone,
        name: partner?.name || 'Campus Peer',
        route: routeText,
        message: `Hi ${partner?.name || 'there'}! Connecting regarding HelpU Booking #${booking._id?.slice(-6)?.toUpperCase()} for route ${routeText}. Let's coordinate pickup!`
      });
    } catch (err) {
      console.error('WhatsApp chat error:', err);
    }
  };

  // Helper for status badge styling
  const renderStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'confirmed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[11px] font-black">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Confirmed
        </span>
      );
    }
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[11px] font-black">
          <Clock className="w-3.5 h-3.5" />
          Pending Approval
        </span>
      );
    }
    if (s === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[11px] font-black">
          <Check className="w-3.5 h-3.5" />
          Accepted
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE] text-[11px] font-black">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-[11px] font-black">
        <XCircle className="w-3.5 h-3.5" />
        Cancelled
      </span>
    );
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Bookings" backTo="/home" />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">

        {/* ========================================================================= */}
        {/* PAGE HEADER: TITLE, SUBTITLE & FIND NEW RIDE CTA                          */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 border border-[#F4E3D8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[11px] font-black text-[#FF572E] mb-3 shadow-2xs">
              🎫 Campus Travel Bookings
            </span>
            <h1 className="font-black text-[#17233C] text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">
              My Campus <span className="text-[#FF572E]">Bookings</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#596277] font-medium mt-2 leading-relaxed">
              Manage your upcoming journeys, active bookings, and travel history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/rides')}
              className="px-6 py-3 rounded-2xl bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
            >
              <Car className="w-4 h-4 stroke-[2.5]" />
              <span>Find New Ride</span>
            </button>
            <button
              onClick={fetchAllBookings}
              title="Refresh Bookings"
              className="w-11 h-11 rounded-2xl bg-white border border-[#F4E3D8] text-[#17233C] hover:text-[#FF572E] flex items-center justify-center shadow-2xs hover:bg-[#FFF7F2] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* ROLE TOGGLE (PASSENGER VS HOST) & CATEGORY TABS                           */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[26px] p-4 sm:p-5 border border-[#F4E3D8]/90 shadow-xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#F4E3D8]/60">
            {/* Passenger / Host Role Switcher */}
            <div className="inline-flex bg-[#FFFBF8] p-1 rounded-2xl border border-[#F4E3D8] shadow-2xs self-start">
              <button
                onClick={() => setActiveRole('passenger')}
                className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  activeRole === 'passenger'
                    ? 'bg-[#FF572E] text-white shadow-xs'
                    : 'text-[#6E7587] hover:text-[#17233C]'
                }`}
              >
                <span>My Booked Rides</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeRole === 'passenger' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {myBookings.length}
                </span>
              </button>

              <button
                onClick={() => setActiveRole('host')}
                className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  activeRole === 'host'
                    ? 'bg-[#FF572E] text-white shadow-xs'
                    : 'text-[#6E7587] hover:text-[#17233C]'
                }`}
              >
                <span>Ride Requests Received</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeRole === 'host' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {receivedBookings.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-[#6E7587] font-semibold flex items-center gap-1.5 self-start sm:self-auto">
              <span>Showing:</span>
              <strong className="text-[#17233C]">
                {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'}
              </strong>
            </div>
          </div>

          {/* Booking Categories Tabs with Live Counts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
            {STATUS_TABS.map((tab) => {
              const count = statusCounts[tab.id] || 0;
              const isActive = activeStatusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveStatusTab(tab.id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#17233C] text-white shadow-xs'
                      : 'bg-[#FFFBF8] text-[#596277] hover:text-[#17233C] border border-[#F4E3D8]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#FFEBE0] text-[#FF572E]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>


        {/* ========================================================================= */}
        {/* BOOKINGS LISTING / LOADING / ERROR / EMPTY STATES                         */}
        {/* ========================================================================= */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LoadingSkeleton count={4} />
            </div>
          ) : error ? (
            <div className="bg-white rounded-[26px] p-10 text-center border border-red-100 max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-[#17233C] text-base">Failed to Load Bookings</h3>
              <p className="text-xs text-[#6E7587] leading-relaxed">{error}</p>
              <button
                onClick={fetchAllBookings}
                className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[32px] p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
                🎫
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-lg">No Bookings Found</h3>
                <p className="text-xs text-[#6E7587] mt-1 max-w-sm mx-auto">
                  {activeStatusTab === 'all'
                    ? activeRole === 'passenger'
                      ? 'You haven\'t booked any campus rides yet. Find a shared ride and book available seats!'
                      : 'You haven\'t received any booking requests on your offered rides yet.'
                    : `No ${activeStatusTab} bookings found for this category.`}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => navigate('/rides')}
                  className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <Car className="w-4 h-4" />
                  <span>Browse Campus Rides</span>
                </button>
              </div>
            </div>
          ) : (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start"
            >
              {filteredBookings.map((b) => {
                const travel = b.travelId || b.travel || {};
                const partner = activeRole === 'passenger' ? b.owner : b.passenger;
                const partnerName = partner?.name || (activeRole === 'passenger' ? 'Student Driver' : 'Co-traveler');
                const partnerAvatar = partner?.avatarId || 'm1';
                const fromCity = travel.source || travel.from || 'Campus Gate';
                const toCity = travel.destination || travel.to || 'City Center';
                
                const seatsCount = b.requestedSeats || b.seatsBooked || 1;
                const pricePerSeat = travel.pricePerSeat || 350;
                const totalAmount = seatsCount * pricePerSeat;

                const timeDisplay = travel.travelDate
                  ? new Date(travel.travelDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
                    (typeof travel.departureTime === 'number'
                      ? ` • ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}`
                      : '')
                  : formatDate(travel.departureTime);

                const status = (b.status || 'pending').toLowerCase();
                const canCancel = ['pending', 'accepted', 'confirmed'].includes(status);
                const isHostPending = activeRole === 'host' && status === 'pending';

                return (
                  <motion.div
                    key={b._id}
                    layout
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs hover:border-[#FF572E]/40 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Meta: Partner Info, Status & Booking ID */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar 
                            avatarId={partnerAvatar}
                            src={partner?.imageUrl} 
                            size="md" 
                            ring 
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-extrabold text-[#17233C] text-sm sm:text-base truncate">
                                {partnerName}
                              </h4>
                              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                            </div>
                            <span className="text-[11px] text-[#6E7587] block mt-0.5">
                              {activeRole === 'passenger' ? 'Driver / Host' : 'Passenger Request'} • {partner?.college || 'VIT, Bhopal'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {renderStatusBadge(status)}
                          <span className="text-[10px] font-mono font-bold text-[#8C93A4]">
                            #{b._id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Route Timeline Box */}
                      <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] mb-4 space-y-2.5">
                        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                          <span className="w-3 h-3 rounded-full bg-[#16A34A] shrink-0 ring-3 ring-[#DCFCE7]" />
                          <span className="font-extrabold text-[#17233C] truncate">{fromCity}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                          <span className="w-3 h-3 rounded-full bg-[#FF572E] shrink-0 ring-3 ring-[#FFEBE0]" />
                          <span className="font-extrabold text-[#17233C] truncate">{toCity}</span>
                        </div>
                      </div>

                      {/* Travel Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 text-xs">
                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Date &amp; Time</span>
                          <span className="font-bold text-[#17233C] text-[11px] truncate block">{timeDisplay}</span>
                        </div>

                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Vehicle</span>
                          <span className="font-bold text-[#17233C] text-[11px] truncate block">
                            {travel.carModel || 'Campus Carpool'}
                          </span>
                        </div>

                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Seats Booked</span>
                          <span className="font-bold text-[#FF572E] text-[11px]">
                            {seatsCount} {seatsCount === 1 ? 'Seat' : 'Seats'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="pt-3.5 border-t border-[#F4E3D8]/80 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#6E7587] block">Total Amount</span>
                        <span className="font-black text-base sm:text-lg text-[#17233C]">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Host Pending Request Accept / Reject */}
                        {isHostPending && (
                          <>
                            <button
                              onClick={() => handleHostRespond(b._id, 'accept')}
                              disabled={actionLoadingId === b._id}
                              className="px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              onClick={() => handleHostRespond(b._id, 'reject')}
                              disabled={actionLoadingId === b._id}
                              className="px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {/* WhatsApp Connect Button */}
                        <button
                          onClick={() => handleWhatsAppChat(b)}
                          title="Coordinate on WhatsApp"
                          className="px-3 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-xs border border-[#25D366]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>

                        {/* Cancel Booking Action */}
                        {canCancel && (
                          <button
                            onClick={() => handleCancelBooking(b._id)}
                            disabled={actionLoadingId === b._id}
                            className="px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingId === b._id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}

                        {/* View Details Button */}
                        <button
                          onClick={() => navigate(`/bookings/${b._id}`)}
                          className="px-4 py-2 rounded-xl bg-[#17233C] hover:bg-[#1F2D4A] text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}
