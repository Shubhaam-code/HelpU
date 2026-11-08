import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Car, Users, CarTaxiFront } from 'lucide-react';

/**
 * Helpu Mobile Navigation Bar
 * Exactly FOUR bottom navigation items:
 * 1. Home
 * 2. Ride
 * 3. Matching
 * 4. Group
 * 
 * Supports Android safe areas, high-contrast active states,
 * and reliable touch targets. Profile is accessed from the header.
 */
const MOBILE_NAV_ITEMS = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/rides/offer', icon: Car, label: 'Ride' },
  { path: '/match', icon: Users, label: 'Matching' },
  { path: '/shared-rides', icon: CarTaxiFront, label: 'Group' },
];

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    const current = location.pathname;
    if (path === '/home') {
      return current === '/home' || current === '/';
    }
    if (path === '/rides/offer') {
      return current.startsWith('/rides') || current.startsWith('/book');
    }
    if (path === '/match') {
      return current.startsWith('/match') || current.startsWith('/matches');
    }
    if (path === '/shared-rides') {
      return current.startsWith('/shared-rides') || current.startsWith('/groups');
    }
    return current.startsWith(path);
  };

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-[#F4E3D8] shadow-[0_-4px_20px_rgba(23,35,60,0.04)] z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
    >
      <div className="flex items-center justify-around px-2 py-0.5 max-w-lg mx-auto">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[48px] relative cursor-pointer select-none transition-transform duration-150 active:scale-95 group focus:outline-none"
            >
              {/* Active top pill indicator */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-[#FF572E] shadow-xs" />
              )}

              {/* Icon Container with subtle background when active */}
              <div 
                className={`w-9 h-7 flex items-center justify-center rounded-xl transition-colors duration-150 ${
                  active ? 'text-[#FF572E]' : 'text-[#6E7587] group-hover:text-[#17233C]'
                }`}
              >
                <Icon
                  className="w-5 h-5 sm:w-5.5 sm:h-5.5"
                  strokeWidth={active ? 2.4 : 2}
                />
              </div>

              {/* Label */}
              <span
                className={`text-[10px] sm:text-[11px] leading-tight transition-colors duration-150 whitespace-nowrap ${
                  active 
                    ? 'font-black text-[#FF572E]' 
                    : 'font-semibold text-[#6E7587] group-hover:text-[#17233C]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavigation;
