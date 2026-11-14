import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Percent,
  CalendarDays,
  UserCheck,
  AlertCircle,
  Plus,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { TimetableGrid } from '../components/TimetableGrid';
import { FFCSBottomNav } from '../components/FFCSBottomNav';

export function FFCSTimeTableScreen() {
  const navigate = useNavigate();
  const { confirmedFaculties, courses } = useFFCS();

  // Segmented switch: 'timetable' or 'faculties'
  const [activeTab, setActiveTab] = useState('timetable');

  const confirmedList = Object.values(confirmedFaculties);

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Main Container */}
      <div className="w-full max-w-lg md:max-w-2xl mx-auto px-3.5 sm:px-4 pt-3 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/courses')}
              className="w-9 h-9 rounded-xl bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Back to Added Courses"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg sm:text-xl text-[#17233C] tracking-tight">
              Time Table
            </h1>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shadow-2xs border border-[#FDE047]">
            <Percent className="w-4 h-4 stroke-[2.5]" />
          </div>
        </header>

        {/* Top Segmented Switch: [ Faculty List ]  [ My Time Table ] */}
        <div className="bg-[#FEF9C3] p-1.5 rounded-2xl border border-[#FEEBA4] flex items-center shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('faculties')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'faculties'
                ? 'bg-[#FFD426] text-[#17233C] shadow-xs'
                : 'text-[#854D0E] hover:text-[#17233C]'
            }`}
          >
            <UserCheck className="w-4 h-4 stroke-[2.2]" />
            <span>Faculty List</span>
            {confirmedList.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#17233C] text-amber-300 text-[10px] font-black flex items-center justify-center ml-1">
                {confirmedList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-[#FFD426] text-[#17233C] shadow-xs'
                : 'text-[#854D0E] hover:text-[#17233C]'
            }`}
          >
            <CalendarDays className="w-4 h-4 stroke-[2.2]" />
            <span>My Time Table</span>
          </button>
        </div>

        {/* TAB 1: My Time Table Grid */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <TimetableGrid confirmedFaculties={confirmedFaculties} />

            {/* Quick action card */}
            <div className="bg-white rounded-2xl border border-[#FEEBA4] p-3.5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-xs text-[#17233C]">
                  Need to change a faculty or slot?
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Return to your courses and pick another batch or instructor anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/slotmate/ffcs/courses')}
                className="px-3 py-2 rounded-xl bg-[#FEF08A] hover:bg-[#FDE047] text-[#854D0E] font-bold text-xs border border-[#FACC15] shrink-0 active:scale-95 transition-all cursor-pointer"
              >
                Manage Courses
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Faculty List */}
        {activeTab === 'faculties' && (
          <div className="space-y-3">
            {confirmedList.length === 0 ? (
              /* Empty State */
              <div className="bg-white rounded-3xl border border-[#FEEBA4] p-8 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mx-auto shadow-2xs">
                  <UserCheck className="w-7 h-7 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#17233C]">
                    No Faculties Confirmed Yet
                  </h3>
                  <p className="text-xs text-[#64748B] max-w-xs mx-auto mt-1 leading-relaxed">
                    You haven't selected faculties for your registered courses yet. Select your faculties to view them here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/slotmate/ffcs/courses')}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FFD426] hover:bg-[#FACC15] text-[#17233C] font-black text-xs shadow-xs border border-[#EAB308] cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Go to Added Courses</span>
                </button>
              </div>
            ) : (
              /* Confirmed Faculties Cards - Showing ONLY Teacher Name, Slot, Room No */
              <div className="space-y-2.5">
                {confirmedList.map((fac) => (
                  <div
                    key={fac.courseCode || fac.facultyId}
                    className="p-4 rounded-2xl bg-white border border-[#FEEBA4] hover:border-[#FACC15] shadow-xs flex items-center justify-between gap-3 transition-all"
                  >
                    {/* Faculty Details: Teacher Name, Slot, Room No */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#17233C] text-amber-300 font-black text-[10px] tracking-wider uppercase">
                          {fac.courseCode}
                        </span>
                        <h3 className="font-black text-sm text-[#17233C] truncate">
                          {fac.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3 pt-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-[#854D0E] uppercase">Slot:</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] font-black text-xs border border-[#FDE68A]">
                            {fac.slot}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase">Room No:</span>
                          <span className="font-extrabold text-xs text-[#17233C]">
                            {fac.roomNo}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Change Button */}
                    <button
                      type="button"
                      onClick={() => navigate(`/slotmate/ffcs/faculty/${fac.courseCode}`)}
                      className="px-3 py-1.5 rounded-xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] text-[#854D0E] font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-all"
                    >
                      Change
                    </button>
                  </div>
                ))}

                {/* Bottom navigation link to courses */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/slotmate/ffcs/courses')}
                    className="w-full py-3 rounded-2xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] text-[#854D0E] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>View All Added Courses ({courses.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="timetable" />
    </div>
  );
}
