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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white border-t border-gray-100 z-40 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          if (item.isCreate) {
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate('/create')}
                whileTap={{ scale: 0.9 }}
                className="w-14 h-14 -mt-5 bg-coral rounded-full flex items-center justify-center shadow-lg shadow-coral/40"
              >
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
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
              className="flex flex-col items-center gap-0.5 flex-1 py-1 relative"
            >
              <Icon
                className={`w-6 h-6 transition-colors ${active ? 'text-coral' : 'text-text-secondary'}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium transition-colors ${active ? 'text-coral' : 'text-text-secondary'}`}>
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

