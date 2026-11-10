import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { useAuthProfile } from '../context/AuthProfileContext';
import { 
  Car, MapPin, Calendar, Clock, Users, ShieldCheck, 
  ArrowRight, ArrowLeft, Minus, Plus, Phone, Mail, 
  User as UserIcon, FileText, CheckCircle2, AlertCircle, 
  Sparkles, Lock, Info, Star, MessageSquare, Check, X
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { CancelBookingModal } from '../components/ui/CancelBookingModal';
import { GuestAuthPromptModal } from '../components/auth/GuestAuthPromptModal';
import { invalidateBookingQueries } from '../lib/queryClient';
import { 
  getTravelById, 
  getProfile, 
  createBooking, 
  getMyBookings, 
  getReceivedBookings, 
  confirmBooking, 
  cancelBooking, 
  getWhatsAppDetails,
  respondBooking 
} from '../lib/api';
import { formatCurrency } from '../lib/utils';
import {
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
  generateIdempotencyKey,
} from '../utils/guestDraft';

export default function RideDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { isSignedIn } = useUser();
  const { hasWhatsApp } = useAuthProfile();

  // Data states
  const [travel, setTravel] = useState(null);
  const [profile, setProfile] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [receivedBookings, setReceivedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Form states
  const [seats, setSeats] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Action states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isWhatsAppLoading, setIsWhatsAppLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelModalError, setCancelModalError] = useState('');
  const [pendingCancelId, setPendingCancelId] = useState(null);

  // Guest booking draft state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isBookingDraftRestored, setIsBookingDraftRestored] = useState(false);
  const idempotencyKeyRef = useRef(null);

  // 1. Fetch live ride details, passenger profile, and bookings on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    try {
      const [travelRes, profileRes, myBookingsRes, receivedRes] = await Promise.allSettled([
        getTravelById(id),
        getProfile(),
        getMyBookings(),
        getReceivedBookings()
      ]);

      if (travelRes.status === 'fulfilled') {
        const tData = travelRes.value.data?.data || travelRes.value.data?.travel || travelRes.value.data;
        setTravel(tData);
      } else {
        const errMsg = travelRes.reason?.response?.data?.message || travelRes.reason?.message || 'Could not load ride details.';
        setFetchError(errMsg);
      }

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data || null);
      }

      if (myBookingsRes.status === 'fulfilled') {
        const raw = myBookingsRes.value.data?.data || myBookingsRes.value.data?.bookings || myBookingsRes.value.data || [];
        setMyBookings(Array.isArray(raw) ? raw : []);
      }

      if (receivedRes.status === 'fulfilled') {
        const raw = receivedRes.value.data?.data || receivedRes.value.data?.bookings || receivedRes.value.data || [];
        setReceivedBookings(Array.isArray(raw) ? raw : []);
      }
    } catch {
      setFetchError('Failed to load ride information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Auto-fill passenger details from authenticated user and student profile
  useEffect(() => {
    if (profile?.name) {
      setFullName(profile.name);
    } else if (user?.fullName) {
      setFullName(user.fullName);
    } else if (user?.firstName) {
      setFullName(`${user.firstName} ${user.lastName || ''}`.trim());
    }

    if (profile?.email) {
      setEmail(profile.email);
    } else if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }

    const savedPhone = (profile?.whatsappNumber || profile?.phone || user?.primaryPhoneNumber?.phoneNumber || '').trim();
    if (savedPhone) {
      setPhone(savedPhone);
    }
  }, [profile, user]);

  // 2b. Restore booking draft if present (guest returning after authentication)
  //     Drafts override auto-fill to preserve whatever the guest typed.
  useEffect(() => {
    const draft = getBookingDraft();
    if (!draft || !draft.data) return;
    // Only restore if the draft is for this ride
    if (draft.data.travelId && draft.data.travelId !== id) return;
    const d = draft.data;
    if (d.fullName) setFullName(d.fullName);
    if (d.email)    setEmail(d.email);
    if (d.phone)    setPhone(d.phone);
    if (d.notes)    setNotes(d.notes);
    if (d.seats)    setSeats(Number(d.seats));
    setIsBookingDraftRestored(true);
  }, [id]);

  // 3. Computed calculations
  const isOffer = travel?.type === 'offer';

  const pricePerSeat = useMemo(() => {
    return typeof travel?.pricePerSeat === 'number' && travel.pricePerSeat >= 0
      ? travel.pricePerSeat
      : 350;
  }, [travel]);

  const maxAvailableSeats = useMemo(() => {
    if (!travel) return 1;
    if (isOffer) {
      if (typeof travel.availableSeats === 'number') {
        return Math.max(0, travel.availableSeats);
      }
      const total = travel.seats || 4;
      const booked = travel.bookedSeats || 0;
      return Math.max(0, total - booked);
    }
    // For request posts: seats requested
    return travel.seats || 1;
  }, [travel, isOffer]);

  // Ensure seats stay within valid range
  useEffect(() => {
    if (maxAvailableSeats > 0 && seats > maxAvailableSeats) {
      setSeats(maxAvailableSeats);
    }
  }, [maxAvailableSeats, seats]);

  const totalAmount = useMemo(() => {
    return seats * pricePerSeat;
  }, [seats, pricePerSeat]);

  // Check if logged-in user is the ride creator
  const isOwnRide = useMemo(() => {
    if (!travel) return false;
    if (travel.isMine) return true;
    const currentUserId = user?.id;
    return Boolean(currentUserId && travel.userId === currentUserId);
  }, [travel, user]);

  // Bookings received on this post (if owner)
  const postReceivedBookings = useMemo(() => {
    if (!isOwnRide || !receivedBookings.length) return [];
    return receivedBookings.filter((b) => {
      const bTravelId = typeof b.travelId === 'object' ? b.travelId?._id : b.travelId;
      return String(bTravelId) === String(id);
    });
  }, [isOwnRide, receivedBookings, id]);

  const isFulfilled = useMemo(() => {
    if (isOffer || !travel) return false;
    const hasConfirmedInReceived = postReceivedBookings?.some(b => ['accepted', 'confirmed', 'completed'].includes(b.status));
    const hasConfirmedInMy = myBookings?.some(b => ['accepted', 'confirmed', 'completed'].includes(b.status) && (b.travelId?._id === travel._id || b.travelId === travel._id));
    return Boolean(travel.isFulfilled || (travel.bookedSeats || 0) >= 1 || travel.status === 'completed' || hasConfirmedInReceived || hasConfirmedInMy);
  }, [isOffer, travel, postReceivedBookings, myBookings]);

  // Check if current user has an active booking for this travel post
  const myActiveBooking = useMemo(() => {
    if (!myBookings.length) return null;
    return myBookings.find((b) => {
      const bTravelId = typeof b.travelId === 'object' ? b.travelId?._id : b.travelId;
      const matches = String(bTravelId) === String(id);
      const isActive = ['pending', 'accepted', 'confirmed'].includes(b.status);
      return matches && isActive;
    }) || null;
  }, [myBookings, id]);

  // Check if target host has already sent an active booking request to current user for this match
  const reverseActiveBooking = useMemo(() => {
    if (isOwnRide || !receivedBookings.length || !travel) return null;
    const hostUserId = travel.userId;
    return receivedBookings.find((b) => {
      if (b.passengerId !== hostUserId) return false;
      if (!['pending', 'accepted', 'confirmed'].includes(b.status)) return false;

      const bTravel = typeof b.travelId === 'object' ? b.travelId : null;
      if (bTravel) {
        const sameDate = bTravel.travelDate === travel.travelDate;
        const norm = (s) => (s || '').toLowerCase().trim();
        const sameRoute = (
          (norm(bTravel.source) === norm(travel.source) && norm(bTravel.destination) === norm(travel.destination)) ||
          (norm(bTravel.source) === norm(travel.destination) && norm(bTravel.destination) === norm(travel.source))
        );
        return sameDate && sameRoute;
      }
      return true;
    }) || null;
  }, [isOwnRide, receivedBookings, travel]);

  const isPending = useMemo(() => {
    return myActiveBooking?.status === 'pending';
  }, [myActiveBooking]);

  const isConfirmed = useMemo(() => {
    return myActiveBooking?.status === 'confirmed' || myActiveBooking?.status === 'accepted';
  }, [myActiveBooking]);

  const isFull = useMemo(() => {
    return isOffer && maxAvailableSeats < 1 && !isConfirmed && !isPending;
  }, [isOffer, maxAvailableSeats, isConfirmed, isPending]);

  // Date and Time formatting
  const formattedDate = useMemo(() => {
    if (!travel?.travelDate) return 'Upcoming Date';
    const d = new Date(travel.travelDate);
    if (isNaN(d.getTime())) return 'Upcoming Date';
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [travel?.travelDate]);

  const formattedTime = useMemo(() => {
    if (typeof travel?.departureTime === 'number') {
      const hours = Math.floor(travel.departureTime / 60);
      const mins = travel.departureTime % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${String(displayHours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    }
    return 'Flexible Time';
  }, [travel?.departureTime]);

  // 4. Validate Form
  const validateForm = () => {
    const errors = {};
    if (!fullName.trim()) {
      errors.fullName = 'Please enter your full name.';
    }
    if (!email.trim() || !email.includes('@')) {
      errors.email = 'Please provide a valid email address.';
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'Please enter a valid 10-digit mobile number for coordination.';
    }
    if (seats < 1) {
      errors.seats = 'Please select at least 1 seat.';
    }
    if (seats > maxAvailableSeats && isOffer) {
      errors.seats = `Only ${maxAvailableSeats} seat(s) available for this ride.`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 5. Submit Booking Request (Creates Pending Request, does NOT decrease seats)
  const handleBookSeat = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');
    setSuccessNotice('');

    // ── GUEST INTERCEPTION ──────────────────────────────────────────────────
    // If the user is not signed in, save passenger form data + ride ID and
    // prompt Google authentication. Never call the API for unauthenticated users.
    if (!isSignedIn) {
      saveBookingDraft(
        travel?._id || id,
        {
          fullName: fullName.trim(),
          email:    email.trim(),
          phone:    phone.trim(),
          notes:    notes.trim(),
          seats,
        },
        `/rides/${id}`
      );
      setShowAuthModal(true);
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    if (isOwnRide) {
      setSubmitError('You cannot book your own ride post.');
      return;
    }

    if (isPending) {
      setSubmitError('You already have a pending booking request for this ride.');
      return;
    }

    if (reverseActiveBooking) {
      setSubmitError('A booking request between these matching posts already exists. The student has already sent you a request.');
      return;
    }

    if (isConfirmed) {
      setSubmitError('You already have a confirmed booking for this ride.');
      return;
    }

    if (isFull) {
      setSubmitError('This ride is currently FULL.');
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Generate or reuse idempotency key for this booking attempt
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }

    try {
      const targetTravelId = travel?._id || id;
      const bookingPayload = {
        travelId: targetTravelId,
        requestedSeats: Number(seats),
        seatsBooked: Number(seats),
        passengerName: fullName.trim(),
        passengerEmail: email.trim(),
        passengerPhone: phone.trim(),
        passengerNotes: notes.trim(),
        notes: notes.trim(),
        totalPrice: totalAmount
      };

      const options = {
        headers: { 'Idempotency-Key': idempotencyKeyRef.current }
      };

      const res = await createBooking(bookingPayload, options);
      const created = res.data?.data || res.data;

      // Success: clear idempotency key and booking draft
      idempotencyKeyRef.current = null;
      clearBookingDraft();
      setIsBookingDraftRestored(false);
      invalidateBookingQueries();

      // Update state locally and notify user
      setMyBookings((prev) => [created, ...prev]);
      setSuccessNotice('Booking request sent! You can now coordinate on WhatsApp with the student.');
      loadData();
    } catch (err) {
      console.error('Booking request failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit booking request. Please try again.';
      setSubmitError(msg);
      if (err.response?.status === 409 || err.code === 'DUPLICATE_BOOKING_REQUEST') {
        // 409 from idempotency or duplicate: do NOT clear key; allow safe retry
        loadData();
      }
      // For any other failure, keep idempotencyKeyRef so the user can retry safely
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Connect via WhatsApp using secure backend coordination URL
  const handleOpenWhatsApp = async (bookingId) => {
    const targetBookingId = bookingId || myActiveBooking?._id || reverseActiveBooking?._id;
    if (!targetBookingId) return;

    setIsWhatsAppLoading(true);
    setSubmitError('');

    try {
      const res = await getWhatsAppDetails(targetBookingId);
      const data = res.data?.data;
      if (data?.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
      } else {
        setSubmitError('WhatsApp coordination link could not be generated.');
      }
    } catch (err) {
      console.error('WhatsApp coordination error:', err);
      setSubmitError(err.response?.data?.message || 'Could not retrieve WhatsApp contact details.');
    } finally {
      setIsWhatsAppLoading(false);
    }
  };

  // 7. Explicit Confirm Booking (Decreases seats atomically)
  const handleExplicitConfirm = async (bookingId) => {
    const targetBookingId = bookingId || myActiveBooking?._id;
    if (!targetBookingId || isConfirming) return;

    setIsConfirming(true);
    setSubmitError('');
    setSuccessNotice('');

    try {
      await confirmBooking(targetBookingId);
      invalidateBookingQueries();
      setSuccessNotice('Booking confirmed! Seats have been reserved successfully.');
      loadData();
    } catch (err) {
      console.error('Confirm booking error:', err);
      const errMsg = err.response?.data?.message || err.message || '';
      if (errMsg.toLowerCase().includes('only accepted bookings')) {
        try {
          await respondBooking(targetBookingId, { action: 'accept' });
          await confirmBooking(targetBookingId);
          invalidateBookingQueries();
          setSuccessNotice('Booking confirmed! Seats have been reserved successfully.');
          loadData();
          return;
        } catch (fallbackErr) {
          setSubmitError(fallbackErr.response?.data?.message || fallbackErr.message || 'Failed to confirm booking.');
          return;
        }
      }
      setSubmitError(errMsg || 'Failed to confirm booking.');
    } finally {
      setIsConfirming(false);
    }
  };

  // 8. Cancel Booking via Helpu Modal
  const handleCancelBooking = (bookingId) => {
    const targetBookingId = bookingId || myActiveBooking?._id;
    if (!targetBookingId || isCancelling) return;
    setPendingCancelId(targetBookingId);
    setCancelModalError('');
    setShowCancelModal(true);
  };

  const handleConfirmCancelModal = async () => {
    if (!pendingCancelId || isCancelling) return;

    setIsCancelling(true);
    setCancelModalError('');
    setSubmitError('');
    setSuccessNotice('');

    try {
      await cancelBooking(pendingCancelId);
      invalidateBookingQueries();
      setSuccessNotice('Booking cancelled successfully.');
      setShowCancelModal(false);
      setPendingCancelId(null);
      loadData();
    } catch (err) {
      console.error('Cancel booking error:', err);
      const msg = err.response?.data?.message || 'Failed to cancel booking. Please try again.';
      setCancelModalError(msg);
      setSubmitError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={
        <AppHeader 
          title={isOffer ? 'Ride Offer Details' : 'Find Ride Details'}
          backTo={-1} 
        />
      }
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Navigation Breadcrumb / Go Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/rides/offer')}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-white border border-[#F4E3D8] flex items-center justify-center group-hover:border-[#FF572E] group-hover:text-[#FF572E] shadow-2xs transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            <span>Back</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Campus Peers</span>
          </div>
        </div>

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start animate-pulse">
            <div className="lg:col-span-7 space-y-6">
              <div className="h-48 bg-white rounded-[28px] border border-[#F4E3D8]" />
              <div className="h-80 bg-white rounded-[28px] border border-[#F4E3D8]" />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="h-44 bg-white rounded-[28px] border border-[#F4E3D8]" />
              <div className="h-60 bg-white rounded-[28px] border border-[#F4E3D8]" />
            </div>
          </div>
        ) : fetchError || !travel ? (
          /* NOT FOUND / ERROR CARD */
          <div className="bg-white rounded-[32px] p-8 sm:p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="font-black text-[#17233C] text-xl">Ride Not Available</h2>
            <p className="text-xs sm:text-sm text-[#6E7587] leading-relaxed">
              {fetchError || 'The ride you are attempting to view could not be found or may have expired.'}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-bold rounded-full shadow-sm transition-all cursor-pointer"
              >
                Go to Rides →
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* MAIN TWO-COLUMN UNIFIED BOOKING CONFIRMATION & DETAILS LAYOUT             */
          /* Same UI for BOTH Offer and Request                                        */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* LEFT COLUMN: RIDE ROUTE DETAILS & PASSENGER FORM (SPAN 7) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* PAGE TITLE & BADGE */}
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] mb-2 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isOffer ? 'Ride Offer' : 'Find Ride'}</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
                  {travel.source} → {travel.destination}
                </h1>
                <p className="text-xs sm:text-sm text-[#6E7587] mt-1 font-medium">
                  {isOffer 
                    ? 'Review ride details, select seats, and coordinate directly with the student.'
                    : (isFulfilled
                        ? 'This student has found a ride! Ride booking is confirmed.'
                        : 'Connect with this verified student looking for a travel buddy on this route.')}
                </p>
              </div>

              {/* CARD 1: JOURNEY & ROUTE DETAILS */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[28px] p-5 sm:p-7 border border-[#F4E3D8]/90 shadow-xs"
              >
                <div className="flex items-center justify-between mb-5">
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
                      {isOffer ? '🚗 Ride Offer' : '🙋 Find Ride'}
                    </span>
                    {isOffer ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                        maxAvailableSeats > 0 
                          ? 'bg-[#EAF8F0] border-[#BCECD4] text-[#16A34A]'
                          : 'bg-red-50 border-red-200 text-red-600'
                      }`}>
                        {maxAvailableSeats > 0 ? `${maxAvailableSeats} seats left` : 'FULL'}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                        isFulfilled
                          ? 'bg-[#EAF8F0] border-[#BCECD4] text-[#16A34A]'
                          : 'bg-[#FFF4ED] border-[#FDE0D0] text-[#FF572E]'
                      }`}>
                        {isFulfilled ? '1 seat found' : '1 seat needed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Route Visualizer */}
                <div className="bg-[#FFFBF8] rounded-2xl p-4 sm:p-5 border border-[#F4E3D8] mb-5">
                  <div className="flex items-start gap-3.5">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#16A34A] ring-4 ring-[#DCFCE7] shrink-0" />
                      <div className="w-0.5 h-12 bg-gradient-to-b from-[#16A34A] to-[#FF572E] my-1 border-dashed" />
                      <div className="w-3.5 h-3.5 rounded-full bg-[#FF572E] ring-4 ring-[#FFEBE0] shrink-0" />
                    </div>

                    <div className="flex flex-col justify-between flex-1 space-y-6">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block">
                          Pickup Location
                        </span>
                        <div className="font-black text-[#17233C] text-sm sm:text-base mt-0.5">
                          {travel.source || travel.from || 'Campus Gate'}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block">
                          Drop-off Destination
                        </span>
                        <div className="font-black text-[#17233C] text-sm sm:text-base mt-0.5">
                          {travel.destination || travel.to || 'City Destination'}
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
                      {isOffer ? 'Available Seats' : 'Seat Status'}
                    </span>
                    <span className="font-black text-xs sm:text-sm text-[#17233C] mt-0.5 flex items-center gap-1.5 truncate">
                      <Users className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                      <span>{isOffer ? `${maxAvailableSeats} available` : (isFulfilled ? '1 seat found' : '1 seat needed')}</span>
                    </span>
                  </div>
                </div>

                {/* Post Creator's Notes/Preferences if provided */}
                {(travel.notes || travel.description) && (
                  <div className="p-3 bg-[#FFFBF8] rounded-xl border border-[#F4E3D8]/80 text-xs flex items-start gap-2">
                    <FileText className="w-4 h-4 text-[#FF572E] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-[#17233C]">Creator's Note: </span>
                      <span className="text-[#6E7587] font-medium leading-relaxed">
                        {travel.notes || travel.description}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* CARD 2: PASSENGER & RESERVATION DETAILS (SAME FOR OFFER AND REQUEST) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white rounded-[28px] p-5 sm:p-7 border border-[#F4E3D8]/90 shadow-xs space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-black text-[#17233C] flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-[#FF572E]" />
                    <span>{isOwnRide ? 'Received Booking Requests' : 'Booking Coordination Details'}</span>
                  </h2>
                  <span className="text-[11px] font-bold text-[#6E7587]">
                    {isOwnRide ? 'Host Dashboard' : 'Verified Student Info'}
                  </span>
                </div>

                {isOwnRide ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-[#17233C] block">Your Published Travel</span>
                        <p className="text-xs text-[#6E7587] mt-0.5">
                          {postReceivedBookings.length > 0
                            ? `You have ${postReceivedBookings.length} booking request(s) on this ride post.`
                            : 'No booking requests received yet. Fellow students can send requests here.'}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#FFF4ED] text-[#FF572E] text-xs font-black">
                        Host View
                      </span>
                    </div>

                    {postReceivedBookings.length > 0 ? (
                      <div className="space-y-3">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6E7587]">
                          Received Requests ({postReceivedBookings.length})
                        </h3>
                        {postReceivedBookings.map((b) => (
                          <div key={b._id} className="p-4 bg-white rounded-2xl border border-[#F4E3D8] shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={b.passengerName || 'Campus Student'} size="sm" ring />
                                <div>
                                  <span className="font-extrabold text-[#17233C] text-sm block">{b.passengerName || 'Campus Student'}</span>
                                  <span className="text-[11px] text-[#6E7587]">
                                    {b.requestedSeats} Seat(s) • Total: {formatCurrency(b.totalPrice || b.requestedSeats * pricePerSeat)}
                                  </span>
                                </div>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {b.status}
                              </span>
                            </div>

                            {/* Action Buttons for this request */}
                            <div className="flex items-center gap-2 pt-1 border-t border-[#F4E3D8]/60">
                              <button
                                type="button"
                                onClick={() => handleOpenWhatsApp(b._id)}
                                className="flex-1 py-2 px-3 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <img src="/whatsapp.png" alt="WhatsApp" className="w-3.5 h-3.5 object-contain shrink-0" onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} />
                                <span>WhatsApp</span>
                              </button>

                              {b.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleExplicitConfirm(b._id)}
                                  disabled={isConfirming}
                                  className="flex-1 py-2 px-3 bg-[#17233C] hover:bg-[#233252] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Confirm</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => navigate(`/bookings/${b._id}`)}
                                className="px-3 py-2 bg-[#FFF4ED] hover:bg-[#FFEBE0] text-[#FF572E] font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>Details →</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-[#8C93A4] font-medium bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
                        When students request a seat on this ride, their requests will appear here with instant WhatsApp coordination and confirmation.
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleBookSeat} className="space-y-4">
                    
                    {/* Booking Draft Restored Banner */}
                    {isBookingDraftRestored && (
                      <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-[#92400E]">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
                          <span><strong>Draft restored:</strong> Please review your passenger details before clicking 'Book Seat'.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            clearBookingDraft();
                            setIsBookingDraftRestored(false);
                            setFullName('');
                            setEmail('');
                            setPhone('');
                            setNotes('');
                            setSeats(1);
                          }}
                          className="text-[#B45309] font-bold underline hover:no-underline text-[11px] shrink-0 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    {/* Full Name Input */}
                    <div>
                      <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                        Full Name <span className="text-[#FF572E]">*</span>
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: null }));
                        }}
                        disabled={isPending || isConfirmed}
                        placeholder="e.g. Shubham Narayan"
                        className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all disabled:opacity-75"
                      />
                      {fieldErrors.fullName && (
                        <span className="text-[11px] text-red-500 font-bold mt-1 block">{fieldErrors.fullName}</span>
                      )}
                    </div>

                    {/* Contact Fields Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                          WhatsApp Contact Number <span className="text-[#FF572E]">*</span>
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: null }));
                          }}
                          disabled={isPending || isConfirmed}
                          placeholder="+91 98765 43210"
                          className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all disabled:opacity-75"
                        />
                        {fieldErrors.phone && (
                          <span className="text-[11px] text-red-500 font-bold mt-1 block">{fieldErrors.phone}</span>
                        )}
                      </div>

                      {/* SEATS STEPPER SELECTOR */}
                      <div>
                        <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                          Number of Seats <span className="text-[#FF572E]">*</span>
                        </label>
                        <div className="flex items-center justify-between bg-[#FFFBF8] rounded-xl p-1.5 border border-[#F4E3D8]">
                          <button
                            type="button"
                            onClick={() => setSeats((s) => Math.max(1, s - 1))}
                            disabled={seats <= 1 || isPending || isConfirmed}
                            className="w-8 h-8 rounded-lg bg-white border border-[#F4E3D8] flex items-center justify-center text-[#17233C] hover:border-[#FF572E] hover:text-[#FF572E] active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>

                          <div className="text-center px-4">
                            <span className="font-black text-[#17233C] text-base block">{seats}</span>
                            <span className="text-[10px] font-bold text-[#6E7587]">{seats === 1 ? 'seat' : 'seats'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSeats((s) => Math.min(maxAvailableSeats || 4, s + 1))}
                            disabled={seats >= (maxAvailableSeats || 4) || isPending || isConfirmed}
                            className="w-8 h-8 rounded-lg bg-[#FF572E] text-white flex items-center justify-center hover:bg-[#E64A22] active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Optional Notes */}
                    <div>
                      <label className="block text-xs font-bold text-[#17233C] mb-1.5 flex items-center justify-between">
                        <span>Luggage / Pickup Notes</span>
                        <span className="text-[11px] text-[#6E7587] font-normal">Optional</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isPending || isConfirmed}
                        placeholder="e.g. Carrying 1 backpack. Will meet at Main Gate."
                        className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-medium text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/15 focus:outline-none transition-all resize-none disabled:opacity-75"
                      />
                    </div>

                    {/* Privacy Callout */}
                    <div className="p-3 bg-[#FFFBF8] rounded-xl border border-[#F4E3D8] flex items-center gap-2.5 text-[11px] text-[#6E7587]">
                      <Lock className="w-4 h-4 text-[#16A34A] shrink-0" />
                      <span>Campus Privacy: Contact details are shared only between verified students coordinating this booking.</span>
                    </div>

                  </form>
                )}
              </motion.div>

            </div>


            {/* RIGHT COLUMN: HOST PROFILE, FARE BREAKDOWN & ACTIONS (SPAN 5) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
              
              {/* CARD 3: HOST / CREATOR PROFILE */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#6E7587]">
                    {isOffer ? 'Ride Host' : 'Ride Finder'}
                  </span>
                  {Boolean(travel.student?.isVerified) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#16A34A] bg-[#EDFAF3] px-2.5 py-0.5 rounded-full border border-[#BCECD4]">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified Student</span>
                    </span>
                  )}
                  {(travel.gender || travel.student?.gender) && 
                    (travel.gender || travel.student?.gender) !== 'Prefer not to say' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FF572E] bg-[#FFF4ED] px-2.5 py-0.5 rounded-full border border-[#FDE0D0]">
                      <span>{travel.gender || travel.student?.gender}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3.5">
                  <Avatar 
                    src={travel.student?.imageUrl || travel.authorImage || (isOwnRide ? user?.imageUrl : null)}
                    name={travel.student?.name || travel.authorName || 'Campus Student'}
                    size="lg" 
                    ring 
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base truncate">
                      {travel.student?.name || travel.studentName || 'Campus Student'}
                    </h3>
                    
                    <div className="flex items-center gap-1 text-xs text-[#6E7587] mt-0.5">
                      <span>{travel.student?.college || 'VIT, Bhopal'}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>4.9</span>
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-[#FFF4ED] text-[#FF572E] text-[11px] font-bold">
                      <Car className="w-3 h-3" />
                      <span>{travel.carModel || (isOffer ? 'Campus Carpool' : 'Needs Ride')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* CARD 4: FARE BREAKDOWN */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-[#17233C] text-base">Fare Breakdown</h3>
                  <span className="text-[11px] font-bold text-[#6E7587]">Cost Split</span>
                </div>

                <div className="space-y-2.5 text-xs text-[#6E7587]">
                  <div className="flex items-center justify-between">
                    <span>Base Seat Price</span>
                    <span className="font-extrabold text-[#17233C]">{formatCurrency(pricePerSeat)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>{isOffer ? 'Reserved Seats' : 'Requested Seats'}</span>
                    <span className="font-extrabold text-[#17233C]">× {seats}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#F4E3D8]/60">
                    <span>Subtotal</span>
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
                <div className="pt-3 border-t border-[#F4E3D8] flex items-center justify-between bg-[#FFFBF8] -mx-5 -mb-5 p-5 rounded-b-[28px]">
                  <div>
                    <span className="text-[11px] font-extrabold text-[#6E7587] uppercase tracking-wider block">
                      Total Payable
                    </span>
                    <span className="text-[10px] text-[#6E7587]">
                      Direct peer payment upon boarding
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-black text-[#FF572E] tracking-tight">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* SUCCESS NOTICE BANNER */}
              <AnimatePresence>
                {successNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 text-xs font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{successNotice}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ERROR ALERT BANNER */}
              <AnimatePresence>
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-xs font-bold"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{submitError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* OWN RIDE BANNER & RECEIVED BOOKINGS */}
              {isOwnRide && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Your Published Ride</span>
                      <p className="mt-0.5">You created this ride post.</p>
                    </div>
                  </div>

                  {postReceivedBookings.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-[#F4E3D8] space-y-3">
                      <h4 className="font-black text-xs sm:text-sm text-[#17233C]">Received Booking Requests</h4>
                      {postReceivedBookings.map((b) => (
                        <div key={b._id} className="p-3 bg-[#FFFBF8] rounded-xl border border-[#F4E3D8] space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#17233C]">{b.passengerName || 'Campus Student'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {b.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6E7587]">
                            Seats: {b.requestedSeats} • Total: {formatCurrency(b.totalPrice || b.requestedSeats * pricePerSeat)}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsApp(b._id)}
                              className="flex-1 py-1.5 px-3 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <img src="/whatsapp.png" alt="WhatsApp" className="w-3.5 h-3.5 object-contain shrink-0" onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} />
                              <span>WhatsApp</span>
                            </button>
                            {b.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleExplicitConfirm(b._id)}
                                disabled={isConfirming}
                                className="flex-1 py-1.5 px-3 bg-[#17233C] hover:bg-[#233252] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Confirm</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STATUS BANNERS FOR NON-OWNER */}
              {!isOwnRide && isPending && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Request Pending</span>
                    <p className="mt-0.5">
                      Your booking request has been sent! You and the student can coordinate directly on WhatsApp.
                    </p>
                  </div>
                </div>
              )}

              {!isOwnRide && isConfirmed && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Booking Confirmed ✓</span>
                    <p className="mt-0.5">Your seat reservation is confirmed.</p>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS (SAME FOR BOTH OFFER AND REQUEST) */}
              <div className="space-y-3">
                {!isOwnRide ? (
                  <>
                    {reverseActiveBooking ? (
                      <div className="space-y-3 bg-[#FFF7F2] border border-[#FFD9C7] rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-[#FF572E]/10 text-[#FF572E] shrink-0 mt-0.5">
                            <Clock className="w-5 h-5 stroke-[2.5]" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-[#17233C] text-sm">
                              Request Already Received
                            </h4>
                            <p className="text-xs text-[#6E7587] mt-0.5">
                              {travel?.student?.name || travel?.authorName || 'This student'} has already sent you a booking request for this matching ride.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/bookings/${reverseActiveBooking._id}`)}
                            className="w-full py-3 px-4 rounded-full font-black text-xs sm:text-sm bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white shadow-md shadow-[#FF572E]/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>View Incoming Request</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(reverseActiveBooking._id)}
                            disabled={isWhatsAppLoading}
                            className="w-full py-3 px-4 rounded-full font-black text-xs sm:text-sm bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <img src="/whatsapp.png" alt="WhatsApp" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} />
                            <span>Coordinate on WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    ) : !myActiveBooking ? (
                      <div className="space-y-2.5">
                        {isFull ? (
                          <button
                            type="button"
                            disabled
                            className="w-full py-4 px-6 rounded-full font-black text-sm bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed shadow-none"
                          >
                            FULL • No Seats Left
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleBookSeat}
                            disabled={isSubmitting}
                            className="w-full py-4 px-6 rounded-full font-black text-sm bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white shadow-lg shadow-[#FF572E]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Sending Request...</span>
                              </>
                            ) : (
                              <>
                                <span>Book Seat • {formatCurrency(totalAmount)}</span>
                                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                              </>
                            )}
                          </button>
                        )}

                        {/* Contact on WhatsApp: visible from beginning, disabled before booking */}
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitError('Please Book a Seat first.');
                          }}
                          className="w-full py-3.5 px-6 rounded-full font-black text-sm bg-gray-100 hover:bg-gray-200 active:scale-[0.99] text-gray-500 border border-gray-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <img 
                            src="/whatsapp.png" 
                            alt="WhatsApp" 
                            className="w-5 h-5 object-contain grayscale opacity-60 shrink-0" 
                            onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} 
                          />
                          <span>Contact on WhatsApp</span>
                        </button>
                        <p className="text-[10px] text-center text-[#8C93A4] font-medium">
                          Please Book a Seat first to unlock direct WhatsApp coordination.
                        </p>
                      </div>
                    ) : isPending ? (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled
                          className="w-full py-3 px-6 rounded-full font-black text-sm bg-amber-500 text-white opacity-95 cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
                        >
                          <Clock className="w-4 h-4 stroke-[2.5]" />
                          <span>Request Pending</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp()}
                          disabled={isWhatsAppLoading}
                          className="w-full py-3.5 px-6 rounded-full font-black text-sm bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white shadow-md shadow-[#25D366]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <img src="/whatsapp.png" alt="WhatsApp" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} />
                          <span>Contact on WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelBooking()}
                          disabled={isCancelling}
                          className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer text-center"
                        >
                          Cancel Request
                        </button>
                      </div>
                    ) : isConfirmed ? (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled
                          className="w-full py-3 px-6 rounded-full font-black text-sm bg-emerald-600 text-white opacity-95 cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                          <span>Confirmed ✓</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp()}
                          disabled={isWhatsAppLoading}
                          className="w-full py-3.5 px-6 rounded-full font-black text-sm bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.99] text-white shadow-md shadow-[#25D366]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <img src="/whatsapp.png" alt="WhatsApp" className="w-5 h-5 object-contain shrink-0" onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} />
                          <span>Contact on WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelBooking()}
                          disabled={isCancelling}
                          className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer text-center"
                        >
                          Cancel Booking
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3.5 px-6 rounded-full font-bold text-xs bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none"
                  >
                    You are the creator of this ride
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/rides/offer')}
                  className="w-full py-2 text-xs font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer text-center"
                >
                  Browse Other Rides
                </button>
              </div>

              {/* TRUST & SAFETY GUARANTEE */}
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
        )}

      </div>

      {/* Premium Reusable Helpu Booking Cancellation Modal */}
      <CancelBookingModal
        isOpen={showCancelModal}
        onClose={() => {
          if (!isCancelling) {
            setShowCancelModal(false);
            setPendingCancelId(null);
          }
        }}
        onConfirm={handleConfirmCancelModal}
        isCancelling={isCancelling}
        error={cancelModalError}
      />

      {/* Guest Authentication Prompt Modal – Booking Flow */}
      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="PoolMate"
        returnPath={`/rides/${id}`}
      />
    </ResponsiveShell>
  );
}
