import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import app from '../src/app.js';
import Course from '../src/models/Course.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function runTests() {
  console.log('🧪 Starting SlotMate Course API & Catalogue Tests...\n');

  await connectDB();

  const totalInDb = await Course.countDocuments();
  console.log(`📊 Total courses currently in DB: ${totalInDb}`);

  if (totalInDb !== 113) {
    throw new Error(`Expected 113 courses in DB, found ${totalInDb}`);
  }

  // Start test express server on an ephemeral port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/slotmate`;

  console.log(`🌐 Test server listening on port ${port}\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Search by name query: q=data
    // -------------------------------------------------------------
    console.log('--- Test 1: GET /api/slotmate/courses?q=data ---');
    const res1 = await fetch(`${baseUrl}/courses?q=data`);
    const json1 = await res1.json();
    console.log(`Status: ${res1.status}, Count: ${json1.count}`);
    console.log('Sample Results:');
    json1.data.slice(0, 3).forEach(c => console.log(` - [${c.courseCode}] ${c.courseName} (${c.category}, ${c.credits} credits)`));

    if (!json1.success || json1.count === 0) throw new Error('Test 1 failed: Expected matches for "data"');
    if (json1.count > 10) throw new Error('Test 1 failed: Expected max 10 results');
    
    // Check fields
    const sample = json1.data[0];
    if (!sample.id || !sample.courseCode || !sample.courseName || !sample.category || typeof sample.credits !== 'number') {
      throw new Error('Test 1 failed: Missing required fields on course object');
    }
    console.log('✅ Test 1 Passed.\n');

    // -------------------------------------------------------------
    // Test 2: Search by course code: q=cse2
    // -------------------------------------------------------------
    console.log('--- Test 2: GET /api/slotmate/courses?q=cse2 ---');
    const res2 = await fetch(`${baseUrl}/courses?q=cse2`);
    const json2 = await res2.json();
    console.log(`Status: ${res2.status}, Count: ${json2.count}`);
    json2.data.forEach(c => console.log(` - [${c.courseCode}] ${c.courseName}`));

    if (!json2.success || json2.count === 0) throw new Error('Test 2 failed: Expected matches for code "cse2"');
    const allStartWithCSE2 = json2.data.every(c => c.courseCode.toLowerCase().includes('cse2'));
    if (!allStartWithCSE2) throw new Error('Test 2 failed: Non-matching course code returned');
    console.log('✅ Test 2 Passed.\n');

    // -------------------------------------------------------------
    // Test 3: Empty query (default list)
    // -------------------------------------------------------------
    console.log('--- Test 3: GET /api/slotmate/courses (empty query) ---');
    const res3 = await fetch(`${baseUrl}/courses`);
    const json3 = await res3.json();
    console.log(`Status: ${res3.status}, Count: ${json3.count}`);
    if (!json3.success || json3.count !== 10) throw new Error(`Test 3 failed: Expected 10 default courses, got ${json3.count}`);
    console.log('✅ Test 3 Passed.\n');

    // -------------------------------------------------------------
    // Test 4: Custom limit: limit=5
    // -------------------------------------------------------------
    console.log('--- Test 4: GET /api/slotmate/courses?limit=5 ---');
    const res4 = await fetch(`${baseUrl}/courses?limit=5`);
    const json4 = await res4.json();
    console.log(`Status: ${res4.status}, Count: ${json4.count}`);
    if (!json4.success || json4.count !== 5) throw new Error(`Test 4 failed: Expected 5 courses, got ${json4.count}`);
    console.log('✅ Test 4 Passed.\n');

    // -------------------------------------------------------------
    // Test 5: Non-existent query
    // -------------------------------------------------------------
    console.log('--- Test 5: GET /api/slotmate/courses?q=nonexistent123xyz ---');
    const res5 = await fetch(`${baseUrl}/courses?q=nonexistent123xyz`);
    const json5 = await res5.json();
    console.log(`Status: ${res5.status}, Count: ${json5.count}`);
    if (!json5.success || json5.count !== 0 || json5.data.length !== 0) {
      throw new Error('Test 5 failed: Expected 0 matches for nonexistent query');
    }
    console.log('✅ Test 5 Passed.\n');

    // -------------------------------------------------------------
    // Test 6: Verify PoolMate API root endpoint integrity
    // -------------------------------------------------------------
    console.log('--- Test 6: Root API health check ---');
    const res6 = await fetch(`http://127.0.0.1:${port}/`);
    const json6 = await res6.json();
    console.log(`Status: ${res6.status}, Message: "${json6.message}"`);
    if (!json6.success || json6.message !== 'CampusPool API is running') {
      throw new Error('Test 6 failed: PoolMate root API altered');
    }
    console.log('✅ Test 6 Passed (PoolMate integrity verified).\n');

    console.log('🎉 ALL 6 TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    server.close();
    await mongoose.disconnect();
    console.log('🔒 Test server and DB closed.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

