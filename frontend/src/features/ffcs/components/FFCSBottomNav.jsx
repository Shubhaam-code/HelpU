import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, CalendarDays, Settings } from 'lucide-react';

export function FFCSBottomNav({ activeTab }) {
  const location = useLocation();

  // If activeTab is not passed explicitly, infer from path
  const currentTab =
    activeTab ||
    (location.pathname.includes('/courses')
      ? 'courses'
      : location.pathname.includes('/timetable')
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
      id: 'courses',
      label: 'Courses',
      icon: BookOpen,
      path: '/slotmate/ffcs/courses'
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F1F5F9] py-1.5 px-2 shadow-[0_-4px_20px_rgba(23,35,60,0.05)]"
    >
      <div className="max-w-[420px] mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              to={tab.path}
              className="flex flex-col items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 no-underline"
            >
              {isActive ? (
                <div className="flex flex-col items-center justify-center px-4 sm:px-5 py-1.5 rounded-full bg-[#FEF08A] text-[#B45309] shadow-xs">
                  <Icon className="w-5 h-5 stroke-[2.3] text-[#B45309]" />
                  <span className="text-[10px] sm:text-[11px] font-black text-[#B45309] mt-0.5 tracking-tight">
                    {tab.label}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-3 py-1.5 text-[#64748B] hover:text-[#17233C] transition-colors">
                  <Icon className="w-5 h-5 stroke-[1.9] text-[#64748B]" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#64748B] mt-0.5 tracking-tight">
                    {tab.label}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
