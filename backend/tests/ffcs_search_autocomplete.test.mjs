import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { searchCurriculumCourses, listCurriculumCourses } = await import('../src/services/curriculumSearch.service.js');
const { default: CurriculumCourse } = await import('../src/models/CurriculumCourse.js');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  console.log('Skipping search autocomplete test: No MONGO_URI');
  process.exit(0);
}

try {
  await mongoose.connect(uri);

  // 1. Minimum 2 characters validation: 1 char returns []
  const res1 = await searchCurriculumCourses({ q: 'D' });
  assert.equal(res1.length, 0, '1 character must return 0 results');

  // 2. 2 characters: suggestions load
  const res2 = await searchCurriculumCourses({ q: 'Da' });
  assert.ok(res2.length > 0, '2 characters must return results');

  // 3. Partial course name matching: "Data Str"
  const res3 = await searchCurriculumCourses({ q: 'Data Str' });
  assert.ok(res3.some(c => c.courseCode === 'CSE2002' && c.courseName.includes('Data Structures')), 'Should find CSE2002 for "Data Str"');

  // 4. Course code matching: "CSE2003"
  const res4 = await searchCurriculumCourses({ q: 'CSE2003' });
  assert.equal(res4[0]?.courseCode, 'CSE2003', 'Exact course code must rank first');

  // 5. Lowercase letters: "cse2003"
  const res5 = await searchCurriculumCourses({ q: 'cse2003' });
  assert.equal(res5[0]?.courseCode, 'CSE2003', 'Lowercase course code must match');

  // 6. Uppercase letters with space: "CSE 2003"
  const res6 = await searchCurriculumCourses({ q: 'CSE 2003' });
  assert.equal(res6[0]?.courseCode, 'CSE2003', 'Course code with space must match');

  // 7. Unavailable course returns 0 results
  const res7 = await searchCurriculumCourses({ q: 'NONEXISTENT999' });
  assert.equal(res7.length, 0, 'Unavailable course must return 0 results');

  // 8. Output shape validation (_id, courseId, courseName, courseCode, semester)
  const sample = res3[0];
  assert.ok(sample._id, 'Must contain _id');
  assert.ok(sample.courseId, 'Must contain courseId');
  assert.ok(sample.courseName, 'Must contain courseName');
  assert.ok(sample.courseCode, 'Must contain courseCode');

  // 9. Total count in MongoDB
  const total = await CurriculumCourse.countDocuments({ isActive: true });
  assert.ok(total >= 113, `CurriculumCourse count should be at least 113, got ${total}`);

  console.log(`FFCS search autocomplete test passed! (Total active courses in DB: ${total})`);
} catch (err) {
  console.error('Test failed:', err);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}

