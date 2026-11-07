import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import {
  MapPin, Calendar, Clock, Users, ArrowUpDown,
  Search, Check, Sparkles, ChevronDown, User,
  MoreHorizontal, ShieldCheck, ArrowRight, IndianRupee,
  CheckCircle2, X, FileText
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { DatePickerModal } from '../components/ui/DatePickerModal';
import { TimePickerModal } from '../components/ui/TimePickerModal';
import { createTravel } from '../lib/api';
import { invalidateRideQueries } from '../lib/queryClient';

// Cute & Modern Vehicle SVG Thumbnails matching reference design
function OmniCarIcon({ className = "w-8 sm:w-9 h-5 sm:h-6" }) {
  return (
    <svg viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="8" width="50" height="24" rx="4" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.5" />
      <path d="M6 16 L20 8 H52 L56 16" fill="#E5E7EB" />
      <rect x="9" y="10" width="10" height="9" rx="1.5" fill="#17233C" opacity="0.8" />
      <rect x="22" y="10" width="13" height="9" rx="1.5" fill="#17233C" opacity="0.8" />
      <rect x="38" y="10" width="14" height="9" rx="1.5" fill="#17233C" opacity="0.8" />
      <line x1="36" y1="10" x2="36" y2="28" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="1 1" />
      <rect x="4" y="24" width="3" height="4" rx="1" fill="#FF572E" />
      <circle cx="7" cy="22" r="2" fill="#FBBF24" />
      <circle cx="16" cy="33" r="6" fill="#1F2937" />
      <circle cx="16" cy="33" r="2.5" fill="#9CA3AF" />
      <circle cx="46" cy="33" r="6" fill="#1F2937" />
      <circle cx="46" cy="33" r="2.5" fill="#9CA3AF" />
    </svg>
  );
}

function CretaCarIcon({ className = "w-8 sm:w-9 h-5 sm:h-6" }) {
  return (
    <svg viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M8 22 L14 12 L26 8 H42 L52 14 L58 20 V28 H8 Z" fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="1.5" />
      <line x1="24" y1="6" x2="44" y2="6" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 13 L24 10 H34 V19 H13 Z" fill="#17233C" opacity="0.85" />
      <path d="M37 10 H43 L49 15 V19 H37 Z" fill="#17233C" opacity="0.85" />
      <rect x="54" y="21" width="4" height="3" rx="1" fill="#3B82F6" />
      <circle cx="17" cy="31" r="6.5" fill="#1F2937" />
      <circle cx="17" cy="31" r="3" fill="#D1D5DB" />
      <circle cx="47" cy="31" r="6.5" fill="#1F2937" />
      <circle cx="47" cy="31" r="3" fill="#D1D5DB" />
    </svg>
  );
}

function EecoCarIcon({ className = "w-8 sm:w-9 h-5 sm:h-6" }) {
  return (
    <svg viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="7" y="10" width="49" height="22" rx="3.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1.5" />
      <path d="M7 17 L16 11 H50 L54 17" fill="#D1D5DB" />
      <rect x="10" y="12" width="11" height="8" rx="1" fill="#17233C" opacity="0.8" />
      <rect x="24" y="12" width="13" height="8" rx="1" fill="#17233C" opacity="0.8" />
      <rect x="40" y="12" width="13" height="8" rx="1" fill="#17233C" opacity="0.8" />
      <line x1="8" y1="23" x2="55" y2="23" stroke="#0284C7" strokeWidth="1.5" />
      <circle cx="16" cy="33" r="5.5" fill="#1F2937" />
      <circle cx="16" cy="33" r="2.5" fill="#9CA3AF" />
      <circle cx="47" cy="33" r="5.5" fill="#1F2937" />
      <circle cx="47" cy="33" r="2.5" fill="#9CA3AF" />
    </svg>
  );
}

// Crisp Car Outline Icon matching the reference buttons and tabs
function ButtonCarIcon({ className = "w-4 h-4 sm:w-5 sm:h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

const POPULAR_LOCATIONS = [
  'VIT, Bhopal',
  'Bhopal Railway Station',
  'Rani Kamlapati Station (RKMP)',
  'Bhopal Airport (BHO)',
  'Indore (Bhawarkua / Bypass)',
  'Lalghati, Bhopal',
  'MP Nagar Zone 1',
  'Sehore Bus Stand',
  'Ashta Toll Plaza',
];

// Date and Time display formatters matching exact mobile UI
function formatDateDisplay(dStr) {
  if (!dStr) return 'Select Date';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dStr;
}

function formatTimeDisplay(tStr) {
  if (!tStr) return 'Select Time';
  const parts = tStr.split(':');
  if (parts.length >= 2) {
    let hh = parseInt(parts[0], 10);
    const mm = parts[1].padStart(2, '0');
    const ampm = hh >= 12 ? 'pm' : 'am';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${hh}:${mm} ${ampm}`;
  }
  return tStr;
}

export default function OfferRidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const [searchParams] = useSearchParams();
  const isRequestPath = location.pathname.includes('/request') || searchParams.get('mode') === 'request';

  const [mode, setMode] = useState(isRequestPath ? 'request' : 'offer'); // 'offer' | 'request'

  // Sync mode if route changes between /rides/offer and /rides/request
  useEffect(() => {
    const isReq = location.pathname.includes('/request') || searchParams.get('mode') === 'request';
    setMode(isReq ? 'request' : 'offer');
  }, [location.pathname, searchParams]);

  const [fromLoc, setFromLoc] = useState('VIT, Bhopal');
  const [toLoc, setToLoc] = useState('Bhopal Railway Station');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [time, setTime] = useState('08:00');
  const [gender, setGender] = useState(''); // 'Male' | 'Female' | 'Prefer not to say' | ''
  const [travellers, setTravellers] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState('350');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSummary, setCreatedSummary] = useState(null);

  // Swap From & To locations
  const handleSwapLocations = () => {
    const temp = fromLoc;
    setFromLoc(toLoc);
    setToLoc(temp);
  };

  // Submit Handler: Posts real ride or searches
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!fromLoc.trim() || !toLoc.trim()) {
      setError('Please specify departure and destination locations.');
      return;
    }
    if (!date) {
      setError('Please select a travel date.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Convert HH:MM time string to minutes from midnight (backend format)
      let departureMinutes = 480; // default 8:00 AM
      if (time) {
        const [hh, mm] = time.split(':').map(Number);
        departureMinutes = hh * 60 + (mm || 0);
      }

      if (mode === 'offer') {
        // POST to backend — use correct field names matching Travel schema
        const res = await createTravel({
          source: fromLoc.trim(),
          destination: toLoc.trim(),
          travelDate: date,
          departureTime: departureMinutes,
          timeFlexibility: 30,
          seats: travellers,
          pricePerSeat: Number(pricePerSeat) || 350,
          carModel: 'Campus Ride',
          type: 'offer',
          notes: notes.trim(),
          gender: gender || null,
          authorImage: user?.imageUrl || null,
          authorName: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || null,
          authorEmail: user?.primaryEmailAddress?.emailAddress || null,
        });

        const createdPost = res.data?.data || res.data;
        invalidateRideQueries();
        setCreatedSummary({
          id: createdPost?._id,
          type: 'offer',
          source: fromLoc.trim(),
          destination: toLoc.trim(),
          travelDate: date,
          time: time || '08:00',
          seats: travellers,
          pricePerSeat: Number(pricePerSeat) || 350,
          carModel: 'Campus Ride',
          gender: gender || null,
          notes: notes.trim(),
        });
        setShowSuccessModal(true);
      } else {
        // For "request" mode — post a travel request
        const res = await createTravel({
          source: fromLoc.trim(),
          destination: toLoc.trim(),
          travelDate: date,
          departureTime: departureMinutes,
          timeFlexibility: 30,
          seats: travellers,
          pricePerSeat: 0,
          carModel: 'Ride Request',
          type: 'request',
          notes: notes.trim(),
          gender: gender || null,
          authorImage: user?.imageUrl || null,
          authorName: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || null,
          authorEmail: user?.primaryEmailAddress?.emailAddress || null,
        });

        const createdPost = res.data?.data || res.data;
        invalidateRideQueries();
        setCreatedSummary({
          id: createdPost?._id,
          type: 'request',
          source: fromLoc.trim(),
          destination: toLoc.trim(),
          travelDate: date,
          time: time || '08:00',
          seats: travellers,
          pricePerSeat: 0,
          carModel: 'Ride Request',
          gender: gender || null,
          notes: notes.trim(),
        });
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error('Ride post error:', err);
      setError(err.message || 'Failed to post ride. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Offer a Ride" backTo="/rides" />}
    >
      <div className="w-full max-w-xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-1.5 pb-20 sm:pt-4 sm:pb-12">

        {/* ========================================================================= */}
        {/* RESPONSIVE LAYOUT CONTAINER (2 Columns on Desktop, Stacked on Mobile)      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-6 items-start">

          {/* ----------------------------------------------------------------------- */}
          {/* HERO CARD (Share Your Ride introductory card)                           */}
          {/* ----------------------------------------------------------------------- */}
          <div className="lg:col-span-5 space-y-3.5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-4 sm:p-5 relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                {/* Left text column */}
                <div className="flex-1 min-w-0 pt-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] leading-tight tracking-tight">
                    {mode === 'offer' ? (
                      <>
                        Share Your <span className="text-[#FF572E]">Ride</span>
                      </>
                    ) : (
                      <>
                        Find Your <span className="text-[#FF572E]">Ride</span>
                      </>
                    )}
                  </h1>
                  <p className="text-xs sm:text-[13px] text-[#6E7587] font-medium leading-relaxed mt-2 max-w-[210px] sm:max-w-[280px]">
                    {mode === 'offer'
                      ? 'Share empty seats, split travel costs, and travel with verified students.'
                      : 'Discover fellow students heading along your route and journey together safely.'}
                  </p>
                </div>

                {/* Right illustration column - Large and prominent matching reference */}
                <div className="shrink-0 w-[140px] sm:w-[175px] md:w-[195px] -mt-1 -mr-1 flex justify-end items-center">
                  <img
                    src="/car-hero.png"
                    alt="Helpu campus ride illustration"
                    className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xs"
                    onError={(e) => {
                      e.currentTarget.src = '/car.png';
                    }}
                  />
                </div>
              </div>

              {/* Feature Badges Row - Clean pills with NO divider line */}
              <div className="flex flex-wrap items-center gap-2 pt-3 mt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF8F3] border border-[#FEE6D8] text-xs font-bold text-[#17233C]">
                  <MapPin className="w-3.5 h-3.5 text-[#FF572E]" />
                  <span>Same Route</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF8F3] border border-[#FEE6D8] text-xs font-bold text-[#17233C]">
                  <IndianRupee className="w-3.5 h-3.5 text-[#FF572E]" />
                  <span>Split Fuel</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EBF9F1] border border-[#C2EED7] text-xs font-bold text-[#17233C]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Verified Campus</span>
                </span>
              </div>
            </motion.div>

            {/* Desktop-only secondary trust badge */}
            <div className="hidden lg:flex bg-white rounded-2xl p-4 border border-[#F4E3D8] items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[#EAF8F0] border border-[#C6EFD9] text-[#16A34A] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-extrabold text-[#17233C] text-sm block leading-snug">
                  Verified Campus Network
                </span>
                <span className="text-xs text-[#6E7587] font-medium block mt-0.5 leading-relaxed">
                  Direct coordination with verified students once matched.
                </span>
              </div>
            </div>
          </div>


          {/* ----------------------------------------------------------------------- */}
          {/* TRAVEL DETAILS FORM CARD & SELECTOR                                     */}
          {/* ----------------------------------------------------------------------- */}
          <div className="lg:col-span-7 space-y-3 sm:space-y-3.5">

            {/* Offer a Ride | Find / Request Selector (Positioned immediately above Travel Details) */}
            <div className="flex items-center justify-between gap-2">
              {/* Mode Switcher Pill */}
              <div className="inline-flex bg-white p-1 rounded-full border border-[#F4E3D8] shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('offer')}
                  className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    mode === 'offer'
                      ? 'bg-[#FF572E] text-white shadow-xs'
                      : 'text-[#17233C] hover:text-[#FF572E]'
                  }`}
                >
                  <ButtonCarIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Offer a Ride</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('request')}
                  className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    mode === 'request'
                      ? 'bg-[#FF572E] text-white shadow-xs'
                      : 'text-[#17233C] hover:text-[#FF572E]'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Find / Request</span>
                </button>
              </div>

              {/* Quick link button to Match Page */}
              <button
                type="button"
                onClick={() => navigate('/match')}
                className="inline-flex items-center gap-1 px-3 sm:px-4 py-2 bg-white rounded-full border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] hover:text-[#FF572E] text-xs font-bold shadow-2xs hover:bg-[#FFF7F2] transition-all cursor-pointer shrink-0"
              >
                <span>Find Matches</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#FF572E]" />
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.05 }}
              className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-4 sm:p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F4E3D8]/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="font-black text-[#17233C] text-sm sm:text-base leading-tight">
                      Your Travel Details
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#6E7587] font-medium">
                      Enter route, schedule and vehicle preference
                    </p>
                  </div>
                </div>

                <span className="text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full bg-[#FFF6F0] border border-[#FF572E]/25 text-[#FF572E] shrink-0">
                  {mode === 'offer' ? 'Offering' : 'Requesting'}
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">

                {/* Route Section: From & To Box with Central Floating Swap */}
                <div className="relative bg-white rounded-2xl border border-[#F4E3D8] overflow-hidden">

                  {/* Departure Location */}
                  <div className="p-3 pr-11 border-b border-[#F4E3D8] focus-within:bg-[#FFFBF8] transition-colors">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                      <span>Departure Location</span>
                    </div>
                    <input
                      type="text"
                      list="from-locations"
                      value={fromLoc}
                      onChange={(e) => setFromLoc(e.target.value)}
                      placeholder="VIT, Bhopal"
                      className="w-full bg-transparent text-xs sm:text-sm font-extrabold text-[#17233C] placeholder:text-[#A0A6B5] focus:outline-none"
                    />
                    <datalist id="from-locations">
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                  {/* Swap Button (Floating on the right edge over the divider) */}
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    title="Swap Departure and Destination"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E] hover:bg-[#FFF7F2] active:scale-90 shadow-sm flex items-center justify-center cursor-pointer transition-all"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#FF572E] stroke-[2.5]" />
                  </button>

                  {/* Destination */}
                  <div className="p-3 pr-11 focus-within:bg-[#FFFBF8] transition-colors">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <MapPin className="w-3.5 h-3.5 text-[#17233C] shrink-0" />
                      <span>Destination</span>
                    </div>
                    <input
                      type="text"
                      list="to-locations"
                      value={toLoc}
                      onChange={(e) => setToLoc(e.target.value)}
                      placeholder="Bhopal Railway Station"
                      className="w-full bg-transparent text-xs sm:text-sm font-extrabold text-[#17233C] placeholder:text-[#A0A6B5] focus:outline-none"
                    />
                    <datalist id="to-locations">
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                </div>


                {/* Schedule Row: Date & Time side by side with Chevrons */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">

                  {/* Date (Custom Helpu Date Picker - No Broken Native OS Dialog) */}
                  <div 
                    onClick={() => setShowDatePicker(true)}
                    className="relative bg-white rounded-2xl p-2.5 sm:p-3 border border-[#F4E3D8] hover:border-[#FF572E]/60 focus-within:border-[#FF572E] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#6E7587] uppercase tracking-wider mb-1">
                      <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span>Date</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                        {formatDateDisplay(date)}
                      </span>
                      <ChevronDown className="w-4 h-4 text-[#17233C]/70 shrink-0" />
                    </div>
                  </div>

                  {/* Time (Custom Helpu Time Picker - No Oversized Native Dialog) */}
                  <div 
                    onClick={() => setShowTimePicker(true)}
                    className="relative bg-white rounded-2xl p-2.5 sm:p-3 border border-[#F4E3D8] hover:border-[#FF572E]/60 focus-within:border-[#FF572E] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#6E7587] uppercase tracking-wider mb-1">
                      <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span>Time (Optional)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                        {formatTimeDisplay(time)}
                      </span>
                      <ChevronDown className="w-4 h-4 text-[#17233C]/70 shrink-0" />
                    </div>
                  </div>

                </div>


                {/* Gender Selection (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span className="font-black text-xs sm:text-sm text-[#17233C]">Gender</span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-[#6E7587] font-medium">Optional</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    {/* Male */}
                    <button
                      type="button"
                      onClick={() => setGender(gender === 'Male' ? '' : 'Male')}
                      className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all cursor-pointer ${
                        gender === 'Male'
                          ? 'border-[#FF572E] bg-[#FFF8F3] shadow-2xs ring-1 ring-[#FF572E]'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                      }`}
                    >
                      {gender === 'Male' && (
                        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <span className="text-lg mb-0.5" role="img" aria-label="Male">👨</span>
                      <span className="text-xs font-extrabold text-[#17233C]">Male</span>
                    </button>

                    {/* Female */}
                    <button
                      type="button"
                      onClick={() => setGender(gender === 'Female' ? '' : 'Female')}
                      className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all cursor-pointer ${
                        gender === 'Female'
                          ? 'border-[#FF572E] bg-[#FFF8F3] shadow-2xs ring-1 ring-[#FF572E]'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                      }`}
                    >
                      {gender === 'Female' && (
                        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <span className="text-lg mb-0.5" role="img" aria-label="Female">👩</span>
                      <span className="text-xs font-extrabold text-[#17233C]">Female</span>
                    </button>

                    {/* Prefer not to say */}
                    <button
                      type="button"
                      onClick={() => setGender(gender === 'Prefer not to say' ? '' : 'Prefer not to say')}
                      className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all cursor-pointer ${
                        gender === 'Prefer not to say'
                          ? 'border-[#FF572E] bg-[#FFF8F3] shadow-2xs ring-1 ring-[#FF572E]'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                      }`}
                    >
                      {gender === 'Prefer not to say' && (
                        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <span className="text-lg mb-0.5" role="img" aria-label="Private">🔒</span>
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-[#17233C] text-center leading-tight">Prefer not to say</span>
                    </button>
                  </div>
                </div>

                {/* Max. Co-travellers & Fuel Split Price */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-[#F4E3D8] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-[#17233C] leading-none">
                        {mode === 'offer' ? 'Max. Co-travellers' : 'Seats Needed'}
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-[#6E7587] font-medium mt-0.5">Available seats</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {mode === 'offer' && (
                      <div className="flex items-center gap-1 bg-[#FFFBF8] rounded-xl px-2.5 py-1.5 border border-[#F4E3D8]">
                        <span className="font-black text-[#FF572E] text-xs sm:text-sm">₹</span>
                        <input
                          type="number"
                          value={pricePerSeat}
                          onChange={(e) => setPricePerSeat(e.target.value)}
                          placeholder="350"
                          title="Price per seat"
                          className="w-12 text-xs sm:text-sm font-black text-[#17233C] focus:outline-none bg-transparent"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTravellers((prev) => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-xl bg-white border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFEBE0] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                      >
                        −
                      </button>
                      <span className="font-black text-[#17233C] text-sm min-w-[16px] text-center">
                        {travellers}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTravellers((prev) => Math.min(8, prev + 1))}
                        className="w-7 h-7 rounded-xl bg-[#FF572E] text-white hover:bg-[#E64A22] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>


                {/* Optional Message / Personal Notes Box */}
                <div className="bg-white rounded-2xl p-3 border border-[#F4E3D8] space-y-1.5 focus-within:border-[#FF572E] transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#17233C] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span>{mode === 'offer' ? 'Ride Notes / Preferences' : 'Request Notes / Details'}</span>
                    </label>
                    <span className="text-[10px] font-bold text-[#8C93A4] bg-[#FFFBF8] px-2 py-0.5 rounded-full border border-[#F4E3D8]">
                      Optional
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      mode === 'offer'
                        ? 'Add any extra details (e.g. AC available, trunk space for 1 luggage, leaving sharp on time)...'
                        : 'Add any extra details (e.g. Carrying 1 backpack, flexible by 15 mins, will wait near gate 2)...'
                    }
                    className="w-full text-xs font-semibold text-[#17233C] placeholder:text-[#A0A6B5] focus:outline-none bg-transparent resize-none leading-relaxed"
                    maxLength={300}
                  />
                  {notes.length > 0 && (
                    <div className="text-right text-[10px] font-bold text-[#A0A6B5]">
                      {notes.length}/300
                    </div>
                  )}
                </div>


                {/* Error Banner */}
                {error && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl text-center">
                    {error}
                  </div>
                )}


                {/* Primary CTA Submit Action Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#FF572E]/25 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <ButtonCarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    <span>
                      {loading
                        ? 'Processing...'
                        : mode === 'offer'
                          ? 'Offer Ride →'
                          : 'Find Rides →'}
                    </span>
                  </button>
                </div>

              </form>

            </motion.div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* POST SUCCESS CONFIRMATION POPUP / MODAL                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showSuccessModal && createdSummary && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full border border-[#F4E3D8] shadow-2xl relative overflow-hidden"
            >
              {/* Close 'X' Button */}
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/posts');
                }}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FFFBF8] border border-[#F4E3D8] text-[#8C93A4] hover:text-[#17233C] hover:bg-[#F4E3D8]/50 flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Animated Celebration Icon & Header */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#EDFAF3] border-2 border-[#BCECD4] text-[#16A34A] flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.4]" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDFAF3] border border-[#BCECD4] text-[10px] font-black uppercase tracking-wider text-[#16A34A] mb-2 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Successfully Published</span>
                </div>

                <h3 className="font-black text-xl sm:text-2xl text-[#17233C] tracking-tight">
                  {createdSummary.type === 'offer'
                    ? 'Ride Offer Successfully Posted!'
                    : 'Ride Request Successfully Posted!'}
                </h3>

                <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1.5 leading-relaxed">
                  Aapki ride live publish ho chuki hai. Verified campus peers traveling on this route can now discover and connect with you!
                </p>
              </div>

              {/* Post Details Card */}
              <div className="mt-5 bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8]/90 space-y-3">
                {/* Route */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                    <span className="font-extrabold text-[#17233C] truncate">{createdSummary.source}</span>
                  </div>
                  <div className="px-2 text-[#FF572E] font-bold">➔</div>
                  <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                    <span className="font-extrabold text-[#17233C] truncate">{createdSummary.destination}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                  </div>
                </div>

                {/* Date & Time Divider */}
                <div className="pt-2 border-t border-[#F4E3D8]/60 flex items-center justify-between text-[11px] font-bold text-[#6E7587]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>{createdSummary.travelDate} • {createdSummary.time}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#16A34A]">
                    <Users className="w-3.5 h-3.5" />
                    <span>{createdSummary.seats} Seat(s)</span>
                  </div>
                </div>

                {/* Vehicle & Price */}
                {createdSummary.type === 'offer' && (
                  <div className="pt-2 border-t border-[#F4E3D8]/60 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-[#6E7587]">Vehicle: {createdSummary.carModel}</span>
                    <span className="text-[#FF572E] font-black text-sm">₹{createdSummary.pricePerSeat}/seat</span>
                  </div>
                )}

                {/* Notes if provided */}
                {createdSummary.notes && (
                  <div className="pt-2 border-t border-[#F4E3D8]/60 text-[11px] text-[#6E7587] flex items-start gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#FF572E] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#17233C]">Notes: </span>
                      <span className="text-[#6E7587] italic break-words">{createdSummary.notes}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/posts');
                  }}
                  className="w-full py-3 px-5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#FF572E]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>View in My Posts</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/match');
                  }}
                  className="w-full py-2.5 px-5 bg-white hover:bg-[#FFF7F2] text-[#17233C] font-bold text-xs sm:text-sm rounded-xl border border-[#F4E3D8] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#FF572E]" />
                  <span>Find Campus Matches</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                  }}
                  className="w-full py-2 text-[#8C93A4] hover:text-[#17233C] font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  Post another ride
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Custom Date Picker Modal */}
      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={date}
        onChange={(newDate) => {
          setDate(newDate);
          setShowDatePicker(false);
        }}
        title={mode === 'offer' ? 'Select Ride Date' : 'Select Travel Date'}
      />

      {/* Modern Custom Time Picker Modal */}
      <TimePickerModal
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        value={time}
        onChange={(newTime) => {
          setTime(newTime);
          setShowTimePicker(false);
        }}
        title="Select Departure Time"
      />
    </ResponsiveShell>
  );
}
