import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCurriculumPdf } from '../src/services/curriculumParser.service.js';

const pdfPath = new URL('../circulam.pdf', import.meta.url);
const buffer = fs.readFileSync(pdfPath);

const result = await parseCurriculumPdf(buffer);

assert.equal(result.scanned, false, 'Text PDF must not be treated as scanned');
assert.ok(result.courses.length >= 100, `Expected >=100 courses, got ${result.courses.length}`);

const codes = result.courses.map((course) => course.courseCode);
assert.equal(new Set(codes).size, codes.length, 'Parser must not emit duplicate course codes');

const byCode = new Map(result.courses.map((course) => [course.courseCode, course]));

const dataStructures = byCode.get('CSE2002');
assert.ok(dataStructures, 'CSE2002 Data Structures must be parsed');
assert.equal(dataStructures.courseName, 'Data Structures and Algorithms');
assert.equal(dataStructures.category, 'Programme Core');
assert.equal(dataStructures.credits, 4);
assert.equal(dataStructures.semester, null, 'Semester must not be invented');
assert.ok(dataStructures.reviewReasons.includes('semester_not_present_in_source'));
assert.ok(dataStructures.sourcePage >= 1);

const management = byCode.get('MGT1002');
assert.ok(management, 'MGT1002 must be parsed');
assert.equal(
  management.courseName,
  'PRINCIPLES OF MANAGEMENT AND ORGANIZATIONAL BEHAVIOUR'
);

const internship = byCode.get('DSN2092');
assert.ok(internship, 'DSN2092 must be parsed');
assert.equal(internship.courseType, 'Project Only');
assert.equal(internship.credits, 1);

const online = byCode.get('ONL1022');
assert.ok(online, 'ONL1022 must be parsed');
assert.equal(online.courseType, 'Online Course');
assert.equal(online.credits, 3);

const unexpectedReview = result.courses.filter((course) =>
  course.reviewReasons.some((reason) => reason !== 'semester_not_present_in_source')
);
assert.equal(
  unexpectedReview.length,
  0,
  `Unexpected parser review flags: ${JSON.stringify(
    unexpectedReview.map((course) => [course.courseCode, course.reviewReasons])
  )}`
);

const categoryCounts = result.courses.reduce((accumulator, course) => {
  accumulator[course.category] = (accumulator[course.category] || 0) + 1;
  return accumulator;
}, {});

console.log('FFCS curriculum parser test passed');
console.log(`  courses: ${result.courses.length}`);
console.log(`  pages: ${result.totalPages}`);
console.log(`  categories: ${JSON.stringify(categoryCounts)}`);
