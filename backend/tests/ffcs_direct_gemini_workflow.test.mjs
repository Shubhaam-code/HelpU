import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.FFCS_WAIT_TIMEOUT_MS = '5000';
process.env.FFCS_WAIT_INTERVAL_MS = '50';

const TEST_DB = `ffcs_direct_workflow_test_${Date.now()}`;
const TEST_URI = `mongodb://127.0.0.1:27017/${TEST_DB}`;

const { default: CurriculumCourse } = await import('../src/models/CurriculumCourse.js');
const { default: CourseCatalog } = await import('../src/models/CourseCatalog.js');
const { default: UserCourse } = await import('../src/models/UserCourse.js');
const { default: CourseUpload } = await import('../src/models/CourseUpload.js');
const { addCourseForUser } = await import('../src/services/ffcsCatalog.service.js');

let geminiCalls = 0;
let lastReceivedImages = [];
let mockGeminiHandler = null;

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  if (!String(url).includes('generativelanguage.googleapis.com')) {
    return originalFetch(url, options);
  }
  geminiCalls++;
  const body = JSON.parse(options.body || '{}');
  const parts = body?.contents?.[0]?.parts || [];
  lastReceivedImages = parts
    .filter((p) => p.inlineData)
    .map((p) => ({
      mimeType: p.inlineData.mimeType,
      dataLength: p.inlineData.data?.length || 0,
      buffer: Buffer.from(p.inlineData.data || '', 'base64')
    }));

  if (mockGeminiHandler) {
    const result = await mockGeminiHandler(parts);
    if (result.status && result.status !== 200) {
      return new Response(JSON.stringify({ error: { message: result.message || 'Gemini error' } }), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result.payload) }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  throw new Error('No mockGeminiHandler defined');
};

function makeMemoryFile(name, size = 100) {
  const buf = Buffer.alloc(size, 0x42);
  return {
    originalname: name,
    mimetype: 'image/png',
    size: buf.length,
    buffer: buf
  };
}

