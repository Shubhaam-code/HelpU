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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#FEEBA4] py-2 px-6 shadow-lg shadow-amber-900/5"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center py-1 px-4 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-[#17233C]'
                  : 'text-[#94A3B8] hover:text-[#475569]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-[#FFD426] text-[#17233C] shadow-md shadow-amber-400/30 scale-105'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[2]'}`} />
              </div>
              <span
                className={`text-[11px] mt-1 font-bold tracking-tight transition-colors ${
                  isActive ? 'text-[#17233C] font-extrabold' : 'text-[#64748B]'
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
