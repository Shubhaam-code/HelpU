import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  CheckCircle2,
  Smartphone,
  Share,
  PlusSquare,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Wifi,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function InstallAppPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [platform, setPlatform] = useState('android'); // 'android', 'ios', 'desktop'

  // Detect platform and standalone status
  useEffect(() => {
    // 1. Check standalone / installed mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Detect platform
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // 3. Listen for native beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanPrompt(true);
      console.log('[Helpu Install] beforeinstallprompt captured successfully.');
    };

    // 4. Listen for appinstalled confirmation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanPrompt(false);
      setDeferredPrompt(null);
      setInstalling(false);
      console.log('[Helpu Install] App was successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle Install Now button click
  const handleInstallClick = useCallback(async () => {
    // If native prompt is available
    if (deferredPrompt) {
      try {
        setInstalling(true);
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log('[Helpu Install] User choice:', choice.outcome);

        if (choice.outcome === 'accepted') {
          // Installation confirmed by user
          setIsInstalled(true);
          setCanPrompt(false);
        } else {
          // User dismissed prompt — do NOT falsely show success
          console.log('[Helpu Install] Prompt dismissed by user.');
        }
      } catch (err) {
        console.warn('[Helpu Install] Error triggering prompt:', err);
        setShowManualGuide(true);
      } finally {
        setDeferredPrompt(null);
        setInstalling(false);
      }
    } else if (platform === 'ios' || !canPrompt) {
      // Prompt not available — show manual instructions
      setShowManualGuide(true);
    }
  }, [deferredPrompt, platform, canPrompt]);

  // Back button navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (document.referrer) {
      window.location.href = document.referrer;
    } else {
      window.location.href = '/';
    }
  };

  const isNativeCapacitor = Capacitor.isNativePlatform();

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-gradient-to-b from-[#FFF8F3] via-[#FFFDFB] to-[#F0F7FF] text-[#17233C] font-sans selection:bg-[#FF572E]/15">
      {/* Top Header Navigation */}
      <header className="w-full max-w-xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-[#F4E3D8] hover:bg-white text-xs font-bold text-[#17233C] shadow-2xs transition-all active:scale-95 cursor-pointer"
          title="Back to Landing Page"
        >
          <ArrowLeft className="w-4 h-4 text-[#FF572E]" />
          <span>Back</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#DBEAFE] shadow-2xs text-[11px] font-extrabold text-[#0284C7]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span>Official PWA</span>
        </div>
      </header>

      {/* Main Installation Hero Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-4 sm:py-8">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#F4E3D8] shadow-xl shadow-[#FF572E]/5 p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
          {/* Subtle background ambient glow */}
          <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-[#FF572E]/8 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-[#0284C7]/8 blur-2xl pointer-events-none" />

          {/* App Logo */}
          <div className="relative mb-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFEFE5] p-3 border border-[#FDE0D0] shadow-md shadow-[#FF572E]/10 flex items-center justify-center">
              <img
                src="/pwa-192x192.png"
                alt="Helpu Logo"
                className="w-full h-full object-contain rounded-xl select-none"
                draggable={false}
              />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-[#10B981] text-white p-1 rounded-full border-2 border-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          {/* App Name & Verified Badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
              Helpu
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-[#EDFAF3] text-[#16A34A] text-[10px] font-black uppercase tracking-wider border border-[#BCECD4]">
              Verified
            </span>
          </div>

          {/* Short Description */}
          <p className="text-xs sm:text-sm text-[#6E7587] font-medium max-w-xs mb-5 leading-relaxed">
            Your all-in-one campus network for slot matching, timetable planning &amp; student rides.
          </p>

          {/* Feature Highlights Pills */}
          <div className="grid grid-cols-3 gap-2 w-full mb-6">
            <div className="flex flex-col items-center p-2.5 rounded-2xl bg-[#FFF8F3] border border-[#F4E3D8]/80 text-center">
              <Zap className="w-4 h-4 text-[#FF572E] mb-1" />
              <span className="text-[11px] font-bold text-[#17233C]">Instant</span>
              <span className="text-[9px] text-[#8C93A4]">No 100MB DL</span>
            </div>
            <div className="flex flex-col items-center p-2.5 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] text-center">
              <ShieldCheck className="w-4 h-4 text-[#16A34A] mb-1" />
              <span className="text-[11px] font-bold text-[#17233C]">Safe</span>
              <span className="text-[9px] text-[#8C93A4]">VIT Students</span>
            </div>
            <div className="flex flex-col items-center p-2.5 rounded-2xl bg-[#F0F7FF] border border-[#DBEAFE] text-center">
              <Smartphone className="w-4 h-4 text-[#0284C7] mb-1" />
              <span className="text-[11px] font-bold text-[#17233C]">Native UI</span>
              <span className="text-[9px] text-[#8C93A4]">Full Screen</span>
            </div>
          </div>

          {/* ACTION SECTION */}
          {isNativeCapacitor ? (
            /* Running inside native APK */
            <div className="w-full bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
              <h3 className="font-extrabold text-sm text-[#17233C] mb-1">
                You are using the Native App
              </h3>
              <p className="text-xs text-[#6E7587] mb-3">
                Helpu is already installed on this device.
              </p>
              <button
                type="button"
                onClick={() => { window.location.href = '/home'; }}
                className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Open Helpu
              </button>
            </div>
          ) : isInstalled ? (
            /* App is Installed Successfully */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-[#F0FDF4] border border-[#86EFAC] rounded-2xl p-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-[#17233C] mb-1">
                Installed Successfully!
              </h3>
              <p className="text-xs text-[#4B5563] mb-4">
                Helpu is now on your home screen. You can launch it anytime like a native app.
              </p>
              <button
                type="button"
                onClick={() => { window.location.href = '/home'; }}
                className="w-full py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-extrabold text-sm rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Open Helpu App</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            /* Ready to Install */
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full py-3.5 px-4 bg-[#FF572E] hover:bg-[#E64A22] active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-[#FF572E]/25 transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {installing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Install Now</span>
                  </>
                )}
              </button>

              <div className="text-[11px] text-[#8C93A4] font-medium flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Instant PWA Install • Safe &amp; Official</span>
              </div>

              {/* Manual Guide Toggle Button */}
              <button
                type="button"
                onClick={() => setShowManualGuide((prev) => !prev)}
                className="text-xs font-bold text-[#0284C7] hover:text-[#0369A1] inline-flex items-center gap-1 pt-2 transition-colors cursor-pointer"
              >
                <span>{showManualGuide ? 'Hide instructions' : 'Installation issues? Tap for help'}</span>
                {showManualGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* STEP-BY-STEP MANUAL INSTRUCTIONS MODAL/ACCORDION */}
          <AnimatePresence>
            {showManualGuide && !isInstalled && !isNativeCapacitor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full mt-4 pt-4 border-t border-[#F4E3D8] text-left overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="font-extrabold text-xs text-[#17233C] uppercase tracking-wider">
                    Manual Install Guide
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0F7FF] text-[#0284C7] border border-[#DBEAFE]">
                    {platform === 'ios' ? 'Safari / iOS' : platform === 'desktop' ? 'Desktop Browser' : 'Chrome / Android'}
                  </span>
                </div>

                {platform === 'ios' ? (
                  /* iOS / Safari Steps */
                  <div className="space-y-2 text-xs text-[#17233C]">
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]">
                      <span className="w-5 h-5 rounded-full bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black text-[11px] shrink-0">
                        1
                      </span>
                      <span>
                        Tap the <strong className="text-[#0284C7]">Share</strong> icon <Share className="w-3.5 h-3.5 inline mx-0.5 text-[#0284C7]" /> at the bottom of Safari.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]">
                      <span className="w-5 h-5 rounded-full bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black text-[11px] shrink-0">
                        2
                      </span>
                      <span>
                        Scroll down and tap <strong className="text-[#17233C]">Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-[#16A34A]" />.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]">
                      <span className="w-5 h-5 rounded-full bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black text-[11px] shrink-0">
                        3
                      </span>
                      <span>
                        Tap <strong className="text-[#16A34A]">Add</strong> in the top-right corner to complete.
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Android / Chrome Steps */
                  <div className="space-y-2 text-xs text-[#17233C]">
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]">
                      <span className="w-5 h-5 rounded-full bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black text-[11px] shrink-0">
                        1
                      </span>
                      <span>
                        Tap the three dots menu <strong className="text-[#17233C]">⋮</strong> in Chrome’s top right corner.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]">
                      <span className="w-5 h-5 rounded-full bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black text-[11px] shrink-0">
                        2
                      </span>
                      <span>
                        Select <strong className="text-[#FF572E]">"Install app"</strong> or <strong className="text-[#FF572E]">"Add to Home screen"</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]">
                      <span className="w-5 h-5 rounded-full bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black text-[11px] shrink-0">
                        3
                      </span>
                      <span>
                        Tap <strong className="text-[#16A34A]">Install</strong> on the popup to finish.
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="w-full max-w-xl mx-auto px-4 py-3 text-center text-[11px] text-[#8C93A4] font-medium">
        <span>© {new Date().getFullYear()} Helpu. Verified Campus Peer Network.</span>
      </footer>
    </div>
  );
}
