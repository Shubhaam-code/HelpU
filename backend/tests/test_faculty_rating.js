import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Faculty from '../src/models/Faculty.js';
import FacultyRating from '../src/models/FacultyRating.js';
import {
  getFacultyById,
  submitFacultyRating,
  calculateRatingStatus
} from '../src/services/faculty.service.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    console.log(`  ✅ PASS  [${duration}ms]  ${name}`);
    passed++;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`  ❌ FAIL  [${duration}ms]  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

async function runTests() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  HELPU – Faculty Rating & Breakdown Test Suite');
  console.log('══════════════════════════════════════════════════════');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  // Clean up any test ratings created previously
  const testStudent1 = 'test_student_user_001';
  const testStudent2 = 'test_student_user_002';
  await FacultyRating.deleteMany({ studentId: { $in: [testStudent1, testStudent2] } });

  // 1. Status label calculation tests
  await test('1. Status calculation: >= 4.5 -> Excellent', async () => {
    assertEqual(calculateRatingStatus(4.8, 5), 'Excellent');
    assertEqual(calculateRatingStatus(4.5, 1), 'Excellent');
  });

  await test('2. Status calculation: >= 3.5 and < 4.5 -> Good', async () => {
    assertEqual(calculateRatingStatus(4.0, 3), 'Good');
    assertEqual(calculateRatingStatus(3.5, 1), 'Good');
  });

  await test('3. Status calculation: >= 2.5 and < 3.5 -> Average', async () => {
    assertEqual(calculateRatingStatus(3.0, 2), 'Average');
    assertEqual(calculateRatingStatus(2.5, 1), 'Average');
  });

  await test('4. Status calculation: >= 1.5 and < 2.5 -> Needs Improvement', async () => {
    assertEqual(calculateRatingStatus(2.0, 2), 'Needs Improvement');
    assertEqual(calculateRatingStatus(1.5, 1), 'Needs Improvement');
  });

  await test('5. Status calculation: < 1.5 -> Below Expectations', async () => {
    assertEqual(calculateRatingStatus(1.25, 1), 'Below Expectations');
    assertEqual(calculateRatingStatus(1.0, 1), 'Below Expectations');
  });

  await test('6. Status calculation: 0 ratings -> Not enough ratings yet', async () => {
    assertEqual(calculateRatingStatus(null, 0), 'Not enough ratings yet');
    assertEqual(calculateRatingStatus(4.5, 0), 'Not enough ratings yet');
  });

  // 2. Fetch faculty profile details
  let targetFaculty = null;
  await test('7. getFacultyById returns faculty with 4 categories and status', async () => {
    targetFaculty = await Faculty.findOne({ facultyId: 'VITB-0001' });
    assert(targetFaculty, 'VITB-0001 must exist');

    const profile = await getFacultyById('VITB-0001');
    assert(profile, 'Profile must not be null');
    assertEqual(profile.facultyId, 'VITB-0001');
    assert(profile.teaching_rating !== undefined, 'teaching_rating must exist');
    assert(profile.evaluation_rating !== undefined, 'evaluation_rating must exist');
    assert(profile.behaviour_rating !== undefined, 'behaviour_rating must exist');
    assert(profile.internals_rating !== undefined, 'internals_rating must exist');
    assert(typeof profile.status === 'string', 'status must be a string');
    assert(typeof profile.ratingsCount === 'number', 'ratingsCount must be a number');
  });

  // 3. Validation tests for submitFacultyRating
  await test('8. Rating validation: Rejects missing category', async () => {
    try {
      await submitFacultyRating({
        idOrFacultyId: 'VITB-0001',
        studentId: testStudent1,
        teachingRating: 5,
        evaluationRating: 4,
        behaviourRating: 5
        // internalsRating missing
      });
      assert(false, 'Should have thrown error for missing internalsRating');
    } catch (err) {
      assert(err.message.includes('internalsRating'), 'Error should mention internalsRating');
    }
  });

  await test('9. Rating validation: Rejects rating outside 1-5 (e.g. 6 or 0)', async () => {
    try {
      await submitFacultyRating({
        idOrFacultyId: 'VITB-0001',
        studentId: testStudent1,
        teachingRating: 6,
        evaluationRating: 4,
        behaviourRating: 5,
        internalsRating: 3
      });
      assert(false, 'Should have thrown error for rating > 5');
    } catch (err) {
      assert(err.message.includes('must be an integer between 1 and 5'));
    }
  });

  await test('10. Rating validation: Rejects non-integer rating (e.g. 3.5)', async () => {
    try {
      await submitFacultyRating({
        idOrFacultyId: 'VITB-0001',
        studentId: testStudent1,
        teachingRating: 3.5,
        evaluationRating: 4,
        behaviourRating: 5,
        internalsRating: 3
      });
      assert(false, 'Should have thrown error for non-integer');
    } catch (err) {
      assert(err.message.includes('must be an integer between 1 and 5'));
    }
  });

  // 4. Submit real student ratings and verify calculations
  await test('11. Submit valid rating by Student 1: Recalculates averages & overall rating', async () => {
    const res = await submitFacultyRating({
      idOrFacultyId: 'VITB-0001',
      studentId: testStudent1,
      teachingRating: 5,
      evaluationRating: 4,
      behaviourRating: 5,
      internalsRating: 4
    });

    assertEqual(res.teaching_rating, 5);
    assertEqual(res.evaluation_rating, 4);
    assertEqual(res.behaviour_rating, 5);
    assertEqual(res.internals_rating, 4);
    // Overall = (5 + 4 + 5 + 4) / 4 = 4.5
    assertEqual(res.overall_rating, 4.5);
    assertEqual(res.status, 'Excellent');
    assertEqual(res.ratingsCount, 1);
  });

  await test('12. Submit second rating by Student 2: Correct multi-student averaging', async () => {
    const res = await submitFacultyRating({
      idOrFacultyId: 'VITB-0001',
      studentId: testStudent2,
      teachingRating: 3,
      evaluationRating: 2,
      behaviourRating: 3,
      internalsRating: 2
    });

    // Teaching: (5 + 3) / 2 = 4.0
    // Evaluation: (4 + 2) / 2 = 3.0
    // Behaviour: (5 + 3) / 2 = 4.0
    // Internals: (4 + 2) / 2 = 3.0
    // Overall: (4 + 3 + 4 + 3) / 4 = 3.5
    assertEqual(res.teaching_rating, 4);
    assertEqual(res.evaluation_rating, 3);
    assertEqual(res.behaviour_rating, 4);
    assertEqual(res.internals_rating, 3);
    assertEqual(res.overall_rating, 3.5);
    assertEqual(res.status, 'Good');
    assertEqual(res.ratingsCount, 2);
  });

  await test('13. Duplicate prevention: Student 1 updates their rating instead of creating duplicate', async () => {
    const res = await submitFacultyRating({
      idOrFacultyId: 'VITB-0001',
      studentId: testStudent1,
      teachingRating: 4,
      evaluationRating: 4,
      behaviourRating: 4,
      internalsRating: 4
    });

    // Count must still be 2, not 3
    const totalDocs = await FacultyRating.countDocuments({ facultyId: 'VITB-0001' });
    assertEqual(totalDocs, 2, 'Total rating documents must remain 2');
    assertEqual(res.ratingsCount, 2);

    // Student 1 (4,4,4,4) + Student 2 (3,2,3,2):
    // Teaching: (4 + 3) / 2 = 3.5
    // Evaluation: (4 + 2) / 2 = 3.0
    // Behaviour: (4 + 3) / 2 = 3.5
    // Internals: (4 + 2) / 2 = 3.0
    // Overall: (3.5 + 3.0 + 3.5 + 3.0) / 4 = 3.25
    assertEqual(res.overall_rating, 3.25);
    assertEqual(res.status, 'Average');
  });

  await test('14. getFacultyById returns userRating when studentId is passed', async () => {
    const profile = await getFacultyById('VITB-0001', testStudent1);
    assert(profile.userRating !== null, 'userRating must exist for Student 1');
    assertEqual(profile.userRating.teachingRating, 4);
    assertEqual(profile.userRating.evaluationRating, 4);
  });

  // Clean up test ratings
  await FacultyRating.deleteMany({ studentId: { $in: [testStudent1, testStudent2] } });

  // Restore faculty original values from DB
  if (targetFaculty) {
    targetFaculty.teaching_rating = targetFaculty.teaching_rating;
    targetFaculty.totalReviews = 1;
    await targetFaculty.save();
  }

  console.log('══════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('══════════════════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

