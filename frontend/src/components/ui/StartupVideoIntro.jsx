import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Premium 5-Second Startup Intro Video for Helpu (Logged-out users only)
 *
 * Requirements Met:
 * - Plays bundled local video: /videos/helpu-intro.mp4 (offline / airplane mode ready)
 * - Muted, autoplay, playsInline for instant zero-gesture playback on Android WebView
 * - Background matched to Helpu signature cream (#FFF8F3) to eliminate black bars and flashes
 * - Auto-advances at 5.0 seconds with smooth 300ms cross-fade transition
 * - Graceful fallback on ended or error events
 * - Proper hardware decoder cleanup on unmount (pause + remove src + load)
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
        // Autoplay restrictions or format issues fallback gracefully
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
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#FFF8F3] select-none transition-opacity duration-300 ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="relative w-full h-full max-w-md mx-auto flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src="/videos/helpu-intro.mp4"
          autoPlay
          muted
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onEnded={finish}
          onError={finish}
          className="w-full h-full object-contain pointer-events-none"
          style={{ backgroundColor: '#FFF8F3' }}
        />

        {/* Minimal elegant Skip pill */}
        <button
          type="button"
          onClick={finish}
          aria-label="Skip Intro"
          className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-md text-[#17233C]/80 text-xs font-bold border border-black/5 shadow-2xs hover:bg-white active:scale-95 transition-all"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
