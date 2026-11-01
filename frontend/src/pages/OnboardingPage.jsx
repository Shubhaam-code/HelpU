import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, SignIn } from '@clerk/clerk-react';
import { PrimaryButton } from '../components/ui/PrimaryButton';

// Campus boy SVG illustration matching reference image
function CampusBoyIllustration() {
  return (
    <svg viewBox="0 0 320 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[280px]">
      {/* Sky background */}
      <rect width="320" height="340" fill="#FFF9F2" />
      
      {/* Campus buildings (background) */}
      <rect x="180" y="100" width="60" height="120" rx="4" fill="#E9E0FF" />
      <rect x="200" y="90" width="20" height="30" rx="2" fill="#C9F2DE" />
      <path d="M170 100 L210 70 L250 100" fill="#BBDFFF" />
      
      <rect x="60" y="120" width="50" height="100" rx="4" fill="#FFE6CB" />
      <path d="M55 120 L85 95 L115 120" fill="#C9F2DE" />
      
      {/* Trees */}
      <circle cx="50" cy="200" r="20" fill="#C9F2DE" />
      <rect x="47" y="210" width="6" height="15" fill="#8B6914" />
      <circle cx="270" cy="190" r="18" fill="#C9F2DE" />
      <rect x="267" y="200" width="6" height="15" fill="#8B6914" />
      
      {/* Ground */}
      <ellipse cx="160" cy="310" rx="130" ry="20" fill="#E8F5E9" />
      
      {/* Boy - body */}
      <ellipse cx="155" cy="280" rx="35" ry="25" fill="#17233C" />
      
      {/* Boy - backpack */}
      <rect x="130" y="220" width="22" height="30" rx="6" fill="#FF654F" />
      <rect x="134" y="216" width="4" height="10" rx="2" fill="#FF654F" />
      <rect x="143" y="216" width="4" height="10" rx="2" fill="#FF654F" />
      
      {/* Boy - arms */}
      <ellipse cx="128" cy="245" rx="8" ry="4" fill="#17233C" transform="rotate(-20 128 245)" />
      <ellipse cx="182" cy="248" rx="8" ry="4" fill="#17233C" transform="rotate(20 182 248)" />
      
      {/* Boy - legs */}
      <rect x="142" y="295" width="14" height="30" rx="7" fill="#4A5568" />
      <rect x="158" y="295" width="14" height="30" rx="7" fill="#4A5568" />
      <rect x="140" y="318" width="18" height="8" rx="4" fill="#1a1a1a" />
      <rect x="156" y="318" width="18" height="8" rx="4" fill="#1a1a1a" />
      
      {/* Boy - neck */}
      <rect x="150" y="200" width="12" height="14" rx="5" fill="#FDBCB4" />
      
      {/* Boy - head */}
      <circle cx="156" cy="190" r="28" fill="#FDBCB4" />
      
      {/* Hair */}
      <ellipse cx="156" cy="167" rx="28" ry="12" fill="#1a1a1a" />
      <ellipse cx="142" cy="173" rx="6" ry="14" fill="#1a1a1a" />
      
      {/* Headphones */}
      <path d="M 130 180 Q 130 160 156 160 Q 182 160 182 180" stroke="#FF654F" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="126" y="178" width="10" height="14" rx="5" fill="#FF654F" />
      <rect x="176" y="178" width="10" height="14" rx="5" fill="#FF654F" />
      
      {/* Eyes */}
      <circle cx="148" cy="190" r="3" fill="#1a1a1a" />
      <circle cx="164" cy="190" r="3" fill="#1a1a1a" />
      <circle cx="149" cy="189" r="1.2" fill="white" />
      <circle cx="165" cy="189" r="1.2" fill="white" />
      
      {/* Smile */}
      <path d="M 148 198 Q 156 204 164 198" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
      
      {/* Stars/sparkles */}
      <text x="240" y="150" fontSize="18" fill="#FF654F">✨</text>
      <text x="60" y="160" fontSize="14" fill="#FF654F">⭐</text>
    </svg>
  );
}

export default function OnboardingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/home', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="w-8 h-8 border-3 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSignedIn) return null;

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Top logo */}
      <div className="flex items-center gap-3 px-6 pt-12 pb-4">
        <div className="w-12 h-12 bg-navy rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-2xl leading-none">H</span>
        </div>
        <div>
          <span className="font-black text-navy text-2xl tracking-tight">HelpU</span>
          <div className="text-text-secondary text-xs">Rides • Help • Campus Connect</div>
        </div>
      </div>

      {/* Illustration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="flex-1 flex items-center justify-center px-6"
      >
        <CampusBoyIllustration />
      </motion.div>

      {/* Bottom content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="px-6 pb-12 text-center"
      >
        <h1 className="font-black text-navy text-3xl mb-3 leading-tight">
          Find rides, share seats,<br />get help – within your<br />campus.
        </h1>
        <p className="text-text-secondary text-sm mb-8">Connect with students going your way. Safe, affordable, campus-verified.</p>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-6 h-2 bg-navy rounded-full" />
          <div className="w-2 h-2 bg-gray-200 rounded-full" />
          <div className="w-2 h-2 bg-gray-200 rounded-full" />
        </div>

        {/* Sign in modal trigger */}
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border border-gray-100 rounded-3xl',
              headerTitle: 'font-black text-navy',
              headerSubtitle: 'text-text-secondary',
              formButtonPrimary: 'bg-navy hover:bg-navy/90 rounded-xl font-semibold',
              socialButtonsBlockButton: 'border border-gray-200 rounded-xl font-medium text-navy',
              footer: 'hidden',
            },
          }}
        />

        {/* Fallback button */}
        <div className="mt-4 text-xs text-text-secondary">
          By continuing, you agree to our <span className="text-coral font-medium">Terms of Service</span>
        </div>
      </motion.div>
    </div>
  );
}