try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([
    CurriculumCourse.syncIndexes(),
    CourseCatalog.syncIndexes(),
    UserCourse.syncIndexes(),
    CourseUpload.syncIndexes()
  ]);

  const courseDoc = await CurriculumCourse.create({
    institution: 'VIT',
    curriculumVersion: '2024-2025',
    courseCode: 'CSE2003',
    courseName: 'Data Structures',
    normalizedCourseName: 'data structures',
    credits: 3,
    category: 'Programme Core',
    semester: null,
    isActive: true
  });

  const courseId = String(courseDoc._id);

  // 1. SETUP MOCK GEMINI PAYLOAD
  mockGeminiHandler = async () => ({
    payload: {
      courseCode: 'CSE2003',
      courseName: 'Data Structures',
      semester: 3,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Prof. Gemini Instructor',
          subject: 'Data Structures',
          schedule: [
            { day: 'Monday', startTime: '09:00', endTime: '09:50', room: 'SJT-101' },
            { day: 'Wednesday', startTime: '10:00', endTime: '10:50', room: 'SJT-101' }
          ]
        }
      ]
    }
  });

  // TEST 2, 4: MongoDB missing -> Gemini receives actual uploaded image bytes (1 screenshot)
  geminiCalls = 0;
  const res1 = await addCourseForUser({
    userId: 'user-direct-1',
    curriculumCourseId: courseId,
    semester: 3,
    academicYear: '2026-27',
    files: [makeMemoryFile('screenshot1.png', 256)]
  });

  assert.equal(res1.status, 'completed');
  assert.equal(res1.reused, false, 'Expected fresh Gemini extraction');
  assert.equal(geminiCalls, 1, 'Gemini must be called when MongoDB has no record');
  assert.equal(lastReceivedImages.length, 1, 'Gemini must receive 1 image');
  assert.equal(lastReceivedImages[0].mimeType, 'image/png');
  assert.equal(lastReceivedImages[0].buffer.length, 256, 'Gemini must receive actual bytes');
  assert.equal(res1.catalog.teachers.length, 1);
  assert.equal(res1.catalog.teachers[0].name, 'Prof. Gemini Instructor');

  // TEST 7, 8 & 1: Next matching request -> MongoDB match: fetch teachers without Gemini
  const callsBeforeReuse = geminiCalls;
  const res2 = await addCourseForUser({
    userId: 'user-direct-2',
    curriculumCourseId: courseId,
    semester: 3,
    academicYear: '2026-27',
    files: [makeMemoryFile('different.png', 512)]
  });

  assert.equal(res2.status, 'completed');
  assert.equal(res2.reused, true, 'Expected MongoDB reuse');
  assert.equal(geminiCalls, callsBeforeReuse, 'Gemini must NOT be called on MongoDB match');
  assert.equal(res2.catalog.teachers.length, 1);
  assert.equal(res2.catalog.teachers[0].name, 'Prof. Gemini Instructor');

  // TEST 9: Wrong semester -> never reuse old teacher data
  mockGeminiHandler = async () => ({
    payload: {
      courseCode: 'CSE2003',
      courseName: 'Data Structures',
      semester: 4,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Prof. Semester Four Teacher',
          subject: 'Data Structures',
          schedule: [{ day: 'Tuesday', startTime: '11:00', endTime: '11:50', room: 'TT-201' }]
        }
      ]
    }
  });

  const resSem4 = await addCourseForUser({
    userId: 'user-direct-1',
    curriculumCourseId: courseId,
    semester: 4, // Different semester!
    academicYear: '2026-27',
    files: [makeMemoryFile('sem4.png', 300)]
  });

  assert.equal(resSem4.status, 'completed');
  assert.equal(resSem4.reused, false, 'Different semester must not reuse old semester data');
  assert.equal(resSem4.catalog.semester, 4);
  assert.equal(resSem4.catalog.teachers[0].name, 'Prof. Semester Four Teacher');

  // TEST 3: MongoDB record with empty teachers: Gemini fallback triggers
  // Create an empty catalog record
  await CourseCatalog.deleteMany({ courseCode: 'CSE2003', semester: 5 });
  await CourseCatalog.create({
    institution: 'VIT',
    curriculumVersion: '2024-2025',
    courseCode: 'CSE2003',
    courseName: 'Data Structures',
    semester: 5,
    academicYear: '2026-27',
    teachers: [], // Empty teachers!
    extractionStatus: 'needs_review',
    reviewStatus: 'unverified'
  });

  mockGeminiHandler = async () => ({
    payload: {
      courseCode: 'CSE2003',
      courseName: 'Data Structures',
      semester: 5,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Prof. Recovered From Empty',
          subject: 'Data Structures',
          schedule: [{ day: 'Friday', startTime: '14:00', endTime: '15:00', room: 'MB-101' }]
        }
      ]
    }
  });

  const resEmptyFallback = await addCourseForUser({
    userId: 'user-direct-3',
    curriculumCourseId: courseId,
    semester: 5,
    academicYear: '2026-27',
    files: [makeMemoryFile('empty_fallback.png', 400)]
  });

  assert.equal(resEmptyFallback.status, 'completed');
  assert.equal(resEmptyFallback.reused, false, 'Empty teachers in MongoDB must trigger Gemini fallback');
  assert.equal(resEmptyFallback.catalog.teachers[0].name, 'Prof. Recovered From Empty');

  // TEST 5: Three screenshots -> all processed together
  mockGeminiHandler = async () => ({
    payload: {
      courseCode: 'CSE2003',
      courseName: 'Data Structures',
      semester: 6,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Prof. Multi Screenshot',
          subject: 'Data Structures',
          schedule: [{ day: 'Thursday', startTime: '08:00', endTime: '09:00', room: 'SJT-301' }]
        }
      ]
    }
  });

  const res3Screenshots = await addCourseForUser({
    userId: 'user-direct-4',
    curriculumCourseId: courseId,
    semester: 6,
    academicYear: '2026-27',
    files: [
      makeMemoryFile('shot1.png', 100),
      makeMemoryFile('shot2.png', 200),
      makeMemoryFile('shot3.png', 300)
    ]
  });

  assert.equal(res3Screenshots.status, 'completed');
  assert.equal(lastReceivedImages.length, 3, 'All 3 screenshots must be sent to Gemini');
  assert.equal(lastReceivedImages[0].buffer.length, 100);
  assert.equal(lastReceivedImages[1].buffer.length, 200);
  assert.equal(lastReceivedImages[2].buffer.length, 300);

  // TEST 10: Gemini failure -> display meaningful error
  mockGeminiHandler = async () => ({
    status: 500,
    message: 'Quota exceeded or upstream error'
  });

  await assert.rejects(
    () =>
      addCourseForUser({
        userId: 'user-direct-5',
        curriculumCourseId: courseId,
        semester: 7,
        academicYear: '2026-27',
        files: [makeMemoryFile('fail.png', 100)]
      }),
    (err) => {
      assert.ok(err.message.includes('Quota exceeded') || err.message.includes('upstream error') || err.message.includes('failed'));
      return true;
    }
  );

  // TEST 11: Missing GEMINI_API_KEY when MongoDB has no teachers -> 503 error, never zero teachers
  const savedKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () =>
        addCourseForUser({
          userId: 'user-direct-no-key',
          curriculumCourseId: courseId,
          semester: 8,
          academicYear: '2026-27',
          files: [makeMemoryFile('nokey.png', 100)]
        }),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'GEMINI_KEY_MISSING');
        assert.ok(err.message.includes('GEMINI_API_KEY is missing'));
        return true;
      }
    );
  } finally {
    process.env.GEMINI_API_KEY = savedKey;
  }

  // TEST 12: Normalized courseName lookup (case-insensitive) matches in MongoDB without calling Gemini
  const callsBeforeNameMatch = geminiCalls;
  const anotherCurriculumCourse = await CurriculumCourse.create({
    institution: 'VIT',
    curriculumVersion: '2024-2025',
    courseCode: 'CSE2003X',
    courseName: 'DATA STRUCTURES', // Uppercase variation
    normalizedCourseName: 'data structures',
    credits: 3,
    category: 'Programme Core',
    semester: null,
    isActive: true
  });

  const resNameMatch = await addCourseForUser({
    userId: 'user-direct-case-insensitive',
    curriculumCourseId: String(anotherCurriculumCourse._id),
    semester: 3,
    academicYear: '2026-27',
    files: [makeMemoryFile('name_match.png', 100)]
  });

  assert.equal(resNameMatch.status, 'completed');
  assert.equal(resNameMatch.reused, true, 'Case-insensitive courseName in MongoDB must match');
  assert.equal(geminiCalls, callsBeforeNameMatch, 'Gemini must NOT be called when matching by normalized courseName');
  assert.equal(resNameMatch.catalog.teachers.length, 1);
  assert.equal(resNameMatch.catalog.teachers[0].name, 'Prof. Gemini Instructor');

  console.log('ALL 12 DIRECT GEMINI IMAGE WORKFLOW TESTS PASSED!');
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

