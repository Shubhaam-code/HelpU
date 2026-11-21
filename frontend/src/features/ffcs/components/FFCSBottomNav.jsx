import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, BookOpen, CalendarDays } from 'lucide-react';

export function FFCSBottomNav({ activeTab }) {
  const location = useLocation();

  // Infer tab based on current pathname
  const currentTab =
    location.pathname.includes('/courses')
      ? 'courses'
      : location.pathname.includes('/add')
      ? 'add'
      : location.pathname.includes('/timetable')
      ? 'timetable'
      : activeTab || 'home';

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      path: '/slotmate/ffcs'
    },
    {
      id: 'add',
      label: 'Add Course',
      icon: PlusCircle,
      path: '/slotmate/ffcs/add'
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
    }
  ];

  return (
    <nav
      aria-label="FFCS Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DBEAFE] py-1.5 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] shadow-[0_-4px_20px_rgba(23,35,60,0.05)]"
    >
      <div className="w-full max-w-xl lg:max-w-4xl mx-auto flex items-center justify-around">
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
                <div className="flex flex-col items-center justify-center px-3.5 sm:px-5 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shadow-2xs">
                  <Icon className="w-5 h-5 stroke-[2.4] text-[#2563EB]" />
                  <span className="text-[10px] sm:text-[11px] font-black text-[#2563EB] mt-0.5 tracking-tight">
                    {tab.label}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-2.5 py-1.5 text-[#64748B] hover:text-[#17233C] transition-colors">
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

export default FFCSBottomNav;
