import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutGrid, Calendar, Car, Users, Heart, MessageSquare, Wrench, Settings 
} from 'lucide-react';

// Illustration for sidebar promo widget matching desktop screenshot
function CampusBuddiesIllustration() {
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* Sky/ground background */}
      <rect width="160" height="100" rx="12" fill="#FFF9F2" />
      <circle cx="25" cy="85" r="28" fill="#C9F2DE" opacity="0.6" />
      <circle cx="135" cy="85" r="28" fill="#C9F2DE" opacity="0.6" />
      <rect x="0" y="86" width="160" height="14" fill="#C9F2DE" />

      {/* Sun/cloud */}
      <circle cx="80" cy="20" r="14" fill="#FFE6CB" />

      {/* Left Student (Boy) */}
      <ellipse cx="55" cy="65" rx="16" ry="14" fill="#17233C" />
      <rect x="36" y="52" width="12" height="16" rx="4" fill="#FF654F" /> {/* Backpack */}
      <circle cx="55" cy="46" r="12" fill="#FDBCB4" /> {/* Head */}
      <ellipse cx="55" cy="38" rx="12" ry="5" fill="#1a1a1a" /> {/* Hair */}
      <circle cx="51" cy="45" r="1.5" fill="#1a1a1a" />
      <circle cx="59" cy="45" r="1.5" fill="#1a1a1a" />
      <path d="M52 50 Q55 53 58 50" stroke="#1a1a1a" strokeWidth="1" fill="none" strokeLinecap="round" />

      {/* Right Student (Girl) */}
      <ellipse cx="105" cy="65" rx="16" ry="14" fill="#FF654F" />
      <rect x="112" y="52" width="12" height="16" rx="4" fill="#17233C" /> {/* Backpack */}
      <circle cx="105" cy="46" r="12" fill="#F1A77D" /> {/* Head */}
      <ellipse cx="105" cy="38" rx="13" ry="6" fill="#1a1a1a" /> {/* Long hair */}
      <ellipse cx="94" cy="45" rx="2.5" ry="8" fill="#1a1a1a" />
      <ellipse cx="116" cy="45" rx="2.5" ry="8" fill="#1a1a1a" />
      <circle cx="101" cy="45" r="1.5" fill="#1a1a1a" />
      <circle cx="109" cy="45" r="1.5" fill="#1a1a1a" />
      <path d="M102 50 Q105 53 108 50" stroke="#1a1a1a" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function DesktopSidebar({ onCloseMobile }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { label: 'Dashboard', path: '/home', icon: LayoutGrid },
    { label: 'My Bookings', path: '/bookings', icon: Calendar },
    { label: 'Offers & Requests', path: '/rides', icon: Car },
    { label: 'Matches', path: '/match', icon: Users },
    { label: 'Saved Rides', path: '/saved', icon: Heart },
    { label: 'WhatsApp Connect', path: '/chat', icon: MessageSquare },
    { label: 'Community', path: '/community', icon: Users },
    { label: 'Get Help', path: '/help', icon: Wrench },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleNav = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const isItemActive = (path) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 flex flex-col justify-between py-6 px-4 bg-transparent select-none">
      {/* Nav List */}
      <div className="space-y-1">
        {menuItems.map((item) => {
          const active = isItemActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 cursor-pointer ${
                active
                  ? 'bg-peach/80 text-coral shadow-sm shadow-coral/5 font-bold'
                  : 'text-text-secondary hover:text-navy hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${active ? 'text-coral' : 'text-text-secondary'}`} />
                <span>{item.label}</span>
              </div>
              
              {item.badge != null && (
                <span className="w-5 h-5 rounded-full bg-coral text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Promo Widget matching Desktop Reference */}
      <div className="mt-8 pt-4">
        <div 
          onClick={() => handleNav('/match')}
          className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100/80 cursor-pointer hover:shadow-md transition-shadow duration-200 overflow-hidden relative"
        >
          <div className="mb-2">
            <h4 className="font-extrabold text-navy text-sm flex items-center gap-1.5">
              <span>Match. Ride. Connect.</span>
              <span>🚗</span>
            </h4>
            <p className="text-text-secondary text-xs mt-1 leading-snug">
              Find the best travel buddies on your campus.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden mt-3 pt-1 bg-peach/20">
            <CampusBuddiesIllustration />
          </div>
        </div>
      </div>
    </aside>
  );
}

export default DesktopSidebar;

