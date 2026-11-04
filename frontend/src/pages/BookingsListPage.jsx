import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Calendar, MapPin, Users, CheckCircle2, Clock, XCircle, 
  AlertCircle, ArrowRight, Car, MessageSquare, 
  ShieldCheck, RefreshCw, Check, X, Phone,
  Ticket, Send, Inbox, AlertTriangle
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
  getWhatsAppDetails 
} from '../lib/api';
import { openWhatsAppChat, getWhatsAppUrl } from '../lib/whatsapp';
import { formatDate, formatCurrency } from '../lib/utils';

export default function BookingsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();

  // Primary Tab: 'confirmed' (My Confirmed Bookings), 'sent' (My Ride Requests), 'received' (Received Requests)
  const initialTab = searchParams.get('tab') || 'confirmed';
  const [activeTab, setActiveTab] = useState(['confirmed', 'sent', 'received'].includes(initialTab) ? initialTab : 'confirmed');
  
  // Sub-filter for Sent Requests ('all', 'pending', 'rejected')
  const [sentFilter, setSentFilter] = useState('all');
  // Sub-filter for Received Requests ('all', 'pending', 'accepted', 'rejected')
  const [receivedFilter, setReceivedFilter] = useState('all');

  const [myBookings, setMyBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Sync tab with URL
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

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

  // 1. Confirmed Bookings (ONLY confirmed or accepted passenger bookings)
  const confirmedBookings = useMemo(() => {
    return myBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase()));
  }, [myBookings]);

  // 2. Sent Requests (All requests sent by current user)
  const sentRequests = useMemo(() => {
    if (sentFilter === 'all') return myBookings;
    if (sentFilter === 'pending') return myBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
    if (sentFilter === 'rejected') return myBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase()));
    if (sentFilter === 'accepted') return myBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase()));
    return myBookings;
  }, [myBookings, sentFilter]);

  // Counts for Sent Requests
  const sentCounts = useMemo(() => {
    return {
      all: myBookings.length,
      pending: myBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length,
      accepted: myBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase())).length,
      rejected: myBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase())).length,
    };
  }, [myBookings]);

  // 3. Received Requests (All requests received on user's offered rides)
  const filteredReceived = useMemo(() => {
    if (receivedFilter === 'all') return receivedBookings;
    if (receivedFilter === 'pending') return receivedBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
    if (receivedFilter === 'accepted') return receivedBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase()));
    if (receivedFilter === 'rejected') return receivedBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase()));
    return receivedBookings;
  }, [receivedBookings, receivedFilter]);

  // Counts for Received Requests
  const receivedCounts = useMemo(() => {
    return {
      all: receivedBookings.length,
      pending: receivedBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length,
      accepted: receivedBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase())).length,
      rejected: receivedBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase())).length,
    };
  }, [receivedBookings]);

  // Handle Cancellation / Withdrawal of Request or Booking
  const handleCancelBooking = async (bookingId, isPending = false) => {
    const confirmMsg = isPending
      ? 'Are you sure you want to withdraw this ride request?'
      : 'Are you sure you want to cancel this confirmed booking? This will release reserved seats.';

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(bookingId);
    try {
      await cancelBooking(bookingId);
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
      await fetchAllBookings();
    } catch (err) {
      console.error('Respond booking error:', err);
      alert(err.message || `Failed to ${action} booking.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Direct WhatsApp Connection
  const handleWhatsAppChat = async (booking, role = 'passenger') => {
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
      console.error('WhatsApp chat error:', err);
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Bookings & Requests" backTo="/home" />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">

        {/* ========================================================================= */}
        {/* PAGE HEADER: TITLE, SUBTITLE & FIND NEW RIDE CTA                          */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 border border-[#F4E3D8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[11px] font-black text-[#FF572E] mb-3 shadow-2xs">
              🎫 Campus Rides & Bookings
            </span>
            <h1 className="font-black text-[#17233C] text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">
              My Rides &amp; <span className="text-[#FF572E]">Requests</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#596277] font-medium mt-2 leading-relaxed">
              Track your confirmed journey tickets, pending ride requests, and approve passengers for your rides.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/rides/offer')}
              className="px-6 py-3 rounded-2xl bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
            >
              <Car className="w-4 h-4 stroke-[2.5]" />
              <span>Offer a Ride</span>
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
        {/* 3 STRICTLY SEPARATE TOP-LEVEL TABS                                        */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[26px] p-2.5 sm:p-3 border border-[#F4E3D8]/90 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            
            {/* TAB 1: CONFIRMED BOOKINGS */}
            <button
              onClick={() => handleTabChange('confirmed')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                activeTab === 'confirmed'
                  ? 'bg-[#17233C] text-white shadow-sm'
                  : 'bg-[#FFFBF8] text-[#596277] hover:bg-[#FFF5EE] hover:text-[#17233C]'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Confirmed Bookings</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'confirmed' ? 'bg-[#FF572E] text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {confirmedBookings.length}
              </span>
            </button>

            {/* TAB 2: MY RIDE REQUESTS (SENT) */}
            <button
              onClick={() => handleTabChange('sent')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                activeTab === 'sent'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'bg-[#FFFBF8] text-[#596277] hover:bg-[#FFF5EE] hover:text-[#17233C]'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>My Ride Requests</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'sent' ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {sentCounts.pending > 0 ? `${sentCounts.pending} Pending` : myBookings.length}
              </span>
            </button>

            {/* TAB 3: RECEIVED REQUESTS (HOST) */}
            <button
              onClick={() => handleTabChange('received')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                activeTab === 'received'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'bg-[#FFFBF8] text-[#596277] hover:bg-[#FFF5EE] hover:text-[#17233C]'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Received Requests</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'received' ? 'bg-white/25 text-white' : receivedCounts.pending > 0 ? 'bg-[#FF572E] text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {receivedCounts.pending > 0 ? `${receivedCounts.pending} New` : receivedBookings.length}
              </span>
            </button>

          </div>
        </div>


        {/* ========================================================================= */}
        {/* VIEW 1: CONFIRMED BOOKINGS (OFFICIAL TICKET / RESERVED SEATS ONLY)       */}
        {/* ========================================================================= */}
        {activeTab === 'confirmed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-black text-[#17233C] text-base sm:text-lg flex items-center gap-2">
                <span>Active Confirmed Bookings</span>
                <span className="text-xs font-bold text-[#6E7587]">({confirmedBookings.length})</span>
              </h2>
              <span className="text-[11px] text-[#16A34A] font-extrabold flex items-center gap-1 bg-[#EDFAF3] px-2.5 py-1 rounded-full border border-[#BCECD4]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified &amp; Accepted by Host
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LoadingSkeleton count={2} />
              </div>
            ) : confirmedBookings.length === 0 ? (
              <div className="bg-white rounded-[32px] p-10 sm:p-14 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center mx-auto text-2xl">
                  🎫
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg">No Confirmed Bookings Yet</h3>
                  <p className="text-xs text-[#6E7587] mt-1.5 leading-relaxed max-w-sm mx-auto">
                    When a ride owner accepts your ride request, your confirmed journey ticket with driver details and seats will appear right here.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => handleTabChange('sent')}
                    className="px-5 py-2.5 bg-[#FFF4ED] hover:bg-[#FFE8DC] text-[#FF572E] font-bold text-xs rounded-xl border border-[#FDE0D0] transition-colors cursor-pointer"
                  >
                    Check My Sent Requests ({sentCounts.pending} Pending)
                  </button>
                  <button
                    onClick={() => navigate('/match')}
                    className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Find Matches
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {confirmedBookings.map((b) => {
                  const travel = b.travelId || b.travel || {};
                  const owner = b.owner || {};
                  const fromCity = travel.source || travel.from || 'Campus Gate';
                  const toCity = travel.destination || travel.to || 'Destination';
                  const seatsCount = b.requestedSeats || b.seatsBooked || 1;
                  const pricePerSeat = travel.pricePerSeat || 350;
                  const totalAmount = seatsCount * pricePerSeat;

                  const timeDisplay = travel.travelDate
                    ? new Date(travel.travelDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
                      (typeof travel.departureTime === 'number'
                        ? ` • ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}`
                        : '')
                    : formatDate(travel.departureTime);

                  return (
                    <motion.div
                      key={b._id}
                      layout
                      whileHover={{ y: -2 }}
                      className="bg-white rounded-[28px] p-5 sm:p-6 border-2 border-[#16A34A]/30 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Top Ribbon */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar 
                            avatarId={owner?.avatarId || 'm1'} 
                            src={owner?.imageUrl || (owner?.clerkId === user?.id ? user?.imageUrl : null)} 
                            name={owner?.name}
                            size="md" 
                            ring 
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-[#17233C] text-sm sm:text-base truncate">
                                {owner?.name || 'Student Host'}
                              </h4>
                              <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                            </div>
                            <span className="text-[11px] text-[#6E7587] block mt-0.5">
                              Ride Host • {owner?.college || 'VIT, Bhopal'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[11px] font-black">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmed Booking
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#8C93A4]">
                            #{b._id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Route Box */}
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

                      {/* Booking Meta Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 text-xs">
                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Travel Schedule</span>
                          <span className="font-bold text-[#17233C] text-[11px] truncate block">{timeDisplay}</span>
                        </div>

                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                          <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Vehicle</span>
                          <span className="font-bold text-[#17233C] text-[11px] truncate block">
                            {travel.carModel || 'Campus Carpool'}
                          </span>
                        </div>

                        <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Seats Reserved</span>
                          <span className="font-black text-[#16A34A] text-[11px]">
                            {seatsCount} {seatsCount === 1 ? 'Seat' : 'Seats'} Confirmed
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3.5 border-t border-[#F4E3D8]/80 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6E7587] block">Fare</span>
                          <span className="font-black text-base sm:text-lg text-[#17233C]">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleWhatsAppChat(b, 'passenger')}
                            className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp Host</span>
                          </button>

                          <button
                            onClick={() => handleCancelBooking(b._id, false)}
                            disabled={actionLoadingId === b._id}
                            className="px-3.5 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingId === b._id ? 'Cancelling...' : 'Cancel Booking'}
                          </button>
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* ========================================================================= */}
        {/* VIEW 2: MY RIDE REQUESTS (SENT REQUESTS & STATUSES)                       */}
        {/* ========================================================================= */}
        {activeTab === 'sent' && (
          <div className="space-y-4">
            
            {/* Filter Pills */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#F4E3D8]">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Requests', count: sentCounts.all },
                  { id: 'pending', label: 'Pending Approval', count: sentCounts.pending },
                  { id: 'accepted', label: 'Accepted', count: sentCounts.accepted },
                  { id: 'rejected', label: 'Declined / Cancelled', count: sentCounts.rejected }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSentFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sentFilter === f.id
                        ? 'bg-[#17233C] text-white shadow-xs'
                        : 'bg-[#FFFBF8] text-[#596277] hover:text-[#17233C] border border-[#F4E3D8]'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      sentFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              <span className="text-xs text-[#6E7587] font-semibold">
                Showing <strong>{sentRequests.length}</strong> sent requests
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LoadingSkeleton count={3} />
              </div>
            ) : sentRequests.length === 0 ? (
              <div className="bg-white rounded-[32px] p-10 sm:p-14 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
                  🚀
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg">No Sent Ride Requests Found</h3>
                  <p className="text-xs text-[#6E7587] mt-1 max-w-sm mx-auto">
                    You haven't requested any rides yet. Explore available campus rides and send a request!
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => navigate('/rides/offer')}
                    className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <Car className="w-4 h-4" />
                    <span>Offer a Ride</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {sentRequests.map((b) => {
                  const travel = b.travelId || b.travel || {};
                  const owner = b.owner || {};
                  const fromCity = travel.source || travel.from || 'Campus Gate';
                  const toCity = travel.destination || travel.to || 'Destination';
                  const seatsCount = b.requestedSeats || 1;
                  const pricePerSeat = travel.pricePerSeat || 350;
                  const totalAmount = seatsCount * pricePerSeat;
                  const status = (b.status || 'pending').toLowerCase();

                  const isPending = status === 'pending';
                  const isAccepted = ['confirmed', 'accepted'].includes(status);
                  const isRejected = ['rejected', 'cancelled'].includes(status);

                  const timeDisplay = travel.travelDate
                    ? new Date(travel.travelDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
                      (typeof travel.departureTime === 'number'
                        ? ` • ${String(Math.floor(travel.departureTime / 60)).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')}`
                        : '')
                    : 'Upcoming';

                  return (
                    <motion.div
                      key={b._id}
                      layout
                      className={`bg-white rounded-[26px] p-5 sm:p-6 border transition-all flex flex-col justify-between ${
                        isPending 
                          ? 'border-[#FED7AA] bg-gradient-to-b from-[#FFFDFB] to-white shadow-xs'
                          : isAccepted
                          ? 'border-[#BCECD4] shadow-xs'
                          : 'border-red-200 bg-red-50/20'
                      }`}
                    >
                      <div>
                        {/* Header Banner: Clarifies Pending vs Accepted vs Declined */}
                        <div className="flex items-start justify-between gap-3 mb-3.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar 
                              avatarId={owner?.avatarId || 'm1'} 
                              src={owner?.imageUrl || (owner?.clerkId === user?.id ? user?.imageUrl : null)} 
                              name={owner?.name}
                              size="sm" 
                              ring 
                            />
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-[#17233C] text-xs sm:text-sm truncate">
                                {owner?.name || 'Ride Provider'}
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
                            {isAccepted && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[11px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Accepted by Host
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

                        {/* Status Notice Banner for Pending */}
                        {isPending && (
                          <div className="mb-3.5 p-3 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5] text-xs text-[#9A3412] flex items-center gap-2 font-medium">
                            <Clock className="w-4 h-4 shrink-0 text-[#EA580C]" />
                            <span>Your request is awaiting host review. This is not a confirmed booking yet.</span>
                          </div>
                        )}

                        {/* Route Box */}
                        <div className="bg-[#FFFBF8] rounded-2xl p-3.5 border border-[#F4E3D8] mb-3.5 space-y-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                            <span className="font-extrabold text-[#17233C] truncate">{fromCity}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                            <span className="font-extrabold text-[#17233C] truncate">{toCity}</span>
                          </div>
                        </div>

                        {/* Quick Specs */}
                        <div className="grid grid-cols-2 gap-2 mb-3.5 text-xs">
                          <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Travel Date &amp; Time</span>
                            <span className="font-bold text-[#17233C] text-[11px] truncate block">{timeDisplay}</span>
                          </div>
                          <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Requested Seats</span>
                            <span className="font-bold text-[#FF572E] text-[11px] truncate block">
                              {seatsCount} {seatsCount === 1 ? 'Seat' : 'Seats'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Actions Row */}
                      <div className="pt-3 border-t border-[#F4E3D8]/80 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6E7587] block">Estimated Fare</span>
                          <span className="font-black text-sm sm:text-base text-[#17233C]">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPending && (
                            <button
                              onClick={() => handleCancelBooking(b._id, true)}
                              disabled={actionLoadingId === b._id}
                              className="px-3.5 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoadingId === b._id ? 'Cancelling...' : 'Withdraw Request'}
                            </button>
                          )}

                          {isAccepted && (
                            <button
                              onClick={() => handleTabChange('confirmed')}
                              className="px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <Ticket className="w-3.5 h-3.5" />
                              <span>View Confirmed Ticket</span>
                            </button>
                          )}

                          {isRejected && (
                            <button
                              onClick={() => navigate('/match')}
                              className="px-3.5 py-2 rounded-xl bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs transition-colors cursor-pointer"
                            >
                              Find Other Matches
                            </button>
                          )}
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* ========================================================================= */}
        {/* VIEW 3: RECEIVED REQUESTS (MANAGE PASSENGERS AS A RIDE OWNER)             */}
        {/* ========================================================================= */}
        {activeTab === 'received' && (
          <div className="space-y-4">
            
            {/* Filter Pills */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#F4E3D8]">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Received', count: receivedCounts.all },
                  { id: 'pending', label: 'Needs Action (Pending)', count: receivedCounts.pending },
                  { id: 'accepted', label: 'Accepted Passengers', count: receivedCounts.accepted },
                  { id: 'rejected', label: 'Declined', count: receivedCounts.rejected }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setReceivedFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      receivedFilter === f.id
                        ? 'bg-[#FF572E] text-white shadow-xs'
                        : 'bg-[#FFFBF8] text-[#596277] hover:text-[#17233C] border border-[#F4E3D8]'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      receivedFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              <span className="text-xs text-[#6E7587] font-semibold">
                Showing <strong>{filteredReceived.length}</strong> received requests
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LoadingSkeleton count={3} />
              </div>
            ) : filteredReceived.length === 0 ? (
              <div className="bg-white rounded-[32px] p-10 sm:p-14 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
                  📬
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg">No Received Requests Yet</h3>
                  <p className="text-xs text-[#6E7587] mt-1 max-w-sm mx-auto">
                    When campus peers request seats on your offered rides, their details and approval actions will appear here.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => navigate('/rides/offer')}
                    className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <Car className="w-4 h-4" />
                    <span>Offer a New Ride</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {filteredReceived.map((b) => {
                  const travel = b.travelId || b.travel || {};
                  const passenger = b.passenger || {};
                  const fromCity = travel.source || travel.from || 'Campus Gate';
                  const toCity = travel.destination || travel.to || 'Destination';
                  const seatsCount = b.requestedSeats || 1;
                  const pricePerSeat = travel.pricePerSeat || 350;
                  const totalAmount = seatsCount * pricePerSeat;
                  const status = (b.status || 'pending').toLowerCase();

                  const isPending = status === 'pending';
                  const isAccepted = ['confirmed', 'accepted'].includes(status);
                  const isRejected = ['rejected', 'cancelled'].includes(status);

                  const requestDate = b.createdAt
                    ? new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Recently';

                  return (
                    <motion.div
                      key={b._id}
                      layout
                      className={`bg-white rounded-[26px] p-5 sm:p-6 border transition-all flex flex-col justify-between ${
                        isPending 
                          ? 'border-[#FF572E]/40 shadow-sm'
                          : isAccepted 
                          ? 'border-[#16A34A]/30' 
                          : 'border-gray-200 opacity-75'
                      }`}
                    >
                      <div>
                        {/* Passenger Details Header */}
                        <div className="flex items-start justify-between gap-3 mb-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar 
                              avatarId={passenger?.avatarId || 'm1'} 
                              src={passenger?.imageUrl || b.passengerImage || (passenger?.clerkId === user?.id || b.passengerId === user?.id ? user?.imageUrl : null)} 
                              name={passenger?.name || b.passengerName}
                              size="md" 
                              ring 
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-black text-[#17233C] text-sm sm:text-base truncate">
                                  {passenger?.name || b.passengerName || 'Student Requester'}
                                </h4>
                                <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                              </div>
                              <span className="text-[11px] text-[#6E7587] block mt-0.5">
                                {passenger?.college || 'VIT, Bhopal'} • Requested {requestDate}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[11px] font-black">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                Awaiting Decision
                              </span>
                            )}
                            {isAccepted && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[11px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Accepted Passenger
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-black">
                                <XCircle className="w-3.5 h-3.5" />
                                Declined
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Route Box */}
                        <div className="bg-[#FFFBF8] rounded-2xl p-3.5 border border-[#F4E3D8] mb-3.5 space-y-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                            <span className="font-extrabold text-[#17233C] truncate">{fromCity}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                            <span className="font-extrabold text-[#17233C] truncate">{toCity}</span>
                          </div>
                        </div>

                        {/* Request Meta */}
                        <div className="grid grid-cols-2 gap-2 mb-3.5 text-xs">
                          <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Seats Requested</span>
                            <span className="font-black text-[#FF572E] text-[11px]">
                              {seatsCount} {seatsCount === 1 ? 'Seat' : 'Seats'}
                            </span>
                          </div>
                          <div className="bg-[#F9FAFB] p-2.5 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Fare Contribution</span>
                            <span className="font-black text-[#17233C] text-[11px]">
                              {formatCurrency(totalAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Passenger Notes if any */}
                        {(b.passengerNotes || b.notes) && (
                          <div className="mb-3.5 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-[#596277]">
                            <strong className="text-[#17233C]">Passenger note:</strong> "{b.passengerNotes || b.notes}"
                          </div>
                        )}
                      </div>

                      {/* Action Decision Buttons */}
                      <div className="pt-3.5 border-t border-[#F4E3D8]/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[11px] font-mono text-[#8C93A4]">
                          ID: #{b._id.slice(-6).toUpperCase()}
                        </div>

                        <div className="flex items-center gap-2">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleHostRespond(b._id, 'accept')}
                                disabled={actionLoadingId === b._id}
                                className="px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{actionLoadingId === b._id ? 'Accepting...' : 'Accept'}</span>
                              </button>
                              <button
                                onClick={() => handleHostRespond(b._id, 'reject')}
                                disabled={actionLoadingId === b._id}
                                className="px-3.5 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {isAccepted && (
                            <button
                              onClick={() => handleWhatsAppChat(b, 'host')}
                              className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp Passenger</span>
                            </button>
                          )}
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}
