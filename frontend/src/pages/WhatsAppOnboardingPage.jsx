import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, ChevronDown, Check, Phone, Lock, Sparkles } from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { useUser } from '@clerk/clerk-react';
import { saveProfile, updateProfile } from '../lib/api';
import { useAuthProfile } from '../context/AuthProfileContext';

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

export default function WhatsAppOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { profile, setWhatsAppNumber, skipWhatsAppOnboarding } = useAuthProfile();

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default: India
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const dropdownRef = useRef(null);

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

    const raw = phoneNumber.trim();
    if (!raw) {
      setError('Please enter your WhatsApp mobile number.');
      return;
    }

    try {
      if (!isValidPhoneNumber(raw, selectedCountry.code)) {
        setError(`Please enter a valid phone number for ${selectedCountry.name} (${selectedCountry.dial}).`);
        return;
      }

      const parsed = parsePhoneNumber(raw, selectedCountry.code);
      const normalizedNumber = parsed.number; // E.164 (+919876543210)

      setLoading(true);

      const payload = {
        name: user?.fullName || profile?.name || 'Campus Student',
        email: user?.primaryEmailAddress?.emailAddress || profile?.email || '',
        phone: normalizedNumber,
        whatsappNumber: normalizedNumber,
        whatsappCountryCode: selectedCountry.code
      };

      // Call saveProfile which POSTs to /api/students/profile (ensures both phone and whatsappNumber are saved)
      await saveProfile(payload);

      // Instantly update context profile state
      setWhatsAppNumber(normalizedNumber);

      // Smoothly direct to home page
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Error saving WhatsApp number:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save WhatsApp number. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    skipWhatsAppOnboarding();
    navigate('/home', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FFF8F3] text-[#17233C] flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 -left-20 w-80 h-80 bg-[#FFE4D5]/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Brand Bar */}
      <header className="relative z-10 max-w-md w-full mx-auto flex items-center justify-between pt-2 sm:pt-4">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="HelpU" 
            className="h-8 sm:h-9 w-auto object-contain select-none"
            draggable="false"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#F4E3D8] text-[11px] font-bold text-[#6E7587] shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#FF572E]" />
          <span>Quick Setup</span>
        </div>
      </header>

      {/* Main Form Card Container */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-white rounded-[32px] border border-[#F4E3D8] shadow-xl shadow-[#17233C]/5 p-6 sm:p-9 space-y-6"
        >
          {/* Real WhatsApp Official Brand Icon */}
          <div className="flex justify-center">
            <div className="relative group">
              <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[#E8F8EE] to-[#DCF5E3] border border-[#B8EBC4] flex items-center justify-center p-3.5 shadow-md shadow-[#25D366]/15 transition-transform group-hover:scale-105">
                <img
                  src="/whatsapp.svg"
                  alt="WhatsApp"
                  className="w-13 h-13 object-contain select-none drop-shadow-sm"
                  draggable="false"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#16A34A] border-2 border-white text-white flex items-center justify-center text-xs shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-[26px] font-black text-[#17233C] tracking-tight">
              Connect on WhatsApp
            </h1>
            <p className="text-xs sm:text-sm text-[#6E7587] leading-relaxed max-w-xs mx-auto">
              Add your WhatsApp number so co-passengers and ride hosts can coordinate pickups directly.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={validateAndSubmit} className="space-y-4 pt-1">
            
            {/* Country Selector */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                Country / Region
              </label>
              <button
                type="button"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-2xl text-left text-sm font-semibold text-[#17233C] hover:bg-white hover:border-[#FF572E]/40 transition-all focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-xl leading-none">{selectedCountry.flag}</span>
                  <span className="font-bold text-[#17233C]">{selectedCountry.name}</span>
                  <span className="text-xs font-bold text-[#6E7587]">({selectedCountry.dial})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-[#6E7587] transition-transform duration-200 ${showCountryDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showCountryDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-20 w-full mt-2 bg-white border border-[#F4E3D8] rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-[#FDF2EC]"
                  >
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(c);
                          setShowCountryDropdown(false);
                          setError('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors text-left ${
                          selectedCountry.code === c.code ? 'bg-[#FFF2EB] text-[#FF572E]' : 'hover:bg-[#FFF8F3] text-[#17233C]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl leading-none">{c.flag}</span>
                          <span className="font-bold">{c.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[#6E7587]">{c.dial}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Phone Number Input */}
            <div>
              <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                WhatsApp Phone Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1 text-xs font-black text-[#17233C] bg-[#FFF2EB] px-2.5 py-1.5 rounded-xl border border-[#FCD8C5] pointer-events-none select-none">
                  <span>{selectedCountry.dial}</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder={selectedCountry.code === 'IN' ? '98765 43210' : 'Mobile number'}
                  className="w-full pl-22 pr-4 py-3.5 bg-[#FFFBF8] border border-[#F4E3D8] rounded-2xl text-sm font-bold text-[#17233C] tracking-wide placeholder:font-normal placeholder:text-[#A0A6B5] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 focus:border-[#FF572E] focus:bg-white transition-all"
                  disabled={loading}
                />
              </div>
              <p className="mt-1 text-[11px] text-[#A0A6B5] pl-1">
                Enter your 10-digit number without country code or symbols
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl"
              >
                <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                  <span>⚠️</span> {error}
                </p>
              </motion.div>
            )}

            {/* Privacy Callout */}
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534]">
              <Lock className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong className="font-bold">Campus Privacy:</strong> Number is shared only with verified students whose ride booking is confirmed.
              </p>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={loading || !phoneNumber.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-sm rounded-2xl shadow-lg shadow-[#FF572E]/25 hover:shadow-xl hover:shadow-[#FF572E]/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Number...</span>
                </div>
              ) : (
                <>
                  <span>Save & Continue</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>

            {/* Skip Button */}
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="w-full py-2.5 text-xs sm:text-sm font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer disabled:opacity-50"
            >
              Skip for now, I'll add it later
            </button>

          </form>

        </motion.div>
      </main>

      {/* Bottom Footer Note */}
      <footer className="relative z-10 max-w-md w-full mx-auto text-center pb-2">
        <p className="text-[11px] text-[#A0A6B5] flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
          <span>HelpU Campus Mobility Network</span>
        </p>
      </footer>

    </div>
  );
}
