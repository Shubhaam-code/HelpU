import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Course from '../src/models/Course.js';
import SlotPost from '../src/models/SlotPost.js';
import Student from '../src/models/Student.js';
import {
  createSlotPost,
  updateSlotPost,
  getMySlotPosts,
  getMatchesForPost,
  getMatchDetails,
  countMatchesForPost
} from '../src/services/slotMatching.service.js';

async function runTests() {
  console.log('🧪 Starting SlotMate Deep Matching Verification Suite...');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB Atlas');

  try {
    // 1. Verify Catalogue Courses
    const cse2001 = await Course.findOne({ courseCode: 'CSE2001' });
    const mat2003 = await Course.findOne({ courseCode: 'MAT2003' });

    if (!cse2001 || !mat2003) {
      throw new Error('Required catalogue courses (CSE2001, MAT2003) not found in DB');
    }
    console.log(` Found Catalogue Courses: ${cse2001.courseCode} and ${mat2003.courseCode}`);

    // Setup 4 unique test student IDs
    const userA = 'test_usr_a_' + Date.now();
    const userB = 'test_usr_b_' + Date.now();
    const userC = 'test_usr_c_' + Date.now();
    const userD = 'test_usr_d_' + Date.now();

    await Student.create([
      {
        clerkId: userA,
        firebaseUid: userA,
        name: 'Aarav Patel',
        email: 'aarav@test.edu',
        phone: '9876543210',
        whatsappNumber: '9876543210',
        college: 'VIT Vellore',
        isVerified: true
      },
      {
        clerkId: userB,
        firebaseUid: userB,
        name: 'Priya Sharma',
        email: 'priya@test.edu',
        phone: '9876543211',
        whatsappNumber: '9876543211',
        college: 'VIT Vellore',
        isVerified: true
      },
      {
        clerkId: userC,
        firebaseUid: userC,
        name: 'Rohan Iyer',
        email: 'rohan@test.edu',
        phone: '9876543212',
        whatsappNumber: '9876543212',
        college: 'VIT Vellore',
        isVerified: true
      },
      {
        clerkId: userD,
        firebaseUid: userD,
        name: 'Neha Verma',
        email: 'neha@test.edu',
        phone: '9876543213',
        whatsappNumber: '9876543213',
        college: 'VIT Vellore',
        isVerified: true
      }
    ]);
    console.log(' Set up test student profiles in MongoDB');

    // -------------------------------------------------------------------------
    // TEST 1: Same Course Code + Same Slot + Different Teachers = MATCH FOUND
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Same Course + Same Slot + Different Teachers ---');
    const postA1 = await createSlotPost({
      userId: userA,
      courseId: cse2001._id,
      courseCode: 'cse2001', // lowercase test
      slot: 'b11', // lowercase test
      teacherName: 'Dr. Rajesh Sharma',
      additionalNotes: 'Need assignment study partner'
    });

    const postB1 = await createSlotPost({
      userId: userB,
      courseId: cse2001._id,
      courseCode: 'CSE2001',
      slot: 'B11',
      teacherName: 'Dr. Amit Verma', // DIFFERENT TEACHER
      additionalNotes: 'Looking for peer for quiz prep'
    });

    const countA1 = await countMatchesForPost(postA1.post);
    const countB1 = await countMatchesForPost(postB1.post);
    console.log(`Student A Matches: ${countA1} (expected: 1), Student B Matches: ${countB1} (expected: 1)`);
    if (countA1 !== 1 || countB1 !== 1) {
      throw new Error(`Test 1 Failed: Different teachers should match! Got A=${countA1}, B=${countB1}`);
    }
    console.log('✅ TEST 1 PASSED: Different teachers matched successfully!');

    // -------------------------------------------------------------------------
    // TEST 2: Same Course + Different Slot = NO MATCH
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Same Course + Different Slot ---');
    const postC1 = await createSlotPost({
      userId: userC,
      courseId: cse2001._id,
      courseCode: 'CSE2001',
      slot: 'C11', // DIFFERENT SLOT
      teacherName: 'Dr. Rajesh Sharma'
    });
    const matchesC1 = await countMatchesForPost(postC1.post);
    console.log(`Student C Matches (Different Slot C11 vs B11): ${matchesC1} (expected: 0)`);
    if (matchesC1 !== 0) {
      throw new Error(`Test 2 Failed: Different slot should not match! Got ${matchesC1}`);
    }
    console.log('✅ TEST 2 PASSED: Different slots correctly did not match!');

    // -------------------------------------------------------------------------
    // TEST 3: Different Course + Same Slot = NO MATCH
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Different Course + Same Slot ---');
    const postD1 = await createSlotPost({
      userId: userD,
      courseId: mat2003._id,
      courseCode: 'MAT2003', // DIFFERENT COURSE
      slot: 'B11',
      teacherName: 'Dr. Rajesh Sharma'
    });
    const matchesD1 = await countMatchesForPost(postD1.post);
    console.log(`Student D Matches (Different Course MAT2003 vs CSE2001): ${matchesD1} (expected: 0)`);
    if (matchesD1 !== 0) {
      throw new Error(`Test 3 Failed: Different courses should not match! Got ${matchesD1}`);
    }
    console.log('✅ TEST 3 PASSED: Different courses correctly did not match!');

    // -------------------------------------------------------------------------
    // TEST 4: Same Course + Same Slot + Same Teacher = MATCH
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Same Course + Same Slot + Same Teacher ---');
    const postC2 = await createSlotPost({
      userId: userC,
      courseId: mat2003._id,
      courseCode: 'MAT2003',
      slot: 'B11',
      teacherName: 'Dr. Rajesh Sharma' // SAME TEACHER AS POST D1
    });
    const matchesForD1 = await countMatchesForPost(postD1.post);
    const matchesForC2 = await countMatchesForPost(postC2.post);
    console.log(`Student D Matches: ${matchesForD1} (expected: 1), Student C Matches: ${matchesForC2} (expected: 1)`);
    if (matchesForD1 !== 1 || matchesForC2 !== 1) {
      throw new Error(`Test 4 Failed: Same teacher should match! Got D=${matchesForD1}, C=${matchesForC2}`);
    }
    console.log('✅ TEST 4 PASSED: Same teacher matches successfully!');

    // -------------------------------------------------------------------------
    // TEST 5: Same User Creating Two Posts = NO SELF MATCH
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Same User Creating Multiple Posts (No Self Match) ---');
    const postA2 = await createSlotPost({
      userId: userA, // SAME USER AS POST A1
      courseId: mat2003._id,
      courseCode: 'MAT2003',
      slot: 'D11',
      teacherName: 'Dr. Rajesh Sharma'
    });
    const matchesForA1AfterA2 = await getMatchesForPost(postA1.post._id, userA);
    const matchedUserIdsA = matchesForA1AfterA2.matches.map(m => m.userId);
    console.log(`Student A post matches user IDs:`, matchedUserIdsA);
    if (matchedUserIdsA.includes(userA) || matchedUserIdsA.includes(`firebase_${userA}`)) {
      throw new Error('Test 5 Failed: User matched with their own post!');
    }
    console.log('✅ TEST 5 PASSED: Self-matching completely prevented!');

    // -------------------------------------------------------------------------
    // TEST 6: Bidirectional Matching Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Bidirectional Matching ---');
    const matchesA = await getMatchesForPost(postA1.post._id, userA);
    const matchesB = await getMatchesForPost(postB1.post._id, userB);
    const aSeesB = matchesA.matches.some(m => m.userId === userB || m.userId === `firebase_${userB}`);
    const bSeesA = matchesB.matches.some(m => m.userId === userA || m.userId === `firebase_${userA}`);
    console.log(`Student A sees Student B: ${aSeesB}, Student B sees Student A: ${bSeesA}`);
    if (!aSeesB || !bSeesA) {
      throw new Error(`Test 6 Failed: Bidirectional matching broken! A->B: ${aSeesB}, B->A: ${bSeesA}`);
    }
    console.log('✅ TEST 6 PASSED: Bidirectional matching verified!');

    // -------------------------------------------------------------------------
    // TEST 7: Multi-Slot Overlap & Token Matching
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Multi-Slot Overlap (e.g. C12, C13 matching C11, C12) ---');
    const postA_Multi = await createSlotPost({
      userId: userA,
      courseId: cse2001._id,
      courseCode: 'CSE2001',
      slot: 'C11, C12', // HAS C12
      teacherName: 'Dr. A'
    });
    const postB_Multi = await createSlotPost({
      userId: userB,
      courseId: cse2001._id,
      courseCode: 'CSE2001',
      slot: 'C12, C13', // ALSO HAS C12
      teacherName: 'Dr. B'
    });
    const multiCountA = await countMatchesForPost(postA_Multi.post);
    const multiCountB = await countMatchesForPost(postB_Multi.post);
    console.log(`Multi-slot post A matches: ${multiCountA} (expected: 1), post B: ${multiCountB} (expected: 1)`);
    if (multiCountA < 1 || multiCountB < 1) {
      throw new Error(`Test 7 Failed: Overlapping slots should match! Got A=${multiCountA}, B=${multiCountB}`);
    }
    console.log('✅ TEST 7 PASSED: Overlapping slot tokens matched perfectly!');

    // -------------------------------------------------------------------------
    // TEST 8: Repeated API Requests Must Not Create Duplicate Matches
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Repeated API Requests / Duplicate Match Prevention ---');
    const req1 = await getMatchesForPost(postA1.post._id, userA);
    const req2 = await getMatchesForPost(postA1.post._id, userA);
    const matchIds1 = req1.matches.map(m => m.matchId.toString());
    const matchIds2 = req2.matches.map(m => m.matchId.toString());
    const isDistinct1 = new Set(matchIds1).size === matchIds1.length;
    const isDistinct2 = new Set(matchIds2).size === matchIds2.length;
    if (!isDistinct1 || !isDistinct2 || req1.matches.length !== req2.matches.length) {
      throw new Error('Test 8 Failed: Duplicate matches detected in result list!');
    }
    console.log(`Repeated calls returned same exact count: ${req1.matches.length} without duplicates.`);
    console.log('✅ TEST 8 PASSED: Idempotent match retrieval verified!');

    // -------------------------------------------------------------------------
    // TEST 9: Deleted / Closed Posts Must Not Appear in Matches
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Inactive / Closed Posts Filtered ---');
    await SlotPost.updateOne({ _id: postB1.post._id }, { $set: { status: 'closed' } });
    const countA1AfterClose = await countMatchesForPost(postA1.post);
    console.log(`Student A matches after Student B closed post: ${countA1AfterClose} (expected: 0)`);
    if (countA1AfterClose !== 0) {
      throw new Error('Test 9 Failed: Closed post was still included in matches!');
    }
    console.log('✅ TEST 9 PASSED: Inactive posts properly excluded from matches!');

    // Clean up test data
    await SlotPost.deleteMany({
      userId: { $in: [userA, userB, userC, userD, `firebase_${userA}`, `firebase_${userB}`, `firebase_${userC}`, `firebase_${userD}`] }
    });
    await Student.deleteMany({
      clerkId: { $in: [userA, userB, userC, userD] }
    });
    console.log(' Cleaned up test data');

    console.log('\n🎉 ALL SLOTMATE MATCHING ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
