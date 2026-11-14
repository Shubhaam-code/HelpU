import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Percent,
  BookOpen,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';

export function AddedCoursesScreen() {
  const navigate = useNavigate();
  const { courses, confirmedFaculties } = useFFCS();

  const confirmedCount = Object.keys(confirmedFaculties).length;

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Main Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs')}
              className="w-9 h-9 rounded-xl bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">
              Your Added Courses
            </h1>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shadow-2xs border border-[#FDE047]">
            <Percent className="w-4 h-4 stroke-[2.5]" />
          </div>
        </header>

        {/* Progress summary banner */}
        <div className="bg-gradient-to-r from-[#FEF08A] to-[#FFFBEB] rounded-2xl border border-[#FEEBA4] p-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFD426] text-[#17233C] flex items-center justify-center font-black shadow-xs">
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <p className="font-extrabold text-xs text-[#17233C]">
                {confirmedCount} of {courses.length} Faculties Selected
              </p>
              <p className="text-[10px] text-[#854D0E] font-medium">
                Tap any course to choose or update faculty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs/timetable')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#17233C] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-transform"
          >
            <CalendarDays className="w-3.5 h-3.5 text-amber-300" />
            <span>Timetable</span>
          </button>
        </div>

        {/* Courses List */}
        <div className="space-y-3">
          {courses.map((course, index) => {
            const confirmed = confirmedFaculties[course.code];

            return (
              <div
                key={course.id || course.code}
                onClick={() => navigate(`/slotmate/ffcs/faculty/${course.code}`)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 shadow-2xs group ${
                  confirmed
                    ? 'bg-white border-[#FDE68A] hover:border-[#FACC15]'
                    : 'bg-white border-[#FEEBA4]/70 hover:border-[#FDE68A]'
                }`}
              >
                {/* Left: Yellow Numbered Badge */}
                <div className="w-10 h-10 rounded-full bg-[#FFD426] text-[#17233C] flex items-center justify-center font-black text-sm shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  {index + 1}
                </div>

                {/* Middle: Course Code + Title + Selected Faculty Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-[#17233C] group-hover:text-[#D97706] transition-colors">
                      {course.code}
                    </h3>
                    {confirmed && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                        <CheckCircle2 className="w-2.8 h-2.8" />
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] font-medium leading-tight truncate mt-0.5">
                    {course.title}
                  </p>

                  {/* Confirmed Faculty preview tag */}
                  {confirmed && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#78350F] font-semibold bg-[#FEF9C3] px-2 py-0.5 rounded-md border border-[#FEF08A] max-w-fit truncate">
                      <span className="truncate">{confirmed.name.split('-')[0].trim()}</span>
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{confirmed.slot}</span>
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{confirmed.roomNo}</span>
                    </div>
                  )}
                </div>

                {/* Right: Chevron */}
                <div className="shrink-0 text-[#94A3B8] group-hover:text-[#17233C] group-hover:translate-x-0.5 transition-all">
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Action: + Add More Courses */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs')}
            className="w-full py-3.5 rounded-2xl bg-[#FFD426] hover:bg-[#FACC15] text-[#17233C] font-black text-sm flex items-center justify-center gap-2 shadow-sm border border-[#EAB308] transition-all cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add More Courses</span>
          </button>
        </div>
      </div>

      {/* 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
