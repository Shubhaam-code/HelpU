import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, SignIn, SignUp } from '@clerk/clerk-react';
import { 
  Car, Users, ShieldCheck, Coins, ArrowRight, X, Play, Award, Star
} from 'lucide-react';

// 3 decorative accent sparks \ | / matching reference image
function AccentSparks({ className = '' }) {
  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" className={`inline-block ${className}`}>
      <line x1="4" y1="20" x2="2" y2="8" stroke="#FF5B37" strokeWidth="3" strokeLinecap="round" />
      <line x1="14" y1="18" x2="15" y2="4" stroke="#FF5B37" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="20" x2="28" y2="8" stroke="#FF5B37" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}


export default function OnboardingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();

  // Auth modal states: null | 'signIn' | 'signUp'
  const [authModal, setAuthModal] = useState(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/home', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const openAuth = (mode = 'signUp') => {
    navigate(`/auth?mode=${mode}`);
  };

  const closeAuth = () => {
    setAuthModal(null);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    // Exact background color sampled from the reference image: #FEF3EF
    <div className="min-h-screen bg-[#FEF3EF] text-[#17233C] font-sans relative overflow-x-hidden selection:bg-[#FF5B37]/20 selection:text-[#FF5B37]">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR                                                             */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FEF3EF]/95 backdrop-blur-md px-4 sm:px-8 lg:px-12 py-3.5 border-b border-[#F5E5DC] transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo - Using user's logo.png */}
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-bold text-[#17233C] relative py-1 cursor-pointer"
            >
              Home
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5B37] rounded-full" />
            </button>
            <button 
              onClick={() => scrollToSection('features')}
              className="text-sm font-semibold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer"
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm font-semibold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer"
            >
              How it Works
            </button>
            <button 
              onClick={() => scrollToSection('about')}
              className="text-sm font-semibold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer"
            >
              About
            </button>
          </nav>

          {/* Right Action Button: Log In only */}
          <div className="flex items-center">
            <button
              onClick={() => openAuth('signIn')}
              className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-[#17233C] bg-white border border-[#E8D8CD] hover:bg-[#FFF9F6] hover:border-[#D9C4B7] shadow-2xs hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              Log In
            </button>
          </div>

        </div>
      </header>


      {/* ========================================================================= */}
      {/* 2. HERO SECTION — TWO-COLUMN RESPONSIVE LAYOUT                             */}
      {/* ========================================================================= */}
      <section className="relative pt-6 sm:pt-8 lg:pt-12 pb-6 sm:pb-8 px-4 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[0.88fr_1.12fr] items-center gap-8 lg:gap-8 relative">
          
          {/*
            =====================================================================
            LEFT COLUMN — 45% width
            - For Campus Students badge
            - Controlled 2-line Heading with sparks
            - Description
            - Get Started + Watch How It Works buttons
            - Student avatars & Campus trust badge
            =====================================================================
          */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col justify-center space-y-5 sm:space-y-6 z-10"
          >
            {/* For Campus Students Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFE3CF] border border-[#FFD1B5] text-[#FF5B37] text-xs sm:text-sm font-extrabold shadow-2xs w-fit">
              <span className="text-sm">🎓</span>
              <span className="tracking-wide">For Campus Students</span>
            </div>

            {/* Heading with Controlled Line Breaks & Sparks */}
            <h1 className="font-black text-[#17233C] text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[52px] leading-[1.12] tracking-tight">
              <span className="block whitespace-nowrap">
                Ride, Share, Get Help —
              </span>
              <span className="block mt-1 sm:mt-1.5 whitespace-nowrap">
                <span>Within </span>
                <span className="text-[#FF5B37] relative inline-block">
                  Your Campus
                  <AccentSparks className="ml-2 sm:ml-2.5 -mt-2 sm:-mt-3" />
                </span>
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="text-[#596277] text-sm sm:text-base lg:text-[17px] font-medium leading-relaxed max-w-lg">
              A student-only platform to <strong className="font-bold text-[#17233C]">find rides</strong>, <strong className="font-bold text-[#17233C]">share seats</strong>, and <strong className="font-bold text-[#17233C]">get or offer help</strong> across your campus.
            </p>

            {/* Action Buttons: Get Started + Watch How It Works */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
              <button
                onClick={() => openAuth('signUp')}
                className="flex items-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 rounded-full font-black text-white bg-[#FF5B37] hover:bg-[#F04F2B] text-sm sm:text-base shadow-lg shadow-[#FF5B37]/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.8} />
              </button>

              <button
                onClick={() => scrollToSection('how-it-works')}
                className="flex items-center gap-2.5 px-6 sm:px-7 py-3.5 sm:py-4 rounded-full font-extrabold text-[#17233C] bg-white border border-[#E8D8CD] hover:bg-[#FFF9F6] hover:border-[#D9C4B7] text-sm sm:text-base shadow-2xs hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#FFE4D3] text-[#FF5B37] flex items-center justify-center shrink-0">
                  <Play className="w-3 h-3 fill-[#FF5B37] ml-0.5" />
                </div>
                <span>How It Works</span>
              </button>
            </div>


          </motion.div>

          {/*
            =====================================================================
            RIGHT COLUMN — 55% width
            - Transparent student illustration
            - Contained entirely within the right column (max-w-[720px])
            - Zero white box, zero overlap with heading/buttons
            =====================================================================
          */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative w-full max-w-[720px] ml-auto overflow-visible flex justify-center lg:justify-end items-end"
          >
            <img 
              src="/image.png" 
              alt="HelpU Campus Students" 
              className="w-full h-auto object-contain object-bottom block select-none pointer-events-none"
            />
          </motion.div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 3. FOUR FEATURE FLOATING PILL CARDS                                       */}
      {/* ========================================================================= */}
      <section id="features" className="px-4 sm:px-8 lg:px-12 py-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/95 rounded-[32px] sm:rounded-full p-3 sm:p-4 shadow-sm border border-[#F4E3D8] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 divide-y sm:divide-y-0 lg:divide-x divide-[#F7EBE2]">
            
            {/* 1. Find & Share Rides */}
            <div className="flex items-center gap-3.5 px-3 py-2">
              <div className="w-12 h-12 rounded-2xl bg-[#FFE4D3] text-[#FF5B37] flex items-center justify-center shrink-0">
                <Car className="w-6 h-6 text-[#FF5B37]" />
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-sm leading-snug">
                  Find & Share Rides
                </h3>
                <p className="text-[#6E7587] text-[11px] font-medium mt-0.5">
                  Travel with verified students
                </p>
              </div>
            </div>

            {/* 2. Get Campus Help */}
            <div className="flex items-center gap-3.5 px-3 py-2 pt-3 sm:pt-2">
              <div className="w-12 h-12 rounded-2xl bg-[#DDF1FF] text-[#2563EB] flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-sm leading-snug">
                  Get Campus Help
                </h3>
                <p className="text-[#6E7587] text-[11px] font-medium mt-0.5">
                  Ask or offer help to peers
                </p>
              </div>
            </div>

            {/* 3. Travel Safely */}
            <div className="flex items-center gap-3.5 px-3 py-2 pt-3 sm:pt-2">
              <div className="w-12 h-12 rounded-2xl bg-[#D7F5E3] text-[#16A34A] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-[#16A34A]" />
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-sm leading-snug">
                  Travel Safely
                </h3>
                <p className="text-[#6E7587] text-[11px] font-medium mt-0.5">
                  Campus-verified & trusted
                </p>
              </div>
            </div>

            {/* 4. Save Time & Money */}
            <div className="flex items-center gap-3.5 px-3 py-2 pt-3 sm:pt-2">
              <div className="w-12 h-12 rounded-2xl bg-[#EFE7FF] text-[#7C3AED] flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-sm leading-snug">
                  Save Time & Money
                </h3>
                <p className="text-[#6E7587] text-[11px] font-medium mt-0.5">
                  Share costs and ride together
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ========================================================================= */}
      {/* 4. HOW HELPU WORKS? SECTION                                               */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="px-4 sm:px-8 lg:px-12 py-12 lg:py-16 relative">
        <div className="max-w-7xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center mb-10">
            <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight inline-flex items-center">
              <span className="text-[#17233C]">How </span>
              <span className="text-[#FF5B37] ml-2">HelpU </span>
              <span className="text-[#17233C] ml-2">Works?</span>
              <AccentSparks className="ml-2.5 -mt-2 sm:-mt-3" />
            </h2>
            <p className="text-[#6E7587] text-sm sm:text-base font-medium mt-2">
              Get started in just 3 simple steps.
            </p>
          </div>

          {/* 3 Steps in a Row with Arrows */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-6 relative">
            
            {/* Step 1 */}
            <div className="flex-1 w-full bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#F4E3D8] flex items-center gap-4 relative">
              <div className="w-13 h-13 rounded-2xl bg-[#FFE4D3] text-[#FF5B37] flex items-center justify-center shrink-0">
                <span className="text-2xl">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="w-5 h-5 rounded-full bg-[#FF5B37] text-white text-[11px] font-black flex items-center justify-center mb-1">
                  1
                </div>
                <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base leading-snug">
                  Create an Account
                </h3>
                <p className="text-[#6E7587] text-xs mt-1 font-medium leading-relaxed">
                  Sign up with your campus email
                </p>
              </div>
            </div>

            {/* Arrow 1 */}
            <div className="hidden md:flex text-[#FF5B37] shrink-0 font-black text-xl">
              →
            </div>

            {/* Step 2 */}
            <div className="flex-1 w-full bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#F4E3D8] flex items-center gap-4 relative">
              <div className="w-13 h-13 rounded-2xl bg-[#FFE4D3] text-[#FF5B37] flex items-center justify-center shrink-0">
                <Car className="w-6 h-6 text-[#FF5B37]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="w-5 h-5 rounded-full bg-[#FF5B37] text-white text-[11px] font-black flex items-center justify-center mb-1">
                  2
                </div>
                <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base leading-snug">
                  Request or Offer a Ride
                </h3>
                <p className="text-[#6E7587] text-xs mt-1 font-medium leading-relaxed">
                  Post a ride or find a match
                </p>
              </div>
            </div>

            {/* Arrow 2 */}
            <div className="hidden md:flex text-[#FF5B37] shrink-0 font-black text-xl">
              →
            </div>

            {/* Step 3 */}
            <div className="flex-1 w-full bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#F4E3D8] flex items-center gap-4 relative">
              <div className="w-13 h-13 rounded-2xl bg-[#FFE4D3] text-[#FF5B37] flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-[#FF5B37]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="w-5 h-5 rounded-full bg-[#FF5B37] text-white text-[11px] font-black flex items-center justify-center mb-1">
                  3
                </div>
                <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base leading-snug">
                  Connect & Travel
                </h3>
                <p className="text-[#6E7587] text-xs mt-1 font-medium leading-relaxed">
                  Coordinate and ride together safely
                </p>
              </div>
            </div>

          </div>

        </div>


      </section>


      {/* ========================================================================= */}
      {/* 5. FOOTER (MATCHING REFERENCE PALETTE)                                    */}
      {/* ========================================================================= */}
      <footer id="about" className="border-t border-[#F2E3D8] bg-[#FEF3EF]/90 py-8 px-4 sm:px-8 text-center relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="h-7 w-auto object-contain"
            />
            <span className="text-xs text-[#6E7587] ml-2">© {new Date().getFullYear()} Campus Ride & Assistance Network.</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#6E7587] font-semibold">
            <button onClick={() => scrollToSection('features')} className="hover:text-[#17233C] cursor-pointer">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-[#17233C] cursor-pointer">How It Works</button>
            <button onClick={() => openAuth('signIn')} className="hover:text-[#FF5B37] font-bold cursor-pointer">Sign In</button>
          </div>
        </div>
      </footer>


      {/* ========================================================================= */}
      {/* 6. CLERK AUTHENTICATION MODAL                                             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {authModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAuth}
              className="absolute inset-0 bg-[#17233C]/60 backdrop-blur-sm"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#F4E3D8] p-6 sm:p-8 z-10 overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={closeAuth}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FEF3EF] hover:bg-gray-100 text-[#17233C] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Brand Header */}
              <div className="flex items-center gap-2.5 mb-4">
                <img 
                  src="/logo.png" 
                  alt="Helpu" 
                  className="h-9 w-auto object-contain"
                />
              </div>

              {/* Toggle Tabs: Sign In / Sign Up */}
              <div className="flex bg-[#FEF3EF] rounded-2xl p-1 mb-6 border border-[#F4E3D8]">
                <button
                  onClick={() => setAuthModal('signIn')}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    authModal === 'signIn'
                      ? 'bg-white text-[#17233C] shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17233C]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthModal('signUp')}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    authModal === 'signUp'
                      ? 'bg-white text-[#17233C] shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17233C]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Clerk Auth Component */}
              <div className="w-full">
                {authModal === 'signIn' ? (
                  <SignIn
                    routing="hash"
                    appearance={{
                      elements: {
                        rootBox: 'w-full',
                        card: 'shadow-none border-none p-0 bg-transparent',
                        headerTitle: 'font-extrabold text-[#17233C] text-xl',
                        headerSubtitle: 'text-[#6E7587] text-xs',
                        formButtonPrimary: 'bg-[#FF5B37] hover:bg-[#F04F2B] text-white rounded-2xl font-bold py-3 text-sm shadow-sm shadow-[#FF5B37]/30',
                        socialButtonsBlockButton: 'border border-gray-200 rounded-2xl font-semibold text-[#17233C] hover:bg-[#FEF3EF]',
                        formFieldInput: 'rounded-2xl border-gray-200 focus:border-[#FF5B37] focus:ring-[#FF5B37]/20 text-[#17233C] text-sm',
                        footer: 'hidden',
                      },
                    }}
                  />
                ) : (
                  <SignUp
                    routing="hash"
                    appearance={{
                      elements: {
                        rootBox: 'w-full',
                        card: 'shadow-none border-none p-0 bg-transparent',
                        headerTitle: 'font-extrabold text-[#17233C] text-xl',
                        headerSubtitle: 'text-[#6E7587] text-xs',
                        formButtonPrimary: 'bg-[#FF5B37] hover:bg-[#F04F2B] text-white rounded-2xl font-bold py-3 text-sm shadow-sm shadow-[#FF5B37]/30',
                        socialButtonsBlockButton: 'border border-gray-200 rounded-2xl font-semibold text-[#17233C] hover:bg-[#FEF3EF]',
                        formFieldInput: 'rounded-2xl border-gray-200 focus:border-[#FF5B37] focus:ring-[#FF5B37]/20 text-[#17233C] text-sm',
                        footer: 'hidden',
                      },
                    }}
                  />
                )}
              </div>

              {/* Note */}
              <p className="text-center text-[11px] text-[#6E7587] mt-5">
                Campus-verified platform. Only verified students are allowed.
              </p>
            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
