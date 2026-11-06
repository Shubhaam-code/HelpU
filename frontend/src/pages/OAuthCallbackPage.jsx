import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const search = window.location.search || '';
    const hash = window.location.hash || '';

    // If already running inside native Capacitor app, route internally to /home
    if (Capacitor.isNativePlatform()) {
      navigate('/home' + search + hash, { replace: true });
      return;
    }

    // Running in external browser (e.g. Chrome on Android after Google login)
    // Deep-link back into the Helpu native app
    const intentUrl = `intent://callback${search}${hash}#Intent;scheme=com.helpu.app;package=com.helpu.app;end`;
    const appDeepLink = `com.helpu.app://callback${search}${hash}`;
    const fallbackDeepLink = `helpu://callback${search}${hash}`;

    // Attempt automatic return to native app using Chrome Android Intent first, then custom scheme
    try {
      window.location.href = intentUrl;
    } catch (_) {
      try {
        window.location.href = appDeepLink;
      } catch (_) {}
    }

    // Fallback timer if browser doesn't automatically hand off
    const timer = setTimeout(() => {
      try {
        window.location.href = appDeepLink;
      } catch (_) {}
    }, 1200);

    return () => clearTimeout(timer);
  }, [navigate]);

  const search = typeof window !== 'undefined' ? window.location.search || '' : '';
  const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
  const appDeepLink = `com.helpu.app://callback${search}${hash}`;

  return (
    <div className="min-h-screen bg-[#FFF7F2] text-[#17213D] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-[#F4E3D8] space-y-6">
        <div className="w-16 h-16 mx-auto bg-[#FFE4D5] rounded-full flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-[#FF572E]" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-[#17213D]">Authentication Successful!</h1>
          <p className="text-sm text-[#6E7587] mt-2">
            Returning to the Helpu app. If it doesn't open automatically, tap below.
          </p>
        </div>

        <a
          href={appDeepLink}
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-[#FF572E] text-white font-extrabold text-base shadow-md hover:bg-[#E64A22] transition-all cursor-pointer"
        >
          <span>Open Helpu App</span>
          <ArrowRight className="w-4 h-4" />
        </a>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate('/home' + search + hash, { replace: true })}
            className="text-xs text-[#8B93A7] hover:text-[#17213D] underline"
          >
            Continue in browser instead
          </button>
        </div>
      </div>
    </div>
  );
}

