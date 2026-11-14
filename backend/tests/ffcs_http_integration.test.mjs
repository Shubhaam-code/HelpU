import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

process.env.ADMIN_API_KEY = 'ffcs-test-admin-key';
process.env.GEMINI_API_KEY = '';

const TEST_DB = `ffcs_http_test_${Date.now()}`;
const TEST_URI = process.env.TEST_MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;

const { default: CurriculumCourse } = await import('../src/models/CurriculumCourse.js');
const { default: app } = await import('../src/app.js');

const pdfPath = new URL('../circulam.pdf', import.meta.url);
const pdfBuffer = fs.readFileSync(pdfPath);

let connected = false;
let server;

try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  connected = true;
  await CurriculumCourse.syncIndexes();

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Admin curriculum upload through real HTTP multipart handling
  const form = new FormData();
  form.append('curriculum', new Blob([pdfBuffer], { type: 'application/pdf' }), 'curriculam.pdf');
  form.append('curriculumVersion', 'http-test-v1');
  form.append('institution', 'VIT');

  const uploadResponse = await fetch(`${baseUrl}/api/admin/curriculum/upload`, {
    method: 'POST',
    headers: { 'x-admin-key': 'ffcs-test-admin-key' },
    body: form
  });
  const uploadBody = await uploadResponse.json();
  assert.equal(uploadResponse.status, 200, JSON.stringify(uploadBody));
  assert.equal(uploadBody.success, true);
  assert.equal(uploadBody.imported, 113);
  assert.equal(uploadBody.inserted, 113);

  // Admin endpoint must reject a wrong key
  const forbiddenForm = new FormData();
  forbiddenForm.append('curriculum', new Blob([pdfBuffer], { type: 'application/pdf' }), 'curriculam.pdf');
  const forbidden = await fetch(`${baseUrl}/api/admin/curriculum/upload`, {
    method: 'POST',
    headers: { 'x-admin-key': 'wrong-key' },
    body: forbiddenForm
  });
  assert.equal(forbidden.status, 401);

  // Public initial listing with pagination metadata
  const listingResponse = await fetch(`${baseUrl}/api/curriculum/courses?limit=10&offset=0`);
  const listBody = await listingResponse.json();
  assert.equal(listingResponse.status, 200);
  assert.equal(listBody.success, true);
  assert.equal(listBody.total, 113);
  assert.equal(listBody.count, 10);
  assert.equal(listBody.hasMore, true);
  assert.equal(listBody.courses.length, 10);

  const shortQueryResponse = await fetch(`${baseUrl}/api/curriculum/courses?q=D&limit=10`);
  const shortQueryBody = await shortQueryResponse.json();
  assert.equal(shortQueryResponse.status, 200);
  assert.ok(shortQueryBody.total > 0, 'One-character searches must return matches');

  // Public autocomplete
  const searchResponse = await fetch(
    `${baseUrl}/api/curriculum/courses/search?q=Data%20Str&limit=5`
  );
  const searchBody = await searchResponse.json();
  assert.equal(searchResponse.status, 200);
  assert.equal(searchBody.success, true);
  assert.ok(searchBody.courses.some((course) => course.courseCode === 'CSE2002'));

  const courseId = searchBody.courses.find((course) => course.courseCode === 'CSE2002').courseId;
  const detailResponse = await fetch(`${baseUrl}/api/curriculum/courses/${courseId}`);
  const detailBody = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailBody.course.semester, null);
  assert.equal(detailBody.course.needsReview, true);

  // Protected routes reject unauthenticated requests
  const listResponse = await fetch(`${baseUrl}/api/courses`);
  assert.equal(listResponse.status, 401);

  const addResponse = await fetch(`${baseUrl}/api/courses/add`, {
    method: 'POST',
    body: new FormData()
  });
  assert.equal(addResponse.status, 401);

  console.log('FFCS HTTP integration test passed');
} catch (error) {
  if (!connected) {
    console.warn('FFCS HTTP integration test skipped: local MongoDB is not reachable.');
    console.warn(error.message);
    process.exit(0);
  }
  throw error;
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
