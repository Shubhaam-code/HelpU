import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Calendar, Clock, Users, ArrowUpDown, 
  Search, ArrowLeft, Check, Sparkles, Car as CarIcon, 
  MoreHorizontal, ShieldCheck 
} from 'lucide-react';
import { createTravel } from '../lib/api';

// Cute & Modern Vehicle SVG Thumbnails matching reference design
function OmniCarIcon({ className = "w-9 sm:w-10 h-6 sm:h-7" }) {
  return (
    <svg viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Boxy Omni Van Body */}
      <rect x="6" y="8" width="50" height="24" rx="4" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.5" />
      <path d="M6 16 L20 8 H52 L56 16" fill="#E5E7EB" />
      {/* Windows */}
      <rect x="9" y="10" width="10" height="9" rx="1.5" fill="#17213D" opacity="0.8" />
      <rect x="22" y="10" width="13" height="9" rx="1.5" fill="#17213D" opacity="0.8" />
      <rect x="38" y="10" width="14" height="9" rx="1.5" fill="#17213D" opacity="0.8" />
      {/* Sliding Door line */}
      <line x1="36" y1="10" x2="36" y2="28" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="1 1" />
      {/* Front Bumper & Headlamp */}
      <rect x="4" y="24" width="3" height="4" rx="1" fill="#FF572E" />
      <circle cx="7" cy="22" r="2" fill="#FBBF24" />
      {/* Wheels */}
      <circle cx="16" cy="33" r="6" fill="#1F2937" />
      <circle cx="16" cy="33" r="2.5" fill="#9CA3AF" />
      <circle cx="46" cy="33" r="6" fill="#1F2937" />
      <circle cx="46" cy="33" r="2.5" fill="#9CA3AF" />
    </svg>
  );
}

function CretaCarIcon({ className = "w-9 sm:w-10 h-6 sm:h-7" }) {
  return (
    <svg viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Modern SUV Creta Body */}
      <path d="M8 22 L14 12 L26 8 H42 L52 14 L58 20 V28 H8 Z" fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="1.5" />
      {/* Roof rails */}
      <line x1="24" y1="6" x2="44" y2="6" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
      {/* Windows */}
      <path d="M16 13 L24 10 H34 V19 H13 Z" fill="#17213D" opacity="0.85" />
      <path d="M37 10 H43 L49 15 V19 H37 Z" fill="#17213D" opacity="0.85" />
      {/* Front LED grille */}
      <rect x="54" y="21" width="4" height="3" rx="1" fill="#3B82F6" />
      {/* Wheels */}
      <circle cx="17" cy="31" r="6.5" fill="#1F2937" />
      <circle cx="17" cy="31" r="3" fill="#D1D5DB" />
      <circle cx="47" cy="31" r="6.5" fill="#1F2937" />
      <circle cx="47" cy="31" r="3" fill="#D1D5DB" />
    </svg>
  );
}

