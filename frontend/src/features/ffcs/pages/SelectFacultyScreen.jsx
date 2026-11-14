import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Percent,
  AlertCircle
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';

export function SelectFacultyScreen() {
  const { courseCode } = useParams();
  const navigate = useNavigate();
  const { courses, confirmedFaculties, confirmFaculty } = useFFCS();

  // Find course
  const course = courses.find(
    (c) => c.code.toLowerCase() === (courseCode || '').toLowerCase()
  );

  // Initial selected faculty
  const currentConfirmed = course ? confirmedFaculties[course.code] : null;
  const [selectedFacultyId, setSelectedFacultyId] = useState(
    currentConfirmed?.facultyId || course?.faculties?.[0]?.id || null
  );

  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (currentConfirmed?.facultyId) {
      setSelectedFacultyId(currentConfirmed.facultyId);
    } else if (course?.faculties?.[0]?.id) {
      setSelectedFacultyId(course.faculties[0].id);
    }
  }, [course, currentConfirmed]);

  const handleConfirm = () => {
    if (!course || !selectedFacultyId) return;
    const faculty = course.faculties.find((f) => f.id === selectedFacultyId);
    if (!faculty) return;

    confirmFaculty(course.code, {
      facultyId: faculty.id,
      name: faculty.name,
      slot: faculty.slot,
      roomNo: faculty.roomNo,
      classNo: faculty.classNo
    });

    setSavedToast(true);
    setTimeout(() => {
      navigate('/slotmate/ffcs/courses');
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Main Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/courses')}
              className="w-9 h-9 rounded-xl bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Back to Courses"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">
              Select Faculty
            </h1>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shadow-2xs border border-[#FDE047]">
            <Percent className="w-4 h-4 stroke-[2.5]" />
          </div>
        </header>

        {/* Course Not Found */}
        {!course ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h2 className="font-black text-base text-[#17233C]">Course Not Found</h2>
            <p className="text-xs text-[#64748B]">
              The requested course code "{courseCode}" does not exist in your catalogue.
            </p>
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/courses')}
              className="px-4 py-2 bg-[#FFD426] text-[#17233C] font-bold text-xs rounded-xl shadow-xs"
            >
              Back to Courses
            </button>
          </div>
        ) : (
          <>
            {/* Top Summary Card */}
            <div className="bg-[#FFFDF7] rounded-2xl border border-[#FEEBA4] p-4 flex items-center gap-3.5 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#FFD426] text-[#17233C] flex items-center justify-center shrink-0 shadow-xs">
                <BookOpen className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#854D0E]">
                  Course Code
                </span>
                <h2 className="font-black text-base text-[#17233C] leading-tight">
                  {course.code}
                </h2>
                <p className="text-xs font-semibold text-[#64748B] leading-tight mt-0.5 truncate">
                  {course.title}
                </p>
              </div>
            </div>

            {/* Empty faculties state */}
            {(!course.faculties || course.faculties.length === 0) ? (
              <div className="bg-white rounded-2xl border border-[#FEEBA4] p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-black text-sm text-[#17233C]">
                  No Faculty List Available
                </h3>
                <p className="text-xs text-[#64748B]">
                  Faculties for this course have not been published yet.
                </p>
              </div>
            ) : (
              /* Faculty Table with Radio Selection */
              <div className="bg-white rounded-2xl border border-[#FEEBA4] shadow-sm overflow-hidden">
                {/* Table Header Columns: Faculty Name | Slot | Room No. */}
                <div className="grid grid-cols-12 bg-[#FEF9C3] px-3.5 py-2.5 border-b border-[#FEEBA4] text-[11px] font-black text-[#854D0E] uppercase tracking-wider">
                  <div className="col-span-6 pl-6">Faculty Name</div>
                  <div className="col-span-3 text-center">Slot</div>
                  <div className="col-span-3 text-right">Room No.</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-[#FEEBA4]/50">
                  {course.faculties.map((fac) => {
                    const isSelected = selectedFacultyId === fac.id;

                    return (
                      <div
                        key={fac.id}
                        onClick={() => setSelectedFacultyId(fac.id)}
                        className={`grid grid-cols-12 items-center px-3.5 py-3 transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#FEFCE8] ring-1 ring-inset ring-[#FACC15]'
                            : 'hover:bg-[#FFFDF7]'
                        }`}
                      >
                        {/* Radio Button + Faculty Name */}
                        <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-1">
                          {/* Radio circle */}
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'border-[#17233C] bg-[#FFD426]'
                                : 'border-[#CBD5E1] bg-white'
                            }`}
                          >
                            {isSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#17233C]" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-xs block leading-tight truncate ${
                                isSelected
                                  ? 'font-black text-[#17233C]'
                                  : 'font-bold text-[#334155]'
                              }`}
                            >
                              {fac.name}
                            </span>
                            {fac.classNo && (
                              <span className="text-[9px] text-[#94A3B8] font-medium block truncate mt-0.5">
                                Class: {fac.classNo}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Slot column */}
                        <div className="col-span-3 text-center px-1">
                          <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] font-black text-[11px] border border-[#FDE68A] whitespace-nowrap">
                            {fac.slot}
                          </span>
                        </div>

                        {/* Room No column */}
                        <div className="col-span-3 text-right">
                          <span className="text-xs font-bold text-[#17233C] whitespace-nowrap">
                            {fac.roomNo}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confirm Faculty Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedFacultyId}
                className="w-full py-3.5 rounded-2xl bg-[#FFD426] hover:bg-[#FACC15] disabled:opacity-50 text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-amber-400/25 border border-[#EAB308] transition-all cursor-pointer active:scale-98"
              >
                {savedToast ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[#17233C]" />
                    <span>Faculty Confirmed!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Faculty</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
