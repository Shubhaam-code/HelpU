import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Calendar, Clock, Users, Car, Check,
  XCircle, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, 
  Sparkles, Lock, Star, ExternalLink, Loader2, User as UserIcon
} from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { getBookingById, confirmBooking, cancelBooking, getWhatsAppDetails, respondBooking } from '../lib/api';
import { formatCurrency } from '../lib/utils';

export default function BookingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadBooking = () => {
    getBookingById(id)
      .then((res) => setBooking(res.data?.data || res.data))
      .catch((err) => {
        console.error('Error fetching booking details:', err);
        setErrorMsg(err.response?.data?.message || err.message || 'Could not load booking details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBooking();
  }, [id]);

  const handleConfirm = async () => {
    setConfirming(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await confirmBooking(id);
      setSuccessMsg('Booking confirmed! Seats have been reserved successfully.');
      loadBooking();
    } catch (err) {
      console.error('Error confirming booking:', err);
      const errMsg = err.response?.data?.message || err.message || '';
      if (errMsg.toLowerCase().includes('only accepted bookings')) {
        try {
          await respondBooking(id, { action: 'accept' });
          await confirmBooking(id);
          setSuccessMsg('Booking confirmed! Seats have been reserved successfully.');
          loadBooking();
          return;
        } catch (fallbackErr) {
          setErrorMsg(fallbackErr.response?.data?.message || fallbackErr.message || 'Failed to confirm booking.');
          return;
        }
      }
      setErrorMsg(errMsg || 'Failed to confirm booking.');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    const isOwner = Boolean(user?.id && booking?.ownerId === user.id);
    const actionLabel = isOwner ? 'decline/cancel this booking request' : 'cancel this booking';
    if (!confirm(`Are you sure you want to ${actionLabel}?`)) return;

    setCancelling(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await cancelBooking(id);
      setSuccessMsg(isOwner ? 'Booking request declined.' : 'Booking cancelled successfully.');
      loadBooking();
    } catch (err) {
      console.error('Error cancelling booking:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Cancel failed.');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!id || whatsAppLoading) return;
    setWhatsAppLoading(true);
    setErrorMsg('');
    try {
      const res = await getWhatsAppDetails(id);
      const data = res.data?.data;
      if (data?.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMsg('WhatsApp coordination link could not be generated.');
      }
    } catch (err) {
      console.error('WhatsApp error:', err);
      setErrorMsg(err.response?.data?.message || 'Could not retrieve WhatsApp contact details.');
    } finally {
      setWhatsAppLoading(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveShell hideSidebarOnDesktop={true} customMobileHeader={<AppHeader title="Booking Details" backTo={-1} />}>
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start animate-pulse">
            <div className="lg:col-span-7 space-y-6">
              <div className="h-48 bg-white rounded-[28px] border border-[#F4E3D8]" />
              <div className="h-64 bg-white rounded-[28px] border border-[#F4E3D8]" />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="h-44 bg-white rounded-[28px] border border-[#F4E3D8]" />
              <div className="h-60 bg-white rounded-[28px] border border-[#F4E3D8]" />
            </div>
          </div>
        </div>
      </ResponsiveShell>
    );
  }

  const travel = booking?.travelId || booking?.travel;
  const isOffer = travel?.type === 'offer';
  const isPending = booking?.status === 'pending';
  const isConfirmed = booking?.status === 'confirmed' || booking?.status === 'accepted';
  const isCancelled = booking?.status === 'cancelled';
  const isCompleted = booking?.status === 'completed';

  // Role Resolution: Strictly identify viewing user vs counterpart using Clerk IDs
  const currentUserId = user?.id;
  const isOwner = Boolean(currentUserId && booking?.ownerId === currentUserId);
  const isPassenger = Boolean(currentUserId && booking?.passengerId === currentUserId);

  // If Post Owner (Student A) is viewing: peer is Requester (Student B).
  // If Requester (Student B) is viewing: peer is Post Owner / Host (Student A).
  const peerStudent = isOwner 
    ? booking?.passengerStudent 
    : (booking?.ownerStudent || travel?.student);

  const peerName = isOwner
    ? (booking?.passengerStudent?.name || booking?.passengerName || 'Campus Requester')
    : (booking?.ownerStudent?.name || travel?.student?.name || 'Ride Host');

  const peerImage = isOwner
    ? (booking?.passengerStudent?.imageUrl || booking?.passengerImage || null)
    : (booking?.ownerStudent?.imageUrl || travel?.student?.imageUrl || null);

  const peerAvatarId = isOwner
    ? (booking?.passengerStudent?.avatarId || 'm1')
    : (booking?.ownerStudent?.avatarId || travel?.student?.avatarId || 'm1');

  const peerCollege = isOwner
    ? (booking?.passengerStudent?.college || 'VIT, Bhopal')
    : (booking?.ownerStudent?.college || travel?.student?.college || 'VIT, Bhopal');

  const peerRoleLabel = isOwner ? 'Ride Requester' : (isOffer ? 'Ride Host' : 'Ride Poster');

  const requestedSeats = booking?.requestedSeats || booking?.seatsBooked || 1;
  const seatPrice = travel?.pricePerSeat ?? 350;
  const totalAmount = booking?.totalPrice || booking?.totalAmount || (requestedSeats * seatPrice);

  const formattedDate = travel?.travelDate 
    ? new Date(travel.travelDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'Upcoming Travel';

  const formattedTime = typeof travel?.departureTime === 'number'
    ? `${String(Math.floor(travel.departureTime / 60) % 12 || 12).padStart(2, '0')}:${String(travel.departureTime % 60).padStart(2, '0')} ${travel.departureTime >= 720 ? 'PM' : 'AM'}`
    : '08:00 AM';

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Booking Details" backTo={-1} />}
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Top Breadcrumb Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-white border border-[#F4E3D8] flex items-center justify-center group-hover:border-[#FF572E] group-hover:text-[#FF572E] shadow-2xs transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#6E7587] bg-white px-3 py-1 rounded-full border border-[#F4E3D8]">
              #{booking?._id?.slice(-6).toUpperCase()}
            </span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Campus Booking</span>
            </div>
          </div>
        </div>

        {/* MAIN TWO-COLUMN UNIFIED NEW UI LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* LEFT COLUMN: JOURNEY & WHATSAPP COORDINATION (SPAN 7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Page Title & Status Header */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] mb-2 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isOwner 
                    ? `Booking Request from ${peerName}` 
                    : (isOffer ? 'Ride Offer Booking' : 'Ride Request Booking')}
                </span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
                {travel?.source || travel?.from || 'Campus Origin'} → {travel?.destination || travel?.to || 'City Destination'}
              </h1>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-1 font-medium">
                {isOwner 
                  ? `${peerName} requested to join your travel on this route. Coordinate on WhatsApp and confirm.`
                  : 'Direct booking coordination between verified students. Coordinate pickup details on WhatsApp.'}
              </p>
            </div>

            {/* CARD 1: JOURNEY ITINERARY & LIVE STATUS */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[28px] p-5 sm:p-7 border border-[#F4E3D8]/90 shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black text-[#17233C] flex items-center gap-2">
                  <Car className="w-5 h-5 text-[#FF572E]" />
                  <span>Journey Itinerary</span>
                </h2>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    isOffer 
                      ? 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]' 
                      : 'bg-[#F5F3FF] text-[#8B5CF6] border border-[#DDD6FE]'
                  }`}>
                    {isOffer ? '🚗 Ride Offer' : '🙋 Ride Request'}
                  </span>

                  {/* Status Pill Badge */}
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                    isConfirmed 
                      ? 'bg-[#EAF8F0] border-[#BCECD4] text-[#16A34A]'
                      : isPending
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : isCancelled
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}>
                    {isConfirmed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>Confirmed ✓</span>
                      </>
                    ) : isPending ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span>Request Pending</span>
                      </>
                    ) : isCancelled ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                        <span>Cancelled</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span>{booking?.status}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Route Visualizer Track */}
              <div className="bg-[#FFFBF8] rounded-2xl p-4 sm:p-5 border border-[#F4E3D8]">
                <div className="flex items-start gap-3.5">
                  <div className="flex flex-col items-center mt-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#16A34A] ring-4 ring-[#DCFCE7] shrink-0" />
                    <div className="w-0.5 h-12 bg-gradient-to-b from-[#16A34A] via-[#FF572E]/50 to-[#FF572E] my-1" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#FF572E] ring-4 ring-[#FFEBE0] shrink-0" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-4">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-[#6E7587] tracking-wider block">
                        Pickup Location
                      </span>
                      <div className="font-black text-sm sm:text-base text-[#17233C] truncate">
                        {travel?.source || travel?.from || 'Campus Origin'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-[#6E7587] tracking-wider block">
                        Drop Location
                      </span>
                      <div className="font-black text-sm sm:text-base text-[#17233C] truncate">
                        {travel?.destination || travel?.to || 'City Destination'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/70">
                  <span className="text-[10px] font-bold text-[#6E7587] uppercase block">Travel Date</span>
                  <span className="font-black text-xs sm:text-sm text-[#17233C] mt-0.5 flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                    <span className="truncate">{formattedDate}</span>
                  </span>
                </div>

                <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/70">
                  <span className="text-[10px] font-bold text-[#6E7587] uppercase block">Departure</span>
                  <span className="font-black text-xs sm:text-sm text-[#17233C] mt-0.5 flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                    <span className="truncate">{formattedTime}</span>
                  </span>
                </div>

                <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/70 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-[#6E7587] uppercase block">
                    {isOwner ? 'Seats Requested' : 'Reserved Seats'}
                  </span>
                  <span className="font-black text-xs sm:text-sm text-[#17233C] mt-0.5 flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                    <span>{requestedSeats} {requestedSeats === 1 ? 'Seat' : 'Seats'}</span>
                  </span>
                </div>
              </div>

              {/* Notes / Luggage Info if provided */}
              {(booking?.passengerNotes || booking?.notes || travel?.notes) && (
                <div className="p-3 bg-[#FFFBF8] rounded-xl border border-[#F4E3D8]/80 text-xs text-[#6E7587] flex items-start gap-2">
                  <span className="font-bold text-[#17233C] shrink-0">
                    {isOwner ? `${peerName}'s Note:` : 'Notes:'}
                  </span>
                  <span className="italic leading-relaxed">
                    {booking?.passengerNotes || booking?.notes || travel?.notes}
                  </span>
                </div>
              )}
            </motion.div>

            {/* CARD 2: WHATSAPP DIRECT COORDINATION (ALWAYS READY FOR PENDING & CONFIRMED) */}
            {!isCancelled && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white rounded-[28px] p-5 sm:p-7 border border-[#F4E3D8]/90 shadow-xs space-y-5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF8F0] border border-[#BCECD4] flex items-center justify-center p-2.5 shadow-2xs shrink-0">
                    <img 
                      src="/whatsapp.png" 
                      alt="WhatsApp" 
                      className="w-7 h-7 object-contain"
                      onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-[#17233C]">
                      Direct WhatsApp Coordination
                    </h3>
                    <p className="text-xs text-[#6E7587] mt-0.5 font-medium leading-relaxed">
                      {isConfirmed 
                        ? 'Booking is confirmed! Connect directly on WhatsApp to coordinate exact pickup point & luggage.'
                        : `Booking request is pending! Connect directly on WhatsApp with ${peerName} to coordinate.`}
                    </p>
                  </div>
                </div>

                {/* Peer Student Preview Bar */}
                <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar 
                      src={peerImage}
                      avatarId={peerAvatarId}
                      name={peerName}
                      size="md"
                      ring
                    />
                    <div className="min-w-0">
                      <div className="font-extrabold text-[#17233C] text-sm truncate">
                        {peerName}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#6E7587] mt-0.5">
                        <span>{peerCollege}</span>
                        <span>•</span>
                        <span className="text-[#16A34A] font-bold inline-flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verified Student</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-[#FFF4ED] text-[#FF572E] text-[10px] font-black uppercase shrink-0">
                    {peerRoleLabel}
                  </span>
                </div>

                {/* Big WhatsApp One-Click Action Button */}
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  disabled={whatsAppLoading}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white shadow-lg shadow-[#25D366]/25 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {whatsAppLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Opening WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <img 
                        src="/whatsapp.png" 
                        alt="WhatsApp" 
                        className="w-6 h-6 object-contain shrink-0"
                        onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }}
                      />
                      <span>Chat with {peerName} on WhatsApp</span>
                      <ExternalLink className="w-4 h-4 opacity-80" />
                    </>
                  )}
                </button>

                {/* Privacy Callout */}
                <div className="p-3 bg-[#FFFBF8] rounded-xl border border-[#F4E3D8] flex items-center gap-2.5 text-[11px] text-[#6E7587]">
                  <Lock className="w-4 h-4 text-[#16A34A] shrink-0" />
                  <span>Campus Privacy Guarantee: WhatsApp contact details are shared exclusively between verified ride participants.</span>
                </div>
              </motion.div>
            )}

          </div>


          {/* RIGHT COLUMN: PEER PROFILE, FARE & ROLE-BASED ACTIONS (SPAN 5) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
            
            {/* CARD 3: VERIFIED PEER PROFILE (SHOWS REQUESTER FOR OWNER, SHOWS HOST FOR PASSENGER) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#6E7587]">
                  {peerRoleLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#3B82F6] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE]">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified Student</span>
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <Avatar 
                  src={peerImage}
                  avatarId={peerAvatarId}
                  name={peerName}
                  size="lg" 
                  ring 
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base truncate">
                    {peerName}
                  </h3>
                  
                  <div className="flex items-center gap-1 text-xs text-[#6E7587] mt-0.5">
                    <span>{peerCollege}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>4.9</span>
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-[#FFF4ED] text-[#FF572E] text-[11px] font-bold">
                    {isOwner ? (
                      <>
                        <Users className="w-3 h-3" />
                        <span>Requested {requestedSeats} Seat(s)</span>
                      </>
                    ) : (
                      <>
                        <Car className="w-3 h-3" />
                        <span>{travel?.carModel || (isOffer ? 'Campus Carpool' : 'Campus Peer')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 4: FARE & SEAT BREAKDOWN */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-[#17233C] text-base">Booking Breakdown</h3>
                <span className="text-[11px] font-bold text-[#6E7587]">Cost Split</span>
              </div>

              <div className="space-y-2.5 text-xs text-[#6E7587]">
                <div className="flex items-center justify-between">
                  <span>Base Seat Price</span>
                  <span className="font-extrabold text-[#17233C]">{formatCurrency(seatPrice)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{isOwner ? 'Requested Seats' : 'Reserved Seats'}</span>
                  <span className="font-extrabold text-[#17233C]">× {requestedSeats}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#F4E3D8]/60">
                  <span>Subtotal Share</span>
                  <span className="font-extrabold text-[#17233C]">{formatCurrency(totalAmount)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>HelpU Platform Fee</span>
                    <span className="text-[10px] bg-[#EDFAF3] text-[#16A34A] px-1.5 py-0.2 rounded font-bold">Free</span>
                  </span>
                  <span className="font-bold text-[#16A34A]">₹0</span>
                </div>
              </div>

              {/* Total Row */}
              <div className="pt-3 border-t border-[#F4E3D8] flex items-center justify-between bg-[#FFFBF8] -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-5 sm:p-6 rounded-b-[28px]">
                <div>
                  <span className="text-[11px] font-extrabold text-[#6E7587] uppercase tracking-wider block">
                    Total Share
                  </span>
                  <span className="text-[10px] text-[#6E7587]">
                    Pay directly upon meeting
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-[#FF572E] tracking-tight">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* NOTICES: SUCCESS & ERROR */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 text-xs font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{successMsg}</p>
                </motion.div>
              )}

              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-xs font-bold"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CARD 5: ROLE-BASED ACTION CONTROLS */}
            <div className="space-y-3">
              {isPending && (
                <div className="space-y-2.5">
                  {/* Owner View: Show Confirm Booking */}
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={confirming}
                      className="w-full py-3.5 px-6 rounded-full font-black text-sm bg-[#17233C] hover:bg-[#233252] active:scale-[0.99] text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{confirming ? 'Confirming Reservation...' : 'Confirm Booking'}</span>
                    </button>
                  ) : (
                    /* Requester View: Show Request Pending indicator (NO Confirm Booking!) */
                    <div className="w-full py-3 px-6 rounded-full font-black text-sm bg-amber-500 text-white opacity-95 flex items-center justify-center gap-2 shadow-xs cursor-default">
                      <Clock className="w-4 h-4 stroke-[2.5] animate-pulse" />
                      <span>Request Pending</span>
                    </div>
                  )}

                  {/* WhatsApp Button: Available for BOTH participants immediately */}
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    disabled={whatsAppLoading}
                    className="w-full py-3.5 px-6 rounded-full font-black text-sm bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white shadow-md shadow-[#25D366]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <img 
                      src="/whatsapp.png" 
                      alt="WhatsApp" 
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }}
                    />
                    <span>Chat on WhatsApp</span>
                  </button>

                  {/* Cancel / Decline Button */}
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer text-center"
                  >
                    {cancelling ? 'Processing...' : (isOwner ? 'Decline Request' : 'Cancel Request')}
                  </button>
                </div>
              )}

              {isConfirmed && (
                <div className="space-y-2.5">
                  <div className="w-full py-3 px-6 rounded-full font-black text-sm bg-emerald-600 text-white flex items-center justify-center gap-2 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Booking Confirmed ✓</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    disabled={whatsAppLoading}
                    className="w-full py-3.5 px-6 rounded-full font-black text-sm bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white shadow-md shadow-[#25D366]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <img 
                      src="/whatsapp.png" 
                      alt="WhatsApp" 
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }}
                    />
                    <span>Chat on WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer text-center"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                  </button>
                </div>
              )}

              {isCancelled && (
                <div className="space-y-2.5">
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-center font-bold text-xs">
                    This booking has been cancelled.
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/rides/offer')}
                    className="w-full py-3 px-5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Browse Active Campus Rides →
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate('/posts')}
                className="w-full py-2 text-xs font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer text-center"
              >
                View all My Posts & Bookings
              </button>
            </div>

            {/* CARD 6: TRUST & SAFETY GUARANTEE */}
            <div className="p-4 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] text-[11px] text-[#6E7587] space-y-1.5">
              <div className="flex items-center gap-1.5 font-extrabold text-[#17233C]">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>HelpU Campus Guarantee</span>
              </div>
              <p className="leading-relaxed">
                All rides are coordinated between verified students. Pay directly via UPI or cash upon meeting.
              </p>
            </div>

          </div>

        </div>

      </div>
    </ResponsiveShell>
  );
}
