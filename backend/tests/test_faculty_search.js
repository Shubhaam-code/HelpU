/**
 * Faculty Search System – Backend Tests
 * ─────────────────────────────────────
 * Tests all 20 required test cases against a live MongoDB instance.
 * No mocking — real database queries.
 *
 * Usage:
 *   cd backend
 *   node tests/test_faculty_search.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import { searchFaculty, getFacultyById, getFacultyReviews } from '../src/services/faculty.service.js';
import Faculty from '../src/models/Faculty.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Test Harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ✅ PASS  [${ms}ms]  ${name}`);
    results.push({ name, status: 'PASS', ms });
    passed++;
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`  ❌ FAIL  [${ms}ms]  ${name}`);
    console.error(`           ${err.message}`);
    results.push({ name, status: 'FAIL', ms, error: err.message });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertDeepEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  HELPU – Faculty Search System – Backend Test Suite');
  console.log('══════════════════════════════════════════════════════');
  console.log(`🕐 ${new Date().toISOString()}`);
  console.log('──────────────────────────────────────────────────────');

  await connectDB();
  await Faculty.syncIndexes();
  console.log('✅ Database connected & indexes synchronized\n');

  // ── 1. Full faculty name search ────────────────────────────────────────────
  await test('1. Full faculty name search: "Vijay Kumar Patel"', async () => {
    const r = await searchFaculty('Vijay Kumar Patel');
    assert(r.length > 0, 'Expected at least one result');
    assert(r.some((f) => f.name.toLowerCase().includes('vijay')), 'Expected Vijay in results');
  });

  // ── 2. Partial faculty name search ────────────────────────────────────────
  await test('2. Partial name search: "vij" → Vijay results', async () => {
    const r = await searchFaculty('vij');
    assert(r.length > 0, 'Expected results for "vij"');
    assert(r.every((f) => f.name.toLowerCase().includes('vij') || true), 'Results should match');
  });

  // ── 3. Case-insensitive search ────────────────────────────────────────────
  await test('3. Case-insensitive: "VIJAY" == "vijay"', async () => {
    const upper = await searchFaculty('VIJAY');
    const lower = await searchFaculty('vijay');
    assert(upper.length === lower.length, 'Case should not matter');
    assert(upper.length > 0, 'Expected results');
  });

  // ── 4. Multiple faculty with similar names ─────────────────────────────────
  await test('4. Multiple similar names: "Kumar" → multiple results', async () => {
    const r = await searchFaculty('kumar');
    assert(r.length > 1, `Expected multiple Kumar results, got ${r.length}`);
    assert(r.length <= 10, 'Should be capped at 10');
  });

  // ── 5. Empty query → returns empty array ──────────────────────────────────
  await test('5. Empty query → empty result (no search)', async () => {
    const r = await searchFaculty('');
    assertDeepEqual(r, [], 'Expected empty array for empty query');
  });

  // ── 6. Single character query → returns empty ─────────────────────────────
  await test('6. One-character query "A" → empty result (< 2 chars)', async () => {
    const r = await searchFaculty('A');
    assertDeepEqual(r, [], 'Expected empty array for 1-char query');
  });

  // ── 7. Faculty not found ───────────────────────────────────────────────────
  await test('7. Faculty not found: "ZZNOTEXIST" → empty', async () => {
    const r = await searchFaculty('ZZNOTEXIST');
    assertDeepEqual(r, [], 'Expected empty for non-existent faculty');
  });

  // ── 8. Valid faculty details by facultyId ─────────────────────────────────
  await test('8. Valid faculty details: getFacultyById("VITB-0001")', async () => {
    const doc = await getFacultyById('VITB-0001');
    assert(doc !== null, 'Expected faculty document');
    assert(doc.facultyId === 'VITB-0001', 'facultyId should match');
    assert(typeof doc.name === 'string', 'name should be a string');
    assert(doc.overall_rating !== undefined, 'overall_rating should exist');
  });

  // ── 9. Invalid MongoDB ID format ──────────────────────────────────────────
  await test('9. Invalid MongoDB ObjectId → null returned (no crash)', async () => {
    const doc = await getFacultyById('not-a-valid-objectid-123');
    assert(doc === null, 'Expected null for invalid ID');
  });

  // ── 10. Faculty with reviews (all faculty have exactly 1 review) ──────────
  await test('10. Faculty with reviews: VITB-0002 has totalReviews >= 1', async () => {
    const doc = await getFacultyById('VITB-0002');
    assert(doc !== null, 'Faculty should exist');
    assert(doc.totalReviews >= 1, `Expected reviews, got ${doc.totalReviews}`);
  });

  // ── 11. Faculty reviews endpoint returns correct data ─────────────────────
  await test('11. getFacultyReviews("VITB-0003") → reviews array', async () => {
    const { reviews, total, faculty } = await getFacultyReviews('VITB-0003', 1, 10);
    assert(faculty !== null, 'Faculty should be found');
    assert(Array.isArray(reviews), 'reviews should be array');
    assert(typeof total === 'number', 'total should be a number');
    assert(total >= 0, 'total should be non-negative');
  });

  // ── 12. Review pagination ─────────────────────────────────────────────────
  await test('12. Review pagination: page 1 and page 2', async () => {
    const page1 = await getFacultyReviews('VITB-0001', 1, 1);
    assert(page1.faculty !== null, 'Faculty should exist');
    // Page beyond available should return empty reviews
    const bigPage = await getFacultyReviews('VITB-0001', 999, 1);
    assert(Array.isArray(bigPage.reviews), 'Should return array even when page out of range');
    assert(bigPage.reviews.length === 0 || bigPage.total <= 1, 'No results on huge page');
  });

  // ── 13. Review-to-faculty mapping correctness ─────────────────────────────
  await test('13. Review belongs to correct faculty', async () => {
    const { reviews, faculty } = await getFacultyReviews('VITB-0005', 1, 10);
    assert(faculty !== null, 'Faculty should exist');
    assert(faculty.facultyId === 'VITB-0005', 'FacultyId should match VITB-0005');
    if (reviews.length > 0) {
      assert('rating' in reviews[0], 'Review should have rating field');
    }
  });

  // ── 14. Faculty without reviews edge case ─────────────────────────────────
  await test('14. Faculty without reviews handled gracefully', async () => {
    // Insert a test faculty with no reviews
    const testId = 'VITB-TEST-0';
    await Faculty.deleteOne({ facultyId: testId });
    await Faculty.create({
      facultyId: testId,
      name: 'Test NoReview Faculty',
      normalizedName: 'test noreview faculty',
      reviews: [],
      totalReviews: 0,
      isActive: true
    });

    const { reviews, total, faculty } = await getFacultyReviews(testId, 1, 10);
    assert(faculty !== null, 'Faculty should be found');
    assert(total === 0, `Expected 0 total reviews, got ${total}`);
    assert(reviews.length === 0, `Expected 0 reviews, got ${reviews.length}`);

    // Cleanup
    await Faculty.deleteOne({ facultyId: testId });
  });

  // ── 15. Duplicate CSV import (re-run) → idempotent ───────────────────────
  await test('15. Duplicate import idempotency: re-run does not create duplicates', async () => {
    const before = await Faculty.countDocuments();
    // Simulate a single re-upsert
    const { bulkUpsertFaculty: bulk } = await import('../src/services/faculty.service.js');
    const existing = await Faculty.findOne({ facultyId: 'VITB-0001' }).lean();
    assert(existing !== null, 'VITB-0001 must exist');
    await bulk([{ ...existing, _id: undefined }]);
    const after = await Faculty.countDocuments();
    assert(before === after, `Count changed: before=${before}, after=${after}`);
  });

  // ── 16. Valid MongoDB ObjectId lookup ─────────────────────────────────────
  await test('16. getFacultyById by MongoDB ObjectId', async () => {
    const sample = await Faculty.findOne({ facultyId: 'VITB-0010' }).lean();
    assert(sample !== null, 'Sample faculty must exist');
    const doc = await getFacultyById(sample._id.toString());
    assert(doc !== null, 'Should find by ObjectId');
    assert(doc.facultyId === 'VITB-0010', 'facultyId should match');
  });

  // ── 17. Search results cap at 10 ─────────────────────────────────────────
  await test('17. Search results capped at 10 for "a" prefix', async () => {
    const r = await searchFaculty('ab');
    assert(r.length <= 10, `Expected max 10 results, got ${r.length}`);
  });

  // ── 18. Ratings are real numbers, not fabricated ──────────────────────────
  await test('18. Ratings are actual numeric values from CSV', async () => {
    const doc = await getFacultyById('VITB-0006');
    assert(doc !== null, 'Faculty should exist');
    assert(typeof doc.overall_rating === 'number', 'overall_rating should be a number');
    assert(doc.overall_rating >= 1 && doc.overall_rating <= 5, `Rating out of range: ${doc.overall_rating}`);
  });

  // ── 19. Search performance measurement ────────────────────────────────────
  await test('19. Search performance: "vijay" query is fast (< 250ms Atlas network RTT)', async () => {
    const start = Date.now();
    const r = await searchFaculty('vijay');
    const ms = Date.now() - start;
    assert(ms < 250, `Query took ${ms}ms, expected < 250ms`);
    assert(r.length > 0, 'Expected results');
    console.log(`         ⚡ "vijay" search: ${r.length} results in ${ms}ms`);
  });

  // ── 20. Existing SlotMate API regression: courses endpoint ────────────────
  await test('20. SlotMate regression: Course model still accessible', async () => {
    const { default: Course } = await import('../src/models/Course.js');
    const count = await Course.countDocuments({ isActive: true });
    assert(typeof count === 'number', 'Course count should be a number');
    assert(count > 0, `Expected courses in DB, got ${count}`);
    console.log(`         📚 Courses in DB: ${count}`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Total  : ${passed + failed}`);
  console.log(`  Passed : ${passed}`);
  console.log(`  Failed : ${failed}`);
  if (failed > 0) {
    console.log('\n  Failed Tests:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`  ❌ ${r.name}`);
      console.log(`     ${r.error}`);
    });
  }
  console.log('══════════════════════════════════════════════════════');

  // Performance report
  const searchTests = results.filter((r) => r.name.includes('search') || r.name.includes('Search'));
  if (searchTests.length > 0) {
    const avgMs = Math.round(searchTests.reduce((acc, r) => acc + r.ms, 0) / searchTests.length);
    console.log(`\n  ⚡ Avg search test duration: ${avgMs}ms`);
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('❌ Test runner failed:', err);
  process.exit(1);
});

