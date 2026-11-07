import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Car, Users, MessageCircle, User, Plus } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/rides/offer', icon: Car, label: 'Rides' },
  { path: '/create', icon: Plus, label: '', isCreate: true },
  { path: '/match', icon: Users, label: 'Match' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    if (path === '/rides/offer') return location.pathname.startsWith('/rides');
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white border-t border-[#F4E3D8]/60 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-40 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
      <div className="flex items-center justify-around px-2 py-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.isCreate) {
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate('/create')}
                whileTap={{ scale: 0.9 }}
                className="w-13 h-13 -mt-4 bg-coral rounded-full flex items-center justify-center shadow-lg shadow-coral/40 cursor-pointer"
                aria-label="Create Ride Activity"
              >
                <Plus className="w-6.5 h-6.5 text-white" strokeWidth={2.5} />
              </motion.button>
            );
          }

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
              <span className={`text-[10px] font-bold transition-colors ${active ? 'text-coral' : 'text-[#8C93A4]'}`}>
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

