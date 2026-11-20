import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Plus,
  CheckCircle2,
  CalendarDays,
  Trash2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { TeacherClassroomIcon } from '../../../components/icons/TeacherClassroomIcon';
import celebrationImg from '../../../assets/images/ffcs_celebration_opt.png';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { CourseSkeletonCard } from '../components/FFCSSkeleton';

function statusBadge(course) {
  if (course.status === 'completed') {
    return { label: 'Ready', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  if (course.status === 'needs_review') {
    return { label: 'Needs review', className: 'text-amber-800 bg-amber-50 border-amber-200' };
  }
  if (course.status === 'failed') {
    return { label: 'Failed', className: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
  return { label: 'Processing', className: 'text-blue-700 bg-blue-50 border-blue-200' };
}

export function AddedCoursesScreen() {
  const navigate = useNavigate();
  const { coursesList, confirmedFaculties, loading, error, deleteCourse, refreshCourses } = useFFCS();
  const [deletingId, setDeletingId] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');

  const confirmedCount = coursesList.filter((course) => confirmedFaculties[course.id]).length;

  const handleRequestDelete = (event, course) => {
    event.stopPropagation();
    setDeleteErrorMessage('');
    setCourseToDelete(course);
  };

  const handleCancelDelete = () => {
    if (deletingId) return;
    setCourseToDelete(null);
    setDeleteErrorMessage('');
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    const courseId = courseToDelete.id;
    setDeletingId(courseId);
    setDeleteErrorMessage('');
    try {
      await deleteCourse(courseId);
      setCourseToDelete(null);
    } catch (deleteError) {
      setDeleteErrorMessage(deleteError?.message || 'Failed to delete course.');
    } finally {
      setDeletingId(null);
    }
  };

  // Close confirmation modal on Escape key
  useEffect(() => {
    if (!courseToDelete) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deletingId) {
        setCourseToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [courseToDelete, deletingId]);

  return (
    <div className="min-h-screen bg-[#F0F6FF] text-[#0F172A] flex flex-col justify-between pb-28 relative overflow-hidden">
      {/* Decorative Light Blue Ambient Background Orbs */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-20 right-0 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl pointer-events-none translate-x-1/3" />

      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4 relative z-10">
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-black text-lg text-[#0F172A] tracking-tight">
              Your Added Courses
            </h1>
          </div>
        </header>

        {coursesList.length > 0 && (
          <div className="relative bg-gradient-to-r from-[#EFF6FF] via-[#DBEAFE]/40 to-[#EFF6FF] rounded-2xl sm:rounded-3xl border border-[#BFDBFE] shadow-2xs overflow-hidden">
            {/* Left Side: Clean Text Information Vertically Centered */}
            <div className="relative z-10 py-3 sm:py-3.5 pl-3.5 sm:pl-4 pr-32 min-[360px]:pr-36 sm:pr-40 flex flex-col justify-center min-h-[76px] sm:min-h-[86px] space-y-0.5">
              <p className="font-black text-xs min-[360px]:text-sm sm:text-base text-[#0F172A] tracking-tight leading-snug">
                {confirmedCount} of {coursesList.length} Faculties Selected
              </p>
              <p className="text-[10.5px] min-[360px]:text-[11px] sm:text-xs text-[#1D4ED8] font-semibold leading-tight">
                Tap any course to choose or update faculty
              </p>
            </div>

            {/* Right Side: Larger Boy-Girl Illustration Anchored Exactly to Bottom-Right */}
            <div className="absolute bottom-0 right-0 h-[76px] sm:h-[86px] w-[130px] min-[360px]:w-[145px] sm:w-[160px] flex items-end justify-end pointer-events-none select-none z-10">
              <img
                src={celebrationImg}
                alt="Faculty Selection Status"
                className="h-full w-auto object-contain object-bottom drop-shadow-xs"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={refreshCourses} className="underline cursor-pointer">Retry</button>
          </div>
        )}

        {coursesList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#BFDBFE] p-8 text-center space-y-3.5 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center mx-auto shadow-xs p-2.5">
              <TeacherClassroomIcon className="w-8 h-8 text-[#2563EB]" />
            </div>
            <h3 className="font-black text-base text-[#0F172A]">No Courses Added Yet</h3>
            <p className="text-xs text-[#64748B] max-w-[240px] mx-auto leading-relaxed">
              You haven't added any courses yet. Tap below to search the curriculum and add your courses.
            </p>
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/add')}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/25 border border-[#1D4ED8] cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Course</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {coursesList.map((course, index) => {
              const confirmed = confirmedFaculties[course.id];

              return (
                <div
                  key={course.id}
                  onClick={() => navigate(`/slotmate/ffcs/faculty/${course.id}`)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#BFDBFE] hover:border-[#60A5FA] shadow-xs transition-all space-y-2 cursor-pointer group"
                >
                  {/* Top Row: Course Code Badge on left, Trash + Change button on right */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] font-black text-[10px] sm:text-[11px] tracking-wider uppercase">
                      {course.code}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(event) => handleRequestDelete(event, course)}
                        disabled={deletingId === course.id}
                        className="w-7 h-7 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove course"
                      >
                        {deletingId === course.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/slotmate/ffcs/faculty/${course.id}`);
                        }}
                        className="px-3 py-1 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#1D4ED8] font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-all shadow-2xs"
                      >
                        {confirmed ? 'Change' : 'Select'}
                      </button>
                    </div>
                  </div>

                  {/* Middle: Faculty Name (or Course Name if no faculty yet) */}
                  <div>
                    <h3 className="font-black text-sm text-[#0F172A] leading-snug break-words">
                      {confirmed ? confirmed.name.split('-')[0].trim() : course.name}
                    </h3>
                    {confirmed && (
                      <p className="text-[11px] text-[#64748B] font-semibold mt-0.5">
                        {course.name}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: SLOT: [A11+A12]  ROOM NO: AB02-415 */}
                  {confirmed ? (
                    <div className="flex items-center gap-3 pt-0.5 text-xs">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wide">SLOT:</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] font-black text-[10px] sm:text-[11px] border border-[#BFDBFE]">
                          {confirmed.slot}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide whitespace-nowrap">ROOM NO:</span>
                        <span className="font-black text-xs text-[#0F172A] whitespace-nowrap">
                          {confirmed.roomNo}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-0.5">
                      <span className="text-[11px] font-bold text-[#2563EB]">
                        No faculty selected yet • Tap to select
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FFCSBottomNav activeTab="add" />

      {/* Modern Custom Course Delete Confirmation Modal */}
      {courseToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-course-dialog-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleCancelDelete}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm w-full border border-blue-100 text-center space-y-4 animate-in zoom-in-95 duration-200"
          >
            {/* Soft Red Trash Icon */}
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-7 h-7 stroke-[2.2]" />
            </div>

            {/* Title & Info */}
            <div className="space-y-1.5">
              <h3
                id="delete-course-dialog-title"
                className="font-black text-lg text-[#0F172A]"
              >
                Remove Course?
              </h3>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-xs font-black max-w-full">
                <span className="shrink-0">{courseToDelete.code}</span>
                <span className="text-blue-400">•</span>
                <span className="truncate">{courseToDelete.name}</span>
              </div>
              <p className="text-xs font-medium text-[#64748B] pt-1 leading-relaxed">
                Are you sure you want to remove this course from your FFCS list? Any faculty selected for this course will also be removed.
              </p>
            </div>

            {deleteErrorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-2.5 rounded-xl text-left">
                {deleteErrorMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={Boolean(deletingId)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-[#475569] font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingId)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Yes, Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
