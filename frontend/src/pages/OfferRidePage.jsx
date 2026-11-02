import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Clock, Users, ArrowUpDown,
  Search, Check, Sparkles, Car as CarIcon,
  MoreHorizontal, ShieldCheck, ArrowRight, IndianRupee
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { createTravel } from '../lib/api';

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

export default function OfferRidePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'request' ? 'request' : 'offer';

  const [mode, setMode] = useState(initialMode); // 'offer' | 'request'
  const [fromLoc, setFromLoc] = useState('VIT, Bhopal');
  const [toLoc, setToLoc] = useState('Bhopal Railway Station');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [time, setTime] = useState('08:00');
  const [preferredCar, setPreferredCar] = useState('Omni');
  const [travellers, setTravellers] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState('350');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        await createTravel({
          source: fromLoc.trim(),
          destination: toLoc.trim(),
          travelDate: date,
          departureTime: departureMinutes,
          timeFlexibility: 30,
          seats: travellers,
          type: 'offer',
        });
        navigate('/rides', { replace: true });
      } else {
        // For "request" mode — post a travel request
        await createTravel({
          source: fromLoc.trim(),
          destination: toLoc.trim(),
          travelDate: date,
          departureTime: departureMinutes,
          timeFlexibility: 30,
          seats: travellers,
          type: 'request',
        });
        navigate('/rides', { replace: true });
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
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ========================================================================= */}
        {/* SUB-HEADER TOOLBAR (Matching Match Page sub-bar)                          */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">

          {/* Mode Switcher Pill */}
          <div className="inline-flex bg-white/90 p-1 rounded-full border border-[#F4E3D8]/90 shadow-xs backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setMode('offer')}
              className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${mode === 'offer'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'text-[#17233C] hover:text-[#FF572E] hover:bg-[#FFF7F2]'
                }`}
            >
              <CarIcon className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Offer a Ride</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('request')}
              className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${mode === 'request'
                  ? 'bg-[#FF572E] text-white shadow-sm'
                  : 'text-[#17233C] hover:text-[#FF572E] hover:bg-[#FFF7F2]'
                }`}
            >
              <Search className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Find / Request</span>
            </button>
          </div>

          {/* Quick link button to View All Rides */}
          <button
            type="button"
            onClick={() => navigate('/rides')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-white rounded-2xl border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] hover:text-[#FF572E] text-xs sm:text-sm font-bold shadow-xs hover:bg-[#FFF7F2] transition-all cursor-pointer"
          >
            <span>Explore Rides</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF572E]" />
          </button>
        </div>


        {/* ========================================================================= */}
        {/* MAIN PREMIUM WHITE CARD (Matching Match Page Hero card)                   */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-[28px] border border-[#F4E3D8]/90 shadow-sm relative overflow-hidden p-5 sm:p-7 lg:p-8"
        >
          {/* Subtle warm decorative glow */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FFF0E7]/50 via-[#FFF5EE]/30 to-transparent pointer-events-none rounded-r-[28px]" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start relative z-10">

            {/* ------------------------------------------------------------------- */}
            {/* LEFT COLUMN: HEADING, VALUE PROPS & COMPACT CAR ILLUSTRATION         */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-4">

              <div>
                {/* Small Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] font-bold text-xs mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 fill-[#FF572E]/10 text-[#FF572E]" />
                  <span>{mode === 'offer' ? 'Offer a Ride' : 'Request a Ride'}</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-[#17233C] leading-tight tracking-tight">
                  {mode === 'offer' ? (
                    <>
                      Share Your <br />
                      <span className="text-[#FF572E] relative inline-block">
                        Ride
                        <svg className="absolute -top-3 -right-5 w-4 h-4 text-[#FF572E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="4" y1="12" x2="1" y2="10" />
                          <line x1="8" y1="5" x2="7" y2="1" />
                          <line x1="16" y1="4" x2="18" y2="1" />
                        </svg>
                      </span>
                    </>
                  ) : (
                    <>
                      Find Your <br />
                      <span className="text-[#FF572E]">Campus Ride</span>
                    </>
                  )}
                </h1>

                {/* Subtitle */}
                <p className="mt-2 text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-sm">
                  {mode === 'offer'
                    ? 'Share empty seats, split travel costs, and travel with verified students.'
                    : 'Discover fellow students heading along your route and journey together safely.'}
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                    <MapPin className="w-3 h-3 text-[#FF572E]" />
                    Same Route
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF6F0] border border-[#FDE3D3] text-[11px] font-bold text-[#17233C]">
                    <IndianRupee className="w-3 h-3 text-[#FF572E]" />
                    Split Fuel
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F0FAF4] border border-[#C6EFD9] text-[11px] font-bold text-[#17233C]">
                    <ShieldCheck className="w-3 h-3 text-[#16A34A]" />
                    Verified Campus
                  </span>
                </div>
              </div>

              {/* Compact Transparent Student-and-Car Illustration */}
            <div className="w-full flex justify-center items-center -mt-14">
  <img
    src="/car.png"
    alt="Student campus ride illustration"
    className="w-auto max-h-[220px] sm:max-h-[260px] lg:max-h-[320px] xl:max-h-[360px] object-contain drop-shadow-sm transition-transform"
    onError={(e) => {
      e.currentTarget.style.display = 'none';
    }}
  />
</div>

              {/* Verified Trust Strip */}
              <div className="bg-[#FFFBF8] rounded-2xl p-3 border border-[#F4E3D8] flex items-center gap-2.5 text-xs text-[#555E70]">
                <div className="w-7 h-7 rounded-xl bg-[#EAF8F0] text-[#16A34A] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-[#17233C] block leading-tight">Verified Campus Network</span>
                  <span className="text-[11px] text-[#6E7587]">Direct WhatsApp connect once matched</span>
                </div>
              </div>

            </div>


            {/* ------------------------------------------------------------------- */}
            {/* RIGHT COLUMN: TRAVEL DETAILS FORM                                   */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-7 bg-[#FFFBF8] rounded-[24px] p-4 sm:p-6 border border-[#F4E3D8] shadow-xs">

              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F4E3D8]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-[#17233C] text-sm sm:text-base leading-tight">
                      Your Travel Details
                    </h2>
                    <p className="text-[11px] text-[#6E7587]">Enter route, schedule and vehicle preference</p>
                  </div>
                </div>

                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E]">
                  {mode === 'offer' ? 'Offering' : 'Requesting'}
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">

                {/* Route Section: From & To */}
                <div className="relative space-y-2">

                  {/* From Field */}
                  <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-[#F4E3D8] focus-within:border-[#FF572E] focus-within:ring-2 focus-within:ring-[#FF572E]/15 transition-all">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF572E]" />
                      <span>Departure Location</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                      <input
                        type="text"
                        list="from-locations"
                        value={fromLoc}
                        onChange={(e) => setFromLoc(e.target.value)}
                        placeholder="e.g. VIT, Bhopal"
                        className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17233C] placeholder:text-[#A0A6B5] focus:outline-none"
                      />
                    </div>
                    <datalist id="from-locations">
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                  {/* Swap Button */}
                  <div className="absolute right-3.5 top-[50%] -translate-y-1/2 z-10">
                    <button
                      type="button"
                      onClick={handleSwapLocations}
                      title="Swap Departure and Destination"
                      className="w-7 h-7 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E] hover:bg-[#FFF7F2] hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#FF572E]" />
                    </button>
                  </div>

                  {/* To Field */}
                  <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-[#F4E3D8] focus-within:border-[#FF572E] focus-within:ring-2 focus-within:ring-[#FF572E]/15 transition-all">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#17233C]" />
                      <span>Destination</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#17233C] shrink-0" />
                      <input
                        type="text"
                        list="to-locations"
                        value={toLoc}
                        onChange={(e) => setToLoc(e.target.value)}
                        placeholder="e.g. Bhopal Railway Station"
                        className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17233C] placeholder:text-[#A0A6B5] focus:outline-none"
                      />
                    </div>
                    <datalist id="to-locations">
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                </div>


                {/* Date & Time Grid */}
                <div className="grid grid-cols-2 gap-2.5">

                  {/* Date */}
                  <div className="bg-white rounded-xl p-2.5 border border-[#F4E3D8] focus-within:border-[#FF572E] transition-all">
                    <label className="flex items-center gap-1 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <Calendar className="w-3 h-3 text-[#FF572E]" />
                      <span>Date</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17233C] focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Time */}
                  <div className="bg-white rounded-xl p-2.5 border border-[#F4E3D8] focus-within:border-[#FF572E] transition-all">
                    <label className="flex items-center gap-1 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <Clock className="w-3 h-3 text-[#FF572E]" />
                      <span>Time (Optional)</span>
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17233C] focus:outline-none cursor-pointer"
                    />
                  </div>

                </div>


                {/* Preferred Car Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <CarIcon className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span className="font-extrabold text-[#17233C] text-xs">Preferred Vehicle</span>
                    </div>
                    <span className="text-[10px] text-[#6E7587]">Select model</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">

                    {/* Omni */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Omni')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${preferredCar === 'Omni'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                        }`}
                    >
                      {preferredCar === 'Omni' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <OmniCarIcon className="w-7 sm:w-8 h-4.5 sm:h-5 mb-0.5" />
                      <span className="text-[11px] font-black text-[#17233C]">Omni</span>
                    </button>

                    {/* Creta */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Creta')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${preferredCar === 'Creta'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                        }`}
                    >
                      {preferredCar === 'Creta' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <CretaCarIcon className="w-7 sm:w-8 h-4.5 sm:h-5 mb-0.5" />
                      <span className="text-[11px] font-black text-[#17233C]">Creta</span>
                    </button>

                    {/* Eeco */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Eeco')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${preferredCar === 'Eeco'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                        }`}
                    >
                      {preferredCar === 'Eeco' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <EecoCarIcon className="w-7 sm:w-8 h-4.5 sm:h-5 mb-0.5" />
                      <span className="text-[11px] font-black text-[#17233C]">Eeco</span>
                    </button>

                    {/* Other */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Other')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${preferredCar === 'Other'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F4E3D8] bg-white hover:border-[#FF572E]/40'
                        }`}
                    >
                      {preferredCar === 'Other' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-7 sm:w-8 h-4.5 sm:h-5 flex items-center justify-center text-[#6E7587] mb-0.5">
                        <MoreHorizontal className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black text-[#17233C]">Other</span>
                    </button>

                  </div>
                </div>


                {/* Co-travellers Counter & Fuel Split Price */}
                <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-2.5 sm:p-3 border border-[#F4E3D8]">

                  {/* Travellers Info */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[#17233C] text-xs leading-none">
                        {mode === 'offer' ? 'Max. Co-travellers' : 'Seats Needed'}
                      </h4>
                      <p className="text-[10px] text-[#6E7587] mt-0.5">Available seats</p>
                    </div>
                  </div>

                  {/* Counter [- 1 +] & Price Input */}
                  <div className="flex items-center gap-2.5">

                    {mode === 'offer' && (
                      <div className="flex items-center gap-1 bg-[#FFFBF8] rounded-lg px-2 py-1 border border-[#F4E3D8]">
                        <span className="font-bold text-[#FF572E] text-xs">₹</span>
                        <input
                          type="number"
                          value={pricePerSeat}
                          onChange={(e) => setPricePerSeat(e.target.value)}
                          placeholder="350"
                          title="Price per seat"
                          className="w-12 text-xs font-black text-[#17233C] focus:outline-none bg-transparent"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTravellers((prev) => Math.max(1, prev - 1))}
                        className="w-6 h-6 rounded-lg bg-[#FFFBF8] border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFEBE0] font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        −
                      </button>
                      <span className="font-black text-[#17233C] text-xs min-w-[14px] text-center">
                        {travellers}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTravellers((prev) => Math.min(8, prev + 1))}
                        className="w-6 h-6 rounded-lg bg-[#FF572E] text-white hover:bg-[#E64A22] font-black text-xs flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        +
                      </button>
                    </div>

                  </div>
                </div>


                {/* Error Banner */}
                {error && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold rounded-xl text-center">
                    {error}
                  </div>
                )}


                {/* Submit Action Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-6 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-xl sm:rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Search className="w-4 h-4 stroke-[2.5]" />
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

            </div>

          </div>
        </motion.div>

      </div>
    </ResponsiveShell>
  );
}
