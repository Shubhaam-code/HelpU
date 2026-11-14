import assert from 'node:assert/strict';
import { validateTeacherExtraction } from '../src/services/gemini.service.js';

const context = {
  courseCode: 'CSE2002',
  courseName: 'Data Structures and Algorithms',
  semester: 3,
  academicYear: '2026-27'
};

const valid = validateTeacherExtraction(
  {
    courseCode: 'CSE2002',
    courseName: 'Data Structures and Algorithms',
    semester: 3,
    academicYear: '2026-27',
    teachers: [
      {
        name: 'Teacher A',
        subject: 'Data Structures and Algorithms',
        schedule: [
          { day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'Room 101' },
          { day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'Room 101' }
        ]
      }
    ]
  },
  context
);

assert.equal(valid.isComplete, true);
assert.equal(valid.extractionStatus, 'completed');
assert.equal(valid.reviewStatus, 'verified');
assert.equal(valid.data.teachers.length, 1);
assert.equal(valid.data.teachers[0].schedule.length, 1, 'Duplicate schedule must be removed');
assert.equal(valid.data.teachers[0].schedule[0].startTime, '09:00');

const invalid = validateTeacherExtraction(
  {
    courseCode: 'CSE2002',
    courseName: 'Data Structures and Algorithms',
    semester: 5,
    academicYear: '2026-27',
    teachers: [
      { name: null, subject: 'Data Structures', schedule: [] },
      { name: 'Teacher B', schedule: [{ day: 'Funday', startTime: '??', endTime: null }] }
    ]
  },
  context
);

assert.equal(invalid.isComplete, false);
assert.equal(invalid.extractionStatus, 'needs_review');
assert.equal(invalid.reviewStatus, 'needs_review');
assert.ok(invalid.issues.includes('semester_mismatch'));
assert.ok(invalid.issues.includes('teacher_name_missing'));
assert.ok(invalid.issues.includes('incomplete_schedule_entry'));

const incomplete = validateTeacherExtraction(
  {
    courseCode: 'CSE2002',
    courseName: 'Data Structures and Algorithms',
    semester: 3,
    academicYear: '2026-27',
    teachers: [{ name: 'Teacher C', subject: null, schedule: [] }]
  },
  context
);

assert.equal(incomplete.isComplete, false);
assert.ok(incomplete.issues.includes('teacher_schedule_missing'));

console.log('FFCS Gemini validation test passed');
