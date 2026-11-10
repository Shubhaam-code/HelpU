import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Premium 5-Second Startup Intro Video for Helpu (Logged-out users only)
 *
 * FIX v2:
 * - object-cover fills the full screen with NO white gaps top/bottom
 * - muted is REMOVED so Android WebView plays video audio natively
 *   (requires setMediaPlaybackRequiresUserGesture(false) in MainActivity, already set)
 * - Wrapper covers inset-0 with NO safe-area padding so video touches screen edges
 * - Skip button positioned using safe-area-inset-top so it stays below status bar
 */
export default function StartupVideoIntro({ onComplete }) {
  const [fading, setFading] = useState(false);
  const videoRef = useRef(null);
  const hasFinishedRef = useRef(false);

  const finish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setFading(true);

    // 300ms smooth cross-fade before unmounting and releasing hardware decoder
    setTimeout(() => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch {
          // ignore
        }
      }
      onComplete?.();
    }, 320);
  }, [onComplete]);

  useEffect(() => {
    // 5.0-second playback timer
    const timer = setTimeout(() => {
      finish();
    }, 5000);

    // Explicit play() trigger for WebView environments
    if (videoRef.current) {
      videoRef.current.play?.().catch(() => {
        // Autoplay restrictions or format issues — finish gracefully
        finish();
      });
    }

    return () => {
      clearTimeout(timer);
    };
  }, [finish]);

  return (
    <div
      role="dialog"
      aria-label="Helpu Welcome Intro"
      className={`fixed inset-0 z-[99999] select-none transition-opacity duration-300 ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#EFD7A2' /* matches video background corner color */ }}
    >
      {/* Video fills screen edge-to-edge with object-cover — eliminates white/cream bars */}
      <video
        ref={videoRef}
        src="/videos/helpu-intro.mp4"
        autoPlay
        playsInline
        webkit-playsinline="true"
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ backgroundColor: '#EFD7A2' }}
      />

      {/* Skip button — positioned below system status bar using safe-area-inset-top */}
      <button
        type="button"
        onClick={finish}
        aria-label="Skip Intro"
        className="absolute right-4 z-10 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md text-[#17233C]/80 text-xs font-bold border border-black/5 shadow active:scale-95 transition-all"
        style={{ top: 'calc(env(safe-area-inset-top, 12px) + 8px)' }}
      >
        Skip
      </button>
    </div>
  );
}

