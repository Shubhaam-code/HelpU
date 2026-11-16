import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Ban,
  Loader2,
  Clock,
  MapPin,
  CalendarDays,
  Star
} from 'lucide-react';
import { useFFCS, teacherToFaculty } from '../context/FFCSContext';
import { detectSlotClash } from '../utils/slotClashDetector.js';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { TeacherSkeletonRow } from '../components/FFCSSkeleton';
import { TeacherClassroomIcon } from '../../../components/icons/TeacherClassroomIcon';
import { FacultyReviewModal } from '../components/FacultyReviewModal';
import { getFacultyByName } from '../../../lib/api';

export function SelectFacultyScreen() {
  const { courseCode: courseIdParam } = useParams();
  const navigate = useNavigate();
  const { coursesList, confirmedFaculties, confirmFaculty, loading, getCourseTeachers } = useFFCS();

  // Review Modal State
  const [reviewModalTeacher, setReviewModalTeacher] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const handleOpenReview = (teacher) => {
    setReviewModalTeacher(teacher);
    setIsReviewModalOpen(true);
  };

  const handleCloseReview = () => {
    setIsReviewModalOpen(false);
    setReviewModalTeacher(null);
  };

  const course = coursesList.find(
    (item) =>
      item.id === courseIdParam ||
      item.code?.toLowerCase() === String(courseIdParam || '').toLowerCase()
  );

  const getTeacherKey = (teacher, index) =>
    `${teacher?.name || 'unknown'}-${teacher?.slot || teacher?.schedule?.[0]?.slot || index}`;

  const currentConfirmed = course ? confirmedFaculties[course.id] : null;
  const [selectedKey, setSelectedKey] = useState(() =>
    currentConfirmed ? `${currentConfirmed.name}-${currentConfirmed.slot || ''}` : null
  );
  const [selectedName, setSelectedName] = useState(currentConfirmed?.name || null);
  const [teachers, setTeachers] = useState(course?.teachers || []);
  const [reviewStatus, setReviewStatus] = useState(course?.reviewStatus || null);
  const [courseStatus, setCourseStatus] = useState(course?.status || null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const [clashError, setClashError] = useState('');

  const selectedTeacher =
    teachers.find((item, idx) => getTeacherKey(item, idx) === selectedKey) ||
    teachers.find((item) => item.name === selectedName);

  const selectedFaculty = selectedTeacher && course ? teacherToFaculty(selectedTeacher, course) : null;
  const selectedSlot =
    selectedFaculty?.slot && selectedFaculty.slot !== 'Schedule not available'
      ? selectedFaculty.slot
      : selectedTeacher?.slot || selectedTeacher?.schedule?.[0]?.slot || '';

  const selectedClash = selectedTeacher
    ? detectSlotClash({
        candidateSlot: selectedSlot,
        candidateSchedule: selectedTeacher.schedule || [],
        confirmedFaculties,
        currentCourseId: course?.id
      })
    : { hasClash: false };

  const loadTeachers = useCallback(async (force = false) => {
    if (!course?.id) return;
    setFetching(true);
    setFetchError('');
    try {
      const data = await getCourseTeachers(course.id, force);
      if (Array.isArray(data?.teachers) && data.teachers.length > 0) {
        setTeachers(data.teachers);
      }
      setReviewStatus(data.reviewStatus || null);
      setCourseStatus(data.status || null);
    } catch (error) {
      setFetchError(
        error?.status === 404
          ? 'Teacher data is not available yet. The course may still be processing.'
          : error?.message || 'Failed to load teacher data.'
      );
    } finally {
      setFetching(false);
    }
  }, [course?.id, getCourseTeachers]);

  useEffect(() => {
    // If course in context already has teachers, populate immediately for zero UI flicker
    if (course?.teachers?.length) {
      setTeachers(course.teachers);
      setReviewStatus(course.reviewStatus || null);
      setCourseStatus(course.status || null);
    }
    // Always trigger fresh fetch to load enriched faculty review data
    if (course?.id) {
      loadTeachers(true);
    }
  }, [course?.id, loadTeachers]);

  // Proactive background verification: for any displayed teacher without review status,
  // query /api/faculty/by-name to verify and load review data on the fly.
  useEffect(() => {
    if (!teachers.length) return;
    let isCancelled = false;

    teachers.forEach(async (teacher, idx) => {
      if (teacher?.hasReview === true || teacher?.reviewSummary?.hasReview) return;
      const tName = teacher?.name;
      if (!tName || tName.trim().length < 2) return;

      try {
        const res = await getFacultyByName(tName.trim());
        if (!isCancelled && res?.data?.found && res?.data?.data) {
          const faculty = res.data.data;
          setTeachers((prev) =>
            prev.map((item, i) =>
              i === idx || item.name === tName
                ? {
                    ...item,
                    hasReview: true,
                    facultyId: faculty.facultyId,
                    reviewSummary: {
                      ...faculty,
                      hasReview: true
                    }
                  }
                : item
            )
          );
        }
      } catch {
        // Safe fail
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [teachers]);

  const handleConfirm = () => {
    if (!course || !selectedTeacher) return;

    if (selectedClash.hasClash) {
      setClashError(selectedClash.message || 'Cannot select this faculty due to a slot clash.');
      return;
    }

    try {
      confirmFaculty(course.id, teacherToFaculty(selectedTeacher, course));
      setSavedToast(true);
      setTimeout(() => navigate('/slotmate/ffcs/courses'), 450);
    } catch (err) {
      setClashError(err?.message || 'Slot clash detected with an existing course.');
    }
  };

  if (loading && !course) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#D97706]" />
      </div>
    );
  }

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
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">Select Faculty</h1>
          </div>
        </header>

        {!course ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h2 className="font-black text-base text-[#17233C]">Course Not Found</h2>
            <p className="text-xs text-[#64748B]">
              This course is not in your added courses list.
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
            <div className="bg-[#FFFDF7] rounded-2xl border border-[#FEEBA4] p-4 flex items-center gap-3.5 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0 shadow-xs p-1.5">
                <TeacherClassroomIcon className="w-9 h-9" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#854D0E]">
                  Course Code
                </span>
                <h2 className="font-black text-base text-[#17233C] leading-tight">{course.code}</h2>
                <p className="text-xs font-semibold text-[#64748B] leading-tight mt-0.5 truncate">
                  {course.name}
                </p>
              </div>
            </div>

            {fetching && teachers.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#FEEBA4] shadow-sm overflow-hidden divide-y divide-[#FEEBA4]/40">
                <TeacherSkeletonRow />
                <TeacherSkeletonRow />
                <TeacherSkeletonRow />
              </div>
            )}

            {fetchError && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-3.5 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{fetchError}</p>
                  <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => loadTeachers(true)} className="underline cursor-pointer">Retry</button>
                  </div>
                </div>
              </div>
            )}

            {!fetching && teachers.length === 0 && !fetchError && (
              <div className="bg-white rounded-2xl border border-[#FEEBA4] p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-black text-sm text-[#17233C]">No Teacher Data Yet</h3>
                <p className="text-xs text-[#64748B]">
                  Status: {courseStatus || course.status}. Teacher data will appear once processing finishes.
                </p>
                <button
                  type="button"
                  onClick={loadTeachers}
                  className="px-4 py-2 bg-[#FFD426] text-[#17233C] font-bold text-xs rounded-xl shadow-xs"
                >
                  Check Again
                </button>
              </div>
            )}

            {clashError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3.5 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="flex-1">{clashError}</span>
                <button
                  type="button"
                  onClick={() => setClashError('')}
                  className="text-rose-500 hover:text-rose-700 font-black text-sm px-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {teachers.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#FEEBA4] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between bg-[#FEF9C3] px-4 py-2.5 border-b border-[#FEEBA4] text-[11px] font-black text-[#854D0E] uppercase tracking-wider">
                  <div className="pl-6">Faculty Name</div>
                  <div>Slot & Classroom</div>
                </div>

                <div className="divide-y divide-[#FEEBA4]/50">
                  {teachers.map((teacher, index) => {
                    const teacherKey = getTeacherKey(teacher, index);
                    const isSelected = selectedKey ? selectedKey === teacherKey : selectedName === teacher.name;
                    const faculty = teacherToFaculty(teacher, course);
                    const displaySlot =
                      faculty.slot && faculty.slot !== 'Schedule not available'
                        ? faculty.slot
                        : teacher.slot || teacher.schedule?.[0]?.slot || 'Slot N/A';
                    const displayRoom =
                      faculty.roomNo && faculty.roomNo !== '—'
                        ? faculty.roomNo
                        : teacher.venue || teacher.schedule?.[0]?.room || null;

                    const clashInfo = detectSlotClash({
                      candidateSlot: displaySlot,
                      candidateSchedule: teacher.schedule || [],
                      confirmedFaculties,
                      currentCourseId: course?.id
                    });
                    const isClashing = clashInfo.hasClash;

                    const hasReview =
                      teacher?.hasReview === true ||
                      Boolean(teacher?.reviewSummary?.hasReview) ||
                      (Boolean(teacher?.facultyId) && teacher?.hasReview !== false);

                    return (
                      <div
                        key={teacherKey}
                        onClick={() => {
                          if (isClashing) {
                            setClashError(clashInfo.message);
                            return;
                          }
                          setSelectedKey(teacherKey);
                          setSelectedName(teacher.name);
                          setClashError('');
                        }}
                        className={`flex items-start justify-between px-3.5 py-3 transition-colors select-none ${
                          isClashing
                            ? 'bg-rose-50/50 border-l-4 border-l-rose-500 cursor-not-allowed opacity-90'
                            : isSelected
                            ? 'bg-[#FEFCE8] ring-1.5 ring-inset ring-[#FACC15] cursor-pointer'
                            : 'hover:bg-[#FFFDF7] cursor-pointer'
                        }`}
                      >
                        {/* Left: Radio / Ban + Faculty Name + Clash or Available Badge */}
                        <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                          {isClashing ? (
                            <div className="w-4.5 h-4.5 rounded-full border border-rose-300 bg-rose-100 flex items-center justify-center shrink-0 mt-0.5 text-rose-500">
                              <Ban className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div
                              className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                isSelected ? 'border-[#17233C] bg-[#FFD426]' : 'border-[#CBD5E1] bg-white'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#17233C]" />}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-xs sm:text-sm leading-tight block truncate ${
                                isClashing
                                   ? 'font-bold text-[#475569]'
                                   : isSelected
                                   ? 'font-black text-[#17233C]'
                                   : 'font-bold text-[#1E293B]'
                              }`}
                            >
                              {teacher.name}
                            </span>

                            {isClashing ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                  CLASH
                                </span>
                                {hasReview ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenReview(teacher);
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/90 hover:bg-amber-100 hover:border-amber-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title="View Faculty Reviews"
                                  >
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                    <span>Review</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-50 text-slate-400 border border-slate-200 select-none">
                                    Review N/A
                                  </span>
                                )}
                                <span className="text-[11px] font-semibold text-rose-600 line-clamp-1">
                                  {clashInfo.message}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Available
                                </span>
                                {hasReview ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenReview(teacher);
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/90 hover:bg-amber-100 hover:border-amber-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title="View Faculty Reviews"
                                  >
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                    <span>Review</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-50 text-slate-400 border border-slate-200 select-none">
                                    Review N/A
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Slot + Classroom Together */}
                        <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-black text-[11px] border shadow-2xs ${
                              isClashing
                                ? 'bg-rose-100/70 text-rose-800 border-rose-200'
                                : 'bg-[#FEF3C7] text-[#854D0E] border-[#FDE68A]'
                            }`}
                          >
                            {displaySlot}
                          </span>
                          {displayRoom && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-[#475569]">
                              <MapPin className="w-3 h-3 text-[#D97706] stroke-[2.5]" />
                              <span>{displayRoom}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {teachers.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedName || selectedClash.hasClash}
                  className="w-full py-3.5 rounded-2xl bg-[#FFD426] hover:bg-[#FACC15] disabled:opacity-50 disabled:cursor-not-allowed text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-amber-400/25 border border-[#EAB308] transition-all cursor-pointer active:scale-98"
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
            )}
          </>
        )}
      </div>

      <FFCSBottomNav activeTab="home" />

      {/* Interactive Faculty Review Modal */}
      <FacultyReviewModal
        isOpen={isReviewModalOpen}
        onClose={handleCloseReview}
        teacher={reviewModalTeacher}
      />
    </div>
  );
}
