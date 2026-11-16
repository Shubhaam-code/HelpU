import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  UploadCloud,
  PlusCircle,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  ChevronDown,
  CalendarDays,
  GraduationCap
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { searchCurriculumCourses } from '../../../lib/api';
import { compressImage } from '../utils/compressImage';
import addCourseHeroSrc from '../../../assets/images/ffcs_hero_banner.webp';

const SEMESTER_OPTIONS = [
  'Winter Semester 2026-27',
  'Fall Semester 2026-27',
  'Winter Semester 2025-26',
  'INTERIM SEMESTER 2025-26',
  'Fall Semester 2025-26',
  'Winter Semester 2024-25',
  'INTERIM SEMESTER 2024-25'
];

const DEFAULT_SUGGESTIONS = [
  {
    _id: 'def-bio1001',
    courseId: 'BIO1001',
    courseCode: 'BIO1001',
    courseName: 'Introduction to Bioengineering',
    credits: 3,
    category: 'University Elective – Open Electives',
    semester: 1
  },
  {
    _id: 'def-bio1101',
    courseId: 'BIO1101',
    courseCode: 'BIO1101',
    courseName: 'Physiology Of Cells And Tissues',
    credits: 3,
    category: 'University Elective – Open Electives',
    semester: 1
  },
  {
    _id: 'def-bio1501',
    courseId: 'BIO1501',
    courseCode: 'BIO1501',
    courseName: 'Bio Inspired Design',
    credits: 3,
    category: 'University Elective – Multidisciplinary Electives',
    semester: 1
  },
  {
    _id: 'def-bmt1013',
    courseId: 'BMT1013',
    courseCode: 'BMT1013',
    courseName: 'Human Resource Management',
    credits: 3,
    category: 'University Elective – Humanities, Social Sciences and Management Electives',
    semester: 1
  }
];

