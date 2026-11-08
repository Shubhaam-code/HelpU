import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Car, Users, FileText, CarTaxiFront } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

/**
 * Check if running inside the native Android Capacitor application shell
 * or explicitly requested via ?platform=android / window.__HELPU_PLATFORM__.
 */
export function isAndroidPlatform() {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return true;
  if (window.__HELPU_PLATFORM__ === 'android') return true;
  try {
    const search = window.location.search;
    if (search && new URLSearchParams(search).get('platform') === 'android') return true;
  } catch {
    // Ignore URL parsing errors
  }
  return false;
}

// Android navigation: Home | Ride | Match | Shared Rides
const ANDROID_NAV_ITEMS = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/rides/offer', icon: Car, label: 'Ride' },
  { path: '/match', icon: Users, label: 'Match' },
  { path: '/shared-rides', icon: CarTaxiFront, label: 'Shared Rides' },
];

// Website navigation: Home | Post | Matching | Shared Rides
const WEBSITE_NAV_ITEMS = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/posts', icon: FileText, label: 'Post' },
  { path: '/match', icon: Users, label: 'Matching' },
  { path: '/shared-rides', icon: CarTaxiFront, label: 'Shared Rides' },
];

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAndroid = isAndroidPlatform();

  const navItems = isAndroid ? ANDROID_NAV_ITEMS : WEBSITE_NAV_ITEMS;

  const isActive = (path) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    if (path === '/rides/offer') return location.pathname.startsWith('/rides');
    if (path === '/posts') return location.pathname.startsWith('/posts') || location.pathname.startsWith('/my-rides');
    if (path === '/match') return location.pathname.startsWith('/match');
    if (path === '/shared-rides') return location.pathname.startsWith('/shared-rides') || location.pathname.startsWith('/groups');
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white border-t border-[#F4E3D8]/60 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-40 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
      <div className="flex items-center justify-around px-2 py-0.5">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-0.5 flex-1 py-1 relative cursor-pointer"
            >
              <Icon
                className={`w-5 h-5 sm:w-5.5 sm:h-5.5 transition-colors ${active ? 'text-coral' : 'text-[#8C93A4]'}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] font-bold transition-colors whitespace-nowrap ${active ? 'text-coral' : 'text-[#8C93A4]'}`}>
                {item.label}
              </span>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-coral"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
