import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';

process.env.GEMINI_API_KEY = '';
process.env.FFCS_WAIT_TIMEOUT_MS = '3000';

const TEST_DB = `ffcs_test_${Date.now()}`;
const TEST_URI = `mongodb://127.0.0.1:27017/${TEST_DB}`;

const { default: CurriculumCourse } = await import('../src/models/CurriculumCourse.js');
const { default: CourseCatalog } = await import('../src/models/CourseCatalog.js');
const { default: UserCourse } = await import('../src/models/UserCourse.js');
const { default: CourseUpload } = await import('../src/models/CourseUpload.js');
const { ingestCurriculum } = await import('../src/services/curriculumIngestion.service.js');
const {
  listCurriculumCourses,
  searchCurriculumCourses,
  getCurriculumCourseById
} = await import('../src/services/curriculumSearch.service.js');
const {
  addCourseForUser,
  listUserCourses
} = await import('../src/services/ffcsCatalog.service.js');

const pdfPath = new URL('../circulam.pdf', import.meta.url);
const screenshotPath = path.join(os.tmpdir(), `ffcs-test-${Date.now()}.png`);
fs.writeFileSync(screenshotPath, Buffer.from('89504e470d0a1a0a', 'hex'));

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

try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  connected = true;

  await Promise.all([
    CurriculumCourse.syncIndexes(),
    CourseCatalog.syncIndexes(),
    UserCourse.syncIndexes(),
    CourseUpload.syncIndexes()
  ]);

  const buffer = fs.readFileSync(pdfPath);
  const version = 'test-v1';

  // TEST 1: curriculum PDF ingestion
  const first = await ingestCurriculum({
    buffer,
    fileName: 'curriculam.pdf',
    originalName: 'curriculam.pdf',
    mimeType: 'application/pdf',
    institution: 'VIT',
    curriculumVersion: version,
    uploadedBy: 'test'
  });

  assert.equal(first.success, true);
  assert.equal(first.imported, 113);
  assert.equal(first.inserted, 113);
  assert.equal(first.needsReview, 113, 'Every row is flagged because the PDF has no semester column');

  const second = await ingestCurriculum({
    buffer,
    fileName: 'curriculam.pdf',
    originalName: 'curriculam.pdf',
    mimeType: 'application/pdf',
    institution: 'VIT',
    curriculumVersion: version,
    uploadedBy: 'test'
  });

  assert.equal(second.inserted, 0, 'Repeated import must not create duplicates');
  assert.equal(second.imported, 113);
  assert.equal(await CurriculumCourse.countDocuments({ curriculumVersion: version }), 113);

  // TEST 2: initial listing and live search from MongoDB
  const firstPage = await listCurriculumCourses({ limit: 10, offset: 0 });
  assert.equal(firstPage.total, 113);
  assert.equal(firstPage.courses.length, 10);
  assert.equal(firstPage.hasMore, true);

  const secondPage = await listCurriculumCourses({ limit: 10, offset: 10 });
  assert.equal(secondPage.courses.length, 10);
  assert.equal(secondPage.hasMore, true);
  assert.equal(
    secondPage.courses.some((course) =>
      firstPage.courses.some((firstCourse) => firstCourse.courseId === course.courseId)
    ),
    false,
    'Pagination pages must not overlap'
  );

  const lastPage = await listCurriculumCourses({ limit: 10, offset: 110 });
  assert.equal(lastPage.courses.length, 3);
  assert.equal(lastPage.hasMore, false);

  const suggestions = await searchCurriculumCourses({ q: 'Data Str' });
  assert.ok(suggestions.some((course) => course.courseCode === 'CSE2002'));
  assert.ok(suggestions.length <= 10);

  const shortQuery = await listCurriculumCourses({ q: 'D' });
  assert.ok(shortQuery.total > 0, 'One-character queries must be allowed');
  assert.ok(shortQuery.courses.length <= 10);

  const lowerCaseCode = await listCurriculumCourses({ q: 'cse2002' });
  assert.ok(lowerCaseCode.courses.some((course) => course.courseCode === 'CSE2002'));

  const partialName = await listCurriculumCourses({ q: 'introduction' });
  assert.ok(partialName.total > 0);
  assert.ok(
    partialName.courses.every((course) =>
      /introduction/i.test(`${course.courseName} ${course.courseCode}`)
    )
  );

  const dataStructures = await CurriculumCourse.findOne({
    curriculumVersion: version,
    courseCode: 'CSE2002'
  }).lean();
  assert.ok(dataStructures);

  const detail = await getCurriculumCourseById(String(dataStructures._id));
  assert.equal(detail.courseCode, 'CSE2002');
  assert.equal(detail.semester, null);
  assert.equal(detail.needsReview, true);

  const cse3004 = await CurriculumCourse.findOne({
    curriculumVersion: version,
    courseCode: 'CSE3004'
  }).lean();

  // TEST 3 + TEST 4 setup: only semester 3 catalog is verified
  const semester3Catalog = await CourseCatalog.create({
    institution: 'VIT',
    courseCode: 'CSE2002',
    courseName: 'Data Structures and Algorithms',
    semester: 3,
    academicYear: '2026-27',
    curriculumVersion: version,
    curriculumCourseId: dataStructures._id,
    teachers: [
      {
        name: 'Teacher A',
        subject: 'Data Structures and Algorithms',
        schedule: [
          { day: 'Monday', startTime: '09:00', endTime: '10:00', room: 'Room 101' }
        ]
      }
    ],
    extractionStatus: 'completed',
    reviewStatus: 'verified',
    confidence: 0.95
  });

  // TEST 3: existing verified data reused, no Gemini needed
  const reuse = await addCourseForUser({
    userId: 'test-user-1',
    curriculumCourseId: String(dataStructures._id),
    semester: 3,
    academicYear: '2026-27',
    institution: 'VIT',
    curriculumVersion: version,
    files: [upload()]
  });

  assert.equal(reuse.reused, true);
  assert.equal(reuse.status, 'completed');
  assert.equal(reuse.catalog.teachers.length, 1);
  assert.equal(String(reuse.catalog._id), String(semester3Catalog._id));

  // TEST 4: different semester can never reuse semester 3 data
  await assert.rejects(
    () =>
      addCourseForUser({
        userId: 'test-user-1',
        curriculumCourseId: String(dataStructures._id),
        semester: 5,
        academicYear: '2026-27',
        institution: 'VIT',
        curriculumVersion: version,
        files: [upload()]
      }),
    (error) => {
      assert.equal(error.status, 503);
      assert.ok(['GEMINI_KEY_MISSING', 'GEMINI_NOT_CONFIGURED'].includes(error.code));
      return true;
    }
  );

  const semester5Catalog = await CourseCatalog.findOne({
    courseCode: 'CSE2002',
    semester: 5,
    academicYear: '2026-27',
    curriculumVersion: version
  }).lean();
  assert.ok(semester5Catalog, 'A separate semester-5 catalog record must exist');
  assert.equal(semester5Catalog.extractionStatus, 'failed');
  assert.equal(semester5Catalog.teachers.length, 0);

  const semester3After = await CourseCatalog.findById(semester3Catalog._id).lean();
  assert.equal(semester3After.teachers.length, 1, 'Semester 3 data must stay untouched');
  assert.equal(semester3After.teachers[0].name, 'Teacher A');

  // TEST 6: reject 4 screenshots
  await assert.rejects(
    () =>
      addCourseForUser({
        userId: 'test-user-1',
        curriculumCourseId: String(dataStructures._id),
        semester: 3,
        academicYear: '2026-27',
        institution: 'VIT',
        curriculumVersion: version,
        files: [upload(), upload(), upload(), upload()]
      }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'TOO_MANY_SCREENSHOTS');
      return true;
    }
  );

  // TEST 9: multiple courses remain associated with the user
  await CourseCatalog.create({
    institution: 'VIT',
    courseCode: 'CSE3004',
    courseName: 'Design and Analysis of Algorithms',
    semester: 3,
    academicYear: '2026-27',
    curriculumVersion: version,
    curriculumCourseId: cse3004._id,
    teachers: [
      {
        name: 'Teacher B',
        subject: 'Design and Analysis of Algorithms',
        schedule: [{ day: 'Tuesday', startTime: '10:00', endTime: '11:00', room: 'Room 202' }]
      }
    ],
    extractionStatus: 'completed',
    reviewStatus: 'verified'
  });

  await addCourseForUser({
    userId: 'test-user-1',
    curriculumCourseId: String(cse3004._id),
    semester: 3,
    academicYear: '2026-27',
    institution: 'VIT',
    curriculumVersion: version,
    files: [upload('second.png')]
  });

  const myCourses = await listUserCourses('test-user-1');
  assert.equal(myCourses.length, 3, 'Completed plus failed attempt records remain intact');
  const completedCourses = myCourses.filter((course) => course.catalog?.teachers?.length === 1);
  assert.equal(completedCourses.length, 2);
  assert.deepEqual(
    completedCourses.map((course) => course.courseCode).sort(),
    ['CSE2002', 'CSE3004']
  );

  // TEST 7: concurrent submissions for a brand-new identity create one catalog row
  const beforeConcurrent = await CourseCatalog.countDocuments({
    courseCode: 'CSE2002',
    semester: 7,
    academicYear: '2026-27',
    curriculumVersion: version
  });
  assert.equal(beforeConcurrent, 0);

  const results = await Promise.allSettled([
    addCourseForUser({
      userId: 'race-user-a',
      curriculumCourseId: String(dataStructures._id),
      semester: 7,
      academicYear: '2026-27',
      institution: 'VIT',
      curriculumVersion: version,
      files: [upload('race-a.png')]
    }),
    addCourseForUser({
      userId: 'race-user-b',
      curriculumCourseId: String(dataStructures._id),
      semester: 7,
      academicYear: '2026-27',
      institution: 'VIT',
      curriculumVersion: version,
      files: [upload('race-b.png')]
    })
  ]);

  assert.equal(results.filter((result) => result.status === 'rejected').length, 2);
  assert.equal(
    await CourseCatalog.countDocuments({
      courseCode: 'CSE2002',
      semester: 7,
      academicYear: '2026-27',
      curriculumVersion: version
    }),
    1,
    'Concurrent submissions must not create duplicate catalog records'
  );

  // TEST 8: incomplete/failed extraction is flagged, never completed
  const failedCourse = await UserCourse.findOne({
    userId: 'test-user-1',
    semester: 5
  }).lean();
  assert.equal(failedCourse.status, 'failed');

  console.log('FFCS DB integration test passed');
  console.log(`  curriculum courses: ${await CurriculumCourse.countDocuments()}`);
  console.log(`  user courses: ${await UserCourse.countDocuments()}`);
  console.log(`  uploads: ${await CourseUpload.countDocuments()}`);
} catch (error) {
  if (!connected) {
    console.warn('FFCS DB integration test skipped: local MongoDB is not reachable.');
    console.warn(error.message);
    process.exit(0);
  }
  throw error;
} finally {
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
