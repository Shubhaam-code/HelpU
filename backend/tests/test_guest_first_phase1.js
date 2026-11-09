import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import app from '../src/app.js';
import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import SlotPost from '../src/models/SlotPost.js';
import Course from '../src/models/Course.js';
import { setMockAuth, resetMockAuth } from '../src/config/firebase.js';
import { setSharedRedisClient, getSharedRedisClient } from '../src/config/redis.js';
import { resolveAuthIdentity } from '../src/middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

function createMockRedisClient() {
  const store = new Map();
  return {
    status: 'ready',
    store,
    get: async (key) => store.get(key) || null,
    set: async (key, val, exFlag, ttlSeconds, nxFlag) => {
      if (nxFlag === 'NX' && store.has(key)) {
        return null; // Not acquired
      }
      store.set(key, val);
      return 'OK';
    },
    del: async (key) => {
      store.delete(key);
      return 1;
    }
  };
}

async function runGuestFirstPhase1Tests() {
  console.log('====================================================');
  console.log('  HELPU GUEST-FIRST PHASE 1: BACKEND TEST SUITE     ');
  console.log('====================================================\n');

  await connectDB();

  // Spin up test server on ephemeral port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Test server listening on http://127.0.0.1:${port}\n`);

  const mockRedis = createMockRedisClient();
  setSharedRedisClient(mockRedis);

  const timestamp = Date.now();
  const testEmail = `student_auth_${timestamp}@vitbhopal.ac.in`;
  const legacyClerkId = `user_clerk_legacy_${timestamp}`;
  const verifiedFirebaseUid = `firebase_uid_${timestamp}`;

  // Configure Mock Firebase Auth
  const tokens = {
    validUser: 'valid_bearer_token_user_1',
    legacyUser: 'valid_bearer_token_legacy_user',
    unverifiedUser: 'token_unverified_email',
    conflictingUser: 'token_uid_conflict',
    newUser1: 'token_new_user_concurrent_1'
  };

  setMockAuth({
    verifyIdToken: async (token) => {
      if (token === tokens.validUser) {
        return {
          uid: verifiedFirebaseUid,
          email: testEmail,
          email_verified: true,
          name: 'Verified Student',
          picture: 'https://example.com/pic.png'
        };
      }
      if (token === tokens.legacyUser) {
        return {
          uid: `fb_legacy_${timestamp}`,
          email: `legacy_${timestamp}@vitbhopal.ac.in`,
          email_verified: true,
          name: 'Legacy Student'
        };
      }
      if (token === tokens.unverifiedUser) {
        return {
          uid: `fb_unverified_${timestamp}`,
          email: `unverified_${timestamp}@vitbhopal.ac.in`,
          email_verified: false,
          name: 'Unverified Student'
        };
      }
      if (token === tokens.conflictingUser) {
        return {
          uid: `fb_intruder_${timestamp}`,
          email: testEmail, // Trying to claim testEmail with a different UID
          email_verified: true,
          name: 'Intruder'
        };
      }
      if (token === tokens.newUser1) {
        return {
          uid: `fb_concurrent_${timestamp}`,
          email: `concurrent_${timestamp}@vitbhopal.ac.in`,
          email_verified: true,
          name: 'Concurrent Student'
        };
      }
      throw new Error('Firebase ID token has invalid signature or has expired');
    }
  });

  // Seed sample data for tests
  console.log('--- SETUP: Seeding test records ---');
  const seededLegacyStudent = await Student.create({
    clerkId: legacyClerkId,
    name: 'Legacy Student',
    email: `legacy_${timestamp}@vitbhopal.ac.in`,
    phone: '+919999988888',
    whatsappNumber: '+919999988888',
    registrationNumber: '21BCE10001',
    college: 'VIT, Bhopal',
    isVerified: true
  });

  const seededTravel = await Travel.create({
    userId: legacyClerkId,
    type: 'offer',
    source: 'Bhopal Railway Station',
    destination: 'VIT Campus',
    travelDate: new Date(Date.now() + 86400000),
    departureTime: 600,
    timeFlexibility: 30,
    seats: 3,
    pricePerSeat: 150,
    authorName: 'Legacy Student',
    authorEmail: `legacy_${timestamp}@vitbhopal.ac.in`,
    authorPhone: '+919999988888',
    status: 'active',
    expiresAt: new Date(Date.now() + 86400000)
  });

  const seededCourse = await Course.findOne().lean();
  let seededSlotPost = null;
  if (seededCourse) {
    seededSlotPost = await SlotPost.create({
      userId: legacyClerkId,
      courseId: seededCourse._id,
      courseCode: seededCourse.courseCode,
      courseName: seededCourse.courseName,
      slot: 'A1+TA1',
      teacherName: 'Dr. Test Professor',
      additionalNotes: 'Looking for study buddy',
      status: 'active'
    });
  }

  console.log(`✓ Seeded Legacy Student (${legacyClerkId})`);
  console.log(`✓ Seeded Travel Post (${seededTravel._id})`);
  if (seededSlotPost) console.log(`✓ Seeded Slot Post (${seededSlotPost._id})`);
  console.log('');

  try {
    // -------------------------------------------------------------
    // TEST 1: Guest can access allowed public feeds
    // -------------------------------------------------------------
    console.log('--- TEST 1: Guest can access allowed public feeds ---');
    const res1a = await fetch(`${baseUrl}/api/travels`);
    const json1a = await res1a.json();
    assert.strictEqual(res1a.status, 200, 'GET /api/travels must return 200 for guest');
    assert.strictEqual(json1a.success, true);
    assert.strictEqual(json1a.isGuest, true, 'isGuest flag must be true');
    console.log(`✓ GET /api/travels returned 200 with ${json1a.count} public rides`);

    const res1b = await fetch(`${baseUrl}/api/slotmate/courses?q=data`);
    const json1b = await res1b.json();
    assert.strictEqual(res1b.status, 200, 'GET /api/slotmate/courses must return 200');
    assert.strictEqual(json1b.success, true);
    console.log(`✓ GET /api/slotmate/courses returned 200 with ${json1b.count} courses`);

    const res1c = await fetch(`${baseUrl}/api/slotmate/posts`);
    const json1c = await res1c.json();
    assert.strictEqual(res1c.status, 200, 'GET /api/slotmate/posts must return 200 for guest');
    assert.strictEqual(json1c.success, true);
    assert.strictEqual(json1c.isGuest, true);
    console.log(`✓ GET /api/slotmate/posts returned 200 with ${json1c.count} slot posts\n`);

    // -------------------------------------------------------------
    // TEST 2: Guest cannot access protected actions
    // -------------------------------------------------------------
    console.log('--- TEST 2: Guest cannot access protected actions ---');
    const res2a = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'VIT', destination: 'Station', travelDate: '2026-11-20', seats: 2 })
    });
    assert.strictEqual(res2a.status, 401, 'Guest POST /api/travels must return 401');
    console.log('✓ Guest POST /api/travels blocked with 401 Unauthorized');

    const res2b = await fetch(`${baseUrl}/api/slotmate/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'A1', teacherName: 'Dr. Test' })
    });
    assert.strictEqual(res2b.status, 401, 'Guest POST /api/slotmate/posts must return 401');
    console.log('✓ Guest POST /api/slotmate/posts blocked with 401 Unauthorized');

    const res2c = await fetch(`${baseUrl}/api/bookings/my`);
    assert.strictEqual(res2c.status, 401, 'Guest GET /api/bookings/my must return 401');
    console.log('✓ Guest GET /api/bookings/my blocked with 401 Unauthorized\n');

    // -------------------------------------------------------------
    // TEST 3: Invalid authentication cannot grant access
    // -------------------------------------------------------------
    console.log('--- TEST 3: Invalid authentication cannot grant access ---');
    const res3a = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: 'Bearer totally_invalid_token_xyz' }
    });
    assert.strictEqual(res3a.status, 401, 'Invalid token must reject with 401 on optionalAuth route');
    console.log('✓ Invalid Bearer token on GET /api/travels returned 401 (not silently degraded to guest)');

    const res3b = await fetch(`${baseUrl}/api/slotmate/posts`, {
      headers: { Authorization: 'Bearer malformed_token_123' }
    });
    assert.strictEqual(res3b.status, 401, 'Invalid token must reject with 401 on optionalAuth route');
    console.log('✓ Invalid Bearer token on GET /api/slotmate/posts returned 401\n');

    // -------------------------------------------------------------
    // TEST 4: Public responses never contain private contact information
    // -------------------------------------------------------------
    console.log('--- TEST 4: Public responses never contain private contact information ---');
    const res4a = await fetch(`${baseUrl}/api/travels`);
    const json4a = await res4a.json();
    for (const item of json4a.data) {
      assert.strictEqual(item.phone, null, 'Public ride item.phone must be null');
      assert.strictEqual(item.authorPhone, null, 'Public ride item.authorPhone must be null');
      assert.strictEqual(item.authorEmail, null, 'Public ride item.authorEmail must be null');
      assert.strictEqual(item.student.phone, null, 'Public ride student.phone must be null');
      assert.strictEqual(item.student.email, null, 'Public ride student.email must be null');
      assert.strictEqual(item.student.whatsappNumber, null, 'Public ride student.whatsappNumber must be null');
      assert.strictEqual(item.student.registrationNumber, null, 'Public ride student.registrationNumber must be null');
    }
    console.log('✓ Verified: GET /api/travels strictly redacted all phone, WhatsApp, email, and registration numbers');

    const res4b = await fetch(`${baseUrl}/api/travels/${seededTravel._id}`);
    const json4b = await res4b.json();
    assert.strictEqual(res4b.status, 200);
    assert.strictEqual(json4b.data.phone, null, 'Public single travel.phone must be null');
    assert.strictEqual(json4b.data.authorPhone, null, 'Public single travel.authorPhone must be null');
    assert.strictEqual(json4b.data.authorEmail, null, 'Public single travel.authorEmail must be null');
    assert.strictEqual(json4b.data.student.phone, null, 'Public single student.phone must be null');
    assert.strictEqual(json4b.data.student.email, null, 'Public single student.email must be null');
    console.log('✓ Verified: GET /api/travels/:id strictly redacted private contacts for guest');

    const res4c = await fetch(`${baseUrl}/api/slotmate/posts`);
    const json4c = await res4c.json();
    for (const post of json4c.posts) {
      assert.strictEqual(post.phone, null, 'Public slot post.phone must be null');
      assert.strictEqual(post.whatsappNumber, null, 'Public slot post.whatsappNumber must be null');
      assert.strictEqual(post.studentEmail, null, 'Public slot post.studentEmail must be null');
      assert.strictEqual(post.student.phone, null, 'Public slot student.phone must be null');
      assert.strictEqual(post.student.whatsappNumber, null, 'Public slot student.whatsappNumber must be null');
    }
    console.log('✓ Verified: GET /api/slotmate/posts strictly redacted all contact info\n');

    // -------------------------------------------------------------
    // TEST 5: Authenticated users retain existing access
    // -------------------------------------------------------------
    console.log('--- TEST 5: Authenticated users retain existing access ---');
    const res5a = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: `Bearer ${tokens.validUser}` }
    });
    const json5a = await res5a.json();
    assert.strictEqual(res5a.status, 200);
    assert.strictEqual(json5a.success, true);
    assert.strictEqual(json5a.hasPostedTravel, false, 'Authenticated matching logic active');
    console.log('✓ Authenticated user calling GET /api/travels runs matching engine successfully');

    const res5b = await fetch(`${baseUrl}/api/slotmate/posts/my`, {
      headers: { Authorization: `Bearer ${tokens.validUser}` }
    });
    const json5b = await res5b.json();
    assert.strictEqual(res5b.status, 200);
    assert.strictEqual(json5b.success, true);
    console.log('✓ Authenticated user calling GET /api/slotmate/posts/my successfully retrieved their posts\n');

    // -------------------------------------------------------------
    // TEST 6: SlotMate match endpoints remain protected
    // -------------------------------------------------------------
    console.log('--- TEST 6: SlotMate match endpoints remain protected ---');
    const res6a = await fetch(`${baseUrl}/api/slotmate/matches/my`);
    assert.strictEqual(res6a.status, 401, 'GET /api/slotmate/matches/my must require auth');
    console.log('✓ GET /api/slotmate/matches/my rejected guest with 401');

    const fakePostId = new mongoose.Types.ObjectId().toString();
    const res6b = await fetch(`${baseUrl}/api/slotmate/posts/${fakePostId}/matches`);
    assert.strictEqual(res6b.status, 401, 'GET /api/slotmate/posts/:postId/matches must require auth');
    console.log('✓ GET /api/slotmate/posts/:postId/matches rejected guest with 401');

    const res6c = await fetch(`${baseUrl}/api/slotmate/matches/${fakePostId}`);
    assert.strictEqual(res6c.status, 401, 'GET /api/slotmate/matches/:matchId must require auth');
    console.log('✓ GET /api/slotmate/matches/:matchId rejected guest with 401\n');

    // -------------------------------------------------------------
    // TEST 7: Repeated idempotency key does not create duplicate writes
    // -------------------------------------------------------------
    console.log('--- TEST 7: Repeated idempotency key does not create duplicate writes ---');
    const testIdempotencyKey = `idem_key_test_${Date.now()}`;
    const initialTravelCount = await Travel.countDocuments({ source: 'Idempotency Source' });

    // Request 1
    const res7a = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.validUser}`,
        'Idempotency-Key': testIdempotencyKey
      },
      body: JSON.stringify({
        type: 'offer',
        source: 'Idempotency Source',
        destination: 'Idempotency Destination',
        travelDate: '2026-11-25',
        departureTime: 840,
        seats: 2,
        pricePerSeat: 200
      })
    });
    const json7a = await res7a.json();
    assert.strictEqual(res7a.status, 201, 'Initial request with Idempotency-Key must succeed with 201');
    const travelIdCreated = json7a.data?._id;

    // Request 2 with same Idempotency-Key
    const res7b = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.validUser}`,
        'Idempotency-Key': testIdempotencyKey
      },
      body: JSON.stringify({
        type: 'offer',
        source: 'Idempotency Source',
        destination: 'Idempotency Destination',
        travelDate: '2026-11-25',
        departureTime: 840,
        seats: 2,
        pricePerSeat: 200
      })
    });
    const json7b = await res7b.json();
    assert.strictEqual(res7b.status, 201, 'Repeated request must return cached 201');
    assert.strictEqual(res7b.headers.get('idempotency-replay'), 'true', 'Must include Idempotency-Replay header');
    assert.strictEqual(json7b.data?._id, travelIdCreated, 'Replayed body must match original');

    const finalTravelCount = await Travel.countDocuments({ source: 'Idempotency Source' });
    assert.strictEqual(finalTravelCount, initialTravelCount + 1, 'Only 1 travel post must exist in MongoDB');
    console.log('✓ Verified: Second identical request replayed cached response with Idempotency-Replay: true without creating duplicates\n');

    // -------------------------------------------------------------
    // TEST 8: Simultaneous duplicate requests are handled safely
    // -------------------------------------------------------------
    console.log('--- TEST 8: Simultaneous duplicate requests are handled safely ---');
    const conflictKey = `idem_conflict_key_${Date.now()}`;

    // Pre-seed in-flight state in Redis to simulate concurrent arrival
    const inFlightKey = `helpu:idempotency:firebase_${verifiedFirebaseUid}:POST:/api/travels:${conflictKey}`;
    await mockRedis.set(inFlightKey, JSON.stringify({ status: 'IN_FLIGHT', createdAt: Date.now() }), 'EX', 30);

    const res8 = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.validUser}`,
        'Idempotency-Key': conflictKey
      },
      body: JSON.stringify({ type: 'offer', source: 'Concurrent Source', destination: 'Station', travelDate: '2026-11-25', departureTime: 840, seats: 1 })
    });
    const json8 = await res8.json();
    assert.strictEqual(res8.status, 409, 'Simultaneous request while IN_FLIGHT must return 409 Conflict');
    assert.strictEqual(json8.success, false);
    console.log(`✓ Concurrent duplicate request safely rejected with 409 Conflict: "${json8.message}"\n`);

    // Clean up mock lock
    await mockRedis.del(inFlightKey);

    // -------------------------------------------------------------
    // TEST 9: Redis outage fails safely on critical idempotent writes
    // -------------------------------------------------------------
    console.log('--- TEST 9: Redis outage fails safely on critical idempotent writes ---');
    // Simulate Redis outage
    setSharedRedisClient({ status: 'close' });

    const res9 = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.validUser}`,
        'Idempotency-Key': `outage_test_key_${Date.now()}`
      },
      body: JSON.stringify({ source: 'A', destination: 'B', travelDate: '2026-11-25', seats: 1 })
    });
    assert.strictEqual(res9.status, 503, 'During Redis outage, critical write must return 503 Service Unavailable');
    const json9 = await res9.json();
    assert.strictEqual(json9.success, false);
    console.log(`✓ Redis outage handled safely: returned 503 without application crash: "${json9.message}"\n`);

    // Restore Redis mock
    setSharedRedisClient(mockRedis);

    // -------------------------------------------------------------
    // TEST 10: Existing Firebase UID conflict returns a safe error
    // -------------------------------------------------------------
    console.log('--- TEST 10: Existing Firebase UID conflict returns a safe error ---');
    // tokens.conflictingUser has testEmail (already linked to verifiedFirebaseUid), but token has fb_intruder
    const conflictResult = await resolveAuthIdentity(tokens.conflictingUser);
    assert.strictEqual(conflictResult.success, false, 'Conflicting UID must fail');
    assert.strictEqual(conflictResult.status, 409, 'Must return status 409 Conflict');
    console.log(`✓ Account linking with conflicting Firebase UID rejected with 409: "${conflictResult.message}"\n`);

    // -------------------------------------------------------------
    // TEST 11: Unverified email cannot claim an existing Student
    // -------------------------------------------------------------
    console.log('--- TEST 11: Unverified email cannot claim an existing Student ---');
    const unverifiedResult = await resolveAuthIdentity(tokens.unverifiedUser);
    assert.strictEqual(unverifiedResult.success, false, 'Unverified email must fail');
    assert.strictEqual(unverifiedResult.status, 403, 'Must return 403 Forbidden');
    console.log(`✓ Unverified email rejected with 403 Forbidden: "${unverifiedResult.message}"\n`);

    // -------------------------------------------------------------
    // TEST 12: Legacy Clerk ID remains unchanged
    // -------------------------------------------------------------
    console.log('--- TEST 12: Legacy Clerk ID remains unchanged ---');
    const legacyResult = await resolveAuthIdentity(tokens.legacyUser);
    assert.strictEqual(legacyResult.success, true);
    assert.strictEqual(legacyResult.user.userId, legacyClerkId, 'Canonical userId must remain legacy clerkId');

    const updatedLegacyStudent = await Student.findOne({ clerkId: legacyClerkId });
    assert.strictEqual(updatedLegacyStudent.registrationNumber, '21BCE10001', 'Registration number must not be overwritten');
    assert.strictEqual(updatedLegacyStudent.college, 'VIT, Bhopal', 'College must not be overwritten');
    assert.strictEqual(updatedLegacyStudent.phone, '+919999988888', 'Phone must not be overwritten');
    console.log(`✓ Verified: Student with legacy Clerk ID retained canonical userId="${legacyResult.user.userId}" and all profile details\n`);

    // -------------------------------------------------------------
    // TEST 13: Concurrent first-time login does not create duplicate Student records
    // -------------------------------------------------------------
    console.log('--- TEST 13: Concurrent first-time login does not create duplicate Student records ---');
    const [c1, c2, c3] = await Promise.all([
      resolveAuthIdentity(tokens.newUser1),
      resolveAuthIdentity(tokens.newUser1),
      resolveAuthIdentity(tokens.newUser1)
    ]);
    assert.strictEqual(c1.success, true);
    assert.strictEqual(c2.success, true);
    assert.strictEqual(c3.success, true);

    const studentRecords = await Student.find({ email: `concurrent_${timestamp}@vitbhopal.ac.in` });
    assert.strictEqual(studentRecords.length, 1, 'Exactly 1 Student record must be created despite 3 concurrent logins');
    console.log(`✓ Verified: 3 concurrent first-time logins resolved to the single unique Student record (${studentRecords[0]._id})\n`);

    console.log('====================================================');
    console.log('  ALL 13 TESTS PASSED SUCCESSFULLY!                 ');
    console.log('====================================================');
  } finally {
    // Teardown
    resetMockAuth();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runGuestFirstPhase1Tests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});

