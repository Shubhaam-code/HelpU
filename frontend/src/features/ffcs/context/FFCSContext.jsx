import React, { createContext, useContext, useState, useEffect } from 'react';
import { SAMPLE_COURSES } from '../data/sampleCourses';

const FFCSContext = createContext(null);

const STORAGE_KEY = 'helpU_ffcs_state_v1';

const INITIAL_UPLOAD_SLOTS = [
  { id: 1, label: 'Course 1', courseCode: 'CSE2003', uploaded: true, fileName: 'cse2003_syllabus.png' },
  { id: 2, label: 'Course 2', courseCode: 'CSE3004', uploaded: true, fileName: 'cse3004_schedule.png' },
  { id: 3, label: 'Course 3', courseCode: 'CSE3005', uploaded: true, fileName: 'cse3005_timetable.png' },
  { id: 4, label: 'Course 4', courseCode: 'CSE3006', uploaded: false, fileName: null },
  { id: 5, label: 'Course 5', courseCode: 'CSE3015', uploaded: false, fileName: null }
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
  // Load initial from localStorage or defaults
  const [courses, setCourses] = useState(SAMPLE_COURSES);
  
  const [uploadSlots, setUploadSlots] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_slots`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse FFCS upload slots from storage', e);
    }
    return INITIAL_UPLOAD_SLOTS;
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

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_slots`, JSON.stringify(uploadSlots));
    } catch (e) {
      console.warn('Failed to save FFCS upload slots to storage', e);
    }
  }, [uploadSlots]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_faculties`, JSON.stringify(confirmedFaculties));
    } catch (e) {
      console.warn('Failed to save FFCS faculties to storage', e);
    }
  }, [confirmedFaculties]);

  // Upload or replace image for a slot
  const uploadCourseImage = (slotId, file) => {
    const fileName = file?.name || `course_upload_${slotId}.png`;
    setUploadSlots((prev) =>
      prev.map((slot) => {
        if (slot.id === slotId) {
          return {
            ...slot,
            uploaded: true,
            fileName: fileName
          };
        }
        return slot;
      })
    );
  };

  // Confirm / update selected faculty for a course
  const confirmFaculty = (courseCode, facultyData) => {
    const course = courses.find((c) => c.code === courseCode);
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
    setUploadSlots(INITIAL_UPLOAD_SLOTS);
    setConfirmedFaculties(DEFAULT_CONFIRMED_FACULTIES);
  };

  // Reset all selections
  const resetAllData = () => {
    setUploadSlots(
      INITIAL_UPLOAD_SLOTS.map((s) => ({ ...s, uploaded: false, fileName: null }))
    );
    setConfirmedFaculties({});
    try {
      localStorage.removeItem(`${STORAGE_KEY}_slots`);
      localStorage.removeItem(`${STORAGE_KEY}_faculties`);
    } catch (e) {
      console.warn('Error clearing FFCS storage', e);
    }
  };

  const value = {
    courses,
    uploadSlots,
    confirmedFaculties,
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

