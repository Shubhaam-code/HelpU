import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Calendar, MapPin, Users, CheckCircle2, Clock, XCircle, 
  AlertCircle, ArrowRight, Car, MessageSquare, 
  ShieldCheck, RefreshCw, Check, X, Phone,
  Ticket, Send, Inbox, AlertTriangle, CheckCheck, Eye
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
  completeBooking,
  getWhatsAppDetails 
} from '../lib/api';
import { openWhatsAppChat, getWhatsAppUrl } from '../lib/whatsapp';
import { formatDate, formatCurrency } from '../lib/utils';

export default function BookingsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();

  // Primary Tab: 'my' (My Bookings) or 'received' (Received Requests as Host)
  const rawTab = searchParams.get('tab') || 'my';
  const initialTab = rawTab === 'received' ? 'received' : 'my';
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Sub-filter for My Bookings ('upcoming', 'pending', 'completed', 'cancelled_rejected', 'all')
  const initialMyFilter = rawTab === 'sent' ? 'pending' : rawTab === 'confirmed' ? 'upcoming' : 'upcoming';
  const [myFilter, setMyFilter] = useState(initialMyFilter);

  // Sub-filter for Received Requests ('all', 'pending', 'accepted', 'completed', 'rejected')
  const [receivedFilter, setReceivedFilter] = useState('all');

  const [myBookings, setMyBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Modal for Viewing Details & Status Timeline
  const [selectedBooking, setSelectedBooking] = useState(null);

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

  // Sub-filter counts for My Bookings
  const myCounts = useMemo(() => {
    return {
      all: myBookings.length,
      upcoming: myBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase())).length,
      pending: myBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length,
      completed: myBookings.filter(b => (b.status || '').toLowerCase() === 'completed').length,
      cancelled_rejected: myBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase())).length,
    };
  }, [myBookings]);

  // Filtered My Bookings based on selected sub-filter
  const filteredMyBookings = useMemo(() => {
    if (myFilter === 'upcoming') {
      return myBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase()));
    }
    if (myFilter === 'pending') {
      return myBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
    }
    if (myFilter === 'completed') {
      return myBookings.filter(b => (b.status || '').toLowerCase() === 'completed');
    }
    if (myFilter === 'cancelled_rejected') {
      return myBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase()));
    }
    return myBookings;
  }, [myBookings, myFilter]);

  // Sub-filter counts for Received Requests (Host)
  const receivedCounts = useMemo(() => {
    return {
      all: receivedBookings.length,
      pending: receivedBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length,
      accepted: receivedBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase())).length,
      completed: receivedBookings.filter(b => (b.status || '').toLowerCase() === 'completed').length,
      rejected: receivedBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase())).length,
    };
  }, [receivedBookings]);

  // Filtered Received Requests
  const filteredReceived = useMemo(() => {
    if (receivedFilter === 'all') return receivedBookings;
    if (receivedFilter === 'pending') return receivedBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending');
    if (receivedFilter === 'accepted') return receivedBookings.filter(b => ['confirmed', 'accepted'].includes((b.status || '').toLowerCase()));
    if (receivedFilter === 'completed') return receivedBookings.filter(b => (b.status || '').toLowerCase() === 'completed');
    if (receivedFilter === 'rejected') return receivedBookings.filter(b => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase()));
    return receivedBookings;
  }, [receivedBookings, receivedFilter]);

  // Handle Cancellation / Withdrawal
  const handleCancelBooking = async (bookingId, isPending = false) => {
    const confirmMsg = isPending
      ? 'Are you sure you want to withdraw this ride request?'
      : 'Are you sure you want to cancel this confirmed booking? This will release reserved seats.';

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(bookingId);
    try {
      await cancelBooking(bookingId);
      const updater = (list) => list.map(b => b._id === bookingId ? { ...b, status: 'cancelled', cancelledAt: new Date().toISOString() } : b);
      setMyBookings(updater);
      setReceivedBookings(updater);
      if (selectedBooking && selectedBooking._id === bookingId) {
        setSelectedBooking(prev => ({ ...prev, status: 'cancelled', cancelledAt: new Date().toISOString() }));
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      alert(err?.response?.data?.message || err.message || 'Failed to cancel booking.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Safe Ride Completion Mechanism
  const handleCompleteRide = async (bookingId) => {
    const confirmMsg = 'Are you sure you want to mark this ride as completed? This confirms that the journey has finished.';
    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(bookingId);
    try {
      const res = await completeBooking(bookingId);
      const updated = res?.data?.data || res?.data;
      const updater = (list) => list.map(b => b._id === bookingId ? { ...b, ...(updated || {}), status: 'completed', completedAt: new Date().toISOString() } : b);
      setMyBookings(updater);
      setReceivedBookings(updater);
      if (selectedBooking && selectedBooking._id === bookingId) {
        setSelectedBooking(prev => ({ ...prev, ...(updated || {}), status: 'completed', completedAt: new Date().toISOString() }));
      }
    } catch (err) {
      console.error('Complete booking error:', err);
      alert(err?.response?.data?.message || err.message || 'Failed to complete booking.');
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
      if (selectedBooking && selectedBooking._id === bookingId) {
        setSelectedBooking(null);
      }
    } catch (err) {
      console.error('Respond booking error:', err);
      alert(err?.response?.data?.message || err.message || `Failed to ${action} booking.`);
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

      if (directPhone) {
        openWhatsAppChat({
          phone: directPhone,
          name: partnerName,
          route: routeText,
          message: `Hi ${partnerName}! Connecting regarding HelpU Booking #${booking._id?.slice(-6)?.toUpperCase()} for route ${routeText}. Let's coordinate pickup!`
        });
        return;
      }

      const newWin = window.open('about:blank', '_blank');
      try {
        const res = await getWhatsAppDetails(booking._id);
        const data = res?.data?.data || res?.data;
        if (data?.whatsappUrl) {
          if (newWin) newWin.location.href = data.whatsappUrl;
          else window.location.href = data.whatsappUrl;
          return;
        }
        if (data?.normalizedPhone || data?.phone) {
          const directUrl = getWhatsAppUrl({
            phone: data.normalizedPhone || data.phone,
            name: data.name || partnerName,
            route: routeText
          });
          if (newWin && directUrl) newWin.location.href = directUrl;
          else if (directUrl) window.location.href = directUrl;
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

  // Status Badge Renderer for all 5 statuses
  const renderStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF9E7] text-[#CA8A04] border border-[#FDEBB2] text-[11px] font-black">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          Pending Approval
        </span>
      );
    }
    if (s === 'confirmed' || s === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[11px] font-black">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Confirmed Booking
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[11px] font-black">
          <CheckCheck className="w-3.5 h-3.5" />
          Ride Completed
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-black">
          <XCircle className="w-3.5 h-3.5" />
          Declined by Host
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-[11px] font-black">
          <AlertTriangle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    }
    return null;
  };

  // Helper to format timestamps for timeline
  const formatTimelineDate = (isoStr) => {
    if (!isoStr) return 'Pending';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(isoStr);
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Bookings & Requests" backTo="/home" />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">

        {/* ========================================================================= */}
        {/* PAGE HEADER: TITLE, SUBTITLE & CTAS                                       */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 border border-[#F4E3D8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[11px] font-black text-[#FF572E] mb-3 shadow-2xs">
              🎫 Campus Rides &amp; Bookings
            </span>
            <h1 className="font-black text-[#17233C] text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">
              My Bookings &amp; <span className="text-[#FF572E]">Requests</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#596277] font-medium mt-2 leading-relaxed">
              Track your upcoming journeys, pending requests, completed rides, and host passenger requests.
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
        {/* TOP-LEVEL TABS: MY BOOKINGS vs RECEIVED REQUESTS                           */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[26px] p-2.5 sm:p-3 border border-[#F4E3D8]/90 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            
            {/* TAB 1: MY BOOKINGS (PASSENGER) */}
            <button
              onClick={() => handleTabChange('my')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                activeTab === 'my'
                  ? 'bg-[#17233C] text-white shadow-sm'
                  : 'bg-[#FFFBF8] text-[#596277] hover:bg-[#FFF5EE] hover:text-[#17233C]'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>My Bookings</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'my' ? 'bg-[#FF572E] text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {myCounts.all}
              </span>
            </button>

            {/* TAB 2: RECEIVED REQUESTS (HOST) */}
            <button
              onClick={() => handleTabChange('received')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                activeTab === 'received'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'bg-[#FFFBF8] text-[#596277] hover:bg-[#FFF5EE] hover:text-[#17233C]'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Received Requests (As Host)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'received' 
                  ? 'bg-white/25 text-white' 
                  : receivedCounts.pending > 0 
                  ? 'bg-[#FF572E] text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {receivedCounts.pending > 0 ? `${receivedCounts.pending} New` : receivedCounts.all}
              </span>
            </button>

          </div>
        </div>


        {/* ========================================================================= */}
        {/* VIEW 1: MY BOOKINGS (PASSENGER) WITH 4 CORE SUB-FILTERS                   */}
        {/* ========================================================================= */}
        {activeTab === 'my' && (
          <div className="space-y-4">
            
            {/* SUB-FILTER PILLS: UPCOMING, PENDING, COMPLETED, CANCELLED & REJECTED */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#F4E3D8]">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'upcoming', label: 'Upcoming Bookings', count: myCounts.upcoming, icon: CheckCircle2 },
                  { id: 'pending', label: 'Pending Requests', count: myCounts.pending, icon: Clock },
                  { id: 'completed', label: 'Completed', count: myCounts.completed, icon: CheckCheck },
                  { id: 'cancelled_rejected', label: 'Cancelled & Declined', count: myCounts.cancelled_rejected, icon: XCircle },
                  { id: 'all', label: 'All Bookings', count: myCounts.all, icon: Ticket }
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setMyFilter(f.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        myFilter === f.id
                          ? 'bg-[#17233C] text-white shadow-xs'
                          : 'bg-[#FFFBF8] text-[#596277] hover:text-[#17233C] border border-[#F4E3D8]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{f.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        myFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className="text-xs text-[#6E7587] font-semibold">
                Showing <strong>{filteredMyBookings.length}</strong> bookings
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LoadingSkeleton count={2} />
              </div>
            ) : filteredMyBookings.length === 0 ? (
              <div className="bg-white rounded-[32px] p-10 sm:p-14 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
                  {myFilter === 'upcoming' ? '🎫' : myFilter === 'completed' ? '🏁' : myFilter === 'pending' ? '⏳' : '📁'}
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg">
                    {myFilter === 'upcoming' && 'No Upcoming Confirmed Bookings'}
                    {myFilter === 'pending' && 'No Pending Ride Requests'}
                    {myFilter === 'completed' && 'No Completed Bookings Yet'}
                    {myFilter === 'cancelled_rejected' && 'No Cancelled or Declined Bookings'}
                    {myFilter === 'all' && 'No Bookings Found'}
                  </h3>
                  <p className="text-xs text-[#6E7587] mt-1.5 leading-relaxed max-w-sm mx-auto">
                    {myFilter === 'upcoming' && 'When a ride host accepts your request, your confirmed journey will appear here.'}
                    {myFilter === 'pending' && 'Ride requests awaiting host approval will appear here.'}
                    {myFilter === 'completed' && 'Rides that you have finished and marked completed will be archived here.'}
                    {myFilter === 'cancelled_rejected' && 'Cancelled or declined booking records will appear here.'}
                    {myFilter === 'all' && 'Explore available campus rides and book seats with fellow students.'}
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/match')}
                    className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Find Campus Matches
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {filteredMyBookings.map((b) => {
                  const travel = b.travelId || b.travel || {};
                  const owner = b.owner || {};
                  const fromCity = travel.source || travel.from || 'Campus Gate';
                  const toCity = travel.destination || travel.to || 'Destination';
                  const seatsCount = b.requestedSeats || b.seatsBooked || 1;
                  const pricePerSeat = travel.pricePerSeat || 350;
                  const totalAmount = seatsCount * pricePerSeat;
                  const status = (b.status || 'pending').toLowerCase();

                  const isPending = status === 'pending';
                  const isConfirmed = ['confirmed', 'accepted'].includes(status);
                  const isCompleted = status === 'completed';

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
                      className={`bg-white rounded-[28px] p-5 sm:p-6 border-2 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden ${
                        isConfirmed 
                          ? 'border-[#16A34A]/30' 
                          : isCompleted 
                          ? 'border-[#2563EB]/30 bg-[#F8FAFC]' 
                          : isPending 
                          ? 'border-[#FED7AA]' 
                          : 'border-gray-200 opacity-80'
                      }`}
                    >
                      {/* Card Header */}
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
                          {renderStatusBadge(b.status)}
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
                          <span className="font-black text-[#17233C] text-[11px]">
                            {seatsCount} {seatsCount === 1 ? 'Seat' : 'Seats'}
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

                        <div className="flex items-center flex-wrap gap-2">
                          {/* View Details & Timeline Button */}
                          <button
                            onClick={() => setSelectedBooking(b)}
                            className="px-3.5 py-2.5 rounded-xl bg-white border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFF7F2] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#596277]" />
                            <span>Details &amp; Timeline</span>
                          </button>

                          {/* WhatsApp Host (if confirmed/accepted) */}
                          {isConfirmed && (
                            <button
                              onClick={() => handleWhatsAppChat(b, 'passenger')}
                              className="px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          {/* Mark Ride Completed (if confirmed/accepted) */}
                          {isConfirmed && (
                            <button
                              onClick={() => handleCompleteRide(b._id)}
                              disabled={actionLoadingId === b._id}
                              className="px-3.5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>{actionLoadingId === b._id ? 'Completing...' : 'Mark Completed'}</span>
                            </button>
                          )}

                          {/* Cancel / Withdraw Booking (NOT allowed if completed or already cancelled/rejected) */}
                          {(isConfirmed || isPending) && (
                            <button
                              onClick={() => handleCancelBooking(b._id, isPending)}
                              disabled={actionLoadingId === b._id}
                              className="px-3.5 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoadingId === b._id ? 'Processing...' : isPending ? 'Withdraw' : 'Cancel'}
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
        {/* VIEW 2: RECEIVED REQUESTS (AS HOST)                                       */}
        {/* ========================================================================= */}
        {activeTab === 'received' && (
          <div className="space-y-4">
            
            {/* SUB-FILTER PILLS FOR RECEIVED REQUESTS */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#F4E3D8]">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Received', count: receivedCounts.all, icon: Inbox },
                  { id: 'pending', label: 'Needs Action (Pending)', count: receivedCounts.pending, icon: Clock },
                  { id: 'accepted', label: 'Accepted Passengers', count: receivedCounts.accepted, icon: CheckCircle2 },
                  { id: 'completed', label: 'Completed Rides', count: receivedCounts.completed, icon: CheckCheck },
                  { id: 'rejected', label: 'Declined / Cancelled', count: receivedCounts.rejected, icon: XCircle }
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setReceivedFilter(f.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        receivedFilter === f.id
                          ? 'bg-[#FF572E] text-white shadow-xs'
                          : 'bg-[#FFFBF8] text-[#596277] hover:text-[#17233C] border border-[#F4E3D8]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{f.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        receivedFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  );
                })}
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
                  <h3 className="font-black text-[#17233C] text-lg">No Received Requests Found</h3>
                  <p className="text-xs text-[#6E7587] mt-1 max-w-sm mx-auto">
                    When campus peers request seats on your offered rides, their requests will appear here.
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
                  const isCompleted = status === 'completed';

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
                          : isCompleted
                          ? 'border-[#2563EB]/30 bg-[#F8FAFC]'
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

                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {renderStatusBadge(b.status)}
                            <span className="text-[10px] font-mono font-bold text-[#8C93A4]">
                              #{b._id.slice(-6).toUpperCase()}
                            </span>
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
                        {/* View Details & Timeline Button */}
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-3.5 py-2 rounded-xl bg-white border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFF7F2] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#596277]" />
                          <span>Timeline</span>
                        </button>

                        <div className="flex items-center flex-wrap gap-2">
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
                            <>
                              <button
                                onClick={() => handleWhatsAppChat(b, 'host')}
                                className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </button>
                              <button
                                onClick={() => handleCompleteRide(b._id)}
                                disabled={actionLoadingId === b._id}
                                className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>{actionLoadingId === b._id ? 'Completing...' : 'Mark Completed'}</span>
                              </button>
                            </>
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
        {/* BOOKING DETAILS & STATUS TIMELINE MODAL                                   */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {selectedBooking && (() => {
            const b = selectedBooking;
            const travel = b.travelId || b.travel || {};
            const owner = b.owner || {};
            const passenger = b.passenger || {};
            const fromCity = travel.source || travel.from || 'Campus Gate';
            const toCity = travel.destination || travel.to || 'Destination';
            const seatsCount = b.requestedSeats || b.seatsBooked || 1;
            const pricePerSeat = travel.pricePerSeat || 350;
            const totalAmount = seatsCount * pricePerSeat;
            const status = (b.status || 'pending').toLowerCase();
            const isConfirmed = ['confirmed', 'accepted'].includes(status);
            const isPending = status === 'pending';
            const isCompleted = status === 'completed';

            // Generate timeline items (using backend timeline if attached, or timestamp fallbacks)
            const timelineSteps = Array.isArray(b.timeline) && b.timeline.length > 0
              ? b.timeline
              : [
                  {
                    status: 'pending',
                    title: 'Booking Request Created',
                    description: `Requested ${seatsCount} seat(s) on this route.`,
                    timestamp: b.createdAt
                  },
                  ...(b.approvedAt ? [{
                    status: 'confirmed',
                    title: 'Booking Approved',
                    description: 'Host approved the request and reserved seats.',
                    timestamp: b.approvedAt
                  }] : []),
                  ...(b.rejectedAt ? [{
                    status: 'rejected',
                    title: 'Booking Declined',
                    description: 'Host declined the booking request.',
                    timestamp: b.rejectedAt
                  }] : []),
                  ...(b.cancelledAt ? [{
                    status: 'cancelled',
                    title: 'Booking Cancelled',
                    description: 'Booking was cancelled and seats restored.',
                    timestamp: b.cancelledAt
                  }] : []),
                  ...(b.completedAt ? [{
                    status: 'completed',
                    title: 'Ride Completed',
                    description: 'Journey successfully finished and verified.',
                    timestamp: b.completedAt
                  }] : [])
                ];

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-[32px] p-6 sm:p-8 max-w-lg w-full border border-[#F4E3D8] shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto scrollbar-none"
                >
                  {/* Modal Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-[#F4E3D8]/80 pb-4">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold text-[#8C93A4] block">
                        Booking #{b._id.slice(-6).toUpperCase()}
                      </span>
                      <h3 className="font-black text-[#17233C] text-lg sm:text-xl mt-0.5">
                        Booking Details &amp; Status
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedBooking(null)}
                      className="w-9 h-9 rounded-full bg-[#FFF4ED] hover:bg-[#FFE8DC] text-[#FF572E] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Current Status Pill */}
                  <div className="flex items-center justify-between p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
                    <span className="text-xs font-bold text-[#596277]">Current Status:</span>
                    <div>{renderStatusBadge(b.status)}</div>
                  </div>

                  {/* Route & Schedule Info */}
                  <div className="space-y-3">
                    <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] space-y-2.5">
                      <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                        <span className="w-3 h-3 rounded-full bg-[#16A34A] shrink-0 ring-3 ring-[#DCFCE7]" />
                        <span className="font-extrabold text-[#17233C]">{fromCity}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                        <span className="w-3 h-3 rounded-full bg-[#FF572E] shrink-0 ring-3 ring-[#FFEBE0]" />
                        <span className="font-extrabold text-[#17233C]">{toCity}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#F9FAFB] p-3 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Seats</span>
                        <span className="font-bold text-[#17233C]">{seatsCount} Seat(s)</span>
                      </div>
                      <div className="bg-[#F9FAFB] p-3 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-[#6E7587] block mb-0.5">Fare</span>
                        <span className="font-bold text-[#17233C]">{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Timeline */}
                  <div className="space-y-3 pt-2 border-t border-[#F4E3D8]/80">
                    <h4 className="font-black text-[#17233C] text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#FF572E]" />
                      <span>Booking Status Timeline</span>
                    </h4>

                    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E7EB]">
                      {timelineSteps.map((step, idx) => {
                        const stepStatus = (step.status || '').toLowerCase();
                        let dotBg = 'bg-gray-400';
                        if (stepStatus === 'confirmed' || stepStatus === 'accepted') dotBg = 'bg-[#16A34A] ring-4 ring-[#DCFCE7]';
                        else if (stepStatus === 'completed') dotBg = 'bg-[#2563EB] ring-4 ring-[#BFDBFE]';
                        else if (stepStatus === 'pending') dotBg = 'bg-[#CA8A04] ring-4 ring-[#FEF08A]';
                        else if (stepStatus === 'rejected') dotBg = 'bg-gray-500 ring-4 ring-gray-200';
                        else if (stepStatus === 'cancelled') dotBg = 'bg-red-500 ring-4 ring-red-100';

                        return (
                          <div key={idx} className="relative">
                            <span className={`absolute -left-[19px] top-1 w-3 h-3 rounded-full ${dotBg}`} />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                                {step.title}
                              </span>
                              <span className="text-[11px] font-semibold text-[#FF572E] mt-0.5">
                                {formatTimelineDate(step.timestamp)}
                              </span>
                              {step.description && (
                                <p className="text-xs text-[#596277] mt-1 leading-relaxed">
                                  {step.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions inside Modal */}
                  <div className="pt-4 border-t border-[#F4E3D8]/80 flex flex-wrap items-center justify-end gap-2.5">
                    {/* Mark Completed */}
                    {isConfirmed && (
                      <button
                        onClick={() => handleCompleteRide(b._id)}
                        disabled={actionLoadingId === b._id}
                        className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>{actionLoadingId === b._id ? 'Completing...' : 'Mark Completed'}</span>
                      </button>
                    )}

                    {/* WhatsApp */}
                    {isConfirmed && (
                      <button
                        onClick={() => handleWhatsAppChat(b, activeTab === 'my' ? 'passenger' : 'host')}
                        className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    )}

                    {/* Cancel Booking (Only if not completed or already cancelled/rejected) */}
                    {(isConfirmed || isPending) && (
                      <button
                        onClick={() => handleCancelBooking(b._id, isPending)}
                        disabled={actionLoadingId === b._id}
                        className="px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {actionLoadingId === b._id ? 'Processing...' : isPending ? 'Withdraw Request' : 'Cancel Booking'}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedBooking(null)}
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#17233C] font-bold text-xs transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}
