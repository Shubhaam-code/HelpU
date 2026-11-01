import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, SignIn, SignUp } from '@clerk/clerk-react';
import { ArrowLeft, ShieldCheck, Sparkles, Car } from 'lucide-react';

export default function AuthPage({ initialMode = 'signIn' }) {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode state: 'signIn' | 'signUp'
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState(modeParam === 'signUp' ? 'signUp' : initialMode);

  // Sync mode state with query params
  useEffect(() => {
    if (modeParam === 'signUp' || modeParam === 'signIn') {
      setMode(modeParam);
    }
  }, [modeParam]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/home', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setSearchParams({ mode: newMode });
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-[#FFF7F2] text-[#17213D] font-sans relative flex flex-col justify-between overflow-x-hidden lg:overflow-hidden selection:bg-[#FF572E]/20 selection:text-[#FF572E]">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-[#FFE4D5]/50 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FFE0D0]/40 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

      {/* ========================================================================= */}
      {/* TOP HEADER / BRAND NAVIGATION (72–76px HEIGHT)                           */}
      {/* ========================================================================= */}
      <header className="relative z-20 h-[72px] sm:h-[76px] px-4 sm:px-8 lg:px-12 border-b border-[#F4E3D8] bg-[#FFF7F2]/95 backdrop-blur-md shrink-0 flex items-center">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          
          {/* Logo & Brand Name - Improved size & alignment */}
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105" 
            />
          </Link>

          {/* Back to Home Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold text-[#17213D] bg-white border border-[#E8D8CD] hover:bg-[#FFF3EC] hover:border-[#D9C4B7] shadow-2xs hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF572E]" />
            <span>Back to Home</span>
          </Link>

        </div>
      </header>


      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTENT (COMPACT & BALANCED ~100VH)                       */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-2 flex items-center justify-center min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full my-auto">
          
          {/* --------------------------------------------------------------------- */}
          {/* LEFT COLUMN: BRANDING, VALUE PROPS & ILLUSTRATION CLOSE TO FORM       */}
          {/* --------------------------------------------------------------------- */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 flex flex-col justify-center space-y-2 lg:pr-2"
          >
            {/* Top Text & Value Points */}
            <div className="space-y-1.5 sm:space-y-2">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE3CF] border border-[#FFD1B5] text-[#FF572E] text-[11px] sm:text-xs font-extrabold shadow-2xs w-fit">
                <Sparkles className="w-3 h-3 text-[#FF572E]" />
                <span>Student-Only Campus Network</span>
              </div>

              {/* Main Heading */}
              <h1 className="font-black text-[#17213D] text-2xl sm:text-3xl lg:text-[32px] leading-[1.12] tracking-tight">
                {mode === 'signIn' ? (
                  <>
                    <span>Welcome back to </span>
                    <span className="text-[#FF572E]">HelpU</span>
                  </>
                ) : (
                  <>
                    <span>Join Your Campus </span>
                    <span className="text-[#FF572E]">Ride Network</span>
                  </>
                )}
              </h1>

              {/* Subtitle */}
              <p className="text-[#596277] text-xs sm:text-sm font-medium leading-relaxed max-w-md">
                Connect with verified college peers, share daily rides, split fuel costs, and get quick campus assistance safely.
              </p>

              {/* Feature Highlights Pills (Compact) */}
              <div className="hidden sm:flex flex-wrap items-center gap-2 pt-0.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-[#F2DDD2] text-[#17213D] text-[11px] font-bold shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Verified Campus Emails</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-[#F2DDD2] text-[#17213D] text-[11px] font-bold shadow-2xs">
                  <Car className="w-3.5 h-3.5 text-[#FF572E]" />
                  <span>Fast Route Matching</span>
                </div>
              </div>

            </div>

            {/*
              ===================================================================
              BACKGROUND ILLUSTRATION (auth.png)
              Aligned to the LEFT, matching the heading and badges.
              ===================================================================
            */}
            <div className="relative w-full overflow-hidden flex justify-center lg:justify-start items-end pt-1">
              <img 
                src="/auth.png" 
                alt="HelpU Campus Community Illustration" 
                className="w-auto max-w-full h-auto max-h-[190px] sm:max-h-[240px] lg:max-h-[290px] xl:max-h-[320px] object-contain object-left-bottom select-none pointer-events-none drop-shadow-sm"
              />
            </div>

          </motion.div>


          {/* --------------------------------------------------------------------- */}
          {/* RIGHT COLUMN: COMPACT CENTERED CLERK AUTHENTICATION CARD              */}
          {/* --------------------------------------------------------------------- */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-5 flex justify-center lg:justify-start w-full"
          >
            <div className="w-full max-w-[370px] sm:max-w-[380px] bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl shadow-[#17213D]/5 border border-[#F4E3D8] relative">
              
              {/* Header Title inside card */}
              <div className="mb-2.5">
                <h2 className="font-black text-[#17213D] text-lg sm:text-xl tracking-tight">
                  {mode === 'signIn' ? 'Sign In to HelpU' : 'Create an Account'}
                </h2>
                <p className="text-[#6E7587] text-[11px] sm:text-xs font-medium mt-0.5">
                  {mode === 'signIn' ? 'Continue with your college credentials' : 'Get started in under a minute'}
                </p>
              </div>

              {/* Mode Switcher Tabs (Sign In / Sign Up) */}
              <div className="flex bg-[#FFF7F2] rounded-xl p-0.5 mb-2.5 border border-[#F4E3D8]">
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    mode === 'signIn'
                      ? 'bg-white text-[#17213D] shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17213D]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signUp')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    mode === 'signUp'
                      ? 'bg-white text-[#17213D] shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17213D]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Clerk Auth Integration (Compact & Seamless) */}
              <div className="w-full">
                <AnimatePresence mode="wait">
                  {mode === 'signIn' ? (
                    <motion.div
                      key="signIn"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                    >
                      <SignIn
                        routing="hash"
                        fallbackRedirectUrl="/home"
                        signInFallbackRedirectUrl="/home"
                        appearance={{
                          layout: {
                            logoPlacement: 'none',
                            socialButtonsPlacement: 'top',
                            showOptionalFields: false,
                          },
                          variables: {
                            colorPrimary: '#FF572E',
                            colorText: '#17213D',
                            colorBackground: 'transparent',
                            borderRadius: '0.75rem',
                          },
                          elements: {
                            rootBox: '!w-full',
                            cardBox: '!w-full !shadow-none !border-none !bg-transparent !p-0 !m-0',
                            card: '!w-full !shadow-none !border-none !bg-transparent !p-0 !m-0',
                            header: '!hidden',
                            headerTitle: '!hidden',
                            headerSubtitle: '!hidden',
                            footer: '!hidden',
                            footerAction: '!hidden',
                            formButtonPrimary: '!bg-[#FF572E] hover:!bg-[#E64A22] !text-white !rounded-xl !font-bold !py-2.5 !text-xs sm:!text-sm !shadow-md !shadow-[#FF572E]/25 transition-all cursor-pointer',
                            socialButtonsBlockButton: '!border !border-gray-200 !rounded-xl !font-bold !text-[#17213D] hover:!bg-[#FFF7F2] transition-colors !py-2 !text-xs sm:!text-sm',
                            socialButtonsBlockButtonText: '!font-bold !text-[#17213D] !text-xs',
                            formFieldLabel: '!font-bold !text-[#17213D] !text-[11px] !mb-1',
                            formFieldInput: '!rounded-xl !border-gray-200 focus:!border-[#FF572E] focus:!ring-2 focus:!ring-[#FF572E]/20 !text-[#17213D] !text-xs sm:!text-sm !py-2 !px-3 transition-all',
                            footerActionLink: '!text-[#FF572E] hover:!text-[#E64A22] !font-black',
                          },
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signUp"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                    >
                      <SignUp
                        routing="hash"
                        fallbackRedirectUrl="/home"
                        signUpFallbackRedirectUrl="/home"
                        appearance={{
                          layout: {
                            logoPlacement: 'none',
                            socialButtonsPlacement: 'top',
                            showOptionalFields: false,
                          },
                          variables: {
                            colorPrimary: '#FF572E',
                            colorText: '#17213D',
                            colorBackground: 'transparent',
                            borderRadius: '0.75rem',
                          },
                          elements: {
                            rootBox: '!w-full',
                            cardBox: '!w-full !shadow-none !border-none !bg-transparent !p-0 !m-0',
                            card: '!w-full !shadow-none !border-none !bg-transparent !p-0 !m-0',
                            header: '!hidden',
                            headerTitle: '!hidden',
                            headerSubtitle: '!hidden',
                            footer: '!hidden',
                            footerAction: '!hidden',
                            formButtonPrimary: '!bg-[#FF572E] hover:!bg-[#E64A22] !text-white !rounded-xl !font-bold !py-2.5 !text-xs sm:!text-sm !shadow-md !shadow-[#FF572E]/25 transition-all cursor-pointer',
                            socialButtonsBlockButton: '!border !border-gray-200 !rounded-xl !font-bold !text-[#17213D] hover:!bg-[#FFF7F2] transition-colors !py-2 !text-xs sm:!text-sm',
                            socialButtonsBlockButtonText: '!font-bold !text-[#17213D] !text-xs',
                            formFieldLabel: '!font-bold !text-[#17213D] !text-[11px] !mb-1',
                            formFieldInput: '!rounded-xl !border-gray-200 focus:!border-[#FF572E] focus:!ring-2 focus:!ring-[#FF572E]/20 !text-[#17213D] !text-xs sm:!text-sm !py-2 !px-3 transition-all',
                            footerActionLink: '!text-[#FF572E] hover:!text-[#E64A22] !font-black',
                          },
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Security Note */}
              <div className="mt-3.5 pt-2.5 border-t border-[#F5E5DC] flex items-center justify-center gap-1.5 text-[10px] text-[#6E7587] font-semibold text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span>Protected by verified college student security</span>
              </div>

            </div>
          </motion.div>

        </div>
      </main>


      {/* ========================================================================= */}
      {/* PREMIUM MINIMAL FOOTER                                                    */}
      {/* ========================================================================= */}
      <footer className="relative z-10 px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 border-t border-[#F2DDD2] bg-[#FFF7F2]/95 backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-[#6E7587]">
          
          {/* Left: Brand & Copyright */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#17213D]">HelpU</span>
            <span className="text-[#D9C4B7]">•</span>
            <span>Campus Student Ride & Community Network</span>
            <span className="hidden md:inline text-[#D9C4B7]">•</span>
            <span className="hidden md:inline">© {new Date().getFullYear()}</span>
          </div>

          {/* Right: Security & Support */}
          <div className="flex items-center gap-3.5 text-[11px] font-medium">
            <span className="flex items-center gap-1.5 text-[#16A34A] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Campus ID Only</span>
            </span>
            <span className="text-[#D9C4B7]">•</span>
            <Link to="/about" className="hover:text-[#FF572E] transition-colors">
              Privacy & Safety
            </Link>
            <span className="text-[#D9C4B7]">•</span>
            <Link to="/support" className="hover:text-[#FF572E] transition-colors">
              Support
            </Link>
          </div>

        </div>
      </footer>

    </div>
  );
}
