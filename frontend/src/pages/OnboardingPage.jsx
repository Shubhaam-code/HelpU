import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  ArrowRight, Zap, ShieldCheck, Users, Sprout, 
  User, LayoutGrid, Plus, Car, GraduationCap
} from 'lucide-react';

export default function OnboardingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();

  // If already logged in, redirect straight to home
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/slotmate', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const openAuth = (mode = 'signUp') => {
    navigate(`/auth?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] font-sans relative overflow-x-clip selection:bg-[#F59E0B]/20 selection:text-[#D97706] touch-pan-y">
      
      {/* ========================================================================= */}
      {/* 0. TOP-RIGHT WARM GLOW — painted once, pointer-events-none                */}
      {/* ========================================================================= */}
      <div 
        aria-hidden="true" 
        className="landing-bg-glow absolute top-0 right-0 w-64 sm:w-80 h-64 sm:h-80 bg-gradient-to-bl from-[#FDE68A]/60 via-[#FDE047]/20 to-transparent rounded-bl-full blur-2xl pointer-events-none select-none" 
      />

      {/* Decorative top-right flame swoosh — SVG is lightweight, no blur needed */}
      <div className="absolute top-1 right-2 sm:right-6 pointer-events-none select-none opacity-90">
        <svg width="120" height="90" viewBox="0 0 120 90" fill="none" className="text-[#FBBF24] pointer-events-none">
          <path 
            d="M120 0C90 10 70 30 65 60C80 40 100 25 120 15V0Z" 
            fill="url(#yellowGlow)" 
            opacity="0.85" 
          />
          {/* Floating confetti shapes */}
          <rect x="75" y="60" width="8" height="4" rx="2" transform="rotate(25 75 60)" fill="#F59E0B" />
          <rect x="95" y="45" width="9" height="4.5" rx="2" transform="rotate(-30 95 45)" fill="#FBBF24" />
          <circle cx="50" cy="50" r="2.5" fill="#F59E0B" />
          <circle cx="85" cy="20" r="3" fill="#FBBF24" />
          <defs>
            <linearGradient id="yellowGlow" x1="120" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FDE68A" />
              <stop offset="1" stopColor="#F59E0B" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CONTAINER: STRICTLY MOBILE-FIRST (MAX-W-MD)                          */}
      {/* ========================================================================= */}
      <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 sm:px-6 pt-3 pb-0 space-y-6 sm:space-y-7 relative z-10 touch-pan-y">

        {/* ======================================================================= */}
        {/* A. HEADER (MINIMAL & CLEAN: HELPU LOGO + LOG IN)                       */}
        {/* ======================================================================= */}
        <header className="flex items-center justify-between py-1">
          <div 
            onClick={() => window.scrollTo({ top: 0 })}
            className="flex items-center cursor-pointer select-none touch-manipulation"
          >
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="h-8 sm:h-9 w-auto object-contain pointer-events-none select-none"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </div>

          {/* Clean minimal Log In pill */}
          <button
            type="button"
            onClick={() => openAuth('signIn')}
            className="px-4 py-1.5 rounded-full text-xs font-black text-[#17233C] bg-white border border-[#F4E3D8] hover:bg-[#FFF8F3] hover:border-[#F59E0B]/50 shadow-2xs active:scale-95 transition-all cursor-pointer touch-manipulation"
          >
            Log In
          </button>
        </header>

        {/* ======================================================================= */}
        {/* B. HERO SECTION                                                         */}
        {/* ======================================================================= */}
        <section className="space-y-3 pt-1 touch-pan-y">
          {/* Main Heading matching reference screenshot exactly */}
          <h1 className="text-[30px] min-[375px]:text-[34px] sm:text-[40px] font-black text-[#17233C] tracking-tight leading-[1.12]">
            Ride Together.<br />
            Study Together.<br />
            Grow Together on{' '}
            <span className="relative inline-block text-[#FF572E]">
              Helpu.
              {/* Decorative yellow sunburst rays */}
              <span className="absolute -top-1.5 -right-4 min-[375px]:-right-5 text-[#F59E0B] pointer-events-none select-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="pointer-events-none">
                  <line x1="4" y1="18" x2="2" y2="6" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                  <line x1="12" y1="20" x2="15" y2="4" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                  <line x1="20" y1="18" x2="24" y2="8" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs min-[375px]:text-[13px] sm:text-sm text-[#5A6275] font-medium leading-relaxed max-w-sm pt-0.5">
            Find rides, match your classes, and stay connected with your college peers — all in one student-only platform. 🚀
          </p>

          {/* CTA Button */}
          <div className="flex items-center pt-2">
            {/* Get Started Without Login Button */}
            <button
              type="button"
              onClick={() => navigate('/slotmate')}
              className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF451A] hover:from-[#FF572E] hover:to-[#E63E15] text-white font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 active:scale-95 transition-all cursor-pointer whitespace-nowrap touch-manipulation"
            >
              <span>Get Started Without Login</span>
              <ArrowRight className="w-4 h-4 stroke-[2.8] pointer-events-none" />
            </button>
          </div>

          {/* Boy and Girl Student Illustration — above the fold, eager load, pointer-events-none */}
          <div className="relative w-full pt-1 overflow-hidden select-none pointer-events-none touch-pan-y">
            <img
              src="/landing-hero-students.png"
              alt="Helpu Students with Yellow Car and Campus"
              className="landing-img-eager w-full h-auto max-h-[290px] sm:max-h-[350px] object-contain mx-auto pointer-events-none select-none"
              loading="eager"
              decoding="async"
              width="600"
              height="290"
              draggable={false}
            />
          </div>
        </section>

        {/* ======================================================================= */}
        {/* C. MAIN FEATURES (TWO ATTRACTIVE 2-COL CARDS) - STATIC PRESENTATION    */}
        {/* ======================================================================= */}
        <section className="grid grid-cols-2 gap-3 sm:gap-3.5 w-full select-none touch-pan-y">
          {/* Card 1: PoolMate */}
          <div 
            className="group relative rounded-[22px] sm:rounded-[26px] bg-gradient-to-b from-[#FFF5ED] via-[#FFF9F5] to-white border border-[#FFE4D6] p-3 sm:p-4 flex flex-col justify-between shadow-2xs touch-pan-y"
          >
            {/* Top Car Illustration — lazy load below fold, pointer-events-none */}
            <div className="w-full flex items-center justify-center py-1 sm:py-2 pointer-events-none select-none">
              <img
                src="/landing-car.png"
                alt="PoolMate Yellow Car"
                className="landing-img h-14 sm:h-18 w-auto object-contain pointer-events-none select-none"
                loading="lazy"
                decoding="async"
                width="120"
                height="80"
                draggable={false}
              />
            </div>

            <div className="space-y-1 mt-1 pointer-events-none select-none">
              {/* Title & Arrow */}
              <div className="flex items-center justify-between gap-1">
                <h3 className="font-black text-sm sm:text-base text-[#17233C] tracking-tight">
                  PoolMate
                </h3>
                <div className="w-5.5 h-5.5 rounded-full bg-[#FF572E] text-white flex items-center justify-center shrink-0 shadow-2xs pointer-events-none">
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.8]" />
                </div>
              </div>

              {/* Description */}
              <p className="text-[10px] min-[360px]:text-[11px] text-[#6E7587] font-medium leading-tight">
                Find & share rides with trusted students.
              </p>

              {/* 3 Pills: Carpool | Save Cost | Safer */}
              <div className="flex flex-wrap items-center gap-1 pt-1.5">
                <span className="px-1.5 min-[360px]:px-2 py-0.5 rounded-full bg-[#FFEFE6] text-[#D9532A] text-[9px] min-[360px]:text-[9.5px] font-black border border-[#FFD9C7]">
                  Carpool
                </span>
                <span className="px-1.5 min-[360px]:px-2 py-0.5 rounded-full bg-[#FFEFE6] text-[#D9532A] text-[9px] min-[360px]:text-[9.5px] font-black border border-[#FFD9C7]">
                  Save Cost
                </span>
                <span className="px-1.5 min-[360px]:px-2 py-0.5 rounded-full bg-[#FFEFE6] text-[#D9532A] text-[9px] min-[360px]:text-[9.5px] font-black border border-[#FFD9C7]">
                  Safer
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: SlotMate */}
          <div 
            className="group relative rounded-[22px] sm:rounded-[26px] bg-gradient-to-b from-[#FEFCE8] via-[#FFFDF5] to-white border border-[#FEF08A] p-3 sm:p-4 flex flex-col justify-between shadow-2xs touch-pan-y"
          >
            {/* Top Books & Graduation Cap Illustration — lazy load below fold, pointer-events-none */}
            <div className="w-full flex items-center justify-center py-1 sm:py-2 pointer-events-none select-none">
              <img
                src="/landing-cap-books.png"
                alt="SlotMate Books & Cap"
                className="landing-img h-14 sm:h-18 w-auto object-contain pointer-events-none select-none"
                loading="lazy"
                decoding="async"
                width="120"
                height="80"
                draggable={false}
              />
            </div>

            <div className="space-y-1 mt-1 pointer-events-none select-none">
              {/* Title & Arrow */}
              <div className="flex items-center justify-between gap-1">
                <h3 className="font-black text-sm sm:text-base text-[#17233C] tracking-tight">
                  SlotMate
                </h3>
                <div className="w-5.5 h-5.5 rounded-full bg-[#F59E0B] text-white flex items-center justify-center shrink-0 shadow-2xs pointer-events-none">
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.8]" />
                </div>
              </div>

              {/* Description */}
              <p className="text-[10px] min-[360px]:text-[11px] text-[#6E7587] font-medium leading-tight">
                Find classmates in your course & slot.
              </p>

              {/* 3 Pills: Match | Collaborate | Study */}
              <div className="flex flex-wrap items-center gap-1 pt-1.5">
                <span className="px-1.5 min-[360px]:px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[9px] min-[360px]:text-[9.5px] font-black border border-[#FDE68A]">
                  Match
                </span>
                <span className="px-1.5 min-[360px]:px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[9px] min-[360px]:text-[9.5px] font-black border border-[#FDE68A]">
                  Collaborate
                </span>
                <span className="px-1.5 min-[360px]:px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[9px] min-[360px]:text-[9.5px] font-black border border-[#FDE68A]">
                  Study
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================================= */}
        {/* D. WHY STUDENTS LOVE HELPU? ❤️                                         */}
        {/* ======================================================================= */}
        <section className="space-y-2.5 w-full touch-pan-y">
          <h2 className="font-black text-sm min-[360px]:text-base sm:text-lg text-[#17233C] flex items-center gap-1.5 tracking-tight select-none">
            <span>Why Students Love</span>
            <span className="text-[#FF572E]">Helpu?</span>
            <span>❤️</span>
          </h2>

          <div className="grid grid-cols-4 gap-1.5 min-[360px]:gap-2 sm:gap-2.5 w-full select-none touch-pan-y">
            {/* 1. Save Time */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FFFBEB] border border-[#FEF3C7] p-2 min-[360px]:p-2.5 flex flex-col items-center text-center shadow-2xs touch-pan-y">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <Zap className="w-3.5 h-3.5 min-[360px]:w-4 min-[360px]:h-4 fill-[#F59E0B] stroke-[#D97706]" />
              </div>
              <span className="text-[9.5px] min-[360px]:text-[10.5px] sm:text-xs font-black text-[#17233C] leading-tight pointer-events-none">
                Save<br />Time
              </span>
            </div>

            {/* 2. Campus Verified */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#F0FDF4] border border-[#DCFCE7] p-2 min-[360px]:p-2.5 flex flex-col items-center text-center shadow-2xs touch-pan-y">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <ShieldCheck className="w-3.5 h-3.5 min-[360px]:w-4 min-[360px]:h-4 stroke-[2.4]" />
              </div>
              <span className="text-[9.5px] min-[360px]:text-[10.5px] sm:text-xs font-black text-[#17233C] leading-tight pointer-events-none">
                Campus<br />Verified
              </span>
            </div>

            {/* 3. Make Connections */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FFF7ED] border border-[#FFEDD5] p-2 min-[360px]:p-2.5 flex flex-col items-center text-center shadow-2xs touch-pan-y">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <Users className="w-3.5 h-3.5 min-[360px]:w-4 min-[360px]:h-4 stroke-[2.4]" />
              </div>
              <span className="text-[9.5px] min-[360px]:text-[10.5px] sm:text-xs font-black text-[#17233C] leading-tight pointer-events-none">
                Make<br />Connections
              </span>
            </div>

            {/* 4. Support Each Other */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF5FF] border border-[#F3E8FF] p-2 min-[360px]:p-2.5 flex flex-col items-center text-center shadow-2xs touch-pan-y">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <Sprout className="w-3.5 h-3.5 min-[360px]:w-4 min-[360px]:h-4 stroke-[2.4]" />
              </div>
              <span className="text-[9.5px] min-[360px]:text-[10.5px] sm:text-xs font-black text-[#17233C] leading-tight pointer-events-none">
                Support<br />Each Other
              </span>
            </div>
          </div>
        </section>

        {/* ======================================================================= */}
        {/* E. HOW IT WORKS? ✨                                                     */}
        {/* ======================================================================= */}
        <section className="space-y-2.5 w-full touch-pan-y">
          <div className="select-none">
            <h2 className="font-black text-sm min-[360px]:text-base sm:text-lg text-[#17233C] flex items-center gap-1.5 tracking-tight">
              <span>How It Works?</span>
              <span className="text-[#F59E0B]">✨</span>
            </h2>
            <p className="text-[10.5px] min-[360px]:text-[11.5px] sm:text-xs text-[#6E7587] font-medium">
              Get started in just 4 simple steps.
            </p>
          </div>

          <div className="flex items-center justify-between gap-1 sm:gap-2 w-full pt-1 select-none touch-pan-y">
            {/* Step 1 */}
            <div className="flex-1 flex flex-col items-center text-center touch-pan-y">
              <div className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.4]" />
              </div>
              <span className="text-[9px] min-[360px]:text-[10px] sm:text-[11px] font-black text-[#17233C] leading-tight pointer-events-none">
                Create<br />Your Account
              </span>
            </div>

            <span className="text-[#D97706]/50 text-xs font-black shrink-0 -mt-3 pointer-events-none">→</span>

            {/* Step 2 */}
            <div className="flex-1 flex flex-col items-center text-center touch-pan-y">
              <div className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <LayoutGrid className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.4]" />
              </div>
              <span className="text-[9px] min-[360px]:text-[10px] sm:text-[11px] font-black text-[#17233C] leading-tight pointer-events-none">
                Choose<br />PoolMate or<br />SlotMate
              </span>
            </div>

            <span className="text-[#D97706]/50 text-xs font-black shrink-0 -mt-3 pointer-events-none">→</span>

            {/* Step 3 */}
            <div className="flex-1 flex flex-col items-center text-center touch-pan-y">
              <div className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
              </div>
              <span className="text-[9px] min-[360px]:text-[10px] sm:text-[11px] font-black text-[#17233C] leading-tight pointer-events-none">
                Post Your<br />Ride or<br />Course
              </span>
            </div>

            <span className="text-[#D97706]/50 text-xs font-black shrink-0 -mt-3 pointer-events-none">→</span>

            {/* Step 4 */}
            <div className="flex-1 flex flex-col items-center text-center touch-pan-y">
              <div className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1 shadow-2xs pointer-events-none">
                <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.4]" />
              </div>
              <span className="text-[9px] min-[360px]:text-[10px] sm:text-[11px] font-black text-[#17233C] leading-tight pointer-events-none">
                Discover<br />Matches &<br />Connect
              </span>
            </div>
          </div>
        </section>

        {/* ======================================================================= */}
        {/* F. BOTTOM CAMPUS DECORATIVE ILLUSTRATION — lazy load, pointer-events-none */}
        {/* ======================================================================= */}
        <section className="relative -mx-4 sm:-mx-6 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] pt-2 pb-0 overflow-hidden select-none -mb-px pointer-events-none touch-pan-y">
          <img
            src="/landing-campus-footer.png"
            alt="Helpu Campus Road Car Landscape"
            className="landing-img w-full h-auto object-cover mx-auto block pointer-events-none select-none"
            loading="lazy"
            decoding="async"
            width="800"
            height="300"
            draggable={false}
          />
        </section>

      </div>
    </div>
  );
}
