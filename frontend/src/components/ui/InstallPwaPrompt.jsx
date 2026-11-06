import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { usePwaInstall } from '../../pwa/usePwaInstall';

export function InstallPwaPrompt() {
  // Always call hooks first, before any conditional returns
  const { isInstallable, isInstalled, isIOS, installApp } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('helpu-pwa-dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }

    // Allow other components to trigger the prompt via window event
    const handleTrigger = () => {
      setDismissed(false);
      if (isInstallable) {
        installApp();
      } else if (isIOS && !isInstalled) {
        setShowIosModal(true);
      }
    };

    window.addEventListener('pwa-prompt-install', handleTrigger);
    return () => window.removeEventListener('pwa-prompt-install', handleTrigger);
  }, [isInstallable, isIOS, isInstalled, installApp]);

  // If running inside native iOS/Android Capacitor app, never show PWA install prompt
  if (Capacitor.isNativePlatform()) {
    return null;
  }

  if (isInstalled || dismissed) {
    return (
      <IosInstallModal
        isOpen={showIosModal}
        onClose={() => setShowIosModal(false)}
      />
    );
  }

  // Only show floating banner if browser supports native prompt OR if iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('helpu-pwa-dismissed', 'true');
  };

  const handleInstallClick = () => {
    if (isInstallable) {
      installApp();
    } else if (isIOS) {
      setShowIosModal(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="pwa-install-banner"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-white rounded-2xl p-4 border border-[#F4E3D8] shadow-xl shadow-[#FF572E]/10"
        >
          <div className="flex items-center gap-3">
            {/* App Icon */}
            <div className="w-12 h-12 rounded-xl bg-[#FFF0E6] border border-[#FDE0D0] p-1.5 shrink-0 flex items-center justify-center shadow-xs">
              <img
                src="/pwa-192x192.png"
                alt="Helpu App"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-black text-sm text-[#17233C] truncate">
                  Install Helpu App
                </h4>
                <span className="px-1.5 py-0.5 rounded-full bg-[#EDFAF3] text-[#16A34A] text-[9px] font-extrabold uppercase tracking-wide border border-[#BCECD4]">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-[#6E7587] font-medium truncate mt-0.5">
                Fast campus ride alerts &amp; standalone mobile experience
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-full bg-[#FFFBF8] border border-[#F4E3D8] text-[#8C93A4] hover:text-[#17233C] hover:bg-[#F4E3D8]/50 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#F4E3D8]/60">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Now</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2 px-3 bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#6E7587] font-bold text-xs rounded-xl border border-[#F4E3D8] transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <IosInstallModal
        isOpen={showIosModal}
        onClose={() => setShowIosModal(false)}
      />
    </>
  );
}

function IosInstallModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="bg-white rounded-[28px] max-w-sm w-full p-6 border border-[#F4E3D8] shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFFBF8] border border-[#F4E3D8] text-[#8C93A4] flex items-center justify-center hover:text-[#17233C]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] p-2 border border-[#FDE0D0] flex items-center justify-center">
            <img src="/pwa-192x192.png" alt="Helpu" className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="font-black text-base text-[#17233C]">Install on iPhone / iPad</h3>
            <p className="text-xs text-[#6E7587]">Add Helpu to your home screen</p>
          </div>
        </div>

        <div className="space-y-3 py-2 text-xs text-[#17233C]">
          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]/70">
            <div className="w-6 h-6 rounded-lg bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black shrink-0">
              1
            </div>
            <div>
              Tap the <strong className="text-[#FF572E]">Share</strong> button{' '}
              <Share className="w-3.5 h-3.5 inline mx-0.5 text-[#2563EB]" /> in Safari's bottom bar.
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]/70">
            <div className="w-6 h-6 rounded-lg bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black shrink-0">
              2
            </div>
            <div>
              Scroll down and select <strong className="text-[#17233C]">Add to Home Screen</strong>{' '}
              <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-[#16A34A]" />.
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8]/70">
            <div className="w-6 h-6 rounded-lg bg-[#FF572E]/10 text-[#FF572E] flex items-center justify-center font-black shrink-0">
              3
            </div>
            <div>
              Tap <strong className="text-[#16A34A]">Add</strong> in the top-right corner to finish.
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-[#FF572E] text-white font-extrabold text-xs rounded-xl hover:bg-[#E64A22] transition-colors cursor-pointer"
        >
          Got it!
        </button>
      </motion.div>
    </div>
  );
}

