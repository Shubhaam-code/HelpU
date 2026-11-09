import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useFirebaseAuth } from '../../context/FirebaseAuthContext';
import { useAuthProfile } from '../../context/AuthProfileContext';

function GoogleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className}>
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

/**
 * Common Guest Authentication Prompt Modal
 * 
 * Displayed across all modules when an unauthenticated guest attempts a protected action:
 * - Create or publish a PoolMate post
 * - Create or publish a SlotMate post
 * - Perform a protected Match action
 * - Connect with another student
 * - Use protected Shared Group functionality
 * - Book a ride or send a booking request
 * 
 * Rules:
 * 1. Single unified modal across all modules.
 * 2. Primary button text is exactly "Login".
 * 3. Clicking "Login" navigates to the existing Auth page with safe returnTo.
 * 4. Does not directly trigger Google authentication from this popup.
 */
export function GuestAuthPromptModal({
  isOpen,
  onClose,
  moduleName = 'Helpu',
  returnPath = '/home',
  title = 'Login Required',
  subtitle = 'Please sign in with your campus account to continue.'
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogin = () => {
    onClose();
    navigate(`/auth?returnTo=${encodeURIComponent(returnPath)}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
        {/* Backdrop dismiss */}
        <div
          className="fixed inset-0"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-md bg-[#FFFDF9] rounded-t-[32px] sm:rounded-[32px] border border-[#F4E3D8] shadow-2xl p-6 sm:p-7 space-y-5 text-center overflow-hidden"
        >
          {/* Top Decorative Amber Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-[#FEF08A]/50 to-transparent pointer-events-none rounded-bl-full blur-xl" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF4ED] rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Badge */}
          <div className="w-14 h-14 rounded-2xl bg-[#FFFBEB] border border-[#FEF3C7] shadow-xs flex items-center justify-center mx-auto text-[#FF572E]">
            <Sparkles className="w-7 h-7 text-[#FF572E]" />
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-[#17233C] tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-[#6E7587] leading-relaxed max-w-xs mx-auto">
              {subtitle}
            </p>
          </div>

          {/* Reassurance Banner */}
          <div className="bg-[#FFF8F3] border border-[#F4E3D8] rounded-2xl p-3 flex items-start gap-2.5 text-left">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
            <div className="text-[11px] leading-snug text-[#4B5563]">
              <span className="font-bold text-[#17233C]">Your progress is safe: </span>
              Your filled details are preserved and you will review before anything is confirmed.
            </div>
          </div>

          {/* Primary Action Button: Exactly "Login" navigating to /auth */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-gradient-to-r from-[#FF6B35] to-[#FF451A] hover:from-[#FF572E] hover:to-[#E63E15] active:scale-[0.98] text-white font-black text-sm sm:text-base rounded-2xl shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4 stroke-[2.8]" />
            </button>
          </div>

          {/* Verified Badge Footer */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#16A34A] pt-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified college students only</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

