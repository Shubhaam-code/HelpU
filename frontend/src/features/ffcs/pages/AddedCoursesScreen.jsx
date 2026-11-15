import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  CalendarDays,
  Trash2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { TeacherClassroomIcon } from '../../../components/icons/TeacherClassroomIcon';
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
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4">
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/60 flex items-center justify-center text-[#17233C] transition-colors cursor-pointer shadow-xs active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">
              Your Added Courses
            </h1>
          </div>
        </header>

        {coursesList.length > 0 && (
          <div className="bg-gradient-to-r from-[#FEF08A] to-[#FFFBEB] rounded-2xl border border-[#FEEBA4] p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FEF08A] border border-[#FDE047] text-[#EA580C] flex items-center justify-center font-black shadow-xs p-1">
                <TeacherClassroomIcon className="w-7 h-7" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-[#17233C]">
                  {confirmedCount} of {coursesList.length} Faculties Selected
                </p>
                <p className="text-[10px] text-[#854D0E] font-medium">
                  Tap any course to choose or update faculty
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={refreshCourses} className="underline">Retry</button>
          </div>
        )}

        {coursesList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#FEEBA4]/70 p-8 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#FEF08A] border border-[#FDE047] text-[#EA580C] flex items-center justify-center mx-auto shadow-xs p-2.5">
              <TeacherClassroomIcon className="w-8 h-8" />
            </div>
            <h3 className="font-black text-base text-[#17233C]">No Courses Added Yet</h3>
            <p className="text-xs text-[#64748B] max-w-[240px] mx-auto leading-relaxed">
              You haven't added any courses yet. Tap below to search the curriculum and add your courses.
            </p>
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/add')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FDE047] to-[#FACC15] text-[#17233C] font-black text-xs shadow-xs border border-[#FACC15] cursor-pointer active:scale-95 transition-all"
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
                  className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#FEEBA4] hover:border-[#FACC15] shadow-xs transition-all space-y-2 cursor-pointer group"
                >
                  {/* Top Row: Course Code Badge on left, Trash + Change button on right */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#FEF9C3] border border-[#FEF08A] text-[#78350F] font-black text-[10px] sm:text-[11px] tracking-wider uppercase">
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
                        className="px-3 py-1 rounded-xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] text-[#854D0E] font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-all shadow-2xs"
                      >
                        {confirmed ? 'Change' : 'Select'}
                      </button>
                    </div>
                  </div>

                  {/* Middle: Faculty Name (or Course Name if no faculty yet) */}
                  <div>
                    <h3 className="font-black text-sm text-[#17233C] leading-snug break-words">
                      {confirmed ? confirmed.name.split('-')[0].trim() : course.name}
                    </h3>
                    {confirmed && (
                      <p className="text-[11px] text-[#64748B] font-semibold mt-0.5">
                        {course.name}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: SLOT: [A11+A12]  ROOM NO: AB02-415 (matching Image 2) */}
                  {confirmed ? (
                    <div className="flex items-center gap-3 pt-0.5 text-xs">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-[#854D0E] uppercase tracking-wide">SLOT:</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#17233C] font-black text-[10px] sm:text-[11px] border border-[#FDE68A]">
                          {confirmed.slot}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide whitespace-nowrap">ROOM NO:</span>
                        <span className="font-black text-xs text-[#17233C] whitespace-nowrap">
                          {confirmed.roomNo}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-0.5">
                      <span className="text-[11px] font-bold text-amber-600">
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

      <FFCSBottomNav activeTab="courses" />

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
            className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm w-full border border-amber-100 text-center space-y-4 animate-in zoom-in-95 duration-200"
          >
            {/* Soft Red Trash Icon */}
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-7 h-7 stroke-[2.2]" />
            </div>

            {/* Title & Info */}
            <div className="space-y-1.5">
              <h3
                id="delete-course-dialog-title"
                className="font-black text-lg text-[#17233C]"
              >
                Remove Course?
              </h3>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-[#854D0E] border border-amber-200/90 text-xs font-black max-w-full">
                <span className="shrink-0">{courseToDelete.code}</span>
                <span className="text-amber-400">•</span>
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
