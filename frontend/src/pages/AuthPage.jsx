import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { ArrowLeft, ShieldCheck, Sparkles, Car, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuthProfile } from '../context/AuthProfileContext';

function formatFirebaseError(err) {
  if (!err) return '';
  const code = err.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Invalid email or password. Please check and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try signing in.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please provide a valid email address.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before completing.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Sign-in was cancelled.';
  }
  return err.message || 'Authentication failed. Please try again.';
}

export default function AuthPage({ initialMode = 'signIn' }) {
  const { isLoaded, isSignedIn, signInWithGoogle, signInWithEmail, signUpWithEmail } = useFirebaseAuth();
  const { hasWhatsApp, isProfileLoading, isSkipped } = useAuthProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode state: 'signIn' | 'signUp'
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState(modeParam === 'signUp' ? 'signUp' : initialMode);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync mode state with query params
  useEffect(() => {
    if (modeParam === 'signUp' || modeParam === 'signIn') {
      setMode(modeParam);
    }
  }, [modeParam]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isLoaded && isSignedIn && !isProfileLoading) {
      if (!hasWhatsApp && !isSkipped) {
        navigate('/whatsapp-setup', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [isLoaded, isSignedIn, isProfileLoading, hasWhatsApp, isSkipped, navigate]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage('');
    setSearchParams({ mode: newMode });
  };

  const handleGoogleAuth = async () => {
    try {
      setErrorMessage('');
      setIsGoogleLoading(true);
      await signInWithGoogle();
      // Navigation will be automatically handled by the useEffect above
    } catch (err) {
      setErrorMessage(formatFirebaseError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (mode === 'signUp' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'signUp') {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setErrorMessage(formatFirebaseError(err));
    } finally {
      setIsSubmitting(false);
    }
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
          
          {/* Logo & Brand Name */}
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
      {/* MAIN TWO-COLUMN CONTENT                                                   */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-2 flex items-center justify-center min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-center w-full my-auto">
          
          {/* --------------------------------------------------------------------- */}
          {/* LEFT COLUMN: BRANDING, VALUE PROPS & ILLUSTRATION                     */}
          {/* --------------------------------------------------------------------- */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-6 xl:col-span-6 flex flex-col justify-center space-y-2.5 lg:pr-2"
          >
            {/* Top Text & Value Points */}
            <div className="space-y-1.5 sm:space-y-2">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE3CF] border border-[#FFD1B5] text-[#FF572E] text-[11px] sm:text-xs font-extrabold shadow-2xs w-fit">
                <Sparkles className="w-3 h-3 text-[#FF572E]" />
                <span>Student-Only Campus Network</span>
              </div>

              {/* Main Heading */}
              <h1 className="font-black text-[#17213D] text-2xl sm:text-3xl lg:text-[34px] leading-[1.12] tracking-tight">
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
              <p className="text-[#596277] text-xs sm:text-sm lg:text-[15px] font-medium leading-relaxed max-w-md">
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

            {/* Background Illustration */}
            <div className="relative w-full overflow-hidden flex justify-center lg:justify-start items-end pt-1">
              <img 
                src="/auth.png" 
                alt="HelpU Campus Community Illustration" 
                className="w-auto max-w-full h-auto max-h-[190px] sm:max-h-[250px] lg:max-h-[300px] xl:max-h-[330px] object-contain object-left-bottom select-none pointer-events-none drop-shadow-sm"
              />
            </div>

          </motion.div>

          {/* --------------------------------------------------------------------- */}
          {/* RIGHT COLUMN: FIREBASE AUTHENTICATION CARD                            */}
          {/* --------------------------------------------------------------------- */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-6 xl:col-span-6 flex justify-center lg:justify-start w-full"
          >
            <div className="w-full max-w-[430px] sm:max-w-[460px] lg:max-w-[475px] bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-7 lg:p-8 shadow-xl shadow-[#17213D]/5 border border-[#F4E3D8] relative">
              
              {/* Header Title inside card */}
              <div className="mb-3.5">
                <h2 className="font-black text-[#17213D] text-xl sm:text-2xl tracking-tight">
                  {mode === 'signIn' ? 'Sign In to HelpU' : 'Create an Account'}
                </h2>
                <p className="text-[#6E7587] text-xs sm:text-sm font-medium mt-1">
                  {mode === 'signIn' ? 'Continue with your college credentials' : 'Get started in under a minute'}
                </p>
              </div>

              {/* Mode Switcher Tabs (Sign In / Sign Up) */}
              <div className="flex bg-[#FFF7F2] rounded-xl p-0.5 mb-4 border border-[#F4E3D8]">
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
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
                  className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    mode === 'signUp'
                      ? 'bg-white text-[#17213D] shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17213D]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Authentication Form */}
              <div className="w-full">
                {/* Google Sign-In Button */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isGoogleLoading || isSubmitting}
                    className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl font-bold text-[#17213D] hover:bg-[#FFF7F2] active:scale-[0.99] transition-all py-2.5 sm:py-3 text-xs sm:text-sm bg-white shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF572E]" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    )}
                    <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
                  </button>

                  <div className="relative flex py-2.5 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink mx-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">or</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3.5 p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-600 text-xs font-medium leading-relaxed"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                {/* Email / Password Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <AnimatePresence mode="wait">
                    {mode === 'signUp' && (
                      <motion.div
                        key="fullNameField"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <label className="block font-bold text-[#17213D] text-xs mb-1.5">
                          Full Name
                        </label>
                        <div className="relative">
                          <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Priya Sharma"
                            required={mode === 'signUp'}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/20 text-[#17213D] text-sm transition-all outline-none bg-white placeholder:text-gray-400"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="block font-bold text-[#17213D] text-xs mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@college.edu"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/20 text-[#17213D] text-sm transition-all outline-none bg-white placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#17213D] text-xs mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min. 6 characters)"
                        required
                        minLength={6}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/20 text-[#17213D] text-sm transition-all outline-none bg-white placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || isGoogleLoading}
                    className="w-full mt-2 py-2.5 sm:py-3 rounded-xl font-black text-white text-xs sm:text-sm bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] transition-all shadow-md shadow-[#FF572E]/20 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                    <span>{mode === 'signIn' ? 'Sign In' : 'Create Account'}</span>
                  </button>
                </form>

              </div>

              {/* Bottom Security Note */}
              <div className="mt-4 pt-3 border-t border-[#F5E5DC] flex items-center justify-center gap-1.5 text-[10px] text-[#6E7587] font-semibold text-center">
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
