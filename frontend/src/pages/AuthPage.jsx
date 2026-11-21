import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirebaseAuth } from '../context/FirebaseAuthContext';
import { 
  ArrowLeft, ShieldCheck, Mail, Lock, User as UserIcon, 
  Eye, EyeOff, Car, GraduationCap, CheckCircle2, X
} from 'lucide-react';
import { useAuthProfile } from '../context/AuthProfileContext';
import { getPendingDraftReturnPath } from '../utils/guestDraft';

/**
 * Sanitize a returnTo URL so that only safe internal application paths are
 * accepted. External URLs, protocol-relative URLs (//), and any non-path
 * strings are rejected and fall back to '/home'.
 */
function sanitizeReturnTo(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Must begin with a single '/' and not with '//' (protocol-relative attack)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  // Reject any embedded protocol scheme
  if (/^\/[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) return null;
  // Reject absolute URLs
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

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
  const { isLoaded, isSignedIn, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useFirebaseAuth();
  const { hasWhatsApp, isProfileLoading } = useAuthProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode: 'signIn' | 'signUp'
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState(modeParam === 'signUp' ? 'signUp' : initialMode);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Sync mode state with query params
  useEffect(() => {
    if (modeParam === 'signUp' || modeParam === 'signIn') {
      setMode(modeParam);
    }
  }, [modeParam]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isLoaded && isSignedIn && !isProfileLoading) {
      const rawReturn = searchParams.get('returnTo') || searchParams.get('redirectUrl');
      const safeReturn = sanitizeReturnTo(rawReturn) || sanitizeReturnTo(getPendingDraftReturnPath()) || '/home';

      if (!hasWhatsApp) {
        navigate(`/whatsapp-setup?returnTo=${encodeURIComponent(safeReturn)}`, { replace: true });
      } else {
        navigate(safeReturn, { replace: true });
      }
    }
  }, [isLoaded, isSignedIn, isProfileLoading, hasWhatsApp, navigate, searchParams]);

  const handleBack = () => {
    const rawReturn = searchParams.get('returnTo') || searchParams.get('redirectUrl');
    const safeReturn = sanitizeReturnTo(rawReturn);
    if (safeReturn && safeReturn !== '/auth' && safeReturn !== '/') {
      navigate(safeReturn);
    } else {
      navigate('/home');
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage('');
    setSuccessMessage('');
    setSearchParams({ mode: newMode });
  };

  const handleGoogleAuth = async () => {
    try {
      setErrorMessage('');
      setIsGoogleLoading(true);
      await signInWithGoogle();
    } catch (err) {
      setErrorMessage(formatFirebaseError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError('');
      if (resetPassword) {
        await resetPassword(forgotEmail.trim());
      }
      setForgotSuccess('Password reset link sent! Please check your email inbox.');
    } catch (err) {
      setForgotError(formatFirebaseError(err));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] font-sans relative overflow-x-hidden selection:bg-[#F59E0B]/20 selection:text-[#D97706] pb-6 sm:pb-8">
      
      {/* Decorative ambient background glows */}
      <div 
        aria-hidden="true" 
        className="absolute top-0 right-0 w-72 sm:w-80 h-72 sm:h-80 bg-gradient-to-bl from-[#FDE68A]/50 via-[#FDE047]/15 to-transparent pointer-events-none rounded-bl-full blur-2xl" 
      />

      {/* Main Container - Mobile First */}
      <div className="max-w-md sm:max-w-lg mx-auto px-4 sm:px-6 pt-3 pb-4 sm:pb-6 space-y-4 sm:space-y-4.5 relative z-10">

        {/* ======================================================================= */}
        {/* 1. TOP BAR: BACK ARROW + CENTERED HELPU LOGO                            */}
        {/* ======================================================================= */}
        <header className="relative flex items-center justify-between py-1">
          {/* Back button */}
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 -ml-1.5 rounded-full text-[#17233C] hover:bg-white border border-transparent hover:border-[#F4E3D8] transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.4]" />
          </button>

          {/* Centered Logo */}
          <div className="flex items-center gap-1.5 select-none">
            {/* Phone UI: Only 'H' Logo */}
            <img 
              src="/logo-h.png" 
              alt="HelpU" 
              className="h-8 sm:hidden w-auto object-contain"
            />
            {/* Desktop UI: Full logo */}
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="hidden sm:block h-8 sm:h-9 w-auto object-contain"
            />
          </div>

          {/* Empty spacer for perfect centering */}
          <div className="w-8" />
        </header>

        {/* ======================================================================= */}
        {/* 2. TOP CELEBRATION ILLUSTRATION BANNER                                  */}
        {/* ======================================================================= */}
        <div className="relative w-full overflow-hidden select-none">
          <img
            src="/login-students-banner.png"
            alt="Helpu Students Celebrating with Laptop"
            className="w-full h-auto max-h-[200px] sm:max-h-[230px] object-contain mx-auto"
            loading="eager"
          />
        </div>

        {/* ======================================================================= */}
        {/* 3. WELCOME SECTION                                                      */}
        {/* ======================================================================= */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-[28px] font-black text-[#17233C] tracking-tight leading-tight">
            <span>Welcome to </span>
            <span className="text-[#FF572E]">Helpu</span>
            <span> 👋</span>
          </h1>

          <p className="text-xs sm:text-[13px] text-[#5A6275] font-medium leading-relaxed max-w-xs sm:max-w-sm mx-auto">
            Your campus community for rides, classmates and more.
          </p>

          {/* Subtle curved yellow accent line */}
          <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[#FBBF24] to-transparent mx-auto rounded-full mt-1.5 opacity-80" />
        </div>

        {/* ======================================================================= */}
        {/* 4. FEATURE CARDS (POOLMATE & SLOTMATE)                                  */}
        {/* ======================================================================= */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
          {/* Card 1: PoolMate */}
          <div className="rounded-2xl bg-[#FFF5ED] border border-[#FFE4D6] p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[#FFEFE6] text-[#FF572E] border border-[#FFD9C7] flex items-center justify-center shrink-0 shadow-2xs">
              <Car className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xs sm:text-[13px] text-[#17233C] truncate">
                PoolMate
              </h3>
              <p className="text-[9.5px] min-[360px]:text-[10px] text-[#6E7587] font-medium leading-tight truncate">
                Share rides & travel together
              </p>
            </div>
          </div>

          {/* Card 2: SlotMate */}
          <div className="rounded-2xl bg-[#FEFCE8] border border-[#FEF08A] p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xs sm:text-[13px] text-[#17233C] truncate">
                SlotMate
              </h3>
              <p className="text-[9.5px] min-[360px]:text-[10px] text-[#6E7587] font-medium leading-tight truncate">
                Find classmates by course & slot
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 5. AUTHENTICATION SECTION                                               */}
        {/* ======================================================================= */}
        <div className="bg-white rounded-[26px] sm:rounded-[30px] border border-[#F4E3D8] shadow-sm shadow-[#F4E3D8]/50 p-4 min-[380px]:p-5 sm:p-6 space-y-4">
          
          {/* Tab Switcher: Sign In | Create Account */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[#FFF8F3] border border-[#F4E3D8]">
            <button
              type="button"
              onClick={() => switchMode('signIn')}
              className={`py-2 rounded-full font-black text-xs sm:text-[13px] transition-all cursor-pointer ${
                mode === 'signIn'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF451A] text-white shadow-xs'
                  : 'text-[#6E7587] hover:text-[#17233C]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signUp')}
              className={`py-2 rounded-full font-black text-xs sm:text-[13px] transition-all cursor-pointer ${
                mode === 'signUp'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF451A] text-white shadow-xs'
                  : 'text-[#6E7587] hover:text-[#17233C]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full py-2.5 sm:py-3 px-4 rounded-2xl bg-white border border-[#E5E7EB] hover:bg-[#FFFDF9] hover:border-[#D1D5DB] shadow-2xs flex items-center justify-center gap-2.5 font-bold text-xs sm:text-sm text-[#17233C] transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <div className="w-4 h-4 border-2 border-[#17233C] border-t-transparent rounded-full animate-spin" />
            ) : (
              <GoogleIcon className="w-4.5 h-4.5 shrink-0" />
            )}
            <span>Continue with Google</span>
          </button>

          {/* OR Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-[#F4E3D8] w-full" />
            <span className="bg-white px-3 text-[10px] font-black text-[#9CA3AF] tracking-wider uppercase absolute">
              OR
            </span>
          </div>

          {/* Error & Success Messages */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-50 border border-rose-200 rounded-2xl"
            >
              <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </p>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl"
            >
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </p>
            </motion.div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            
            {/* If Sign Up, ask for Full Name */}
            {mode === 'signUp' && (
              <div className="space-y-1">
                <label className="text-xs font-black text-[#17233C]">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#9CA3AF]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Shubham Narayan"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm placeholder:text-[#9CA3AF] transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-xs font-black text-[#17233C]">
                Email Address
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#9CA3AF]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm placeholder:text-[#9CA3AF] transition-all outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-black text-[#17233C]">
                Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#9CA3AF]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm placeholder:text-[#9CA3AF] transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-[#9CA3AF] hover:text-[#17233C] transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password link */}
            {mode === 'signIn' && (
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotError('');
                    setForgotSuccess('');
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-bold text-[#DC2626] hover:text-[#B91C1C] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Orange / Yellow Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF451A] hover:from-[#FF572E] hover:to-[#E63E15] text-white font-black text-sm sm:text-base shadow-md shadow-[#FF572E]/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{mode === 'signIn' ? 'Signing In...' : 'Creating Account...'}</span>
                </div>
              ) : (
                <span>{mode === 'signIn' ? 'Sign In →' : 'Create Account →'}</span>
              )}
            </button>
          </form>

        </div>

        {/* ======================================================================= */}
        {/* 6. TRUST SECTION                                                        */}
        {/* ======================================================================= */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#16A34A] select-none pt-1">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] stroke-[2.4]" />
          <span>Verified college students only</span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 8. FORGOT PASSWORD MODAL                                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm sm:max-w-md bg-[#FFFDF9] rounded-[28px] border border-[#F4E3D8] shadow-2xl p-5 sm:p-6 space-y-4 relative overflow-hidden"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white text-[#6E7587] hover:text-[#17233C] border border-[#F4E3D8] shadow-2xs transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-[#17233C] tracking-tight">
                  Reset Password
                </h3>
                <p className="text-xs text-[#6E7587] font-medium leading-relaxed">
                  Enter your registered campus email address and we'll send you a link to reset your password.
                </p>
              </div>

              {forgotError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600">
                  {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                  {forgotSuccess}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#17233C]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@college.edu"
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#F4E3D8] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#17233C] font-bold text-xs sm:text-sm outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF451A] hover:from-[#FF572E] text-white font-black text-sm shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending link...' : 'Send Reset Link →'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
