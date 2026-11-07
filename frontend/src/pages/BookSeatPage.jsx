import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Car, MapPin, Calendar, Clock, Users, ShieldCheck, 
  ArrowRight, ArrowLeft, Minus, Plus, Phone, Mail, 
  User as UserIcon, FileText, CheckCircle2, AlertCircle, 
  Sparkles, Lock, Info, ChevronRight, Star
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { getTravelById, getProfile, createBooking, getMyBookings } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { invalidateBookingQueries } from '../lib/queryClient';

export default function BookSeatPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  // Ride & Profile States
  const [travel, setTravel] = useState(state?.travel || null);
  const [profile, setProfile] = useState(null);
  const [existingBooking, setExistingBooking] = useState(null);
  const [loading, setLoading] = useState(!state?.travel);
  const [fetchError, setFetchError] = useState('');

  // Form States
  const [seats, setSeats] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // 1. Fetch live ride details, passenger profile, and existing booking on mount
  const loadData = useCallback(async () => {
    if (!state?.travel) {
      setLoading(true);
    }
    setFetchError('');

    try {
      const [travelRes, profileRes, bookingsRes] = await Promise.allSettled([
        id ? getTravelById(id) : Promise.reject(new Error('No ride ID provided')),
        getProfile(),
        getMyBookings()
      ]);

      if (travelRes.status === 'fulfilled') {
        const tData = travelRes.value.data?.data || travelRes.value.data?.travel || travelRes.value.data;
        setTravel(tData);
      } else if (!state?.travel) {
        setFetchError(travelRes.reason?.response?.data?.message || travelRes.reason?.message || 'Could not load ride details.');
      }

      if (profileRes.status === 'fulfilled') {
        const pData = profileRes.value.data?.data || null;
        setProfile(pData);
      }

      if (bookingsRes.status === 'fulfilled') {
        const rawBookings = bookingsRes.value.data?.data || bookingsRes.value.data?.bookings || bookingsRes.value.data || [];
        const bookingsList = Array.isArray(rawBookings) ? rawBookings : [];
        const activeBooking = bookingsList.find((b) => {
          const bTravelId = typeof b.travelId === 'object' ? b.travelId?._id : b.travelId;
          const matches = String(bTravelId) === String(id);
          const isActive = ['pending', 'accepted', 'confirmed'].includes(b.status);
          return matches && isActive;
        });
        setExistingBooking(activeBooking || null);
      }
    } catch (err) {
      if (!state?.travel) {
        setFetchError('Failed to load ride information. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, state?.travel]);

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

    if (profile?.phone) {
      setPhone(profile.phone);
    } else if (user?.primaryPhoneNumber?.phoneNumber) {
      setPhone(user.primaryPhoneNumber.phoneNumber);
    }
  }, [profile, user]);

  // 3. Computed calculations
  const pricePerSeat = useMemo(() => {
    return typeof travel?.pricePerSeat === 'number' && travel.pricePerSeat >= 0
      ? travel.pricePerSeat
      : 350;
  }, [travel]);

  const maxAvailableSeats = useMemo(() => {
    if (!travel) return 1;
    if (typeof travel.availableSeats === 'number') {
      return Math.max(0, travel.availableSeats);
    }
    const total = travel.seats || 4;
    const booked = travel.bookedSeats || 0;
    return Math.max(0, total - booked);
  }, [travel]);

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

  // Check if current user already has an active request for this travel post
  const isPending = useMemo(() => {
    return existingBooking?.status === 'pending';
  }, [existingBooking]);

  const isConfirmed = useMemo(() => {
    return existingBooking?.status === 'confirmed' || existingBooking?.status === 'accepted';
  }, [existingBooking]);

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
    if (seats > maxAvailableSeats) {
      errors.seats = `Only ${maxAvailableSeats} seat(s) available for this ride.`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 5. Submit Booking Request
  const handleConfirmBooking = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');

    if (isOwnRide) {
      setSubmitError('You cannot book your own ride offer.');
      return;
    }

    if (isPending) {
      setSubmitError('You already have a pending booking request for this ride post. Please wait for the host to respond.');
      return;
    }

    if (isConfirmed) {
      setSubmitError('You already have a confirmed booking for this ride post.');
      return;
    }

    if (maxAvailableSeats < 1) {
      setSubmitError('This ride is already fully booked. Please browse other rides.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const targetTravelId = travel?._id || id;
      if (!targetTravelId || typeof targetTravelId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(targetTravelId)) {
        setSubmitError('Invalid travel ID format. Please select an active ride from the campus listing.');
        setIsSubmitting(false);
        return;
      }

      const bookingPayload = {
        travelId: targetTravelId,
        requestedSeats: Number(seats),
        seatsBooked: Number(seats),
        passengerName: fullName.trim(),
        passengerEmail: email.trim(),
        passengerPhone: phone.trim(),
        passengerNotes: notes.trim(),
        passengerImage: user?.imageUrl || profile?.imageUrl || '',
        notes: notes.trim(),
        totalPrice: totalAmount
      };

      const res = await createBooking(bookingPayload);
      const createdBooking = res.data?.data || res.data;
      invalidateBookingQueries();

      // Navigate to My Posts page with success state
      navigate('/posts', {
        replace: true,
        state: {
          highlightId: createdBooking?._id,
          successMessage: 'Your seat reservation request has been submitted to the driver!'
        }
      });
    } catch (err) {
      console.error('Booking confirmation failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit booking request. Please try again.';
      setSubmitError(msg);
      if (err.status === 409 || err.code === 'DUPLICATE_BOOKING_REQUEST' || msg.toLowerCase().includes('already')) {
        loadData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={
        <AppHeader 
          title="Confirm Booking" 
          backTo={-1} 
        />
      }
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Navigation Breadcrumb / Go Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-white border border-[#F4E3D8] flex items-center justify-center group-hover:border-[#FF572E] group-hover:text-[#FF572E] shadow-2xs transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            <span>Back to Ride Details</span>
          </button>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-xs font-black">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Peer Carpooling</span>
          </div>
        </div>

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start animate-pulse">
            <div className="lg:col-span-7 space-y-6">
              <div className="h-44 bg-white rounded-[28px] border border-[#F4E3D8]" />
              <div className="h-80 bg-white rounded-[28px] border border-[#F4E3D8]" />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="h-48 bg-white rounded-[28px] border border-[#F4E3D8]" />
              <div className="h-56 bg-white rounded-[28px] border border-[#F4E3D8]" />
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
              {fetchError || 'The ride you are attempting to book could not be found or may have expired.'}
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
          /* MAIN TWO-COLUMN BOOKING CONFIRMATION LAYOUT                               */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* ======================================================================= */}
            {/* LEFT COLUMN: RIDE ROUTE DETAILS & PASSENGER FORM (SPAN 7)               */}
            {/* ======================================================================= */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* PAGE TITLE & BADGE */}
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] mb-2 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reserve Seats</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
                  Confirm Your Ride Booking
                </h1>
                <p className="text-xs sm:text-sm text-[#6E7587] mt-1 font-medium">
                  Review your campus route details, verify passenger info, and reserve seats.
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

                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#EAF8F0] border border-[#BCECD4] text-[#16A34A]">
                    {maxAvailableSeats > 0 ? `${maxAvailableSeats} seats available` : 'Sold Out'}
                  </span>
                </div>

                {/* Route Visualizer */}
                <div className="bg-[#FFFBF8] rounded-2xl p-4 sm:p-5 border border-[#F4E3D8] mb-5">
                  <div className="flex items-start gap-3.5">
                    {/* Dots and Connecting Vertical Line */}
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#16A34A] ring-4 ring-[#DCFCE7] shrink-0" />
                      <div className="w-0.5 h-12 bg-gradient-to-b from-[#16A34A] to-[#FF572E] my-1 border-dashed" />
                      <div className="w-3.5 h-3.5 rounded-full bg-[#FF572E] ring-4 ring-[#FFEBE0] shrink-0" />
                    </div>

                    {/* Locations */}
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

                {/* Key Meta Badges Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#FFFDFB] p-3 rounded-xl border border-[#F4E3D8] text-center">
                    <Calendar className="w-4 h-4 text-[#FF572E] mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-[#6E7587] block">Date</span>
                    <span className="text-xs font-black text-[#17233C] truncate block mt-0.5">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="bg-[#FFFDFB] p-3 rounded-xl border border-[#F4E3D8] text-center">
                    <Clock className="w-4 h-4 text-[#FF572E] mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-[#6E7587] block">Departure</span>
                    <span className="text-xs font-black text-[#17233C] block mt-0.5">
                      {formattedTime}
                    </span>
                  </div>

                  <div className="bg-[#FFFDFB] p-3 rounded-xl border border-[#F4E3D8] text-center">
                    <Car className="w-4 h-4 text-[#FF572E] mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-[#6E7587] block">Vehicle</span>
                    <span className="text-xs font-black text-[#17233C] truncate block mt-0.5">
                      {travel.carModel || 'Campus Car'}
                    </span>
                  </div>

                  <div className="bg-[#FFFDFB] p-3 rounded-xl border border-[#F4E3D8] text-center">
                    <Users className="w-4 h-4 text-[#FF572E] mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-[#6E7587] block">Rate / Seat</span>
                    <span className="text-xs font-black text-[#FF572E] block mt-0.5">
                      {formatCurrency(pricePerSeat)}
                    </span>
                  </div>
                </div>
              </motion.div>


              {/* CARD 2: PASSENGER FORM */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white rounded-[28px] p-5 sm:p-7 border border-[#F4E3D8]/90 shadow-xs"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#17233C] flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-[#FF572E]" />
                      <span>Passenger Information</span>
                    </h2>
                    <p className="text-xs text-[#6E7587] mt-0.5 font-medium">
                      Information shared with the verified student driver for campus pickup.
                    </p>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold text-[#16A34A] bg-[#EDFAF3] px-2.5 py-1 rounded-full border border-[#BCECD4]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Auto-filled</span>
                  </span>
                </div>

                <form onSubmit={handleConfirmBooking} className="space-y-4">
                  
                  {/* Full Name & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                        Full Name <span className="text-[#FF572E]">*</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-[#8C93A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: null }));
                          }}
                          placeholder="e.g. Shubham Narayan"
                          className={`w-full bg-[#FFFBF8] rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm font-semibold text-[#17233C] border ${
                            fieldErrors.fullName ? 'border-red-400 focus:ring-red-200' : 'border-[#F4E3D8] focus:border-[#FF572E] focus:ring-[#FF572E]/15'
                          } focus:outline-none focus:ring-2 transition-all`}
                        />
                      </div>
                      {fieldErrors.fullName && (
                        <span className="text-[11px] text-red-500 font-bold mt-1 block">
                          {fieldErrors.fullName}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                        College / Account Email <span className="text-[#FF572E]">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#8C93A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                          }}
                          placeholder="student@vitbhopal.ac.in"
                          className={`w-full bg-[#FFFBF8] rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm font-semibold text-[#17233C] border ${
                            fieldErrors.email ? 'border-red-400 focus:ring-red-200' : 'border-[#F4E3D8] focus:border-[#FF572E] focus:ring-[#FF572E]/15'
                          } focus:outline-none focus:ring-2 transition-all`}
                        />
                      </div>
                      {fieldErrors.email && (
                        <span className="text-[11px] text-red-500 font-bold mt-1 block">
                          {fieldErrors.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Phone Number & Number of Seats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                        WhatsApp / Contact Number <span className="text-[#FF572E]">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#8C93A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: null }));
                          }}
                          placeholder="+91 98765 43210"
                          className={`w-full bg-[#FFFBF8] rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm font-semibold text-[#17233C] border ${
                            fieldErrors.phone ? 'border-red-400 focus:ring-red-200' : 'border-[#F4E3D8] focus:border-[#FF572E] focus:ring-[#FF572E]/15'
                          } focus:outline-none focus:ring-2 transition-all`}
                        />
                      </div>
                      {fieldErrors.phone ? (
                        <span className="text-[11px] text-red-500 font-bold mt-1 block">
                          {fieldErrors.phone}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#6E7587] mt-1 block">
                          Required for driver coordination and pickup confirmation.
                        </span>
                      )}
                    </div>

                    {/* SEATS STEPPER SELECTOR */}
                    <div>
                      <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                        Number of Seats <span className="text-[#FF572E]">*</span>
                      </label>
                      <div className="flex items-center justify-between bg-[#FFFBF8] rounded-xl p-2 border border-[#F4E3D8]">
                        <button
                          type="button"
                          onClick={() => setSeats((s) => Math.max(1, s - 1))}
                          disabled={seats <= 1}
                          className="w-9 h-9 rounded-lg bg-white border border-[#F4E3D8] flex items-center justify-center text-[#17233C] hover:border-[#FF572E] hover:text-[#FF572E] active:scale-95 disabled:opacity-40 disabled:hover:border-[#F4E3D8] disabled:hover:text-[#17233C] transition-all cursor-pointer shadow-2xs"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>

                        <div className="text-center px-4">
                          <span className="font-black text-[#17233C] text-lg block">
                            {seats}
                          </span>
                          <span className="text-[10px] font-bold text-[#6E7587]">
                            {seats === 1 ? 'seat' : 'seats'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSeats((s) => Math.min(maxAvailableSeats, s + 1))}
                          disabled={seats >= maxAvailableSeats}
                          className="w-9 h-9 rounded-lg bg-[#FF572E] text-white flex items-center justify-center hover:bg-[#E64A22] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#FF572E] transition-all cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                      {fieldErrors.seats && (
                        <span className="text-[11px] text-red-500 font-bold mt-1 block">
                          {fieldErrors.seats}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-[#17233C] mb-1.5 flex items-center justify-between">
                      <span>Additional Notes or Luggage Details</span>
                      <span className="text-[11px] text-[#6E7587] font-normal">Optional</span>
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-[#8C93A4] absolute left-3.5 top-3.5" />
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Carrying 1 medium trolley bag. Will meet near Gate 2 security cabin."
                        className="w-full bg-[#FFFBF8] rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm font-medium text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/15 focus:outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Privacy & Safety Note */}
                  <div className="p-3 bg-[#FFFBF8] rounded-xl border border-[#F4E3D8] flex items-center gap-2.5 text-[11px] text-[#6E7587]">
                    <Lock className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span>Your phone number and name are only visible to the verified driver once confirmed.</span>
                  </div>

                </form>
              </motion.div>

            </div>


            {/* ======================================================================= */}
            {/* RIGHT COLUMN: DRIVER PROFILE, FARE BREAKDOWN & CONFIRM CTA (SPAN 5)      */}
            {/* ======================================================================= */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
              
              {/* CARD 3: DRIVER & VEHICLE SUMMARY */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#6E7587]">
                    Ride Host & Driver
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#3B82F6] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE]">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Student Verified</span>
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <Avatar 
                    src={travel.student?.imageUrl || travel.authorImage || (isOwnRide ? user?.imageUrl : null)}
                    name={travel.student?.name || travel.authorName || (isOwnRide ? (profile?.name || user?.fullName) : 'Campus Student')}
                    email={travel.student?.email || travel.authorEmail || (isOwnRide ? user?.primaryEmailAddress?.emailAddress : '')}
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
                        <span>{travel.rating || '4.9'}</span>
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-[#FFF4ED] text-[#FF572E] text-[11px] font-bold">
                      <Car className="w-3 h-3" />
                      <span>{travel.carModel || 'Campus Carpool'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>


              {/* CARD 4: FARE BREAKDOWN & PRICE DETAILS */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-[#17233C] text-base">
                    Fare Breakdown
                  </h3>
                  <span className="text-[11px] font-bold text-[#6E7587]">
                    Cost Split
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-[#6E7587]">
                  {/* Seat Price */}
                  <div className="flex items-center justify-between">
                    <span>Base Seat Price</span>
                    <span className="font-extrabold text-[#17233C]">
                      {formatCurrency(pricePerSeat)}
                    </span>
                  </div>

                  {/* Reserved Seats */}
                  <div className="flex items-center justify-between">
                    <span>Reserved Seats</span>
                    <span className="font-extrabold text-[#17233C]">
                      × {seats}
                    </span>
                  </div>

                  {/* Subtotal */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#F4E3D8]/60">
                    <span>Subtotal</span>
                    <span className="font-extrabold text-[#17233C]">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>

                  {/* Platform Fee */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>HelpU Campus Fee</span>
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
                      Pay directly to host at ride time
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-black text-[#FF572E] tracking-tight">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </motion.div>


              {/* ERROR ALERT BANNER */}
              <AnimatePresence>
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Booking Request Error</span>
                      <p className="mt-0.5 leading-relaxed">{submitError}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>


              {/* OWN RIDE WARNING BANNER */}
              {isOwnRide && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Your Own Ride Offer</span>
                    <p className="mt-0.5">
                      You are the creator of this ride offer. You cannot book seats on your own ride.
                    </p>
                  </div>
                </div>
              )}

              {/* PENDING REQUEST BANNER */}
              {isPending && !isOwnRide && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Booking Request Pending</span>
                    <p className="mt-0.5">
                      You already have a pending booking request for this ride post. Please wait for the host to respond.
                    </p>
                  </div>
                </div>
              )}

              {/* CONFIRMED BOOKING BANNER */}
              {isConfirmed && !isOwnRide && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Booking Already Confirmed</span>
                    <p className="mt-0.5">
                      You already have a confirmed seat reservation for this ride post.
                    </p>
                  </div>
                </div>
              )}

              {/* CONFIRM BOOKING ACTION BUTTON */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting || isOwnRide || isPending || isConfirmed || maxAvailableSeats < 1}
                  className={`w-full py-3.5 px-6 rounded-full font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                    isPending
                      ? 'bg-amber-500 hover:bg-amber-500 text-white shadow-amber-500/20 opacity-90'
                      : isConfirmed
                      ? 'bg-emerald-600 hover:bg-emerald-600 text-white shadow-emerald-600/20 opacity-90'
                      : 'bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white shadow-[#FF572E]/25 disabled:opacity-50 disabled:hover:bg-[#FF572E]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting Reservation...</span>
                    </>
                  ) : isPending ? (
                    <>
                      <Clock className="w-4 h-4 stroke-[2.5]" />
                      <span>Request Pending</span>
                    </>
                  ) : isConfirmed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Already Confirmed</span>
                    </>
                  ) : maxAvailableSeats < 1 ? (
                    <span>Ride Fully Booked</span>
                  ) : isOwnRide ? (
                    <span>Cannot Book Own Ride</span>
                  ) : (
                    <>
                      <span>Book Seat • {formatCurrency(totalAmount)}</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full py-2.5 text-xs font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer text-center"
                >
                  Cancel and return
                </button>
              </div>


              {/* TRUST & SAFETY GUARANTEE */}
              <div className="p-4 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] text-[11px] text-[#6E7587] space-y-1.5">
                <div className="flex items-center gap-1.5 font-extrabold text-[#17233C]">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                  <span>HelpU Campus Guarantee</span>
                </div>
                <p className="leading-relaxed">
                  All rides are hosted by verified college students. Pay directly via UPI or cash after meeting at the pickup point.
                </p>
              </div>

            </div>

          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}
