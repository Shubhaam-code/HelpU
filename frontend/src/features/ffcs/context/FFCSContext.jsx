import React, { createContext, useContext, useState, useEffect } from 'react';
import { SAMPLE_COURSES } from '../data/sampleCourses';

const FFCSContext = createContext(null);

const STORAGE_KEY = 'helpU_ffcs_state_v2';

const INITIAL_COURSES = [
  {
    id: 'course-1',
    sequence: 1,
    label: 'Course 1',
    code: 'CSE2003',
    name: 'Computer Architecture and Organization',
    fileName: 'Upload Image',
    screenshots: [],
    uploaded: false
  },
  {
    id: 'course-2',
    sequence: 2,
    label: 'Course 2',
    code: 'CSE3004',
    name: 'Design and Analysis of Algorithms',
    fileName: 'Upload Image',
    screenshots: [],
    uploaded: false
  },
  {
    id: 'course-3',
    sequence: 3,
    label: 'Course 3',
    code: 'CSE3005',
    name: 'Software Engineering',
    fileName: 'Upload Image',
    screenshots: [],
    uploaded: false
  }
];

const DEFAULT_CONFIRMED_FACULTIES = {
  CSE2003: {
    facultyId: 'f-2003-1',
    name: 'KOMARASAMY G - SCAI',
    slot: 'B14+B23+D21',
    roomNo: 'AB02-423',
    classNo: 'BL2026270501056',
    courseCode: 'CSE2003',
    courseTitle: 'Computer Architecture and Organization'
  },
  CSE3004: {
    facultyId: 'f-3004-1',
    name: 'BUBAI MANNA - SCOPE',
    slot: 'B21+E14+E22',
    roomNo: 'AB02-317',
    classNo: 'BL2026270501126',
    courseCode: 'CSE3004',
    courseTitle: 'Design and Analysis of Algorithms'
  },
  CSE3005: {
    facultyId: 'f-3005-1',
    name: 'MITHUN SINGH AHIRWAR - SCAI',
    slot: 'A21+A22+A23',
    roomNo: 'AB02-217',
    classNo: 'BL2026270500979',
    courseCode: 'CSE3005',
    courseTitle: 'Software Engineering'
  },
  CSE3006: {
    facultyId: 'f-3006-1',
    name: 'AMIT ABHISHEK - SCOPE',
    slot: 'B22+B24+F21',
    roomNo: 'AB02-017',
    classNo: 'BL2026270501049',
    courseCode: 'CSE3006',
    courseTitle: 'Computer Networks'
  },
  CSE3015: {
    facultyId: 'f-3015-1',
    name: 'ETHNUS TRAINER 6 - ACAD',
    slot: 'C14+E11+E12',
    roomNo: 'AB02-224',
    classNo: 'BL2026270500847',
    courseCode: 'CSE3015',
    courseTitle: 'AWS Cloud Practitioner'
  }
};

export function FFCSProvider({ children }) {
  const [catalogueCourses] = useState(SAMPLE_COURSES);

  // Unlimited user added courses list
  const [coursesList, setCoursesList] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_courses_list`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse FFCS courses from storage', e);
    }
    return INITIAL_COURSES;
  });

  const [confirmedFaculties, setConfirmedFaculties] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_faculties`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse FFCS faculties from storage', e);
    }
    return DEFAULT_CONFIRMED_FACULTIES;
  });

  // Sync courses list to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_courses_list`, JSON.stringify(coursesList));
    } catch (e) {
      console.warn('Failed to save FFCS courses list to storage', e);
    }
  }, [coursesList]);

  // Sync faculties to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_faculties`, JSON.stringify(confirmedFaculties));
    } catch (e) {
      console.warn('Failed to save FFCS faculties to storage', e);
    }
  }, [confirmedFaculties]);

  // Add a new course (Unlimited courses supported)
  const addCourse = ({ courseCode, courseName, screenshots = [] }) => {
    const nextSeq = coursesList.length + 1;
    const code = courseCode || `CSE${2000 + nextSeq}`;
    const name = courseName || `Course ${nextSeq}`;
    
    // Screenshot info
    const screenshotNames = screenshots.map((s) => s.name || 'screenshot.png');
    const displayFileName = screenshotNames.length > 0 
      ? screenshotNames[0] + (screenshotNames.length > 1 ? ` (+${screenshotNames.length - 1} more)` : '')
      : 'Upload Image';

    const newCourse = {
      id: `course-${Date.now()}-${nextSeq}`,
      sequence: nextSeq,
      label: `Course ${nextSeq}`,
      code: code,
      name: name,
      fileName: displayFileName,
      screenshots: screenshots.slice(0, 3), // Max 3 screenshots per course
      uploaded: screenshots.length > 0
    };

    setCoursesList((prev) => [...prev, newCourse]);
    return newCourse;
  };

  // Upload or replace image for an existing course
  const uploadCourseImage = (courseIdOrSeq, file) => {
    const fileName = file?.name || `screenshot.png`;
    setCoursesList((prev) =>
      prev.map((c) => {
        if (c.id === courseIdOrSeq || c.sequence === courseIdOrSeq) {
          return {
            ...c,
            uploaded: true,
            fileName: fileName,
            screenshots: [{ name: fileName, url: URL.createObjectURL(file) }]
          };
        }
        return c;
      })
    );
  };

  // Confirm / update selected faculty for a course
  const confirmFaculty = (courseCode, facultyData) => {
    const course = catalogueCourses.find((c) => c.code === courseCode);
    setConfirmedFaculties((prev) => ({
      ...prev,
      [courseCode]: {
        ...facultyData,
        courseCode,
        courseTitle: course?.title || courseCode
      }
    }));
  };

  // Remove confirmed faculty
  const removeConfirmedFaculty = (courseCode) => {
    setConfirmedFaculties((prev) => {
      const next = { ...prev };
      delete next[courseCode];
      return next;
    });
  };

  // Load sample demo data
  const loadDemoData = () => {
    setCoursesList(INITIAL_COURSES);
    setConfirmedFaculties(DEFAULT_CONFIRMED_FACULTIES);
  };

  // Reset all selections
  const resetAllData = () => {
    setCoursesList(INITIAL_COURSES.map(c => ({ ...c, uploaded: false, fileName: 'Upload Image', screenshots: [] })));
    setConfirmedFaculties({});
    try {
      localStorage.removeItem(`${STORAGE_KEY}_courses_list`);
      localStorage.removeItem(`${STORAGE_KEY}_faculties`);
    } catch (e) {
      console.warn('Error clearing FFCS storage', e);
    }
  };

  const value = {
    courses: catalogueCourses,
    coursesList,
    uploadSlots: coursesList, // Alias for backward compatibility
    confirmedFaculties,
    addCourse,
    uploadCourseImage,
    confirmFaculty,
    removeConfirmedFaculty,
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
