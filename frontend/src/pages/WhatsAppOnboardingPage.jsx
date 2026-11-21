import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Lock, CheckCircle2, Info, ChevronDown, Check, ShieldCheck
} from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { useUser } from '../context/FirebaseAuthContext';
import { saveProfile } from '../lib/api';
import { useAuthProfile } from '../context/AuthProfileContext';
import { invalidateProfileQueries } from '../lib/queryClient';
import { getPendingDraftReturnPath, saveProfileDraft, getProfileDraft } from '../utils/guestDraft';

/**
 * Sanitize a returnTo URL so that only safe internal application paths are accepted.
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

  // Track whether the user has started filling the form — once true, we do NOT auto-populate
  // from background profile syncs to prevent premature navigation or state clobbering mid-form.
  const hasUserStartedTypingRef = useRef(false);

  // Initial values from profile or draft (read once on mount)
  const initialReg = profile?.registrationNumber || '';
  const existingNum = (profile?.whatsappNumber || profile?.phone || '').replace(/^\+91/, '').replace(/[^\d]/g, '');

  // Only two user-entered state fields as per Part 4
  const [registrationNumber, setRegistrationNumber] = useState(initialReg);
  const [phoneNumber, setPhoneNumber] = useState(existingNum);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default: India (+91)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const countryDropdownRef = useRef(null);

  // Sync if profile loads dynamically — but ONLY before the user has started typing.
  // This prevents a background profile fetch from wiping the user's partially-typed form.
  useEffect(() => {
    if (hasUserStartedTypingRef.current) return;
    if (!registrationNumber && profile?.registrationNumber) {
      setRegistrationNumber(profile.registrationNumber);
    }
    if (!phoneNumber && (profile?.whatsappNumber || profile?.phone)) {
      setPhoneNumber((profile.whatsappNumber || profile.phone).replace(/^\+91/, '').replace(/[^\d]/g, ''));
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore guest draft on mount if present
  useEffect(() => {
    const draft = getProfileDraft();
    if (draft && draft.data) {
      const d = draft.data;
      if (!registrationNumber && d.registrationNumber) setRegistrationNumber(d.registrationNumber);
      if (!phoneNumber && (d.whatsappNumber || d.phone)) {
        setPhoneNumber((d.whatsappNumber || d.phone).replace(/^\+91/, '').replace(/[^\d]/g, ''));
      }
      if (d.whatsappCountryCode) {
        const matched = COUNTRIES.find((c) => c.code === d.whatsappCountryCode);
        if (matched) setSelectedCountry(matched);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePhoneChange = (e) => {
    hasUserStartedTypingRef.current = true;
    const val = e.target.value.replace(/[^\d]/g, ''); // Digits only
    setPhoneNumber(val);
    if (error) setError('');
  };

  const validateAndSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setError('');

    // 1. Validate Registration Number (Required)
    const cleanReg = registrationNumber.trim().toUpperCase().replace(/\s/g, '');
    if (!cleanReg || cleanReg.length < 5) {
      setError('Please enter a valid Registration Number (e.g. 22BCE1234).');
      return;
    }

    // 2. Validate WhatsApp Number (Required)
    const rawPhone = phoneNumber.trim();
    if (!rawPhone) {
      setError('Please enter your WhatsApp contact number.');
      return;
    }

    try {
      if (!isValidPhoneNumber(rawPhone, selectedCountry.code)) {
        setError(`Please enter a valid phone number for ${selectedCountry.name} (${selectedCountry.dial}).`);
        return;
      }

      const parsed = parsePhoneNumber(rawPhone, selectedCountry.code);
      const normalizedNumber = parsed.number; // E.164 (e.g. +919876543210)

      setLoading(true);

      // Prefer existing persisted student name over Google display name (BUG 1)
      const googleName = profile?.name?.trim() || user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.displayName || 'Campus Student';
      const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || user?.email || profile?.email || '';

      const payload = {
        name: googleName,
        email: userEmail,
        college: profile?.college || 'VIT, Bhopal',
        registrationNumber: cleanReg,
        branch: profile?.branch || '',
        year: profile?.year || '',
        phone: normalizedNumber,
        whatsappNumber: normalizedNumber,
        whatsappCountryCode: selectedCountry.code
      };

      // Unauthenticated guest flow
      if (!user) {
        saveProfileDraft(payload);
        const rawReturn = searchParams.get('returnTo');
        const returnTarget = sanitizeReturnTo(rawReturn) || sanitizeReturnTo(getPendingDraftReturnPath()) || '/home';
        navigate(returnTarget, { replace: true });
        return;
      }

      // Persist student profile in backend
      await saveProfile(payload);
      invalidateProfileQueries();

      // Update context profile state
      setWhatsAppNumber(normalizedNumber);
      if (refreshProfile) {
        await refreshProfile().catch(() => {});
      }

      // Navigate to return target or home
      const rawReturn = searchParams.get('returnTo');
      const returnTarget = sanitizeReturnTo(rawReturn) || sanitizeReturnTo(getPendingDraftReturnPath()) || '/home';
      navigate(returnTarget, { replace: true });
    } catch (err) {
      console.error('Error saving profile setup:', err);
      let userFriendlyMessage = 'Failed to save student profile. Please check your connection and try again.';
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
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] font-sans relative overflow-x-hidden pb-10">
      
      {/* Subtle warm background glow */}
      <div 
        aria-hidden="true" 
        className="absolute top-0 right-0 w-72 sm:w-80 h-72 sm:h-80 bg-gradient-to-bl from-[#FDE68A]/40 via-[#FDE047]/10 to-transparent pointer-events-none rounded-bl-full blur-2xl" 
      />

      {/* Main Container */}
      <div className="max-w-md mx-auto px-4 sm:px-6 pt-4 space-y-4 relative z-10">

        {/* Top Header: Logo */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center select-none">
            <img 
              src="/logo.png" 
              alt="Helpu" 
              className="h-8 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#D97706] text-xs font-black shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.8]" />
            <span>Verification Setup</span>
          </div>
        </header>

        {/* Hero Illustration Banner */}
        <div className="relative w-full pt-1 overflow-hidden select-none">
          <img
            src="/student-setup-banner.png"
            alt="Helpu Student Verification and WhatsApp Setup"
            className="w-full h-auto max-h-[175px] sm:max-h-[195px] object-contain mx-auto"
            loading="eager"
          />
        </div>

        {/* Heading & Subtitle */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight leading-tight flex items-center justify-center gap-1.5">
            <span>Student</span>
            <span className="relative inline-block px-2.5 py-0.5 rounded-xl bg-[#FEF08A]/80 text-[#17233C]">
              Verification
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-[#5A6275] font-medium pt-0.5">
            Complete your setup to unlock campus rides & slot matching 🎓
          </p>
        </div>

        {/* Simplified Two-Field Card (Part 4 & Part 5) */}
        <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] shadow-sm shadow-[#F4E3D8]/50 p-4 min-[380px]:p-5 sm:p-6 space-y-4">
          <form onSubmit={validateAndSubmit} className="space-y-4">

            {/* Field 1: Registration Number (Required) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-black text-[#17233C]">
                <div className="w-5 h-5 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 stroke-[2.6]" />
                </div>
                <span>Registration Number</span>
                <span className="text-[#FF572E] text-xs">*</span>
              </label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => {
                  hasUserStartedTypingRef.current = true;
                  setRegistrationNumber(e.target.value.toUpperCase().replace(/\s/g, ''));
                  if (error) setError('');
                }}
                placeholder="e.g. 22BCE1234"
                maxLength={15}
                required
                autoFocus
                className="w-full px-3.5 py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-black text-sm placeholder:text-[#9CA3AF] placeholder:font-normal tracking-wide transition-all outline-none uppercase"
              />
              <p className="text-[10.5px] text-[#8C93A4] font-medium pl-1">
                Your university student ID for campus verification.
              </p>
            </div>

            {/* Field 2: WhatsApp Number (Required) */}
            <div className="space-y-1.5" ref={countryDropdownRef}>
              <label className="flex items-center gap-1.5 text-xs font-black text-[#17233C]">
                <div className="w-5 h-5 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#16A34A]" />
                </div>
                <span>WhatsApp Number</span>
                <span className="text-[#FF572E] text-xs">*</span>
              </label>

              {/* Dial Code Pill + Phone Input Group */}
              <div className="relative">
                <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus-within:border-[#F59E0B] focus-within:ring-2 focus-within:ring-[#F59E0B]/20 transition-all">
                  
                  {/* Compact Country Selector Button */}
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FEF3C7] text-[#854D0E] font-black text-xs shrink-0 border border-[#FDE68A] hover:bg-[#FDE68A] transition-colors cursor-pointer select-none"
                    title="Select country code"
                  >
                    <span>{selectedCountry.flag}</span>
                    <span>{selectedCountry.dial}</span>
                    <ChevronDown className={`w-3 h-3 text-[#854D0E] transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <span className="text-[#D1D5DB] font-light">|</span>

                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="10-digit number"
                    maxLength={15}
                    required
                    className="w-full py-1.5 pr-3 bg-transparent text-[#17233C] font-black text-sm placeholder:text-[#9CA3AF] placeholder:font-normal outline-none tracking-wide"
                  />
                </div>

                {/* Compact, clean, mobile-responsive country dropdown (Part 5) */}
                <AnimatePresence>
                  {showCountryDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-[#F4E3D8] rounded-2xl shadow-xl max-h-52 w-64 overflow-y-auto p-1.5 space-y-0.5"
                    >
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c);
                            setShowCountryDropdown(false);
                            if (error) setError('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            selectedCountry.code === c.code
                              ? 'bg-[#FEF3C7] text-[#B45309]'
                              : 'hover:bg-[#FFFDF9] text-[#17233C]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-base">{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="text-xs text-[#6E7587] font-semibold">{c.dial}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Helper text */}
              <p className="flex items-center gap-1 text-[10.5px] text-[#8C93A4] font-medium pl-1">
                <Info className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                <span>Enter 10 digits without spaces or special characters.</span>
              </p>
            </div>

            {/* Error Notification */}
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

            {/* Campus Privacy Notice */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534]">
              <div className="w-6 h-6 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
                <Lock className="w-3 h-3 stroke-[2.5]" />
              </div>
              <p className="text-[10.5px] leading-snug">
                <strong className="font-black text-[#14532D]">Campus Privacy:</strong> Contact is shared exclusively with verified students on confirmed rides.
              </p>
            </div>

            {/* Complete Setup Yellow Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FBBF24] via-[#F59E0B] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#D97706] text-[#17233C] font-black text-sm shadow-md shadow-[#F59E0B]/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Footer */}
        <footer className="text-center pt-2 space-y-1 select-none">
          <p className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#6E7587]">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B] stroke-[2.4]" />
            <span>Helpu • Verified Campus Community</span>
          </p>
        </footer>

      </div>

    </div>
  );
}
