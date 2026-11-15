import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getMyFFCSCourses,
  addFFCSCourse,
  deleteFFCSCourse,
  getFFCSCourseTeachers
} from '../../../lib/api';
import { auth } from '../../../lib/firebase';
import {
  queryClient,
  queryKeys,
  invalidateFFCSCourseQueries,
  invalidateFFCSTeacherQueries
} from '../../../lib/queryClient';
import { VIT_TIME_COLUMNS, VIT_TIMETABLE_DAYS } from '../data/sampleCourses';
import { detectSlotClash } from '../utils/slotClashDetector.js';

const FFCSContext = createContext(null);

const COURSES_STORAGE_KEY = 'helpU_ffcs_user_courses_v2';
const SELECTION_STORAGE_KEY = 'helpU_ffcs_faculty_selections_v2';
const ACADEMIC_YEAR_STORAGE_KEY = 'helpU_ffcs_academic_year_v1';

function readStoredCourses() {
  try {
    const raw = localStorage.getItem(COURSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const unique = [];
    for (const c of parsed) {
      const codeKey = (c.code || c.courseCode || '').trim().toUpperCase().replace(/\s+/g, '');
      const idKey = String(c.id || c.curriculumCourseId || '').trim();
      if ((codeKey && seen.has(codeKey)) || (idKey && seen.has(idKey))) {
        continue;
      }
      if (codeKey) seen.add(codeKey);
      if (idKey) seen.add(idKey);
      unique.push(c);
    }
    return unique;
  } catch {
    return [];
  }
}

function readSelections() {
  try {
    const raw = localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function minutes(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function columnForSchedule(startTime) {
  const start = minutes(startTime);
  if (start === null) return null;

  let best = null;
  let bestDelta = Infinity;
  for (const column of VIT_TIME_COLUMNS) {
    if (column.isLunch) continue;
    const columnStart = minutes(column.start);
    if (columnStart === null) continue;
    const delta = Math.abs(columnStart - start);
    if (delta < bestDelta) {
      best = column;
      bestDelta = delta;
    }
  }
  return bestDelta <= 60 ? best : null;
}

function computeSlots(teacher) {
  const codes = new Set();
  for (const entry of teacher?.schedule || []) {
    const dayKey = String(entry.day || '').slice(0, 3).toUpperCase();
    const row = VIT_TIMETABLE_DAYS.find((item) => item.day === dayKey);
    if (!row) continue;
    const column = columnForSchedule(entry.startTime);
    if (!column) continue;
    const code = row.slots?.[column.id];
    if (code) codes.add(code);
  }
  return Array.from(codes).join('+');
}

function firstRoom(teacher) {
  const slot = (teacher?.schedule || []).find((entry) => entry.room);
  return slot?.room || '';
}

export function teacherToFaculty(teacher, course) {
  const directSlot = teacher?.slot || teacher?.schedule?.[0]?.slot;
  const directRoom = teacher?.venue || firstRoom(teacher);
  return {
    facultyId: `${course.id}:${teacher?.name || 'teacher'}:${directSlot || 'slot'}`,
    name: teacher?.name || 'Unknown faculty',
    subject: teacher?.subject || course.name,
    slot: directSlot || computeSlots(teacher) || 'Schedule not available',
    roomNo: directRoom || '—',
    classNo: null,
    courseCode: course.code,
    courseTitle: course.name,
    courseId: course.id,
    schedule: teacher?.schedule || []
  };
}

function normalizeCourse(course, index) {
  const teachers = course?.catalog?.teachers || [];
  const status = course?.status || 'completed';
  return {
    id: course.courseId,
    sequence: index + 1,
    code: course.courseCode,
    name: course.courseName,
    title: course.courseName,
    semester: course.semester,
    academicYear: course.academicYear,
    status,
    statusMessage: course.statusMessage || null,
    reviewStatus: course.catalog?.reviewStatus || null,
    curriculumCourseId: course.curriculumCourseId,
    catalogId: course.catalogId,
    institution: course.institution,
    curriculumVersion: course.curriculumVersion,
    teachers,
    screenshots: [],
    uploaded: status === 'completed' || status === 'needs_review',
    createdAt: course.createdAt
  };
}

export function FFCSProvider({ children }) {
  const [coursesList, setCoursesList] = useState(readStoredCourses);
  const [confirmedFaculties, setConfirmedFaculties] = useState(readSelections);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const [error, setError] = useState(null);
  const [addInProgress, setAddInProgress] = useState(null);
  const inFlightCoursesPromiseRef = useRef(null);

  const refreshCourses = useCallback(async (options = {}) => {
    const force = options?.force === true;
    setError(null);

    // 1. In-flight Request Deduplication:
    // If a request is already fetching, reuse it across all concurrent callers
    if (inFlightCoursesPromiseRef.current) {
      return inFlightCoursesPromiseRef.current;
    }

    const queryKey = queryKeys.ffcsCourses();

    // 2. Cache Check:
    // If we have fresh cached courses (< 5 minutes) and not forcing, return immediately
    if (!force) {
      const cached = queryClient.getQueryData(queryKey);
      const queryState = queryClient.getQueryState(queryKey);
      const isFresh = queryState && (Date.now() - queryState.dataUpdatedAt < 5 * 60 * 1000);
      if (cached && Array.isArray(cached) && isFresh) {
        setCoursesList(cached);
        setIsInitialLoading(false);
        return cached;
      }
    }

    setIsBackgroundFetching(true);

    const fetchPromise = (async () => {
      try {
        const response = await getMyFFCSCourses();
        const rawCourses = response?.data?.courses || [];
        const seen = new Set();
        const deduplicatedRaw = [];
        for (const c of rawCourses) {
          const codeKey = (c.courseCode || c.code || '').trim().toUpperCase().replace(/\s+/g, '');
          const idKey = String(c.curriculumCourseId || c.courseId || c.id || '').trim();
          if ((codeKey && seen.has(codeKey)) || (idKey && seen.has(idKey))) {
            continue;
          }
          if (codeKey) seen.add(codeKey);
          if (idKey) seen.add(idKey);
          deduplicatedRaw.push(c);
        }
        const normalizedList = deduplicatedRaw.map(normalizeCourse);

        setCoursesList(normalizedList);
        queryClient.setQueryData(queryKey, normalizedList);
        return normalizedList;
      } catch (err) {
        const statusCode = err?.response?.status || err?.status;
        if (statusCode === 401 || statusCode === 403) {
          // If not logged in, keep local stored courses and do not show an error
        } else {
          setError(err?.message || 'Unable to load your FFCS courses.');
        }
        return coursesList;
      } finally {
        setIsInitialLoading(false);
        setIsBackgroundFetching(false);
        inFlightCoursesPromiseRef.current = null;
      }
    })();

    inFlightCoursesPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [coursesList]);

  // Centralized Course Teachers Cache & Fetcher (10-minute cache per course)
  const getCourseTeachers = useCallback(async (courseId, force = false) => {
    if (!courseId) return { teachers: [], reviewStatus: null, status: null };
    const queryKey = queryKeys.ffcsCourseTeachers(courseId);

    // Check in-memory query cache first
    if (!force) {
      const cached = queryClient.getQueryData(queryKey);
      const queryState = queryClient.getQueryState(queryKey);
      const isFresh = queryState && (Date.now() - queryState.dataUpdatedAt < 10 * 60 * 1000);
      if (cached && isFresh) {
        return cached;
      }
    }

    return queryClient.fetchQuery({
      queryKey,
      queryFn: async () => {
        const response = await getFFCSCourseTeachers(courseId);
        const data = response?.data || {};
        const teachers = data.teachers || [];
        if (teachers.length > 0) {
          setCoursesList((prev) =>
            prev.map((c) =>
              c.id === courseId
                ? { ...c, teachers, reviewStatus: data.reviewStatus }
                : c
            )
          );
        }
        return {
          teachers,
          reviewStatus: data.reviewStatus || null,
          status: data.status || null
        };
      },
      staleTime: 10 * 60 * 1000,
      gcTime: 60 * 60 * 1000
    });
  }, []);

  // Fetch immediately on mount
  useEffect(() => {
    refreshCourses();
  }, [refreshCourses]);

  // Re-sync with backend automatically when Firebase auth state changes / token becomes ready
  useEffect(() => {
    const unsubscribe = auth?.onAuthStateChanged?.((user) => {
      if (user) {
        refreshCourses();
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [refreshCourses]);

  // Persist courses to localStorage whenever coursesList changes
  useEffect(() => {
    try {
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(coursesList));
    } catch {
      // ignore
    }
  }, [coursesList]);

  // Persist confirmed faculties to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(confirmedFaculties));
    } catch {
      // Selection persistence is a convenience only.
    }
  }, [confirmedFaculties]);

  // Compute Active Confirmed Faculties:
  // Strictly scopes confirmed faculty assignments to valid courses currently in coursesList.
  // Unselected courses and deleted courses NEVER appear in Timetable!
  const activeConfirmedFaculties = useMemo(() => {
    const activeMap = {};
    const validCourseIds = new Set(coursesList.map((c) => String(c.id)));
    const validCourseCodes = new Set(coursesList.map((c) => c.code?.toUpperCase()));

    Object.entries(confirmedFaculties).forEach(([key, fac]) => {
      if (!fac || !fac.slot) return;
      const isIdMatch = validCourseIds.has(String(key)) || validCourseIds.has(String(fac.courseId));
      const isCodeMatch = fac.courseCode && validCourseCodes.has(fac.courseCode.toUpperCase());
      if (isIdMatch || isCodeMatch) {
        activeMap[key] = fac;
      }
    });
    return activeMap;
  }, [coursesList, confirmedFaculties]);

  const getAcademicYear = () => {
    try {
      return (
        localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY) ||
        import.meta.env.VITE_DEFAULT_ACADEMIC_YEAR ||
        '2026-27'
      );
    } catch {
      return '2026-27';
    }
  };

  const setAcademicYear = (value) => {
    try {
      localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, String(value || ''));
    } catch {
      // ignore
    }
  };

  const addCourse = async ({
    curriculumCourseId,
    courseCode,
    courseName,
    semester,
    academicYear,
    files = [],
    screenshots = []
  }) => {
    if (addInProgress) {
      throw new Error('A course is already being processed. Please wait.');
    }

    if (coursesList.length >= 8) {
      throw new Error('Maximum 8 courses allowed in FFCS. You cannot add more than 8 courses.');
    }

    // Duplicate Validation: Check by unique course ID and normalized courseCode
    const targetId = String(curriculumCourseId || '').trim();
    const targetCode = String(courseCode || '').trim().toUpperCase().replace(/\s+/g, '');

    const alreadyAdded = coursesList.some((existing) => {
      const existingId = String(existing.id || '').trim();
      const existingCurriculumId = String(existing.curriculumCourseId || '').trim();
      const existingCode = String(existing.code || existing.courseCode || '').trim().toUpperCase().replace(/\s+/g, '');

      return (
        (targetId && (targetId === existingId || targetId === existingCurriculumId)) ||
        (targetCode && existingCode && targetCode === existingCode)
      );
    });

    if (alreadyAdded) {
      const err = new Error('This course has already been added.');
      err.code = 'COURSE_ALREADY_EXISTS';
      err.status = 409;
      throw err;
    }

    const uploadFiles = files.length
      ? files
      : screenshots.map((item) => item.file).filter(Boolean);

    setAddInProgress({
      state: 'checking_database',
      message: 'Checking database for existing teachers...'
    });

    const progressTimers = [
      setTimeout(() => {
        setAddInProgress({
          state: 'extracting_with_gemini',
          message: 'AI is extracting teacher details... (takes ~40-50s, please wait)'
        });
      }, 400),
      setTimeout(() => {
        setAddInProgress({
          state: 'extracting_with_gemini',
          message: 'Scanning faculty names & slots from screenshots... (~20s remaining)'
        });
      }, 18000),
      setTimeout(() => {
        setAddInProgress({
          state: 'extracting_with_gemini',
          message: 'Finalizing course catalog... Almost done!'
        });
      }, 36000)
    ];

    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ffcs-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await addFFCSCourse(
        {
          curriculumCourseId,
          courseCode,
          courseName,
          semester,
          academicYear,
          idempotencyKey
        },
        uploadFiles
      );

      progressTimers.forEach(clearTimeout);

      setAddInProgress({
        state: response?.data?.status || 'completed',
        message:
          response?.data?.source === 'mongodb'
            ? 'Teacher data loaded instantly from database!'
            : 'AI extraction completed successfully!'
      });

      // Optimistically add the new course to coursesList immediately
      const newCourseData = response?.data?.course;
      if (newCourseData) {
        const normalized = normalizeCourse(
          {
            ...newCourseData,
            catalog: response?.data?.catalog || { teachers: response?.data?.teachers || [] }
          },
          coursesList.length
        );
        setCoursesList((prev) => {
          const filtered = prev.filter(
            (c) => c.id !== normalized.id && c.code?.toUpperCase() !== normalized.code?.toUpperCase()
          );
          return [normalized, ...filtered];
        });
      }

      invalidateFFCSCourseQueries();
      await refreshCourses({ force: true });
      return response?.data;
    } catch (err) {
      progressTimers.forEach(clearTimeout);
      setAddInProgress(null);
      throw err;
    } finally {
      setTimeout(() => setAddInProgress(null), 1500);
    }
  };

  const deleteCourse = async (courseId) => {
    // 1. Optimistically remove from coursesList immediately
    setCoursesList((previous) => previous.filter((course) => course.id !== courseId));

    // 2. Remove from confirmedFaculties
    setConfirmedFaculties((previous) => {
      const next = { ...previous };
      delete next[courseId];
      Object.keys(next).forEach((k) => {
        if (next[k]?.courseId === courseId) delete next[k];
      });
      return next;
    });

    // 3. Delete from backend database
    try {
      await deleteFFCSCourse(courseId);
    } catch (err) {
      console.warn('[FFCS] Backend delete error:', err?.message);
    }

    // 4. Invalidate course query & teacher query specifically for this course
    invalidateFFCSCourseQueries();
    invalidateFFCSTeacherQueries(courseId);

    // 5. Background sync
    await refreshCourses({ force: true });
  };

  const confirmFaculty = (courseId, facultyData) => {
    if (facultyData?.slot) {
      const clash = detectSlotClash({
        candidateSlot: facultyData.slot,
        candidateSchedule: facultyData.schedule || [],
        confirmedFaculties: activeConfirmedFaculties,
        currentCourseId: courseId
      });
      if (clash.hasClash) {
        throw new Error(clash.message || 'Cannot select this slot due to a clash with another registered course.');
      }
    }
    setConfirmedFaculties((previous) => ({
      ...previous,
      [courseId]: { ...facultyData, courseId }
    }));
  };

  const removeConfirmedFaculty = (courseId) => {
    setConfirmedFaculties((previous) => {
      const next = { ...previous };
      delete next[courseId];
      return next;
    });
  };

  const loadDemoData = async () => {
    await refreshCourses();
  };

  const resetSelections = () => {
    setConfirmedFaculties({});
    try {
      localStorage.removeItem(SELECTION_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const resetAllData = async () => {
    setConfirmedFaculties({});
    try {
      localStorage.removeItem(SELECTION_STORAGE_KEY);
      localStorage.removeItem(COURSES_STORAGE_KEY);
    } catch {
      // ignore
    }
    setCoursesList([]);
    await refreshCourses();
  };

  const value = {
    courses: coursesList,
    coursesList,
    confirmedFaculties: activeConfirmedFaculties,
    rawConfirmedFaculties: confirmedFaculties,
    detectSlotClash,
    loading: isInitialLoading,
    isInitialLoading,
    isBackgroundFetching,
    error,
    addInProgress,
    refreshCourses,
    getCourseTeachers,
    addCourse,
    deleteCourse,
    confirmFaculty,
    removeConfirmedFaculty,
    resetSelections,
    getAcademicYear,
    setAcademicYear,
    loadDemoData,
    resetAllData
  };

  return <FFCSContext.Provider value={value}>{children}</FFCSContext.Provider>;
}

export function useFFCS() {
  const context = useContext(FFCSContext);
  if (!context) {
    throw new Error('useFFCS must be used within a FFCSProvider');
  }
  return context;
}
