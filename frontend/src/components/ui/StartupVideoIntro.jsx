import React, { useState, useEffect, useRef, useCallback } from 'react';
import { hideNativeSplashScreen } from '../../mobile/mobileBridge';

/**
 * Premium Startup Intro Video for Helpu (Logged-out users only)
 *
 * FIX v4 (Eliminate native Play button flash):
 * - Static first-frame poster (/videos/helpu-intro-poster.jpg) overlays the video
 * - Video element stays opacity: 0 until `onPlaying` actively fires
 * - Native WebKit media controls disabled via CSS & element attributes
 * - Primary trigger: onEnded event — video plays to full natural completion with audio
 * - Safety fallback: 8000ms timer (video is 6.29s)
 * - Full-bleed object-cover with matching #EFD7A2 background
 */
export default function StartupVideoIntro({ onComplete }) {
  const [fading, setFading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
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
    // Reveal native splash as soon as intro is mounted and preparing playback
    const readyTimer = setTimeout(() => {
      hideNativeSplashScreen(180);
    }, 80);

    // Safety fallback timer: 8000ms (video is 6.29s — gives buffer for slow decode)
    const fallbackTimer = setTimeout(() => {
      finish();
    }, 8000);

    // Reveal video if playing event is delayed but video has loaded data
    const revealFallbackTimer = setTimeout(() => {
      setIsVideoPlaying(true);
    }, 1500);

    // Explicit play() trigger for Capacitor Android WebView
    if (videoRef.current) {
      videoRef.current.play?.().catch(() => {
        // If autoplay is blocked, finish gracefully
        setTimeout(finish, 500);
      });
    }

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(fallbackTimer);
      clearTimeout(revealFallbackTimer);
    };
  }, [finish]);

  const handleMediaReady = useCallback(() => {
    hideNativeSplashScreen(180);
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Helpu Welcome Intro"
      className={`fixed inset-0 z-[99999] select-none transition-opacity duration-300 ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#EFD7A2' /* matches video background corner color */ }}
    >
      {/* 1. Static high-resolution poster of frame 0: displays instantly with 0ms delay */}
      <img
        src="/videos/helpu-intro-poster.jpg"
        alt=""
        aria-hidden="true"
        onLoad={handleMediaReady}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${
          isVideoPlaying ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: '#EFD7A2' }}
      />

      {/* 2. Edge-to-edge video: hidden until frames are actively playing, preventing any native play button flash */}
      <video
        ref={videoRef}
        src="/videos/helpu-intro.mp4"
        poster="/videos/helpu-intro-poster.jpg"
        autoPlay
        playsInline
        webkit-playsinline="true"
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
        preload="auto"
        tabIndex={-1}
        onLoadedData={handleMediaReady}
        onPlaying={() => {
          setIsVideoPlaying(true);
          handleMediaReady();
        }}
        onEnded={finish}
        onError={finish}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-150 ${
          isVideoPlaying ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: '#EFD7A2' }}
      />

      {/* 3. Skip button — positioned below system status bar using safe-area-inset-top */}
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

