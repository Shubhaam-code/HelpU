import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Trash2,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  FileText,
  Eye,
  ExternalLink
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { searchCurriculumCourses } from '../../../lib/api';
import { compressImage } from '../utils/compressImage';
import addCourseHeroSrc from '../../../assets/images/ffcs_add_courses_hero.png';
import bgArcTopLeft from '../../../assets/images/ffcs_bg_arc_top_left.png';
import bgCirclesTopRight from '../../../assets/images/ffcs_bg_circles_top_right.png';

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

// Blue Cloud with Up Arrow Icon matching Image 2 mockup
function BlueCloudUploadIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} text-[#2563EB] drop-shadow-xs`}
    >
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
    </svg>
  );
}

// Extraction Progress Card (AI Vision extraction feedback)
function ExtractionProgressCard({ addInProgress, currentCourseIndex, totalCourses }) {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    if (!addInProgress) {
      setProgress(15);
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
        nextProgress = 15 + (elapsedSeconds / 1.5) * 35;
      } else if (elapsedSeconds <= 3.5) {
        nextProgress = 50 + ((elapsedSeconds - 1.5) / 2) * 35;
      } else {
        nextProgress = Math.min(96, 85 + (elapsedSeconds - 3.5) * 2);
      }
      setProgress(Math.round(nextProgress));
    }, 150);

    return () => clearInterval(interval);
  }, [addInProgress]);

  const displayProgress = addInProgress?.state === 'completed' ? 100 : progress;

  return (
    <div className="bg-white border-2 border-[#93C5FD] rounded-2xl p-4 shadow-[0_8px_24px_rgba(37,99,235,0.08)] space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
            {displayProgress >= 100 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-[#2563EB] stroke-[2.5]" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-sm text-[#0F172A] tracking-tight leading-tight">
              {totalCourses > 1
                ? `Adding Course ${currentCourseIndex + 1} of ${totalCourses}...`
                : 'Extracting Course Details...'}
            </h4>
            <p className="text-[11px] font-bold text-[#2563EB] truncate mt-0.5">
              {addInProgress?.message || 'Scanning timetable with AI vision...'}
            </p>
          </div>
        </div>

        <div className="shrink-0 px-2.5 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] font-black text-xs">
          {displayProgress}%
        </div>
      </div>

      <div className="w-full h-2.5 bg-[#EFF6FF] rounded-full overflow-hidden p-0.5 border border-[#BFDBFE]">
        <div
          className="h-full bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#2563EB] rounded-full transition-all duration-300 ease-out relative overflow-hidden"
          style={{ width: `${displayProgress}%` }}
        >
          <div className="absolute inset-0 bg-white/30 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function AddCourseScreen() {
  const navigate = useNavigate();
  const { coursesList, addCourse, addInProgress, getAcademicYear, setAcademicYear } = useFFCS();

  // Semester State
  const [semester, setSemester] = useState('');
  const [semesterDropdownOpen, setSemesterDropdownOpen] = useState(false);
  const semesterDropdownRef = useRef(null);
  const [academicYear, setAcademicYearState] = useState(() => getAcademicYear() || '2026-27');

  // Courses Rows State (Initial 3 rows matching Image 2 mockup)
  const [courseRows, setCourseRows] = useState([
    { id: 'row-1', searchQuery: '', selectedCourse: null, screenshots: [] },
    { id: 'row-2', searchQuery: '', selectedCourse: null, screenshots: [] },
    { id: 'row-3', searchQuery: '', selectedCourse: null, screenshots: [] }
  ]);

  // Autocomplete suggestions per active row
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestRef = useRef(0);

  // File Preview Modal State (for both Images and PDFs)
  const [previewFile, setPreviewFile] = useState(null);

  // Submission State
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentSubmittingIndex, setCurrentSubmittingIndex] = useState(0);

  // Refs maps
  const rowFileInputRefs = useRef({});
  const courseInputRefs = useRef({});

  // Helper: Check if a course is already in the user's permanent list
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

  // Close semester dropdown & course suggestions dropdown on outside click or Esc
  useEffect(() => {
    const handleOutsideClick = (e) => {
      // Close semester dropdown
      if (semesterDropdownRef.current && !semesterDropdownRef.current.contains(e.target)) {
        setSemesterDropdownOpen(false);
      }

      // Close active course suggestions dropdown if click is outside the active input container
      if (activeRowIndex !== null) {
        const activeContainer = courseInputRefs.current[activeRowIndex];
        if (activeContainer && !activeContainer.contains(e.target)) {
          setActiveRowIndex(null);
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveRowIndex(null);
        setSemesterDropdownOpen(false);
        setPreviewFile(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeRowIndex]);

  // Live search for the active row
  useEffect(() => {
    if (activeRowIndex === null) return;
    const activeRow = courseRows[activeRowIndex];
    if (!activeRow) return;

    const trimmed = (activeRow.searchQuery || '').trim();
    if (!trimmed) {
      setSuggestions(DEFAULT_SUGGESTIONS);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const response = await searchCurriculumCourses(trimmed, { limit: 8 });
        if (requestId !== searchRequestRef.current) return;
        const results = Array.isArray(response?.data?.courses) ? response.data.courses : [];
        setSuggestions(results);
      } catch {
        if (requestId !== searchRequestRef.current) return;
        setSuggestions([]);
      } finally {
        if (requestId === searchRequestRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [activeRowIndex, courseRows]);

  // Handle row input change
  const handleRowInputChange = (index, value) => {
    setErrorMessage('');
    setCourseRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, searchQuery: value, selectedCourse: null } : r))
    );
    setActiveRowIndex(index);
  };

  // Select suggestion for a row
  const handleSelectSuggestion = (index, course) => {
    if (isCourseAlreadyAdded(course)) {
      setErrorMessage(`"${course.courseCode}" has already been added.`);
      return;
    }
    // Check if duplicate within current rows
    const duplicateInForm = courseRows.some(
      (r, i) =>
        i !== index &&
        r.selectedCourse &&
        (r.selectedCourse.courseCode === course.courseCode ||
          r.selectedCourse._id === (course._id || course.courseId))
    );
    if (duplicateInForm) {
      setErrorMessage(`"${course.courseCode}" is already in your form list.`);
      return;
    }

    setCourseRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              selectedCourse: {
                _id: course._id || course.courseId,
                courseId: course.courseId || course._id,
                courseCode: course.courseCode,
                courseName: course.courseName,
                credits: course.credits || 3,
                category: course.category || ''
              },
              searchQuery: `${course.courseCode} - ${course.courseName}`
            }
          : r
      )
    );
    setActiveRowIndex(null);
    setSuggestions([]);
    setErrorMessage('');
  };

  // Clear a row's selected course
  const handleClearRow = (index) => {
    setCourseRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, searchQuery: '', selectedCourse: null } : r
      )
    );
    setActiveRowIndex(null);
  };

  // Delete a row
  const handleDeleteRow = (index) => {
    setCourseRows((prev) => {
      if (prev.length <= 1) {
        return [{ id: 'row-1', searchQuery: '', selectedCourse: null, screenshots: [] }];
      }
      return prev.filter((_, i) => i !== index);
    });
    if (activeRowIndex === index) {
      setActiveRowIndex(null);
    } else if (activeRowIndex !== null && activeRowIndex > index) {
      setActiveRowIndex((curr) => curr - 1);
    }
    setErrorMessage('');
  };

  // Add more courses row (Up to 8 max)
  const handleAddMoreRow = () => {
    if (courseRows.length >= 8) {
      setErrorMessage('You can add up to 8 courses at a time.');
      return;
    }
    const newId = `row-${Date.now()}`;
    setCourseRows((prev) => [
      ...prev,
      { id: newId, searchQuery: '', selectedCourse: null, screenshots: [] }
    ]);
    setErrorMessage('');
  };

  // File Upload trigger for a row
  const triggerRowUpload = (index) => {
    const input = rowFileInputRefs.current[index];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  // Handle files attached to a row (supports both Images and PDFs)
  const handleRowFileChange = async (index, e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles.length) return;

    setErrorMessage('');
    const currentRow = courseRows[index];
    const existingCount = currentRow.screenshots?.length || 0;
    const remainingSlots = 3 - existingCount;

    if (remainingSlots <= 0) {
      setErrorMessage(`Row ${index + 1}: Maximum 3 files (images or PDFs) allowed.`);
      return;
    }

    const filesToProcess = rawFiles.slice(0, remainingSlots);
    const processedFiles = await Promise.all(
      filesToProcess.map(async (f) => {
        const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        const processed = isPdf ? f : await compressImage(f);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name,
          file: processed,
          type: isPdf ? 'pdf' : 'image',
          url: URL.createObjectURL(processed)
        };
      })
    );

    setCourseRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, screenshots: [...(r.screenshots || []), ...processedFiles] }
          : r
      )
    );
  };

  // Remove a specific file from a row
  const handleRemoveRowFile = (rowIndex, fileId) => {
    setCourseRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;
        const target = (r.screenshots || []).find((s) => s.id === fileId);
        if (target?.url) URL.revokeObjectURL(target.url);
        return {
          ...r,
          screenshots: (r.screenshots || []).filter((s) => s.id !== fileId)
        };
      })
    );
  };

  // Submit all valid rows when Continue is clicked
  const handleContinueSubmit = async () => {
    if (submitting || addInProgress) return;

    if (!semester) {
      setErrorMessage('Please select a semester first.');
      return;
    }

    // Filter valid rows (must have selectedCourse or typed course name)
    const validRows = courseRows.filter(
      (r) => r.selectedCourse || (r.searchQuery && r.searchQuery.trim().length >= 3)
    );

    if (validRows.length === 0) {
      setErrorMessage('Please enter at least one course name.');
      return;
    }

    if (coursesList.length + validRows.length > 8) {
      setErrorMessage(
        `Total courses cannot exceed 8. You currently have ${coursesList.length} courses and are trying to add ${validRows.length} more.`
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    let firstAddedCourseId = null;

    try {
      setAcademicYear(academicYear);

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        setCurrentSubmittingIndex(i);

        const coursePayload = row.selectedCourse
          ? {
              curriculumCourseId: row.selectedCourse._id || row.selectedCourse.courseId,
              courseCode: row.selectedCourse.courseCode,
              courseName: row.selectedCourse.courseName,
              semester,
              academicYear,
              files: (row.screenshots || []).map((s) => s.file).filter(Boolean)
            }
          : {
              courseCode: row.searchQuery.trim().split(' ')[0].toUpperCase(),
              courseName: row.searchQuery.trim(),
              semester,
              academicYear,
              files: (row.screenshots || []).map((s) => s.file).filter(Boolean)
            };

        const res = await addCourse(coursePayload);
        const targetId = res?.course?.courseId || res?.courseId;
        if (!firstAddedCourseId && targetId) {
          firstAddedCourseId = targetId;
        }
      }

      // Success: Navigate to faculty selection if 1 course, else to courses list
      if (validRows.length === 1 && firstAddedCourseId) {
        navigate(`/slotmate/ffcs/faculty/${firstAddedCourseId}`);
      } else {
        navigate('/slotmate/ffcs/courses');
      }
    } catch (err) {
      const apiMsg = err?.response?.data?.message || err?.message;
      setErrorMessage(
        err?.status === 401
          ? 'Please sign in to add courses.'
          : apiMsg || 'Failed to add course. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || Boolean(addInProgress);

  return (
    <div className="min-h-[100dvh] bg-[#F0F6FF] flex justify-center selection:bg-blue-200">
      <div className="w-full max-w-[430px] min-h-[100dvh] bg-gradient-to-b from-[#EFF6FF] via-[#F4F9FF] to-[#EAF2FE] text-[#0F172A] flex flex-col justify-between pb-28 relative overflow-x-hidden sm:shadow-xl sm:border-x sm:border-blue-100">
        
        {/* Decorative Background PNG: Top-Left Concentric Arcs matching Image 3 */}
        <img
          src={bgArcTopLeft}
          alt=""
          aria-hidden="true"
          className="absolute -top-3 -left-6 w-36 sm:w-44 h-auto pointer-events-none select-none z-0 opacity-80 drop-shadow-xs"
          onError={(e) => { e.currentTarget.src = '/ffcs-bg-arc-top-left.png'; }}
        />

        {/* Decorative Background PNG: Top-Right Overlapping Circles matching Image 3 */}
        <img
          src={bgCirclesTopRight}
          alt=""
          aria-hidden="true"
          className="absolute -top-4 -right-6 w-36 sm:w-44 h-auto pointer-events-none select-none z-0 opacity-80 drop-shadow-xs"
          onError={(e) => { e.currentTarget.src = '/ffcs-bg-circles-top-right.png'; }}
        />

        {/* Bottom Ambient Glows / Subtle Curved Bubbles matching Image 3 */}
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-blue-200/40 blur-xl pointer-events-none select-none z-0" />
        <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-blue-300/35 blur-xl pointer-events-none select-none z-0" />

        <main className="w-full px-4 pt-2 space-y-4 relative z-10 flex-1">
          
          {/* Top Minimal Navigation Bar */}
          <header className="flex items-center pt-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-white hover:bg-blue-50 border border-[#BFDBFE] flex items-center justify-center text-[#1E3A8A] transition-colors cursor-pointer shadow-xs active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
          </header>

          {/* Title & Subtitle on Top matching user request */}
          <div className="text-center space-y-1 pt-0.5">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[#3B82F6] text-xs font-black tracking-widest">
                ‹‹
              </span>
              <div className="flex items-center gap-2 text-[#0B1E48]">
                <GraduationCap className="w-6 h-6 text-[#1D4ED8] stroke-[2.5]" />
                <h1 className="font-black text-2xl tracking-tight text-[#0B1E48]">
                  Add Courses
                </h1>
              </div>
              <span className="text-[#3B82F6] text-xs font-black tracking-widest">
                ››
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-semibold text-[#475569]">
              Select your semester and add your subjects
            </p>
          </div>

          {/* Connected Hero Illustration & White Card Box (Zero Gap) */}
          <div className="space-y-0 pt-0.5">
            {/* Hero Illustration: Below text, directly touching the card */}
            <div className="w-full flex justify-center items-end select-none pointer-events-none -mb-2.5 relative z-10">
              <img
                src={addCourseHeroSrc}
                alt="Add Courses"
                className="w-full max-w-[380px] h-auto max-h-[220px] object-contain drop-shadow-xs block"
                onError={(e) => {
                  e.currentTarget.src = '/ffcs-add-courses-hero.png';
                }}
              />
            </div>

            {/* Main White Card Container directly connected */}
            <div className="bg-white rounded-[28px] border border-[#BFDBFE] shadow-[0_10px_30px_rgba(37,99,235,0.06)] p-4 sm:p-5 space-y-4 relative z-20">
            
            {/* Section 1: Select Semester */}
            <div ref={semesterDropdownRef} className="space-y-2 relative">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#2563EB] stroke-[2.4]" />
                <h3 className="font-black text-sm sm:text-base text-[#0F172A] tracking-tight">
                  Select Semester
                </h3>
              </div>

              {/* Choose Semester Dropdown Button */}
              <button
                type="button"
                onClick={() => setSemesterDropdownOpen((prev) => !prev)}
                className={`w-full bg-white rounded-2xl border p-3 flex items-center justify-between text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs ${
                  semesterDropdownOpen
                    ? 'border-[#2563EB] ring-2 ring-blue-100'
                    : 'border-[#BFDBFE] hover:border-[#60A5FA]'
                }`}
              >
                <span className={semester ? 'text-[#0F172A] font-bold' : 'text-[#64748B]'}>
                  {semester || 'Choose Semester'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#1E3A8A] shrink-0 transition-transform duration-200 ${
                    semesterDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {semesterDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#BFDBFE] shadow-xl z-50 divide-y divide-slate-100 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200">
                  {SEMESTER_OPTIONS.map((opt) => {
                    const isSelected = semester === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setSemester(opt);
                          const match = opt.match(/\d{4}-\d{2}/);
                          if (match) setAcademicYearState(match[0]);
                          setSemesterDropdownOpen(false);
                          setErrorMessage('');
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                            : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Courses List */}
            <div className="space-y-3 pt-1">
              {/* Courses List Header with Open Book Icon */}
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2563EB] stroke-[2.4]" />
                <h3 className="font-black text-sm sm:text-base text-[#0F172A] tracking-tight">
                  Courses List
                </h3>
              </div>

              {/* Rows List */}
              <div className="space-y-3">
                {courseRows.map((row, index) => {
                  const isRowActive = activeRowIndex === index;
                  const hasSelected = Boolean(row.selectedCourse);
                  const screenshotCount = row.screenshots?.length || 0;

                  return (
                    <div
                      key={row.id}
                      className="relative space-y-1.5"
                    >
                      {/* Hidden File Input for this row (accepts images & PDFs) */}
                      <input
                        type="file"
                        ref={(el) => (rowFileInputRefs.current[index] = el)}
                        onChange={(e) => handleRowFileChange(index, e)}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        multiple
                        className="hidden"
                      />

                      <div className="flex items-center gap-2 sm:gap-2.5">
                        {/* 1. Blue Number Badge */}
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E0EDFF] text-[#1D4ED8] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {index + 1}
                        </div>

                        {/* 2. Course Name Input Box with Autocomplete */}
                        <div
                          ref={(el) => (courseInputRefs.current[index] = el)}
                          className="flex-1 min-w-0 bg-white rounded-2xl border border-[#BFDBFE] p-2 sm:p-2.5 shadow-2xs relative focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-[#1E293B] block leading-none">
                              Course Name <span className="text-rose-500 font-bold">*</span>
                            </label>
                            {hasSelected && (
                              <button
                                type="button"
                                onClick={() => handleClearRow(index)}
                                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-0.5 cursor-pointer"
                                title="Clear course"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <input
                            type="text"
                            value={row.searchQuery}
                            onChange={(e) => handleRowInputChange(index, e.target.value)}
                            onFocus={() => setActiveRowIndex(index)}
                            placeholder="Enter course name"
                            className="w-full text-xs font-bold text-[#0F172A] placeholder:text-[#94A3B8] bg-transparent focus:outline-none mt-1"
                          />

                          {/* Autocomplete Dropdown attached to this row */}
                          {isRowActive && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#BFDBFE] shadow-2xl z-50 divide-y divide-slate-100 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200">
                              {/* Header with Title and Close Button */}
                              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Suggestions
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRowIndex(null);
                                  }}
                                  className="w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                                  title="Close"
                                >
                                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                              </div>

                              {isSearching && (
                                <div className="px-3 py-2 flex items-center gap-2 text-xs font-bold text-[#2563EB]">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Searching courses...</span>
                                </div>
                              )}

                              {!isSearching && suggestions.length === 0 && (
                                <div className="px-3 py-2 text-center text-xs text-[#64748B]">
                                  No curriculum match found.
                                </div>
                              )}

                              {!isSearching &&
                                suggestions.map((course) => {
                                  const isAdded = isCourseAlreadyAdded(course);
                                  return (
                                    <button
                                      key={course._id || course.courseId || course.courseCode}
                                      type="button"
                                      onClick={() => handleSelectSuggestion(index, course)}
                                      className="w-full text-left px-3 py-2 hover:bg-[#EFF6FF] transition-colors cursor-pointer flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-black text-xs text-[#0F172A] truncate">
                                          <span className="text-[#2563EB] mr-1.5">
                                            {course.courseCode}
                                          </span>
                                          {course.courseName}
                                        </p>
                                        <p className="text-[10px] text-[#64748B] font-semibold truncate">
                                          {course.credits ?? 3} Credits • {course.category || 'Elective'}
                                        </p>
                                      </div>
                                      {isAdded ? (
                                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                                          Added
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded-full shrink-0">
                                          Select
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>

                        {/* 3. Blue Upload Button (Image & PDF) matching Image 2 */}
                        <button
                          type="button"
                          onClick={() => triggerRowUpload(index)}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border border-dashed border-[#60A5FA] bg-[#EFF6FF] hover:bg-[#DBEAFE] flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs relative active:scale-95"
                          title="Upload timetable screenshot or PDF for this course"
                        >
                          <BlueCloudUploadIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                          {screenshotCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                              {screenshotCount}
                            </span>
                          )}
                        </button>

                        {/* 4. Delete Trash Button matching Image 2 */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(index)}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#FEE2E2]/70 hover:bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs active:scale-95"
                          title="Delete row"
                        >
                          <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                        </button>
                      </div>

                      {/* Attached Files Preview Chips (Images & PDFs) */}
                      {row.screenshots && row.screenshots.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-10 pr-1">
                          {row.screenshots.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-2 py-1 shadow-2xs hover:border-[#60A5FA] transition-all"
                            >
                              {item.type === 'pdf' ? (
                                <div className="w-5 h-5 rounded-md bg-rose-500 text-white flex items-center justify-center font-black text-[8px] shrink-0">
                                  PDF
                                </div>
                              ) : (
                                <img
                                  src={item.url}
                                  alt={item.name}
                                  className="w-5 h-5 rounded-md object-cover border border-[#BFDBFE] shrink-0"
                                />
                              )}
                              <span
                                onClick={() => setPreviewFile(item)}
                                className="text-[10px] font-bold text-[#1E293B] max-w-[90px] sm:max-w-[120px] truncate cursor-pointer hover:text-[#2563EB]"
                                title={`Click to preview: ${item.name}`}
                              >
                                {item.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setPreviewFile(item)}
                                className="w-4 h-4 rounded-full text-[#2563EB] hover:bg-blue-100 flex items-center justify-center cursor-pointer"
                                title="Preview file"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRowFile(index, item.id)}
                                className="w-4 h-4 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer"
                                title="Remove file"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* "+ Add More Courses (Up to 8 Courses)" Dashed Button matching Image 2 */}
              {courseRows.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddMoreRow}
                  className="w-full rounded-2xl border border-dashed border-[#60A5FA] bg-[#EFF6FF]/60 hover:bg-[#EFF6FF] py-3 px-4 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs active:scale-[0.99] mt-3"
                >
                  <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="font-black text-xs sm:text-sm text-[#2563EB]">
                    + Add More Courses
                  </span>
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    ({courseRows.length}/8 Courses)
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

          {/* AI Vision Extraction Progress Card */}
          {addInProgress && (
            <ExtractionProgressCard
              addInProgress={addInProgress}
              currentCourseIndex={currentSubmittingIndex}
              totalCourses={courseRows.filter((r) => r.selectedCourse || r.searchQuery).length}
            />
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bottom Gradient Continue Button matching Image 2 mockup */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleContinueSubmit}
              disabled={busy}
              className="w-full py-3.5 sm:py-4 px-6 rounded-full bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] hover:brightness-105 active:scale-[0.98] text-white font-black text-base shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Courses...</span>
                </>
              ) : (
                <span>Continue →</span>
              )}
            </button>
          </div>
        </main>

        <FFCSBottomNav activeTab="add" />

        {/* ========================================================================= */}
        {/* FULLSCREEN / RESPONSIVE FILE PREVIEW MODAL (IMAGE & PDF SUPPORT)         */}
        {/* ========================================================================= */}
        {previewFile && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
            onClick={() => setPreviewFile(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 border border-slate-100"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {previewFile.type === 'pdf' ? (
                    <div className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-black text-[10px] shrink-0">
                      PDF
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[10px] shrink-0">
                      IMAGE
                    </div>
                  )}
                  <h3 className="font-black text-xs sm:text-sm text-[#0F172A] truncate">
                    {previewFile.name}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewFile(null)}
                    className="w-7 h-7 rounded-xl hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Close preview"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-100/50">
                {previewFile.type === 'image' ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-sm border border-slate-200"
                  />
                ) : (
                  <div className="w-full h-[65vh] flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <iframe
                      src={previewFile.url}
                      title={previewFile.name}
                      className="w-full h-full flex-1"
                    />
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold truncate pr-2">
                        PDF Preview ({previewFile.name})
                      </span>
                      <a
                        href={previewFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Full Tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddCourseScreen;