function EecoCarIcon({ className = "w-9 sm:w-10 h-6 sm:h-7" }) {
  return (
    <svg viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Maruti Eeco Van Body */}
      <rect x="7" y="10" width="49" height="22" rx="3.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1.5" />
      <path d="M7 17 L16 11 H50 L54 17" fill="#D1D5DB" />
      {/* Windows */}
      <rect x="10" y="12" width="11" height="8" rx="1" fill="#17213D" opacity="0.8" />
      <rect x="24" y="12" width="13" height="8" rx="1" fill="#17213D" opacity="0.8" />
      <rect x="40" y="12" width="13" height="8" rx="1" fill="#17213D" opacity="0.8" />
      {/* Body Decal Stripe */}
      <line x1="8" y1="23" x2="55" y2="23" stroke="#0284C7" strokeWidth="1.5" />
      {/* Wheels */}
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
      const departureTime = time 
        ? new Date(`${date}T${time}`).toISOString() 
        : new Date(`${date}T08:00:00`).toISOString();

      await createTravel({
        from: fromLoc.trim(),
        to: toLoc.trim(),
        departureTime,
        availableSeats: travellers,
        pricePerSeat: mode === 'offer' ? (Number(pricePerSeat) || 0) : 0,
        type: mode,
        carModel: preferredCar === 'Other' ? 'Campus Ride' : preferredCar,
        timeFlexibility: 30,
      });

      navigate('/rides', { replace: true });
    } catch (err) {
      console.error('Ride post error:', err);
      navigate(`/rides?from=${encodeURIComponent(fromLoc)}&to=${encodeURIComponent(toLoc)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden bg-[#FFF7F2] text-[#17213D] flex flex-col justify-between selection:bg-[#FF572E]/20 relative">
      
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-br from-[#FFE7DA] via-[#FFF0E7] to-transparent rounded-full blur-3xl opacity-60 transform translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#FFE2D4] via-[#FFF3EB] to-transparent rounded-full blur-3xl opacity-50 transform -translate-x-1/4 translate-y-1/4" />
      </div>

      {/* ========================================================================= */}
      {/* TOP NAVBAR (Clean, No duplicate black HelpU text)                         */}
      {/* ========================================================================= */}
      <header className="relative z-10 w-full px-4 sm:px-8 lg:px-10 py-2.5 sm:py-3 flex items-center justify-between border-b border-[#F4E3D8]/80 bg-[#FFF7F2]/90 backdrop-blur-md shrink-0">
        
        {/* HelpU Brand Logo (Image only, without duplicated black text) */}
        <div 
          onClick={() => navigate('/home')} 
          className="flex items-center cursor-pointer group select-none"
        >
          <img 
            src="/logo.png" 
            alt="HelpU" 
            className="h-7 sm:h-8 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-2xs" 
          />
        </div>

        {/* Back to Home Button */}
        <button
          onClick={() => navigate('/home')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white rounded-full border border-[#F2DDD2] text-[#17213D] hover:text-[#FF572E] text-xs font-bold shadow-xs hover:bg-[#FFF7F2] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>
      </header>


      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTENT (Fit in 1 screen ~100vh)                          */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 py-2 sm:py-3 lg:py-2 flex items-center justify-center min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center w-full my-auto">
          
          {/* --------------------------------------------------------------------- */}
          {/* LEFT COLUMN: BRANDING, VALUE PROPS & CAR.PNG ILLUSTRATION             */}
          {/* --------------------------------------------------------------------- */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-5 flex flex-col justify-center space-y-2.5 sm:space-y-3 lg:pr-2 select-none"
          >
            {/* Travel Preferences Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE3CF] border border-[#FFD1B5] text-[#FF572E] text-[11px] sm:text-xs font-black shadow-2xs w-fit">
              <Sparkles className="w-3.5 h-3.5 text-[#FF572E]" />
              <span>Travel Preferences</span>
            </div>

            {/* Main Heading matching the screenshot */}
            <div className="space-y-1">
              <h1 className="font-black text-[#17213D] text-2xl sm:text-3xl lg:text-[36px] leading-[1.12] tracking-tight">
                <span>Set Your Ride </span>
                <span className="text-[#FF572E] relative inline-block">
                  Preferences
                  {/* Decorative orange rays \ / */}
                  <span className="absolute -top-2.5 -right-5 text-[#FF572E] text-lg font-black select-none pointer-events-none">
                    \ /
                  </span>
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-[#596277] text-xs sm:text-sm font-medium leading-relaxed max-w-sm pt-0.5">
                {mode === 'offer'
                  ? 'Share your empty seats, split travel costs, and journey with verified college peers!'
                  : 'Help us find the best matches for your travel needs!'}
              </p>
            </div>

            {/*
              ===================================================================
              CAR.PNG ILLUSTRATION (Compact height so entire page fits ~100vh)
              ===================================================================
            */}
            <div className="relative w-full pt-1 flex justify-center lg:justify-start items-end overflow-hidden">
              <img 
                src="/car.png" 
                alt="HelpU Ride Travel Illustration" 
                className="w-auto max-w-full h-auto max-h-[170px] sm:max-h-[210px] lg:max-h-[230px] xl:max-h-[260px] object-contain select-none pointer-events-none drop-shadow-sm"
              />
            </div>

          </motion.div>


          {/* --------------------------------------------------------------------- */}
          {/* RIGHT COLUMN: "YOUR TRAVEL DETAILS" PREFERENCES CARD                  */}
          {/* --------------------------------------------------------------------- */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-7 flex justify-center lg:justify-end w-full"
          >
            <div className="w-full max-w-[530px] bg-white rounded-3xl p-4 sm:p-5 lg:p-5.5 shadow-xl shadow-[#17213D]/5 border border-[#F4E3D8] relative">
              
              {/* Header Title & Mode Switcher on the Right */}
              <div className="flex items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFEAE3] text-[#FF572E] flex items-center justify-center shrink-0 shadow-xs">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF572E]" />
                  </div>
                  <div>
                    <h2 className="font-black text-[#17213D] text-base sm:text-lg tracking-tight leading-tight">
                      Your Travel Details
                    </h2>
                    <p className="text-[#6E7587] text-[10px] sm:text-[11px] font-medium leading-none mt-0.5">
                      Choose your route, date and preferences
                    </p>
                  </div>
                </div>

                {/* Offer Ride / Find Request Toggle Switcher on Right side */}
                <div className="inline-flex bg-[#FFF7F2] p-0.5 rounded-full border border-[#F4E3D8] shadow-2xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setMode('offer')}
                    className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                      mode === 'offer'
                        ? 'bg-[#FF572E] text-white shadow-xs'
                        : 'text-[#6E7587] hover:text-[#17213D]'
                    }`}
                  >
                    Offer Ride
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('request')}
                    className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                      mode === 'request'
                        ? 'bg-[#FF572E] text-white shadow-xs'
                        : 'text-[#6E7587] hover:text-[#17213D]'
                    }`}
                  >
                    Find / Request
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-2.5">
                
                {/* Route Section (From & To with Interchange button) */}
                <div className="relative space-y-2">
                  
                  {/* From Field */}
                  <div className="bg-[#FFFBF8] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-[#F5E2D6] focus-within:border-[#FF572E] focus-within:ring-2 focus-within:ring-[#FF572E]/15 transition-all">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF572E]" />
                      <span>From</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                      <input
                        type="text"
                        list="from-locations"
                        value={fromLoc}
                        onChange={(e) => setFromLoc(e.target.value)}
                        placeholder="e.g. VIT, Bhopal"
                        className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17213D] placeholder:text-[#A0A6B5] focus:outline-none"
                      />
                    </div>
                    <datalist id="from-locations">
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                  {/* Swap / Interchange Button */}
                  <div className="absolute right-4 top-[50%] -translate-y-1/2 z-10">
                    <button
                      type="button"
                      onClick={handleSwapLocations}
                      title="Swap Departure and Destination"
                      className="w-7 h-7 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E] hover:bg-[#FFF7F2] hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#FF572E]" />
                    </button>
                  </div>

                  {/* To Field */}
                  <div className="bg-[#FFFBF8] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-[#F5E2D6] focus-within:border-[#FF572E] focus-within:ring-2 focus-within:ring-[#FF572E]/15 transition-all">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#17213D]" />
                      <span>To</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#17213D] shrink-0" />
                      <input
                        type="text"
                        list="to-locations"
                        value={toLoc}
                        onChange={(e) => setToLoc(e.target.value)}
                        placeholder="e.g. Bhopal Railway Station"
                        className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17213D] placeholder:text-[#A0A6B5] focus:outline-none"
                      />
                    </div>
                    <datalist id="to-locations">
                      {POPULAR_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                </div>


                {/* Date & Time Row (Two Columns) */}
                <div className="grid grid-cols-2 gap-2.5">
                  
                  {/* Date Input */}
                  <div className="bg-[#FFFBF8] rounded-xl sm:rounded-2xl p-2.5 border border-[#F5E2D6] focus-within:border-[#FF572E] transition-all">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <Calendar className="w-3 h-3 text-[#FF572E]" />
                      <span>Date</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17213D] focus:outline-none cursor-pointer py-0.5"
                    />
                  </div>

                  {/* Time Input */}
                  <div className="bg-[#FFFBF8] rounded-xl sm:rounded-2xl p-2.5 border border-[#F5E2D6] focus-within:border-[#FF572E] transition-all">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-[#6E7587] uppercase tracking-wider mb-0.5">
                      <Clock className="w-3 h-3 text-[#FF572E]" />
                      <span>Time (Optional)</span>
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#17213D] focus:outline-none cursor-pointer py-0.5"
                    />
                  </div>

                </div>


                {/* Preferred Car Selection Section */}
                <div className="pt-0.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#FFEAE3] flex items-center justify-center text-[#FF572E]">
                        <CarIcon className="w-3 h-3" />
                      </div>
                      <span className="font-extrabold text-[#17213D] text-xs">Preferred Car</span>
                    </div>
                    <span className="text-[10px] text-[#6E7587]">Choose your vehicle type</span>
                  </div>

                  {/* 4 Car Tiles Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    
                    {/* 1. Omni */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Omni')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                        preferredCar === 'Omni'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F5E2D6] bg-[#FFFBF8] hover:bg-white'
                      }`}
                    >
                      {preferredCar === 'Omni' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-2xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <OmniCarIcon className="w-8 sm:w-10 h-5.5 sm:h-6 mb-0.5" />
                      <span className="text-[11px] font-black text-[#17213D]">Omni</span>
                    </button>

                    {/* 2. Creta */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Creta')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                        preferredCar === 'Creta'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F5E2D6] bg-[#FFFBF8] hover:bg-white'
                      }`}
                    >
                      {preferredCar === 'Creta' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-2xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <CretaCarIcon className="w-8 sm:w-10 h-5.5 sm:h-6 mb-0.5" />
                      <span className="text-[11px] font-black text-[#17213D]">Creta</span>
                    </button>

                    {/* 3. Eeco */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Eeco')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                        preferredCar === 'Eeco'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F5E2D6] bg-[#FFFBF8] hover:bg-white'
                      }`}
                    >
                      {preferredCar === 'Eeco' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-2xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <EecoCarIcon className="w-8 sm:w-10 h-5.5 sm:h-6 mb-0.5" />
                      <span className="text-[11px] font-black text-[#17213D]">Eeco</span>
                    </button>

                    {/* 4. Other */}
                    <button
                      type="button"
                      onClick={() => setPreferredCar('Other')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                        preferredCar === 'Other'
                          ? 'border-[#FF572E] bg-white ring-2 ring-[#FF572E]/15 shadow-2xs'
                          : 'border-[#F5E2D6] bg-[#FFFBF8] hover:bg-white'
                      }`}
                    >
                      {preferredCar === 'Other' && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shadow-2xs">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-8 sm:w-10 h-5.5 sm:h-6 flex items-center justify-center text-[#6E7587] mb-0.5">
                        <MoreHorizontal className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-black text-[#17213D]">Other</span>
                    </button>

                  </div>
                </div>


                {/* Max. Co-travellers & Optional Price */}
                <div className="flex items-center justify-between gap-3 bg-[#FFFBF8] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-[#F5E2D6]">
                  
                  {/* Travellers Info */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#FFEAE3] text-[#FF572E] flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[#17213D] text-xs leading-none">Max. Co-travellers</h4>
                      <p className="text-[10px] text-[#6E7587] mt-0.5">How many seats needed?</p>
                    </div>
                  </div>

                  {/* Counter [- 1 +] and optional Price input */}
                  <div className="flex items-center gap-3">
                    {mode === 'offer' && (
                      <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-[#E5E7EB]">
                        <span className="font-bold text-[#FF572E] text-xs">₹</span>
                        <input
                          type="number"
                          value={pricePerSeat}
                          onChange={(e) => setPricePerSeat(e.target.value)}
                          placeholder="350"
                          title="Price per seat"
                          className="w-14 text-xs font-black text-[#17213D] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTravellers((prev) => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-full bg-white border border-[#E5E7EB] text-[#17213D] hover:bg-[#FFF7F2] font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                      >
                        −
                      </button>
                      <span className="font-black text-[#17213D] text-sm min-w-[16px] text-center">
                        {travellers}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTravellers((prev) => Math.min(8, prev + 1))}
                        className="w-7 h-7 rounded-full bg-[#FF572E] text-white hover:bg-[#E64A22] font-black text-xs flex items-center justify-center cursor-pointer shadow-xs"
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


                {/* Big Orange Primary Action Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 px-6 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Search className="w-4 h-4 stroke-[2.5]" />
                    <span>{loading ? 'Processing...' : mode === 'offer' ? 'Offer Ride >' : 'Find Rides >'}</span>
                  </button>
                </div>

              </form>

              {/* Bottom Trust Badge */}
              <div className="mt-2.5 pt-2 border-t border-[#F5E5DC] flex items-center justify-center gap-1.5 text-[10px] text-[#6E7587] font-semibold text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span>Protected by verified college student network</span>
              </div>

            </div>
          </motion.div>

        </div>
      </main>


      {/* Compact Minimal Footer */}
      <footer className="relative z-10 px-4 sm:px-8 py-2 text-center text-[10px] text-[#8C93A4] font-medium border-t border-[#F4E3D8]/60 bg-[#FFF7F2]/60 shrink-0">
        HelpU • Campus Ride & Community Network • © {new Date().getFullYear()}
      </footer>

    </div>
  );
}
