import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, ShieldCheck, ChevronDown, Check, Lock, 
  User, CreditCard, GitBranch, Globe, CheckCircle2, Sparkles, Info
} from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { useUser } from '../context/FirebaseAuthContext';
import { saveProfile } from '../lib/api';
import { useAuthProfile } from '../context/AuthProfileContext';
import { invalidateProfileQueries } from '../lib/queryClient';
import { getPendingDraftReturnPath, saveProfileDraft, getProfileDraft } from '../utils/guestDraft';

/**
 * Sanitize a returnTo URL so that only safe internal application paths are
 * accepted. External URLs, protocol-relative URLs (//), and any non-path
 * strings are rejected and fall back to null.
 */
function sanitizeReturnTo(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (/^\/[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

const COUNTRIES = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
];

const BRANCH_OPTIONS = [
  'B.Tech – Computer Science & Engineering',
  'B.Tech – CSE (Artificial Intelligence & Machine Learning)',
  'B.Tech – CSE (Cyber Security)',
  'B.Tech – Electronics & Communication Engineering',
  'B.Tech – Mechanical Engineering',
  'B.Tech – Electrical & Electronics Engineering',
  'B.Tech – Bioengineering',
  'B.Tech – Aerospace Engineering',
  'Integrated M.Tech – CSE',
  'BCA / MCA',
  'Other Branch'
];

const YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Postgraduate / Research'
];

function WhatsAppIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function WhatsAppOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { profile, setWhatsAppNumber, refreshProfile } = useAuthProfile();

  // Form states with intelligent prefill from authenticated Google account / profile
  const initialName = profile?.fullName || profile?.name || user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.displayName || '';
  const initialReg = profile?.registrationNumber || '';
  const initialBranch = profile?.branch || BRANCH_OPTIONS[0];
  const initialYear = profile?.year || YEAR_OPTIONS[1];
  
  // Extract clean local number if user already has an existing saved number
  const existingNum = (profile?.whatsappNumber || profile?.phone || '').replace(/^\+91/, '').replace(/[^\d]/g, '');

  const [fullName, setFullName] = useState(initialName);
  const [registrationNumber, setRegistrationNumber] = useState(initialReg);
  const [branch, setBranch] = useState(initialBranch);
  const [year, setYear] = useState(initialYear);

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default: India (+91)
  const [phoneNumber, setPhoneNumber] = useState(existingNum);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Sync state if profile loads dynamically
  useEffect(() => {
    if (!fullName && (profile?.fullName || profile?.name || user?.fullName)) {
      setFullName(profile?.fullName || profile?.name || user?.fullName || '');
    }
    if (!registrationNumber && profile?.registrationNumber) {
      setRegistrationNumber(profile.registrationNumber);
    }
    if (profile?.branch) {
      setBranch(profile.branch);
    }
    if (profile?.year) {
      setYear(profile.year);
    }
    if (!phoneNumber && (profile?.whatsappNumber || profile?.phone)) {
      setPhoneNumber((profile.whatsappNumber || profile.phone).replace(/^\+91/, '').replace(/[^\d]/g, ''));
    }
  }, [profile, user]);

  // Restore guest profile draft on mount
  useEffect(() => {
    const draft = getProfileDraft();
    if (draft && draft.data) {
      const d = draft.data;
      if (!fullName && d.name) setFullName(d.name);
      if (!registrationNumber && d.registrationNumber) setRegistrationNumber(d.registrationNumber);
      if (d.branch) setBranch(d.branch);
      if (d.year) setYear(d.year);
      if (!phoneNumber && (d.whatsappNumber || d.phone)) {
        const num = (d.whatsappNumber || d.phone).replace(/^\+91/, '').replace(/[^\d]/g, '');
        setPhoneNumber(num);
      }
      if (d.whatsappCountryCode) {
        const matchedCountry = COUNTRIES.find((c) => c.code === d.whatsappCountryCode);
        if (matchedCountry) setSelectedCountry(matchedCountry);
      }
    }
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, ''); // Digits only
    setPhoneNumber(value);
    if (error) setError('');
  };

  const validateAndSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    // 1. Validate Full Name
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full student name.');
      return;
    }

    // 2. Validate Registration Number
    const cleanReg = registrationNumber.trim().toUpperCase();
    if (!cleanReg || cleanReg.length < 5) {
      setError('Please enter a valid Registration Number (e.g. 22BCE1234).');
      return;
    }

    // 3. Validate Phone Number
    const rawPhone = phoneNumber.trim();
    if (!rawPhone) {
      setError('Please enter your WhatsApp phone number.');
      return;
    }

    try {
      if (!isValidPhoneNumber(rawPhone, selectedCountry.code)) {
        setError(`Please enter a valid phone number for ${selectedCountry.name} (${selectedCountry.dial}).`);
        return;
      }

      const parsed = parsePhoneNumber(rawPhone, selectedCountry.code);
      const normalizedNumber = parsed.number; // E.164 (+919876543210)

      setLoading(true);

      const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || profile?.email || '';

      const payload = {
        name: cleanName,
        email: userEmail,
        college: profile?.college || 'VIT, Bhopal',
        registrationNumber: cleanReg,
        branch: branch,
        year: year,
        phone: normalizedNumber,
        whatsappNumber: normalizedNumber,
        whatsappCountryCode: selectedCountry.code
      };

      // ── GUEST FLOW ────────────────────────────────────────────────────────
      // If unauthenticated, save details in localStorage guest draft and
      // proceed directly to /home so the guest can freely explore the platform.
      if (!user) {
        saveProfileDraft(payload);
        const rawReturn = searchParams.get('returnTo');
        const returnTarget = sanitizeReturnTo(rawReturn) || sanitizeReturnTo(getPendingDraftReturnPath()) || '/home';
        navigate(returnTarget, { replace: true });
        return;
      }
      // ──────────────────────────────────────────────────────────────────────

      // Call saveProfile to persist student profile in database
      await saveProfile(payload);
      invalidateProfileQueries();

      // Instantly update context profile state
      setWhatsAppNumber(normalizedNumber);
      if (refreshProfile) {
        await refreshProfile().catch(() => {});
      }

      // Smoothly navigate back to intended form or main module
      const rawReturn = searchParams.get('returnTo');
      const returnTarget = sanitizeReturnTo(rawReturn) || sanitizeReturnTo(getPendingDraftReturnPath()) || '/home';
      navigate(returnTarget, { replace: true });
    } catch (err) {
      console.error('Error saving student profile setup:', err);
      let userFriendlyMessage = 'Failed to save student profile. Please check your network and try again.';
      if (err.response?.data?.message) {
        userFriendlyMessage = err.response.data.message;
      } else if (err.message) {
        userFriendlyMessage = err.message;
      }
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] font-sans relative overflow-x-hidden selection:bg-[#F59E0B]/20 selection:text-[#D97706] pb-10">
      
      {/* Subtle warm background glow */}
      <div 
        aria-hidden="true" 
        className="absolute top-0 right-0 w-72 sm:w-80 h-72 sm:h-80 bg-gradient-to-bl from-[#FDE68A]/50 via-[#FDE047]/15 to-transparent pointer-events-none rounded-bl-full blur-2xl" 
      />

      {/* Main Container - Mobile First (Max-W-MD) */}
      <div className="max-w-md sm:max-w-lg mx-auto px-4 sm:px-6 pt-3 space-y-4 sm:space-y-5 relative z-10">

        {/* ======================================================================= */}
        {/* 1. TOP HEADER: LOGO                                                     */}
        {/* ======================================================================= */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 select-none">
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="h-8 sm:h-9 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex items-center">
              <span className="font-black text-xl tracking-tight text-[#17233C]">Help</span>
              <span className="font-black text-xl tracking-tight text-[#FF572E]">u</span>
            </div>
          </div>
        </header>

        {/* ======================================================================= */}
        {/* 2. TOP HERO ILLUSTRATION BANNER                                         */}
        {/* ======================================================================= */}
        <div className="relative w-full pt-1 overflow-hidden select-none">
          <img
            src="/student-setup-banner.png"
            alt="Helpu Slot Match and Ride Together"
            className="w-full h-auto max-h-[190px] sm:max-h-[220px] object-contain mx-auto"
            loading="eager"
          />
        </div>

        {/* ======================================================================= */}
        {/* 3. MAIN HEADING & SUBTITLE                                              */}
        {/* ======================================================================= */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight leading-tight flex items-center justify-center gap-1.5">
            <span>Set Up Your</span>
            <span className="relative inline-block px-2 py-0.5 rounded-xl bg-[#FEF08A]/70 text-[#17233C]">
              Student Profile
              {/* Decorative yellow sunburst accent */}
              <span className="absolute -top-1 -right-3 text-[#F59E0B]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <line x1="4" y1="18" x2="2" y2="6" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                  <line x1="12" y1="20" x2="15" y2="4" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                  <line x1="20" y1="18" x2="24" y2="8" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-[#5A6275] font-medium pt-0.5">
            Use Helpu for Slot Match & Ride together 🚗 🎓
          </p>
        </div>

        {/* ======================================================================= */}
        {/* 4. MAIN FORM CARD: STUDENT DETAILS & WHATSAPP                           */}
        {/* ======================================================================= */}
        <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] shadow-sm shadow-[#F4E3D8]/50 p-4 min-[380px]:p-5 sm:p-6 space-y-5">
          <form onSubmit={validateAndSubmit} className="space-y-4 sm:space-y-5">

            {/* ── SECTION A: STUDENT DETAILS ─────────────────────────────────── */}
            <div className="space-y-3">
              {/* Badge Heading */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#17233C] text-xs font-black shadow-2xs">
                <User className="w-3.5 h-3.5 text-[#D97706] stroke-[2.8]" />
                <span>Student Details</span>
              </div>

              {/* Field 1: Full Name */}
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] min-[380px]:text-xs font-black text-[#17233C]">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                    <User className="w-3 h-3 stroke-[2.6]" />
                  </div>
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your full name"
                  required
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm placeholder:text-[#9CA3AF] transition-all outline-none"
                />
              </div>

              {/* Field 2: Registration Number */}
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] min-[380px]:text-xs font-black text-[#17233C]">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                    <CreditCard className="w-3 h-3 stroke-[2.6]" />
                  </div>
                  <span>Registration Number</span>
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => {
                    setRegistrationNumber(e.target.value.toUpperCase().replace(/\s/g, ''));
                    if (error) setError('');
                  }}
                  placeholder="22BCE1234"
                  maxLength={15}
                  required
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm placeholder:text-[#9CA3AF] tracking-wide transition-all outline-none uppercase"
                />
              </div>

              {/* Field 3: Branch Dropdown */}
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] min-[380px]:text-xs font-black text-[#17233C]">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                    <GitBranch className="w-3 h-3 stroke-[2.6]" />
                  </div>
                  <span>Branch</span>
                </label>
                <div className="relative">
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm appearance-none cursor-pointer outline-none transition-all pr-10"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#9CA3AF] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.4]" />
                </div>
              </div>
            </div>

            {/* Subtle Divider */}
            <hr className="border-t border-[#F4E3D8]/70" />

            {/* ── SECTION B: CONNECT ON WHATSAPP ─────────────────────────────── */}
            <div className="space-y-3">
              {/* Badge Heading */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#166534] text-xs font-black shadow-2xs">
                <WhatsAppIcon className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Connect on WhatsApp</span>
              </div>

              {/* Field 4: Country / Region */}
              <div className="space-y-1" ref={dropdownRef}>
                <label className="flex items-center gap-1.5 text-[11px] min-[380px]:text-xs font-black text-[#17233C]">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                    <Globe className="w-3 h-3 stroke-[2.6]" />
                  </div>
                  <span>Country / Region</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] hover:border-[#F59E0B]/50 transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{selectedCountry.flag}</span>
                      <span className="font-bold text-xs sm:text-sm text-[#17233C]">
                        {selectedCountry.name} ({selectedCountry.dial})
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {showCountryDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-[#F4E3D8] rounded-2xl shadow-xl max-h-56 overflow-y-auto no-scrollbar p-1.5 space-y-0.5"
                      >
                        {COUNTRIES.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(c);
                              setShowCountryDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                              selectedCountry.code === c.code
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'hover:bg-[#FFFDF9] text-[#17233C]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                            </span>
                            <span className="text-xs text-[#6E7587] font-semibold">{c.dial}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Field 5: WhatsApp Phone Number */}
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] min-[380px]:text-xs font-black text-[#17233C]">
                  <div className="w-4.5 h-4.5 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                    <WhatsAppIcon className="w-3 h-3 text-[#16A34A]" />
                  </div>
                  <span>WhatsApp Phone Number</span>
                </label>

                {/* Dial Code Pill + Local Phone Input Group */}
                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus-within:border-[#F59E0B] focus-within:ring-2 focus-within:ring-[#F59E0B]/20 transition-all">
                  <div className="px-3 py-1.5 rounded-xl bg-[#FEF3C7] text-[#854D0E] font-black text-xs sm:text-sm shrink-0 border border-[#FDE68A] select-none">
                    {selectedCountry.dial}
                  </div>
                  <span className="text-[#D1D5DB] font-light">|</span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="9876543210"
                    maxLength={15}
                    required
                    className="w-full py-1 pr-3 bg-transparent text-[#17233C] font-black text-xs sm:text-sm placeholder:text-[#9CA3AF] outline-none tracking-wide"
                  />
                </div>

                {/* Helper text */}
                <p className="flex items-center gap-1 text-[10px] min-[360px]:text-[10.5px] text-[#6E7587] font-medium pt-0.5">
                  <Info className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                  <span>Enter your 10-digit number without country code or symbols.</span>
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 border border-rose-200 rounded-2xl"
              >
                <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{error}</span>
                </p>
              </motion.div>
            )}

            {/* Campus Privacy Card */}
            <div className="flex items-center gap-2.5 p-2.5 min-[380px]:p-3 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534]">
              <div className="w-6.5 h-6.5 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <p className="text-[10.5px] min-[380px]:text-[11px] leading-snug">
                <strong className="font-black text-[#14532D]">Campus Privacy:</strong> Number is shared only with verified students whose ride booking is confirmed.
              </p>
            </div>

            {/* Complete Setup Yellow Gradient Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-[#FBBF24] via-[#F59E0B] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#D97706] text-[#17233C] font-black text-sm sm:text-base shadow-md shadow-[#F59E0B]/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#17233C] border-t-transparent rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>Complete Setup →</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* ======================================================================= */}
        {/* 5. FOOTER: SHIELD ICON + BRAND NOTE                                     */}
        {/* ======================================================================= */}
        <footer className="text-center pt-2 space-y-2 select-none">
          <p className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#6E7587]">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B] stroke-[2.4]" />
            <span>Helpu • Slot Match & Ride for Students</span>
          </p>

          {/* Decorative bottom corner yellow hills and greenery */}
          <div className="w-full flex justify-between items-end opacity-90 pointer-events-none px-2 pt-1">
            <svg width="45" height="28" viewBox="0 0 45 28" fill="none">
              <path d="M0 28C10 20 25 15 45 22V28H0Z" fill="#FDE68A" opacity="0.6" />
              <circle cx="10" cy="18" r="6" fill="#86EFAC" opacity="0.8" />
              <circle cx="20" cy="14" r="8" fill="#4ADE80" opacity="0.9" />
            </svg>

            <svg width="45" height="28" viewBox="0 0 45 28" fill="none">
              <path d="M45 28C35 20 20 15 0 22V28H45Z" fill="#FDE68A" opacity="0.6" />
              <circle cx="35" cy="18" r="6" fill="#86EFAC" opacity="0.8" />
              <circle cx="25" cy="14" r="8" fill="#4ADE80" opacity="0.9" />
            </svg>
          </div>
        </footer>

      </div>

    </div>
  );
}
