import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Settings } from 'lucide-react';

export function FFCSBottomNav({ activeTab }) {
  const navigate = useNavigate();
  const location = useLocation();

  // If activeTab is not passed explicitly, infer from path
  const currentTab =
    activeTab ||
    (location.pathname.includes('/timetable')
      ? 'timetable'
      : location.pathname.includes('/settings')
      ? 'settings'
      : 'home');

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      path: '/slotmate/ffcs'
    },
    {
      id: 'timetable',
      label: 'Time Table',
      icon: CalendarDays,
      path: '/slotmate/ffcs/timetable'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/slotmate/ffcs/settings'
    }
  ];

  return (
    <nav
      aria-label="FFCS Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#FEEBA4]/80 py-2 px-5 shadow-[0_-4px_20px_rgba(23,35,60,0.06)]"
    >
      <div className="max-w-[420px] mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-[#FACC15] text-[#17233C] px-5 py-2 rounded-2xl shadow-sm'
                  : 'text-[#475569] hover:text-[#17233C] px-4 py-2'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
              <span
                className={`text-[11px] mt-0.5 tracking-tight font-black ${
                  isActive ? 'text-[#17233C]' : 'text-[#64748B] font-bold'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
