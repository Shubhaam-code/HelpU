import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Car, Users, CarTaxiFront, Info, FileText, CheckCircle2, User, Heart
} from 'lucide-react';

/**
 * Helpu Drawer Navigation (Tablet / Responsive Drawer)
 * Consistently features the 5 core tabs + essential student destinations.
 */
export function DesktopSidebar({ onCloseMobile }) {
  const navigate = useNavigate();
  const location = useLocation();

  const coreItems = [
    { label: 'Home', path: '/home', icon: Home },
    { label: 'Ride', path: '/rides/offer', icon: Car },
    { label: 'Matching', path: '/match', icon: Users },
    { label: 'Group', path: '/shared-rides', icon: CarTaxiFront },
    { label: 'About', path: '/about', icon: Info },
  ];

  const secondaryItems = [
    { label: 'My Posts', path: '/posts', icon: FileText },
    { label: 'Confirmed Rides', path: '/confirmed-rides', icon: CheckCircle2 },
    { label: 'My Profile', path: '/profile', icon: User },
    { label: 'Saved Rides', path: '/saved', icon: Heart },
  ];

  const handleNav = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const isItemActive = (path) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    if (path === '/rides/offer') return location.pathname.startsWith('/rides');
    if (path === '/match') return location.pathname.startsWith('/match') || location.pathname.startsWith('/matches');
    if (path === '/shared-rides') return location.pathname.startsWith('/shared-rides') || location.pathname.startsWith('/groups');
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-full flex flex-col justify-between py-2 px-1 select-none">
      <div className="space-y-4">
        {/* Core 5 Navigation Items */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[11px] font-black uppercase tracking-wider text-[#8C93A4]">
            Navigation
          </div>
          {coreItems.map((item) => {
            const active = isItemActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#FFEBE0] text-[#FF572E] font-black border border-[#FDD0BE]'
                    : 'text-[#6E7587] hover:text-[#17233C] hover:bg-white/80'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? 'text-[#FF572E]' : 'text-[#6E7587]'}`} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary Links */}
        <div className="space-y-1 pt-2 border-t border-[#F4E3D8]/60">
          <div className="px-3 pb-1 text-[11px] font-black uppercase tracking-wider text-[#8C93A4]">
            Account & Activity
          </div>
          {secondaryItems.map((item) => {
            const active = isItemActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#FFEBE0] text-[#FF572E] font-black border border-[#FDD0BE]'
                    : 'text-[#6E7587] hover:text-[#17233C] hover:bg-white/80'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? 'text-[#FF572E]' : 'text-[#6E7587]'}`} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default DesktopSidebar;