function ExtractionProgressCard({ addInProgress }) {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    if (!addInProgress) {
      setProgress(12);
      return;
    }

    if (addInProgress.state === 'completed' || addInProgress.state === 'success') {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      let nextProgress = 15;
      if (elapsedSeconds <= 1.5) {
        nextProgress = 15 + (elapsedSeconds / 1.5) * 35; // 15% -> 50%
      } else if (elapsedSeconds <= 3.5) {
        nextProgress = 50 + ((elapsedSeconds - 1.5) / 2) * 35; // 50% -> 85%
      } else {
        nextProgress = Math.min(96, 85 + (elapsedSeconds - 3.5) * 2);
      }
      setProgress(Math.round(nextProgress));
    }, 150);

    return () => clearInterval(interval);
  }, [addInProgress]);

  const displayProgress = addInProgress?.state === 'completed' ? 100 : progress;

  let statusText = 'Extracting teacher details...';
  if (displayProgress >= 100) {
    statusText = 'Extraction complete!';
  } else if (displayProgress >= 75) {
    statusText = 'Finalizing course catalog...';
  } else if (displayProgress >= 40) {
    statusText = 'Extracting faculty names & timetable slots...';
  } else if (displayProgress >= 20) {
    statusText = 'Scanning screenshots with AI vision...';
  } else {
    statusText = 'Preparing screenshots for AI extraction...';
  }

  return (
    <div className="bg-gradient-to-b from-[#FFFDF7] via-white to-[#FEFCE8] border-2 border-[#FDE047] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_8px_24px_rgba(234,179,8,0.12)] space-y-3.5 animate-in fade-in duration-200">
      {/* Top Row: Circular Animated Loader + Heading + Percentage Indicator */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FEF08A] text-[#854D0E] border border-[#FDE047] flex items-center justify-center shrink-0 shadow-2xs">
            {displayProgress >= 100 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-[#D97706] stroke-[2.5]" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-sm sm:text-base text-[#17233C] tracking-tight leading-tight">
              Extracting Teacher Details...
            </h4>
            <p className="text-[11px] font-bold text-[#D97706] truncate mt-0.5">
              {statusText}
            </p>
          </div>
        </div>

        {/* Percentage Indicator Badge */}
        <div className="shrink-0 px-2.5 py-1 rounded-full bg-[#FEF9C3] border border-[#FDE047] text-[#854D0E] font-black text-xs shadow-2xs">
          {displayProgress}%
        </div>
      </div>

      {/* Horizontal Golden Yellow Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2.5 sm:h-3 bg-[#FEF3C7] rounded-full overflow-hidden p-0.5 border border-[#FDE68A] shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[#FDE047] via-[#FACC15] to-[#EAB308] rounded-full transition-all duration-300 ease-out shadow-xs relative overflow-hidden"
            style={{ width: `${displayProgress}%` }}
          >
            <div className="absolute inset-0 bg-white/30 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Required English Description */}
      <p className="text-[11px] sm:text-xs font-medium text-[#475569] leading-relaxed bg-[#FFFDF7] border border-[#FEEBA4] rounded-xl p-2.5 sm:p-3">
        AI is scanning screenshots and extracting teacher information. This ultra-fast process takes only 3–5 seconds. Please wait while we process your schedule.
      </p>
    </div>
  );
}

export function AddCourseScreen() {
  const navigate = useNavigate();
  const { coursesList, addCourse, addInProgress, getAcademicYear, setAcademicYear } = useFFCS();

  // Search & Autocomplete State
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const searchContainerRef = useRef(null);
  const searchRequestRef = useRef(0);
  const isSelectingRef = useRef(false);

  // Helper to verify if a course already exists in the user's selected courses list
  const isCourseAlreadyAdded = (course) => {
    if (!course || !Array.isArray(coursesList) || coursesList.length === 0) return false;
    const targetId = String(course._id || course.courseId || '').trim();
    const targetCode = String(course.courseCode || course.code || '').trim().toUpperCase().replace(/\s+/g, '');

    return coursesList.some((existing) => {
      const existingId = String(existing.id || '').trim();
      const existingCurriculumId = String(existing.curriculumCourseId || '').trim();
      const existingCode = String(existing.code || existing.courseCode || '').trim().toUpperCase().replace(/\s+/g, '');

      return (
        (targetId && (targetId === existingId || targetId === existingCurriculumId)) ||
        (targetCode && existingCode && targetCode === existingCode)
      );
    });
  };

  // Form State
  const [semester, setSemester] = useState('');
  const [semesterDropdownOpen, setSemesterDropdownOpen] = useState(false);
  const semesterDropdownRef = useRef(null);
  const [academicYear, setAcademicYearState] = useState(() => getAcademicYear());
  const [screenshots, setScreenshots] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [maxLimitReached, setMaxLimitReached] = useState(false);
  const fileInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (semesterDropdownRef.current && !semesterDropdownRef.current.contains(event.target)) {
        setSemesterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Debounced live search (250ms) with stale response discarding
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const trimmed = courseSearchQuery.trim();

    if (!trimmed) {
      setSuggestions(DEFAULT_SUGGESTIONS);
      setIsSearching(false);
      setSearchError('');
      setHighlightedIndex(-1);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    setSearchError('');
    setShowDropdown(true);

    const timer = setTimeout(async () => {
      try {
        const response = await searchCurriculumCourses(trimmed, { limit: 10 });
        if (requestId !== searchRequestRef.current) return;

        const results = Array.isArray(response?.data?.courses)
          ? response.data.courses
          : [];
        setSuggestions(results);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } catch (err) {
        if (requestId !== searchRequestRef.current) return;
        setSuggestions([]);
        setSearchError(err?.message || 'Failed to search courses. Please check connection.');
        setShowDropdown(true);
      } finally {
        if (requestId === searchRequestRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [courseSearchQuery]);

  const handleSelectSuggestion = (course) => {
    if (isCourseAlreadyAdded(course)) {
      setErrorMessage('This course has already been added.');
      return;
    }
    isSelectingRef.current = true;
    setSelectedCourse({
      _id: course._id || course.courseId,
      courseId: course.courseId || course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      semester: course.semester || null,
      credits: course.credits || null,
      category: course.category || null,
      institution: course.institution || 'VIT',
      curriculumVersion: course.curriculumVersion || '2024-2025'
    });
    setCourseSearchQuery(`${course.courseCode} - ${course.courseName}`);
    setShowDropdown(false);
    setSuggestions([]);
    setErrorMessage('');
  };

  const handleClearSelection = () => {
    setSelectedCourse(null);
    setCourseSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setSemester('');
    setErrorMessage('');
  };

  // Keyboard navigation for autocomplete list
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleFileChange = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles.length) return;

    setErrorMessage('');
    const remainingSlots = 3 - screenshots.length;

    if (remainingSlots <= 0) {
      setMaxLimitReached(true);
      setErrorMessage('Maximum 3 screenshots allowed for this course.');
      return;
    }

    if (rawFiles.length > remainingSlots) {
      setErrorMessage(`Only ${remainingSlots} more screenshot(s) allowed (Max 3 total).`);
    }

    const selectedFiles = rawFiles.slice(0, remainingSlots);
    const compressedFiles = await Promise.all(selectedFiles.map((f) => compressImage(f)));

    const filesToAdd = compressedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      file,
      url: URL.createObjectURL(file)
    }));

    const updated = [...screenshots, ...filesToAdd];
    setScreenshots(updated);
    if (updated.length >= 3) setMaxLimitReached(true);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveScreenshot = (idToRemove) => {
    setScreenshots((previous) => {
      const target = previous.find((item) => item.id === idToRemove);
      if (target?.url) URL.revokeObjectURL(target.url);
      const remaining = previous.filter((item) => item.id !== idToRemove);
      if (remaining.length < 3) setMaxLimitReached(false);
      return remaining;
    });
  };

  const triggerUploadClick = () => {
    if (maxLimitReached) {
      setErrorMessage('Maximum 3 screenshots allowed for this course.');
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleAddCourseSubmit = async () => {
    // Prevent duplicate entries even if the user clicks the Add button multiple times quickly
    if (submitting || busy) return;

    if (coursesList.length >= 8) {
      setErrorMessage('Maximum 8 courses allowed in FFCS. You cannot add more than 8 courses.');
      return;
    }
    if (!selectedCourse) {
      setErrorMessage('Please search and select a course from the suggestions.');
      return;
    }
    if (isCourseAlreadyAdded(selectedCourse)) {
      setErrorMessage('This course has already been added.');
      return;
    }
    if (!semester) {
      setErrorMessage('Please select a semester.');
      return;
    }
    if (!academicYear.trim()) {
      setErrorMessage('Academic year is required (e.g. 2026-27).');
      return;
    }
    if (!screenshots.length) {
      setErrorMessage('Please upload at least 1 screenshot of the faculty timetable.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      setAcademicYear(academicYear.trim());
      const res = await addCourse({
        curriculumCourseId: selectedCourse._id || selectedCourse.courseId,
        courseCode: selectedCourse.courseCode,
        courseName: selectedCourse.courseName,
        semester,
        academicYear: academicYear.trim(),
        files: screenshots.map((item) => item.file).filter(Boolean)
      });
      const targetCourseId = res?.course?.courseId || res?.courseId;
      if (targetCourseId) {
        navigate(`/slotmate/ffcs/faculty/${targetCourseId}`);
      } else {
        navigate('/slotmate/ffcs/courses');
      }
    } catch (error) {
      const apiMsg = error?.response?.data?.message || error?.message;
      setErrorMessage(
        error?.status === 401
          ? 'Please sign in to add a course to your account.'
          : error?.response?.status === 409 || error?.code === 'COURSE_ALREADY_EXISTS' || apiMsg?.includes('already been added')
            ? 'This course has already been added.'
            : error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')
              ? 'Extraction is taking longer than expected. Please check your internet connection and try again.'
              : apiMsg || 'Failed to add course.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || Boolean(addInProgress);

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex justify-center">
      <div className="w-full max-w-[420px] min-h-[100dvh] bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28 relative overflow-x-hidden selection:bg-[#FDE047] sm:shadow-xl sm:border-x sm:border-amber-100/70">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
        />

        {/* Golden Ambient Gradients */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/40 via-[#FFFBEB]/20 to-transparent pointer-events-none" />

        {/* Main Container: Mobile First */}
        <main className="w-full px-4 pt-2 space-y-3.5 relative z-10 flex-1">
          
          {/* Top Minimal Navigation Bar */}
          <header className="flex items-center justify-between pt-1 pb-0.5">
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
                Add Course
              </h1>
            </div>
          </header>

          {/* 8 Courses Limit Warning Banner */}
          {coursesList.length >= 8 && (
            <div className="bg-amber-50 border-2 border-[#FACC15] text-[#854D0E] px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0" />
              <div>
                <p className="font-black text-[#17233C]">Maximum 8 Courses Limit Reached (8/8)</p>
                <p className="text-[11px] font-medium text-[#854D0E] mt-0.5">
                  You cannot add more than 8 courses. Please remove an existing course to add a new one.
                </p>
              </div>
            </div>
          )}

          {/* Hero Section: Full-Bleed Edge-to-Edge (No blank space on left/right) */}
          <div className="-mx-4 w-[calc(100%+2rem)] flex justify-center items-center select-none pointer-events-none -mt-1 mb-1">
            <img
              src={addCourseHeroSrc}
              alt="Add Your Courses"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-auto max-h-[220px] object-contain sm:object-cover drop-shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Section Heading: Select Course */}
          <div className="flex items-center gap-2 px-1 pt-0.5">
            <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
            <h2 className="font-black text-lg text-[#17233C] tracking-tight">
              Select Course
            </h2>
          </div>

        {/* ========================================================================= */}
        {/* AUTOCOMPLETE SEARCH FIELD WITH ATTACHED DROPDOWN POPUP                    */}
        {/* ========================================================================= */}
        <div ref={searchContainerRef} className="relative z-30 space-y-1.5">
          <label className="block text-[10px] font-black uppercase tracking-wider text-[#854D0E] px-1">
            Course Code / Name *
          </label>

          <div className="w-full bg-white rounded-2xl border border-[#FEEBA4] hover:border-[#FACC15] p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs focus-within:border-[#FACC15] focus-within:ring-2 focus-within:ring-[#FEF08A]/70 transition-all">
            <div className="w-8 h-8 rounded-xl bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shrink-0 shadow-2xs">
              <Search className="w-4 h-4 stroke-[2.4]" />
            </div>
            <input
              type="text"
              value={courseSearchQuery}
              onChange={(e) => {
                setCourseSearchQuery(e.target.value);
                if (selectedCourse) setSelectedCourse(null);
                setErrorMessage('');
              }}
              onFocus={() => {
                setShowDropdown(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search course code or name (e.g. CSE2001)..."
              className="w-full text-xs sm:text-sm font-bold text-[#17233C] placeholder:text-[#94A3B8] bg-transparent focus:outline-none"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 animate-spin text-[#D97706] shrink-0" />
            )}
            {!isSearching && courseSearchQuery && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="w-6 h-6 rounded-full bg-slate-100 text-[#64748B] flex items-center justify-center shrink-0 hover:bg-slate-200 cursor-pointer"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5 stroke-[2.8]" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#FEEBA4] shadow-[0_12px_36px_rgba(23,35,60,0.12)] max-h-72 overflow-y-auto z-50 divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-amber-200">
              
              {/* Searching status */}
              {isSearching && (
                <div className="px-4 py-3 flex items-center gap-2 text-xs font-bold text-[#854D0E]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D97706]" />
                  <span>Searching curriculum courses...</span>
                </div>
              )}

              {/* API error */}
              {!isSearching && searchError && (
                <div className="px-4 py-3 text-center text-xs font-bold text-rose-600">
                  {searchError}
                </div>
              )}

              {/* No matches */}
              {!isSearching && !searchError && courseSearchQuery.trim().length >= 1 && suggestions.length === 0 && (
                <div className="px-4 py-4 text-center space-y-1">
                  <p className="text-xs font-black text-[#17233C]">No courses found</p>
                  <p className="text-[11px] font-semibold text-[#64748B]">
                    No curriculum match for "{courseSearchQuery.trim()}".
                  </p>
                </div>
              )}

              {/* Course suggestions list */}
              {!isSearching && (courseSearchQuery.trim().length === 0 ? DEFAULT_SUGGESTIONS : suggestions).map((course, idx) => {
                const isHighlighted = highlightedIndex === idx;
                const isChosen = selectedCourse?._id === course._id || selectedCourse?.courseId === course.courseId || selectedCourse?.courseCode === course.courseCode;

                return (
                  <button
                    key={course._id || course.courseId || course.courseCode || idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(course)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      isHighlighted || isChosen
                        ? 'bg-[#FEFCE8]'
                        : 'bg-white hover:bg-[#FFFBEB]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Course Code & Badges matching Image 2 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#D97706] font-black text-xs sm:text-sm">
                          {course.courseCode}
                        </span>
                        {course.credits !== null && course.credits !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-200/60">
                            {course.credits} Credits
                          </span>
                        )}
                        {course.category && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100/70 text-[#854D0E] text-[10px] font-medium border border-amber-200/60 truncate max-w-[220px]">
                            {course.category}
                          </span>
                        )}
                      </div>
                      
                      {/* Course Name */}
                      <p className="font-extrabold text-xs sm:text-[13px] text-[#17233C] leading-snug">
                        {course.courseName}
                      </p>
                    </div>

                    {isCourseAlreadyAdded(course) ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full shrink-0 border border-amber-300">
                        Added
                      </span>
                    ) : isChosen ? (
                      <CheckCircle2 className="w-4 h-4 text-[#EAB308] shrink-0" />
                    ) : (
                      <span className="text-[10px] font-bold text-[#854D0E] bg-[#FEF08A]/70 px-2 py-0.5 rounded-full shrink-0">
                        Select
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Course Confirmation Card */}
        {selectedCourse && (
          <div className="bg-[#FFFDF7] rounded-2xl border-2 border-[#FACC15] p-3.5 shadow-xs relative space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#FACC15] text-[#17233C] font-black text-xs">
                  {selectedCourse.courseCode}
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 stroke-[2.8]" /> Selected
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] font-extrabold text-[#854D0E] hover:text-rose-600 transition-colors cursor-pointer"
              >
                Change
              </button>
            </div>

            <h3 className="font-black text-sm sm:text-base text-[#17233C] leading-snug">
              {selectedCourse.courseName}
            </h3>

            <p className="text-[11px] text-[#64748B] font-bold flex items-center gap-2 flex-wrap">
              <span>{selectedCourse.category || 'Curriculum Course'}</span>
              <span>•</span>
              <span>{selectedCourse.credits ?? 4} Credits</span>
              <span>•</span>
              <span className="text-[#854D0E]">
                {semester ? semester : (selectedCourse.semester ? `Curriculum Sem ${selectedCourse.semester}` : 'Select semester below')}
              </span>
            </p>
          </div>
        )}

        {/* Semester & Academic Year Input with Styled Dropdown */}
        <div className="space-y-2.5">
          <div ref={semesterDropdownRef} className="relative z-20 space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#854D0E] px-1">
              Semester *
            </label>
            
            <button
              type="button"
              onClick={() => setSemesterDropdownOpen((prev) => !prev)}
              className={`w-full bg-white rounded-2xl border p-2.5 sm:p-3 flex items-center justify-between text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs ${
                semesterDropdownOpen
                  ? 'border-[#FACC15] ring-2 ring-[#FEF08A]/70'
                  : 'border-[#FEEBA4] hover:border-[#FACC15]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shrink-0 shadow-2xs">
                  <GraduationCap className="w-4 h-4 stroke-[2.4]" />
                </div>
                <span className={`truncate text-xs sm:text-sm ${semester ? 'text-[#17233C] font-black' : 'text-[#94A3B8] font-bold'}`}>
                  {semester || 'Select Semester'}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-[#854D0E] shrink-0 transition-transform duration-200 ${
                  semesterDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Custom Styled Dropdown Menu */}
            {semesterDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#FEEBA4] shadow-[0_12px_36px_rgba(23,35,60,0.14)] z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-200">
                {SEMESTER_OPTIONS.map((opt) => {
                  const isSelected = semester === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSemester(opt);
                        const match = opt.match(/\d{4}-\d{2}/);
                        if (match) {
                          setAcademicYearState(match[0]);
                        }
                        setSemesterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FEFCE8] text-[#854D0E] font-black'
                          : 'text-[#17233C] hover:bg-[#FFFBEB] hover:text-[#854D0E]'
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-[#EAB308] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Styled Academic Year Card */}
          <div className="bg-[#FFFDF7] rounded-2xl border border-[#FEEBA4] p-2.5 sm:p-3 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shrink-0 shadow-2xs">
                <CalendarDays className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#854D0E] block leading-none">
                  Academic Year
                </span>
                <span className="text-[11px] font-bold text-[#17233C] mt-1 block leading-none truncate">
                  Session Period
                </span>
              </div>
            </div>

            <div className="relative shrink-0">
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYearState(e.target.value)}
                placeholder="2026-27"
                className="w-24 bg-white rounded-xl border border-[#FDE047] focus:border-[#FACC15] focus:ring-2 focus:ring-[#FEF08A]/60 px-2.5 py-1.5 text-xs font-black text-[#17233C] text-center shadow-2xs transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Screenshot Upload Container (Max 3) */}
        {screenshots.length === 0 ? (
          <div
            onClick={triggerUploadClick}
            className="w-full relative rounded-[28px] border-2 border-dashed border-[#FDE047] hover:border-[#FACC15] bg-[#FFFDF7] hover:bg-white transition-all py-6 px-4 flex flex-col items-center justify-center text-center overflow-hidden cursor-pointer shadow-[0_4px_20px_rgba(250,204,21,0.08)]"
          >
            {/* Left Decorative Floating Photo Card */}
            <div className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border-2 border-[#FEF08A] bg-white/95 p-1.5 shadow-sm transform -rotate-12 pointer-events-none select-none opacity-85 sm:opacity-90">
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#FEF9C3] via-[#FEF08A]/40 to-[#FDE047]/30 flex flex-col justify-end p-1 overflow-hidden relative">
                <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#FDE047]/80" />
                <div className="w-full h-5 bg-[#FACC15]/40 rounded-t-md transform -skew-x-6" />
              </div>
            </div>

            {/* Right Decorative Floating Photo Card */}
            <div className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border-2 border-[#FEF08A] bg-white/95 p-1.5 shadow-sm transform rotate-12 pointer-events-none select-none opacity-85 sm:opacity-90">
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#FEF9C3] via-[#FEF08A]/40 to-[#FDE047]/30 flex flex-col justify-end p-1 overflow-hidden relative">
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#FDE047]/80" />
                <div className="w-full h-5 bg-[#FACC15]/40 rounded-t-md transform skew-x-6" />
              </div>
            </div>

            {/* Center Upload Icon with Gradient */}
            <div className="relative mb-1 z-10">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-[#FEF08A] via-[#FDE047] to-[#FACC15] flex items-center justify-center shadow-md shadow-amber-300/40">
                <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8 text-[#17233C] stroke-[2.3]" />
              </div>
            </div>

            {/* Text: Bold Navy Heading + Subtitle */}
            <h3 className="font-black text-base text-[#17233C] tracking-tight mt-1 z-10">
              Upload Screenshot
            </h3>
            <p className="text-xs font-bold text-[#475569] mt-0.5 z-10">
              (Max 3 Screenshots)
            </p>
          </div>
        ) : (
          <div className="w-full rounded-[28px] border-2 border-dashed border-[#FACC15] bg-[#FFFDF7] p-4 space-y-3 shadow-[0_4px_20px_rgba(250,204,21,0.08)]">
            {/* Header Row: Count & Add More Button */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-black text-xs text-[#17233C]">
                  {screenshots.length} of 3 Screenshots Selected
                </span>
              </div>
              {screenshots.length < 3 && (
                <button
                  type="button"
                  onClick={triggerUploadClick}
                  className="flex items-center gap-1 text-[11px] font-black text-[#854D0E] hover:text-[#17233C] bg-[#FEF08A] hover:bg-[#FDE047] px-2.5 py-1 rounded-full border border-[#FACC15] active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add More</span>
                </button>
              )}
            </div>

            {/* 3-Column Slot Grid: Displays uploaded thumbnails and empty dashed slot if < 3 */}
            <div className="grid grid-cols-3 gap-2.5">
              {screenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className="relative rounded-2xl overflow-hidden border border-[#FACC15] bg-white shadow-2xs group flex flex-col"
                >
                  <img
                    src={screenshot.url}
                    alt={screenshot.name}
                    className="w-full h-20 sm:h-22 object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveScreenshot(screenshot.id);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-[#17233C] text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors cursor-pointer shadow-xs active:scale-90"
                    title="Remove screenshot"
                  >
                    <X className="w-3 h-3 stroke-[2.8]" />
                  </button>
                  <p className="text-[9px] font-bold text-[#17233C] bg-white/95 truncate px-1.5 py-0.5 text-center border-t border-slate-100">
                    {screenshot.name}
                  </p>
                </div>
              ))}

              {/* Empty '+ Add' slot if less than 3 */}
              {screenshots.length < 3 && (
                <button
                  type="button"
                  onClick={triggerUploadClick}
                  className="h-20 sm:h-22 rounded-2xl border-2 border-dashed border-[#FDE047] hover:border-[#FACC15] bg-white/80 hover:bg-white flex flex-col items-center justify-center gap-1 text-[#854D0E] hover:text-[#17233C] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <div className="w-7 h-7 rounded-full bg-[#FEF08A] text-[#854D0E] flex items-center justify-center">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-[10px] font-bold">Add Photo</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modern Extraction Progress Card */}
        {addInProgress && (
          <ExtractionProgressCard addInProgress={addInProgress} />
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleAddCourseSubmit}
            disabled={busy || coursesList.length >= 8 || isCourseAlreadyAdded(selectedCourse)}
            className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[#FDE047] to-[#FACC15] hover:from-[#FACC15] hover:to-[#EAB308] disabled:opacity-60 disabled:cursor-not-allowed text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-amber-400/30 border border-[#FACC15] transition-all cursor-pointer active:scale-98"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4 stroke-[2.8]" />
            )}
            <span>
              {busy
                ? 'Processing...'
                : coursesList.length >= 8
                  ? 'Limit Reached (8/8 Courses)'
                  : isCourseAlreadyAdded(selectedCourse)
                    ? 'Course Already Added'
                    : 'Add Course'}
            </span>
          </button>
        </div>
      </main>

      <FFCSBottomNav activeTab="home" />
      </div>
    </div>
  );
}
