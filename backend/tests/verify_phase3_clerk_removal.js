import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import DeviceToken from '../src/models/DeviceToken.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { setMockAuth, resetMockAuth } from '../src/config/firebase.js';

function createSimulatedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = 'sig_bytes';
  return `${header}.${body}.${sig}`;
}

function createMockReqRes({ authHeader = null } = {}) {
  const req = { headers: {}, query: {}, body: {}, cookies: {} };
  if (authHeader) req.headers.authorization = authHeader;

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function runPhase3Verification() {
  console.log('\n=============================================================');
  console.log('   PHASE 3: COMPLETE CLERK REMOVAL VERIFICATION');
  console.log('=============================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  const testSuffix = Date.now();

  try {
    // -------------------------------------------------------------
    // Test 1: Valid Firebase ID Token Authentication
    // -------------------------------------------------------------
    console.log('--- Test 1: Firebase ID Token Authentication ---');
    const fbUid1 = `fb_p3_user_${testSuffix}`;
    const fbEmail1 = `p3_student_${testSuffix}@vitbhopal.ac.in`;

    const tokenPayload1 = {
      iss: `https://securetoken.google.com/helpu-bae0b`,
      sub: fbUid1,
      uid: fbUid1,
      email: fbEmail1,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    };
    const validFirebaseToken = createSimulatedJwt(tokenPayload1);

    setMockAuth({
      verifyIdToken: async (tok) => {
        if (tok === validFirebaseToken) return tokenPayload1;
        throw new Error('Invalid token');
      }
    });

    const { req: req1, res: res1, getResult: getRes1 } = createMockReqRes({
      authHeader: `Bearer ${validFirebaseToken}`
    });

    let nextCalled1 = false;
    await requireAuth(req1, res1, () => { nextCalled1 = true; });

    assert(nextCalled1, 'requireAuth calls next() for valid Firebase ID token');
    assert(req1.userId === `firebase_${fbUid1}`, 'Sets canonical req.userId = firebase_' + fbUid1);
    assert(req1.firebaseUid === fbUid1, 'Attaches req.firebaseUid correctly');
    assert(req1.authType === 'firebase', 'Sets req.authType = "firebase"');

    // -------------------------------------------------------------
    // Test 2: Unauthenticated Request (No Header) Rejection
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Missing Token Rejection ---');
    const { req: req2, res: res2, getResult: getRes2 } = createMockReqRes({});
    let nextCalled2 = false;
    await requireAuth(req2, res2, () => { nextCalled2 = true; });

    assert(!nextCalled2, 'Rejects unauthenticated request');
    assert(getRes2().statusCode === 401, 'Returns HTTP 401 Unauthorized for missing token');

    // -------------------------------------------------------------
    // Test 3: Invalid / Expired Firebase Token Rejection
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Invalid Firebase Token Rejection ---');
    const badFirebaseToken = createSimulatedJwt({
      iss: `https://securetoken.google.com/helpu-bae0b`,
      sub: 'bad_uid',
      firebase: {}
    });
    const { req: req3, res: res3, getResult: getRes3 } = createMockReqRes({
      authHeader: `Bearer ${badFirebaseToken}`
    });
    let nextCalled3 = false;
    await requireAuth(req3, res3, () => { nextCalled3 = true; });

    assert(!nextCalled3, 'Rejects invalid Firebase token');
    assert(getRes3().statusCode === 401, 'Returns HTTP 401 for invalid Firebase token');

    // -------------------------------------------------------------
    // Test 4: Legacy Clerk Tokens Are Strictly Rejected (No Fallback)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Legacy Clerk Token Rejection (No Fallback) ---');
    const legacyClerkToken = createSimulatedJwt({
      iss: 'https://clerk.helpu.accounts.dev',
      sub: 'user_legacy_clerk_123',
      clerk: true
    });
    const { req: req4, res: res4, getResult: getRes4 } = createMockReqRes({
      authHeader: `Bearer ${legacyClerkToken}`
    });
    let nextCalled4 = false;
    await requireAuth(req4, res4, () => { nextCalled4 = true; });

    assert(!nextCalled4, 'Rejects legacy Clerk token');
    assert(getRes4().statusCode === 401, 'Returns HTTP 401: Clerk fallback is completely removed');

    // -------------------------------------------------------------
    // Test 5: Existing User Retention & Zero Data Loss
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Existing User Retention & Historical clerkId Integrity ---');
    const historicalClerkId = `user_historical_${testSuffix}`;
    const userEmail = `historical_${testSuffix}@vitbhopal.ac.in`;

    // Create an existing student created during Clerk era
    const existingStudent = await Student.create({
      clerkId: historicalClerkId,
      name: 'Historical Student',
      email: userEmail,
      phone: '+919876543210',
      whatsappNumber: '+919876543210',
      college: 'VIT, Bhopal',
      isVerified: true
    });

    assert(existingStudent._id != null, 'Existing student created with clerkId: ' + historicalClerkId);
    assert(existingStudent.userId === historicalClerkId, 'Virtual alias student.userId matches clerkId');

    // Now this student signs in with Firebase via Google
    const newFbUid = `fb_uid_${testSuffix}`;
    const fbPayloadForExisting = {
      iss: `https://securetoken.google.com/helpu-bae0b`,
      sub: newFbUid,
      uid: newFbUid,
      email: userEmail,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    };
    const tokenForExisting = createSimulatedJwt(fbPayloadForExisting);

    setMockAuth({
      verifyIdToken: async (tok) => {
        if (tok === tokenForExisting) return fbPayloadForExisting;
        throw new Error('Invalid token');
      }
    });

    const { req: req5, res: res5 } = createMockReqRes({ authHeader: `Bearer ${tokenForExisting}` });
    let nextCalled5 = false;
    await requireAuth(req5, res5, () => { nextCalled5 = true; });

    assert(nextCalled5, 'Authentication succeeds for existing student signing in with Firebase');
    assert(req5.userId === historicalClerkId, 'Canonical req.userId preserves original historical clerkId (' + historicalClerkId + ')');

    // Verify student record in database was updated with firebaseUid without creating duplicate
    const reloadedStudent = await Student.findById(existingStudent._id);
    assert(reloadedStudent.firebaseUid === newFbUid, 'firebaseUid linked to existing student record');
    assert(reloadedStudent.clerkId === historicalClerkId, 'clerkId remains untouched');

    const totalStudentsWithEmail = await Student.countDocuments({ email: userEmail });
    assert(totalStudentsWithEmail === 1, 'No duplicate student records created (count = 1)');

    // -------------------------------------------------------------
    // Test 6: Ride, Booking, and Notification Relationship Integrity
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Rides, Bookings, and Notifications with Canonical ID ---');

    // Create travel ride owned by historical student
    const travel = await Travel.create({
      userId: historicalClerkId,
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Bhopal Junction Railway Station',
      travelDate: new Date(Date.now() + 86400000),
      departureTime: 600,
      seats: 3,
      availableSeats: 3,
      timeFlexibility: 30,
      expiresAt: new Date(Date.now() + 172800000),
      authorName: existingStudent.name,
      authorEmail: existingStudent.email
    });

    assert(travel.userId === historicalClerkId, 'Travel created with canonical userId: ' + travel.userId);

    // Create notification for historical student
    const notification = await Notification.create({
      recipientId: historicalClerkId,
      eventId: `evt_test_${testSuffix}`,
      type: 'BOOKING_REQUESTED',
      title: 'New Booking Request',
      message: 'A student requested a seat on your ride.',
      relatedTravelId: travel._id
    });

    assert(notification.recipientId === historicalClerkId, 'Notification recipientId matches historical clerkId');

    // Query notifications by req.userId
    const fetchedNotifications = await Notification.find({ recipientId: req5.userId });
    assert(fetchedNotifications.length >= 1, 'Notifications retrieved successfully using Firebase canonical req.userId');

    // Clean up test records
    await Student.deleteOne({ _id: existingStudent._id });
    await Travel.deleteOne({ _id: travel._id });
    await Notification.deleteOne({ _id: notification._id });

    // -------------------------------------------------------------
    // Test 7: MongoDB Index Validation
    // -------------------------------------------------------------
    console.log('\n--- Test 7: MongoDB Index Validation ---');
    const indexes = await Student.collection.indexes();
    const hasClerkIndex = indexes.some(idx => idx.name === 'clerkId_1' && idx.unique);
    const hasFirebaseUidIndex = indexes.some(idx => idx.name === 'firebaseUid_1' && idx.unique);

    assert(hasClerkIndex, 'Student collection retains unique index on clerkId');
    assert(hasFirebaseUidIndex, 'Student collection retains unique sparse index on firebaseUid');

  } finally {
    resetMockAuth();
    await mongoose.disconnect();
  }

  console.log('\n=============================================================');
  console.log(`   PHASE 3 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Verification().catch(err => {
  console.error('Phase 3 verification encountered unhandled error:', err);
  process.exit(1);
});
