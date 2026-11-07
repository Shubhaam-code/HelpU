import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Travel from '../src/models/Travel.js';
import { findMatchesForTravel } from '../src/services/matching.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('=== RUNNING MATCHING ENGINE DB INTEGRATION TESTS ===\n');
  await mongoose.connect(process.env.MONGO_URI);

  const testUserA = 'test_student_a_' + Date.now();
  const testUserB = 'test_student_b_' + Date.now();
  const testUserC = 'test_student_c_' + Date.now();

  const now = new Date();
  const futureExpires = new Date(Date.now() + 86400000 * 5);
  const pastExpires = new Date(Date.now() - 3600000);

  const cleanupIds = [];

  try {
    // Student A creates an OFFER on 7 Nov from Patna to Gaya
    const [offerA] = await Travel.create([{
      userId: testUserA,
      type: 'offer',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 480, // 8:00 AM
      timeFlexibility: 30,
      seats: 3,
      bookedSeats: 0,
      pricePerSeat: 350,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(offerA._id);

    // Scenario 1: Same route + Same date (7 Nov) from Student B -> MUST MATCH
    const [requestB_sameDate] = await Travel.create([{
      userId: testUserB,
      type: 'request',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 500, // 8:20 AM (within 420 mins)
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(requestB_sameDate._id);

    // Scenario 2: Same route + Different date (9 Nov) from Student C -> MUST NEVER MATCH
    const [requestC_diffDate] = await Travel.create([{
      userId: testUserC,
      type: 'request',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-09T00:00:00.000Z'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(requestC_diffDate._id);

    // Scenario 3: Different destination (Patna to Ranchi) -> MUST NOT MATCH
    const [request_diffDest] = await Travel.create([{
      userId: 'test_student_diff_dest',
      type: 'request',
      source: 'Patna',
      destination: 'Ranchi',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(request_diffDest._id);

    // Scenario 4: Different origin (Muzaffarpur to Gaya) -> MUST NOT MATCH
    const [request_diffOrig] = await Travel.create([{
      userId: 'test_student_diff_orig',
      type: 'request',
      source: 'Muzaffarpur',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(request_diffOrig._id);

    // Scenario 5: Time difference outside limit (> 420 mins, e.g. 11:30 PM = 1410 mins vs 480 mins) -> MUST NOT MATCH
    const [request_diffTime] = await Travel.create([{
      userId: 'test_student_diff_time',
      type: 'request',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 1410, // 930 mins difference > 420
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(request_diffTime._id);

    // Scenario 6: Same user's post -> MUST NEVER MATCH
    const [ownPost] = await Travel.create([{
      userId: testUserA,
      type: 'request',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(ownPost._id);

    // Scenario 7: Inactive post (status: 'cancelled') -> MUST NOT MATCH
    const [inactivePost] = await Travel.create([{
      userId: 'test_student_inactive',
      type: 'request',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'cancelled',
      expiresAt: futureExpires
    }]);
    cleanupIds.push(inactivePost._id);

    // Scenario 8: Expired post (expiresAt in past) -> MUST NOT MATCH
    const [expiredPost] = await Travel.create([{
      userId: 'test_student_expired',
      type: 'request',
      source: 'Patna',
      destination: 'Gaya',
      travelDate: new Date('2026-11-07T00:00:00.000Z'),
      departureTime: 480,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: pastExpires
    }]);
    cleanupIds.push(expiredPost._id);

    // RUN MATCHING FOR OFFER A
    const matchesForA = await findMatchesForTravel(offerA);
    const matchIds = matchesForA.map(m => m._id.toString());

    console.log(`findMatchesForTravel returned ${matchesForA.length} match(es) for Student A (7 Nov).`);

    assert(matchIds.includes(requestB_sameDate._id.toString()), 'Scenario 1: Same route + Same date is MATCHED');
    assert(!matchIds.includes(requestC_diffDate._id.toString()), 'Scenario 2: Same route + Different date (9 Nov vs 7 Nov) is NOT MATCHED');
    assert(!matchIds.includes(request_diffDest._id.toString()), 'Scenario 3: Different destination is NOT MATCHED');
    assert(!matchIds.includes(request_diffOrig._id.toString()), 'Scenario 4: Different origin is NOT MATCHED');
    assert(!matchIds.includes(request_diffTime._id.toString()), 'Scenario 5: Time difference outside limit is NOT MATCHED');
    assert(!matchIds.includes(ownPost._id.toString()), 'Scenario 6: User cannot match with own post');
    assert(!matchIds.includes(inactivePost._id.toString()), 'Scenario 7: Inactive post is NOT MATCHED');
    assert(!matchIds.includes(expiredPost._id.toString()), 'Scenario 8: Expired post is NOT MATCHED');

    // Scenario 9: Request + Request must NEVER match
    const matchesForRequestB = await findMatchesForTravel(requestB_sameDate);
    const requestMatchIds = matchesForRequestB.map(m => m._id.toString());
    assert(requestMatchIds.includes(offerA._id.toString()), 'Request matches Offer post');
    assert(!requestMatchIds.includes(requestC_diffDate._id.toString()), 'Request + Request NEVER matches');

  } finally {
    // Clean up all temporary test posts
    await Travel.deleteMany({ _id: { $in: cleanupIds } });
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`DB TEST TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL 9 MATCHING REGRESSION SCENARIOS PASSED WITH LIVE DB!\n');
  }
}

run().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});

