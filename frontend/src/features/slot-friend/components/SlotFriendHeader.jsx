import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Users, FileText, Home, CalendarDays } from 'lucide-react';
import { useSlotFriend } from '../context/SlotFriendContext';

export function SlotFriendHeader({ title, subtitle, showTabs = true, backTo = '/slotmate' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { myPosts = [] } = useSlotFriend();
  const totalMatches = myPosts.reduce((acc, p) => acc + (p.matchCount || 0), 0);

  const navTabs = [
    { label: 'Overview', path: '/slotmate', icon: Home },
    { label: 'Matches', path: '/slotmate/matches', icon: Users, badge: totalMatches },
    { label: 'Create Post', path: '/slotmate/create', icon: Plus },
  ];

  return (
    <div className="w-full bg-white border-b border-[#F4E3D8] sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
      {/* Top Bar with Back Button, Brand Badge & Title */}
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => (backTo === -1 ? navigate(-1) : navigate(backTo))}
            className="p-2 -ml-1 text-[#17233C] hover:bg-[#FFF8F3] active:scale-95 rounded-xl border border-transparent hover:border-[#F4E3D8] transition-all cursor-pointer shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-[#17233C]" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
              <h1 className="font-black text-[#17233C] text-sm sm:text-base md:text-lg truncate tracking-tight">
                {title || 'SlotMate'}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF5FF] border border-[#BAE6FD] text-[#0284C7] text-[10px] font-black uppercase tracking-wider">
                <CalendarDays className="w-3 h-3" />
                <span>SlotMate</span>
              </span>
            </div>
            {subtitle && (
              <p className="text-[11px] text-[#6E7587] truncate font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Quick Create Action on Desktop */}
        <button
          type="button"
          onClick={() => navigate('/slot-friend/create')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF572E] hover:bg-[#E64A22] text-white rounded-full font-black text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>New Slot Post</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      {showTabs && (
        <div className="max-w-6xl mx-auto px-2 sm:px-6 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-1.5 pt-0.5">
          {navTabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;

            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#FFEBE0] text-[#FF572E] font-black border border-[#FDD0BE] shadow-2xs'
                    : 'text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F3]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF572E]' : 'text-[#8C93A4]'}`} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive
                        ? 'bg-[#FF572E] text-white'
                        : 'bg-[#F4E3D8] text-[#17233C]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

