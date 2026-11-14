import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';

process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.FFCS_WAIT_TIMEOUT_MS = '8000';
process.env.FFCS_WAIT_INTERVAL_MS = '100';

const TEST_DB = `ffcs_gemini_test_${Date.now()}`;
const TEST_URI = `mongodb://127.0.0.1:27017/${TEST_DB}`;

const { default: CurriculumCourse } = await import('../src/models/CurriculumCourse.js');
const { default: CourseCatalog } = await import('../src/models/CourseCatalog.js');
const { default: UserCourse } = await import('../src/models/UserCourse.js');
const { default: app } = await import('../src/app.js');
const { addCourseForUser } = await import('../src/services/ffcsCatalog.service.js');

const pdfPath = new URL('../circulam.pdf', import.meta.url);
const screenshotPath = path.join(os.tmpdir(), `ffcs-gemini-${Date.now()}.png`);
fs.writeFileSync(screenshotPath, Buffer.from('89504e470d0a1a0a', 'hex'));

const originalFetch = global.fetch;
let geminiCalls = 0;
let nextHandler = null;

global.fetch = async (url, options) => {
  if (!String(url).includes('generativelanguage.googleapis.com')) {
    return originalFetch(url, options);
  }
  geminiCalls += 1;
  const handler = nextHandler;
  if (!handler) throw new Error('No Gemini mock handler configured');
  const { text, delay = 0, status = 200 } = await handler();
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (status !== 200) {
    return new Response(JSON.stringify({ error: { message: 'mock gemini failure' } }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

function geminiText(payload) {
  return JSON.stringify(payload);
}

function upload(name = 'teacher.png') {
  return {
    path: screenshotPath,
    originalname: name,
    filename: path.basename(screenshotPath),
    mimetype: 'image/png',
    size: fs.statSync(screenshotPath).size
  };
}

let connected = false;
let server;

try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  connected = true;
  await Promise.all([
    CurriculumCourse.syncIndexes(),
    CourseCatalog.syncIndexes(),
    UserCourse.syncIndexes()
  ]);

  await CurriculumCourse.create([
    {
      institution: 'VIT',
      curriculumVersion: 'gemini-test-v1',
      courseCode: 'CSE2002',
      courseName: 'Data Structures and Algorithms',
      normalizedCourseName: 'data structures and algorithms',
      credits: 4,
      category: 'Program Core',
      semester: null,
      isActive: true
    },
    {
      institution: 'VIT',
      curriculumVersion: 'gemini-test-v1',
      courseCode: 'CSE3004',
      courseName: 'Design and Analysis of Algorithms',
      normalizedCourseName: 'design and analysis of algorithms',
      credits: 4,
      category: 'Program Core',
      semester: null,
      isActive: true
    }
  ]);

  const dataStructures = await CurriculumCourse.findOne({ courseCode: 'CSE2002' }).lean();
  const algorithmDesign = await CurriculumCourse.findOne({ courseCode: 'CSE3004' }).lean();

  // TEST 1: full extraction is persisted as verified
  nextHandler = async () => ({
    text: geminiText({
      courseCode: 'CSE2002',
      courseName: 'Data Structures and Algorithms',
      semester: 3,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Teacher A',
          subject: 'Data Structures and Algorithms',
          schedule: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'Room 101' }]
        }
      ],
      confidence: 0.94
    })
  });

  const complete = await addCourseForUser({
    userId: 'gemini-user-1',
    curriculumCourseId: String(dataStructures._id),
    semester: 3,
    academicYear: '2026-27',
    institution: 'VIT',
    curriculumVersion: 'gemini-test-v1',
    files: [upload()]
  });

  assert.equal(complete.status, 'completed');
  assert.equal(complete.reused, false);
  assert.equal(complete.catalog.reviewStatus, 'verified');
  assert.equal(complete.catalog.teachers.length, 1);
  assert.equal(complete.catalog.teachers[0].name, 'Teacher A');
  assert.equal(complete.catalog.teachers[0].schedule[0].room, 'Room 101');
  assert.equal(geminiCalls, 1);

  // Re-submitting the same course reuses the stored result without calling Gemini
  const reused = await addCourseForUser({
    userId: 'gemini-user-1',
    curriculumCourseId: String(dataStructures._id),
    semester: 3,
    academicYear: '2026-27',
    institution: 'VIT',
    curriculumVersion: 'gemini-test-v1',
    files: [upload('again.png')]
  });
  assert.equal(reused.status, 'completed');
  assert.equal(reused.reused, true);
  assert.equal(geminiCalls, 1, 'A completed catalog must not trigger another Gemini call');

  // TEST 2: partial extraction merges schedules and is flagged for review
  nextHandler = async () => ({
    text: geminiText({
      courseCode: 'CSE3004',
      courseName: 'Design and Analysis of Algorithms',
      semester: 3,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Teacher B',
          subject: 'Design and Analysis of Algorithms',
          schedule: [
            { day: 'Tuesday', startTime: '10:00', endTime: '11:00', room: 'Room 202' },
            { day: 'Thursday', startTime: '14:00', endTime: '15:00', room: 'Room 203' }
          ]
        },
        {
          name: '',
          schedule: [{ day: 'Friday', startTime: '09:00', endTime: '10:00', room: 'Room 204' }]
        }
      ]
    })
  });

  const partial = await addCourseForUser({
    userId: 'gemini-user-1',
    curriculumCourseId: String(algorithmDesign._id),
    semester: 3,
    academicYear: '2026-27',
    institution: 'VIT',
    curriculumVersion: 'gemini-test-v1',
    files: [upload('partial.png')]
  });

  assert.equal(partial.status, 'needs_review');
  assert.equal(partial.catalog.reviewStatus, 'needs_review');
  assert.equal(partial.catalog.teachers.length, 1);
  assert.equal(partial.catalog.teachers[0].schedule.length, 2);
  assert.ok(partial.issues.includes('teacher_name_missing'));

  // TEST 3: malformed Gemini JSON fails the catalog without inventing data
  nextHandler = async () => ({ text: 'not valid json at all' });

  await assert.rejects(
    () =>
      addCourseForUser({
        userId: 'gemini-user-2',
        curriculumCourseId: String(dataStructures._id),
        semester: 5,
        academicYear: '2026-27',
        institution: 'VIT',
        curriculumVersion: 'gemini-test-v1',
        files: [upload('bad-json.png')]
      }),
    (error) => {
      assert.equal(error.code, 'GEMINI_INVALID_JSON');
      return true;
    }
  );

  const failedCatalog = await CourseCatalog.findOne({ courseCode: 'CSE2002', semester: 5 }).lean();
  assert.equal(failedCatalog.extractionStatus, 'failed');
  assert.notEqual(failedCatalog.reviewStatus, 'verified');
  assert.equal(failedCatalog.teachers.length, 0);

  // TEST 4: concurrent identical submissions share a single Gemini extraction
  const callsBeforeRace = geminiCalls;
  nextHandler = async () => ({
    delay: 400,
    text: geminiText({
      courseCode: 'CSE2002',
      courseName: 'Data Structures and Algorithms',
      semester: 7,
      academicYear: '2026-27',
      teachers: [
        {
          name: 'Teacher C',
          subject: 'Data Structures and Algorithms',
          schedule: [{ day: 'Wednesday', startTime: '11:00', endTime: '12:00', room: 'Room 301' }]
        }
      ],
      confidence: 0.9
    })
  });

  const [raceA, raceB] = await Promise.all([
    addCourseForUser({
      userId: 'race-a',
      curriculumCourseId: String(dataStructures._id),
      semester: 7,
      academicYear: '2026-27',
      institution: 'VIT',
      curriculumVersion: 'gemini-test-v1',
      files: [upload('race-a.png')]
    }),
    addCourseForUser({
      userId: 'race-b',
      curriculumCourseId: String(dataStructures._id),
      semester: 7,
      academicYear: '2026-27',
      institution: 'VIT',
      curriculumVersion: 'gemini-test-v1',
      files: [upload('race-b.png')]
    })
  ]);

  assert.equal(raceA.status, 'completed');
  assert.equal(raceB.status, 'completed');
  assert.equal(geminiCalls - callsBeforeRace, 1, 'Concurrent submissions must share one Gemini call');
  assert.equal(
    await CourseCatalog.countDocuments({ courseCode: 'CSE2002', semester: 7 }),
    1
  );

  // TEST 5: semester 3 and semester 5/7 data coexist independently
  assert.equal(await CourseCatalog.countDocuments({ courseCode: 'CSE2002', semester: 3 }), 1);
  assert.equal(await CourseCatalog.countDocuments({ courseCode: 'CSE2002', semester: 5 }), 1);
  assert.equal(await CourseCatalog.countDocuments({ courseCode: 'CSE2002', semester: 7 }), 1);

  const semester3 = await CourseCatalog.findOne({ courseCode: 'CSE2002', semester: 3 }).lean();
  assert.equal(semester3.teachers[0].name, 'Teacher A');

  // Small HTTP smoke test while the server is up
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const listResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/courses`);
  assert.equal(listResponse.status, 401);

  console.log('FFCS extraction flow test passed');
  console.log(`  Gemini mock calls: ${geminiCalls}`);
} catch (error) {
  if (!connected) {
    console.warn('FFCS extraction flow test skipped: local MongoDB is not reachable.');
    console.warn(error.message);
    process.exit(0);
  }
  throw error;
} finally {
  global.fetch = originalFetch;
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  try {
    fs.unlinkSync(screenshotPath);
  } catch {
    // ignore
  }
}