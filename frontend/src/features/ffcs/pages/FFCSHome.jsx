import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  Clock,
  Megaphone,
  Plus,
  ArrowRight,
  Check,
  ChevronRight,
  Zap,
  X
} from 'lucide-react';

import { AppHeader } from '../../../components/layout/AppHeader';
import { ServiceSwitcher } from '../../../components/layout/ServiceSwitcher';
import { useFFCS } from '../context/FFCSContext';
import { useUser } from '../../../context/FirebaseAuthContext';
import { useUserProfile, useUnreadNotificationsCount } from '../../../hooks/useAppData';
import { FFCSBottomNav } from '../components/FFCSBottomNav';

/**
 * Universal Mobile & Desktop Screen: FFCSHome
 * Pixel-accurate to Image 1:
 * - On Mobile (Android Capacitor): Compact, touch targets, safe-area insets, 100% native feel.
 * - On Desktop / Web: Centered responsive max-w container, scalable typography, elegant hover states.
 */
export function FFCSHome() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: profile } = useUserProfile();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount({ module: 'slotmate' });
  const { coursesList, isBackgroundFetching, confirmedFaculties } = useFFCS();

  const [showNoticeModal, setShowNoticeModal] = useState(false);

  const firstName = profile?.name ? profile.name.split(' ')[0] : (user?.firstName || 'Student');

  const handleAddCourseClick = () => {
    if (coursesList.length >= 8) {
      window.alert('Maximum 8 courses allowed in FFCS. Please remove an existing course to add a new one.');
      return;
    }
    navigate('/slotmate/ffcs/add');
  };

  return (
    <div className="min-h-screen bg-[#F0F7FF] text-[#17233C] flex flex-col justify-between selection:bg-[#93C5FD]">
      
      {/* 1. APP HEADER (Responsive + Light Blue Theme, Notification Bell Removed as requested) */}
      <AppHeader
        theme="blue"
        avatarId={profile?.avatarId}
        onAvatar={() => {}}
      />

      {/* Decorative Ambient Top Glows */}
      <div className="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#DBEAFE]/40 via-[#EFF6FF]/20 to-transparent pointer-events-none" />
      <div className="fixed -top-12 -right-12 w-56 h-56 bg-[#93C5FD]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-24 -left-12 w-48 h-48 bg-[#BFDBFE]/25 rounded-full blur-2xl pointer-events-none" />

      {/* ========================================================================= */}
      {/* MAIN CONTENT CONTAINER (Universal: Phone + Desktop Responsive)           */}
      {/* ========================================================================= */}
      <main className="w-full max-w-xl lg:max-w-4xl mx-auto px-3.5 sm:px-6 pt-2.5 pb-[54px] min-[360px]:pb-[60px] sm:pb-[66px] relative z-10 flex-1">

        <div className="space-y-4 sm:space-y-5">
          {/* 2. WELCOME GREETING */}
          <div className="px-0.5">
            <div className="flex items-center gap-1.5">
              <h2 className="font-black text-[#17233C] text-[19px] min-[360px]:text-[21px] sm:text-2xl md:text-3xl tracking-tight">
                Welcome back, {firstName}
              </h2>
              <span className="text-lg sm:text-2xl">👋</span>
            </div>
          </div>

          {/* 3. TRIPLE SERVICE SWITCHER (SlotMate | PoolMate | FFCS Mate) */}
          <ServiceSwitcher activeService="ffcs" />

          {/* 4. HERO BANNER: MAKE YOUR FFCS SMARTER (FLUSH BOTTOM CONNECTION) */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-gradient-to-br from-[#EFF6FF] via-[#F0F7FF] to-[#DBEAFE]/90 rounded-[22px] min-[360px]:rounded-[26px] sm:rounded-[30px] border border-[#BFDBFE] pt-3.5 px-3.5 min-[360px]:pt-4 min-[360px]:px-4 sm:pt-6 sm:px-6 pb-0 overflow-hidden shadow-xs hover:shadow-sm transition-shadow"
          >
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#93C5FD]/30 to-transparent pointer-events-none rounded-full" />

            <div className="relative z-10 flex items-end justify-between gap-2 sm:gap-6">
              {/* Left Content */}
              <div className="flex-1 min-w-0 pr-0.5 sm:pr-2 space-y-1 sm:space-y-2 pb-3.5 min-[360px]:pb-4 sm:pb-6">
                <h1 className="font-black text-[#17233C] text-[19px] min-[360px]:text-[21px] sm:text-2xl md:text-3xl leading-[1.15] tracking-tight">
                  Make Your <br />
                  <span className="text-[#2563EB]">FFCS Smarter</span>
                </h1>
                <p className="text-[10.5px] min-[360px]:text-[11.5px] sm:text-xs md:text-sm text-[#475569] font-medium leading-relaxed max-w-[220px] sm:max-w-md">
                  Explore courses, compare faculty and plan your perfect schedule.
                </p>
              </div>

              {/* Right Illustration (Connected flush to bottom edge, zero gap) */}
              <div
                className="shrink-0 w-[130px] min-[360px]:w-[150px] sm:w-[210px] md:w-[250px] flex justify-end items-end self-end -mr-1 sm:mr-0"
                style={{ maxWidth: '50%' }}
              >
                <img
                  src="/ffcs-students-duo.png"
                  alt="Smart FFCS Course Planning"
                  className="w-full h-auto max-h-[140px] min-[360px]:max-h-[155px] sm:max-h-[195px] md:max-h-[220px] object-contain object-bottom select-none pointer-events-none drop-shadow-xs block"
                  onError={(e) => {
                    e.currentTarget.src = '/ffcs-campus-hero.png';
                    e.currentTarget.onerror = null;
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* 5. QUICK ACTIONS SECTION (4 CIRCULAR ITEMS) */}
          <div className="bg-white rounded-[22px] min-[360px]:rounded-[24px] sm:rounded-[28px] p-3.5 min-[360px]:p-4 sm:p-5 border border-[#DBEAFE] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xs min-[360px]:text-sm sm:text-base text-[#17233C] tracking-tight">
                Quick Actions
              </h3>
              <button
                type="button"
                onClick={() => navigate('/slotmate/ffcs/courses')}
                className="text-[11px] sm:text-xs font-black text-[#2563EB] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-4 pt-1">
              {/* 1. My Courses */}
              <button
                type="button"
                onClick={() => navigate('/slotmate/ffcs/courses')}
                className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 min-[360px]:w-13.5 min-[360px]:h-13.5 sm:w-16 sm:h-16 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shadow-2xs group-hover:scale-105 group-hover:shadow-xs transition-all">
                  <BookOpen className="w-5 h-5 min-[360px]:w-6 min-[360px]:h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
                </div>
                <span className="text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
                  My Courses
                </span>
              </button>

              {/* 2. Add Course (Clean vector icon matching palette) */}
              <button
                type="button"
                onClick={handleAddCourseClick}
                className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 min-[360px]:w-13.5 min-[360px]:h-13.5 sm:w-16 sm:h-16 rounded-full bg-[#F3E8FF] text-[#9333EA] border border-[#DDD6FE] flex items-center justify-center shadow-2xs group-hover:scale-105 group-hover:shadow-xs transition-all">
                  <Plus className="w-5 h-5 min-[360px]:w-6 min-[360px]:h-6 sm:w-7 sm:h-7 stroke-[2.4]" />
                </div>
                <span className="text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
                  Add Course
                </span>
              </button>

              {/* 3. Time Table */}
              <button
                type="button"
                onClick={() => navigate('/slotmate/ffcs/timetable')}
                className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 min-[360px]:w-13.5 min-[360px]:h-13.5 sm:w-16 sm:h-16 rounded-full bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0] flex items-center justify-center shadow-2xs group-hover:scale-105 group-hover:shadow-xs transition-all">
                  <Clock className="w-5 h-5 min-[360px]:w-6 min-[360px]:h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
                </div>
                <span className="text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
                  Time Table
                </span>
              </button>

              {/* 4. Notices */}
              <button
                type="button"
                onClick={() => setShowNoticeModal(true)}
                className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 min-[360px]:w-13.5 min-[360px]:h-13.5 sm:w-16 sm:h-16 rounded-full bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] flex items-center justify-center shadow-2xs group-hover:scale-105 group-hover:shadow-xs transition-all">
                  <Megaphone className="w-5 h-5 min-[360px]:w-6 min-[360px]:h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
                </div>
                <span className="text-[10px] min-[360px]:text-[11px] sm:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
                  Notices
                </span>
              </button>
            </div>
          </div>

          {/* 6. YOUR COURSES SECTION (Compact Box) */}
          <div className="bg-white rounded-[20px] min-[360px]:rounded-[22px] sm:rounded-[26px] p-3 min-[360px]:p-3.5 sm:p-4 border border-[#DBEAFE] shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-1.5">
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.4]" />
                </div>
                <h3 className="font-black text-xs min-[360px]:text-[13px] sm:text-sm text-[#17233C]">
                  Your Courses
                </h3>
                {isBackgroundFetching && (
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-[#BFDBFE] animate-pulse">
                    Syncing...
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/slotmate/ffcs/courses')}
                className="text-[11px] sm:text-xs font-black text-[#2563EB] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Empty State vs Added Courses */}
            {coursesList.length === 0 ? (
              <div className="py-2 px-2 text-center flex flex-col items-center justify-center space-y-1.5">
                <img
                  src="/ffcs-book-empty.png"
                  alt="No courses yet"
                  className="w-13 h-13 min-[360px]:w-14 min-[360px]:h-14 sm:w-16 sm:h-16 object-contain select-none pointer-events-none drop-shadow-sm"
                  loading="eager"
                  decoding="sync"
                />

                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-[11.5px] min-[360px]:text-xs sm:text-sm text-[#17233C]">
                    No courses added yet
                  </h4>
                  <p className="text-[10px] min-[360px]:text-[10.5px] text-[#64748B] max-w-[220px] leading-tight">
                    Add your courses to get started
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddCourseClick}
                  className="mt-0.5 inline-flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:from-[#2563EB] hover:to-[#1D4ED8] text-white font-black text-[11px] min-[360px]:text-xs rounded-full shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add Course</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  {coursesList.slice(0, 2).map((course, idx) => {
                    const isSelected = Boolean(confirmedFaculties[course.id]);

                    return (
                      <div
                        key={course.id || idx}
                        onClick={() => navigate(`/slotmate/ffcs/faculty/${course.id}`)}
                        className="p-3 sm:p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#3B82F6]/50 hover:bg-[#F0F7FF] flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-all group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#EFF6FF] text-[#2563EB] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 border border-[#BFDBFE]">
                            {course.sequence || idx + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-xs sm:text-sm text-[#17233C] truncate group-hover:text-[#2563EB] transition-colors">
                              {course.code || 'Course'}
                            </h4>
                            <p className="text-[10px] sm:text-[11px] text-[#64748B] font-medium truncate mt-0.5">
                              {course.name || 'Curriculum Course'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-[#FFEDD5] text-[#EA580C] border border-[#FED7AA]">
                              <Check className="w-2.5 h-2.5 stroke-[3] mr-1" /> Selected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                              Choose Faculty
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#17233C] transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* 7. BOTTOM CAMPUS HERO CARD (In a styled box with FFCS guide text) */}
          <div className="bg-gradient-to-br from-white via-[#F8FBFF] to-[#EFF6FF] rounded-[22px] min-[360px]:rounded-[24px] sm:rounded-[28px] border border-[#BFDBFE] p-3.5 sm:p-5 shadow-2xs overflow-hidden relative space-y-2">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
                <span>Smart FFCS Companion</span>
              </div>
              <h3 className="font-black text-xs min-[360px]:text-sm sm:text-base text-[#17233C] tracking-tight">
                Plan Clash-Free Schedules Effortlessly
              </h3>
              <p className="text-[10.5px] min-[360px]:text-[11.5px] sm:text-xs text-[#64748B] font-medium leading-relaxed max-w-md">
                Select your preferred teachers, compare timetable slots, and verify your weekly schedule with zero clash before registration opens.
              </p>
            </div>

            {/* Campus Illustration inside the card */}
            <div className="w-full pt-1 flex items-end justify-center select-none pointer-events-none -mb-3 sm:-mb-5">
              <img
                src="/ffcs-campus-hero.png"
                alt="VIT Campus and FFCS Planning"
                className="w-full h-auto max-h-[145px] min-[360px]:max-h-[165px] sm:max-h-[210px] object-contain object-bottom block"
                loading="eager"
                decoding="sync"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

        </div>

      </main>

      {/* 8. RESPONSIVE BOTTOM NAVIGATION */}
      <FFCSBottomNav activeTab="home" />

      {/* Notices Dialog Modal */}
      {showNoticeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowNoticeModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-xl border border-[#DBEAFE]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 stroke-[2.4]" />
                </div>
                <h4 className="font-black text-xs sm:text-sm text-[#17233C]">FFCS Notices</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-[#64748B] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-[#475569] leading-relaxed">
              <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]/60">
                <p className="font-bold text-[#17233C] text-[11.5px]">Winter Semester 2026-27 Registration</p>
                <p className="text-[10.5px] text-[#64748B] mt-0.5">
                  Verify timetable slots before finalizing courses. Check slot clashes in Time Table tab.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="font-bold text-[#17233C] text-[11.5px]">AI Timetable Scanner Active</p>
                <p className="text-[10.5px] text-[#64748B] mt-0.5">
                  Upload screenshots to extract faculty names and slots in 7–10 seconds.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNoticeModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default FFCSHome;
