import { useNavigate } from 'react-router-dom';
import { Home, PlusCircle, Users, GraduationCap } from 'lucide-react';

/**
 * 4-Item SlotMate Bottom Navigation:
 * 1. Home      -> /slotmate
 * 2. Post      -> /slotmate/create
 * 3. Match     -> /slotmate/matches
 * 4. Faculty   -> /slotmate/faculty (Active: soft yellow pill #FEF08A + orange text)
 */
export function SlotMateBottomNav({ active = 'home' }) {
  const navigate = useNavigate();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/slotmate' },
    { id: 'post', label: 'Post', icon: PlusCircle, path: '/slotmate/create' },
    { id: 'match', label: 'Matches', icon: Users, path: '/slotmate/matches' },
    { id: 'faculty', label: 'Faculty', icon: GraduationCap, path: '/slotmate/faculty' },
  ];

  return (
    <nav
      aria-label="SlotMate Navigation"
      className="fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-[#F4E3D8] shadow-[0_-4px_20px_rgba(23,35,60,0.04)] z-40 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5"
    >
      <div className="flex items-center justify-around px-2 py-0.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            active === item.id ||
            (item.id === 'match' && active === 'matches') ||
            (item.id === 'faculty' && (active === 'faculty' || active === 'faculty-details'));
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              className={`flex items-center justify-center py-1 focus:outline-none cursor-pointer transition-all ${
                isActive ? '' : 'px-2 text-[#6E7587] hover:text-[#17233C] active:scale-95'
              }`}
            >
              {isActive ? (
                <div className="flex flex-col items-center justify-center px-4 py-1.5 rounded-full bg-[#FEF08A] text-[#C2410C] shadow-2xs">
                  <Icon className="w-5 h-5 stroke-[2.4] text-[#EA580C]" />
                  <span className="text-[11px] font-black leading-tight text-[#C2410C]">
                    {item.label}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <Icon className="w-5 h-5 stroke-[2]" />
                  <span className="text-[10px] font-bold mt-0.5 leading-tight text-[#6E7587]">
                    {item.label}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default SlotMateBottomNav;

