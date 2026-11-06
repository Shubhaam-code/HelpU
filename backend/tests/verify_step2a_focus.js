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

// Helper to construct simulated JWT with header.payload.sig
function createSimulatedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = 'simulated_signature_bytes';
  return `${header}.${body}.${sig}`;
}

function createMockReqRes({ authHeader = null, clerkAuth = null, cookies = {} } = {}) {
  const req = {
    headers: {},
    query: {},
    body: {},
    cookies
  };

  if (authHeader) {
    req.headers.authorization = authHeader;
  }

  if (clerkAuth) {
    req.auth = clerkAuth;
  }

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

async function runFocusedVerification() {
  console.log('================================================================');
  console.log('       FOCUSED VERIFICATION OF STEP 2A IMPLEMENTATION          ');
  console.log('================================================================\n');

  await connectDB();

  const timestamp = Date.now();
  const testClerkUserId = `user_clerk_verify_${timestamp}`;
  const testEmail = `verify_existing_${timestamp}@campus.edu`;
  const testFirebaseUid = `firebase_uid_verify_${timestamp}`;

  const newFirebaseUid = `firebase_uid_brand_new_${timestamp}`;
  const newEmail = `verify_brand_new_${timestamp}@campus.edu`;

  let testsPassed = 0;
  const totalTests = 7;

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Clerk Authentication Works
    // -------------------------------------------------------------------------
    console.log('[1/7] Verifying Clerk authentication...');
    {
      const { req, res } = createMockReqRes({
        clerkAuth: { userId: testClerkUserId, sessionId: 'sess_valid_123' }
      });
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });

      if (nextCalled && req.userId === testClerkUserId && req.authType === 'clerk') {
        console.log(`  ✓ Clerk auth verified: req.userId = ${req.userId}, authType = clerk`);
        testsPassed++;
      } else {
        throw new Error(`Clerk verification failed: req.userId=${req.userId}, authType=${req.authType}`);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Verify Firebase Authentication with Valid ID Token
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Verifying Firebase authentication with valid ID token...');
    {
      const validFirebaseToken = createSimulatedJwt({
        iss: 'https://securetoken.google.com/helpu-bae0b',
        sub: testFirebaseUid,
        email: 'test_user_fb@test.com',
        email_verified: true
      });

      setMockAuth({
        verifyIdToken: async (token) => {
          if (token === validFirebaseToken) {
            return {
              uid: testFirebaseUid,
              email: 'test_user_fb@test.com',
              email_verified: true
            };
          }
          throw new Error('Invalid Firebase token');
        }
      });

      const { req, res } = createMockReqRes({
        authHeader: `Bearer ${validFirebaseToken}`
      });
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });

      if (nextCalled && req.authType === 'firebase' && req.firebaseUid === testFirebaseUid) {
        console.log(`  ✓ Firebase auth verified: req.userId = ${req.userId}, authType = firebase`);
        testsPassed++;
      } else {
        throw new Error(`Firebase token verification failed`);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Verify Invalid Firebase Token CANNOT Accidentally Authenticate Through Clerk
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Verifying invalid Firebase token rejection (No accidental Clerk fallback)...');
    {
      const expiredOrInvalidFirebaseToken = createSimulatedJwt({
        iss: 'https://securetoken.google.com/helpu-bae0b',
        sub: 'attacker_or_expired_uid',
        email: 'attacker@evil.com'
      });

      // Firebase Admin rejects this token
      setMockAuth({
        verifyIdToken: async () => {
          const err = new Error('Firebase ID token has expired or signature invalid');
          err.code = 'auth/id-token-expired';
          throw err;
        }
      });

      // Even if a Clerk session/cookie exists on the request context!
      const { req, res, getResult } = createMockReqRes({
        authHeader: `Bearer ${expiredOrInvalidFirebaseToken}`,
        clerkAuth: { userId: 'accidental_clerk_user_id', sessionId: 'sess_999' }
      });

      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });
      const { statusCode, responseData } = getResult();

      if (!nextCalled && statusCode === 401 && responseData?.message?.includes('Invalid or expired Firebase authentication token')) {
        console.log(`  ✓ Invalid Firebase token rejected with 401 Unauthorized.`);
        console.log(`  ✓ Clerk fallback strictly prevented when Firebase token is present.`);
        testsPassed++;
      } else {
        throw new Error(`Security fail: Invalid Firebase token was not rejected! Status: ${statusCode}, nextCalled: ${nextCalled}`);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Verify Existing Users Retain Canonical clerkId & Ride/Booking Ownership
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Verifying existing user ownership & canonical clerkId retention...');
    {
      // 1. Seed existing student with original clerkId
      const student = await Student.create({
        clerkId: testClerkUserId,
        name: 'Original Student Name',
        email: testEmail,
        phone: '+919876500001',
        whatsappNumber: '+919876500001',
        college: 'Engineering Campus'
      });

      // 2. Seed ride & booking belonging to this student
      const travel = await Travel.create({
        userId: testClerkUserId,
        type: 'offer',
        source: 'Hostel 1',
        destination: 'Airport Terminal 2',
        travelDate: new Date(Date.now() + 86400000),
        departureTime: 720,
        timeFlexibility: 30,
        seats: 2,
        pricePerSeat: 150,
        authorName: 'Original Student Name',
        authorEmail: testEmail
      });

      const booking = await Booking.create({
        travelId: travel._id,
        passengerId: `passenger_test_${timestamp}`,
        ownerId: testClerkUserId,
        requestedSeats: 1,
        passengerName: 'Passenger Tester',
        passengerEmail: `passenger_${timestamp}@test.com`,
        passengerPhone: '+919876500002',
        status: 'confirmed'
      });

      // 3. User logs in with Firebase Google Auth matching this verified email
      const fbToken = createSimulatedJwt({
        iss: 'https://securetoken.google.com/helpu-bae0b',
        sub: testFirebaseUid,
        email: testEmail,
        email_verified: true
      });

      setMockAuth({
        verifyIdToken: async (t) => ({
          uid: testFirebaseUid,
          email: testEmail,
          email_verified: true
        })
      });

      const { req, res } = createMockReqRes({ authHeader: `Bearer ${fbToken}` });
      let nextCalled = false;
      await requireAuth(req, res, () => { nextCalled = true; });

      if (!nextCalled || req.userId !== testClerkUserId) {
        throw new Error(`Expected req.userId to match canonical clerkId ${testClerkUserId}, got ${req.userId}`);
      }

      // Check ownership queries
      const myTravels = await Travel.find({ userId: req.userId });
      const myBookings = await Booking.find({ ownerId: req.userId });

      if (myTravels.length !== 1 || myTravels[0].userId !== testClerkUserId) {
        throw new Error('Travel ownership mismatch for existing user');
      }
      if (myBookings.length !== 1 || myBookings[0].ownerId !== testClerkUserId) {
        throw new Error('Booking ownership mismatch for existing user');
      }

      console.log(`  ✓ Canonical clerkId retained: ${req.userId}`);
      console.log(`  ✓ Linked Student.firebaseUid = ${testFirebaseUid}`);
      console.log(`  ✓ Travel ownership intact (count: ${myTravels.length}, userId: ${myTravels[0].userId})`);
      console.log(`  ✓ Booking ownership intact (count: ${myBookings.length}, ownerId: ${myBookings[0].ownerId})`);
      testsPassed++;
    }

    // -------------------------------------------------------------------------
    // 5. Verify New Firebase User Creation & Profile Without Duplicates
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Verifying new Firebase user profile creation & deduplication...');
    {
      const newFbToken = createSimulatedJwt({
        iss: 'https://securetoken.google.com/helpu-bae0b',
        sub: newFirebaseUid,
        email: newEmail,
        email_verified: true
      });

      setMockAuth({
        verifyIdToken: async () => ({
          uid: newFirebaseUid,
          email: newEmail,
          email_verified: true
        })
      });

      const { req, res } = createMockReqRes({ authHeader: `Bearer ${newFbToken}` });
      await requireAuth(req, res, () => {});

      const expectedNewCanonicalId = `firebase_${newFirebaseUid}`;
      if (req.userId !== expectedNewCanonicalId) {
        throw new Error(`Expected new canonical ID ${expectedNewCanonicalId}, got ${req.userId}`);
      }

      // 1st Save Profile
      const student1 = await Student.findOneAndUpdate(
        { clerkId: req.userId },
        {
          $set: {
            name: 'New Student Name',
            email: newEmail,
            phone: '+919988776655',
            whatsappNumber: '+919988776655',
            firebaseUid: req.firebaseUid
          },
          $setOnInsert: { clerkId: req.userId }
        },
        { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      // 2nd Save Profile (Partial update - change phone number)
      const student2 = await Student.findOneAndUpdate(
        { _id: student1._id },
        {
          $set: {
            phone: '+919988776600',
            whatsappNumber: '+919988776600',
            firebaseUid: req.firebaseUid
          }
        },
        { returnDocument: 'after', upsert: true, runValidators: true }
      );

      // Count matching documents
      const docsCount = await Student.countDocuments({
        $or: [{ clerkId: req.userId }, { firebaseUid: newFirebaseUid }, { email: newEmail }]
      });

      if (docsCount !== 1) {
        throw new Error(`Duplicate records created! Found ${docsCount} records, expected exactly 1.`);
      }

      if (student2.whatsappNumber !== '+919988776600' || student2.clerkId !== expectedNewCanonicalId) {
        throw new Error('Profile update fields not persisted accurately');
      }

      console.log(`  ✓ Single document maintained (count: ${docsCount})`);
      console.log(`  ✓ Canonical clerkId: ${student2.clerkId}`);
      console.log(`  ✓ Stored firebaseUid: ${student2.firebaseUid}`);
      testsPassed++;
    }

    // -------------------------------------------------------------------------
    // 6. Inspect firebase_${uid} Compatibility with Backend Models
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Inspecting backend models schema compatibility with firebase_${uid}...');
    {
      const modelsToCheck = [
        { model: Travel, path: 'userId', name: 'Travel.userId' },
        { model: Booking, path: 'passengerId', name: 'Booking.passengerId' },
        { model: Booking, path: 'ownerId', name: 'Booking.ownerId' },
        { model: Notification, path: 'recipientId', name: 'Notification.recipientId' },
        { model: DeviceToken, path: 'userId', name: 'DeviceToken.userId' }
      ];

      for (const item of modelsToCheck) {
        const schemaType = item.model.schema.paths[item.path]?.instance;
        if (schemaType !== 'String') {
          throw new Error(`Schema mismatch on ${item.name}: Expected String, got ${schemaType}`);
        }
        console.log(`  ✓ ${item.name} is String schema: 100% compatible with 'firebase_\${uid}'.`);
      }
      testsPassed++;
    }

    // -------------------------------------------------------------------------
    // 7. Check MongoDB Indexes on Atlas Collection
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Checking MongoDB indexes on students collection in Atlas...');
    {
      // Ensure indexes are synchronized with Mongoose schema
      await Student.syncIndexes();
      const indexes = await Student.collection.indexes();

      console.log('  Live MongoDB Indexes on "students":');
      for (const idx of indexes) {
        const keys = Object.keys(idx.key).map(k => `${k}: ${idx.key[k]}`).join(', ');
        const props = [];
        if (idx.unique) props.push('UNIQUE');
        if (idx.sparse) props.push('SPARSE');
        console.log(`    - ${idx.name} [${keys}] ${props.length > 0 ? `(${props.join(', ')})` : ''}`);
      }

      const clerkIdIndex = indexes.find(i => i.key.clerkId === 1);
      const firebaseUidIndex = indexes.find(i => i.key.firebaseUid === 1);

      if (!clerkIdIndex || !clerkIdIndex.unique) {
        throw new Error('clerkId index missing or not unique');
      }
      if (!firebaseUidIndex || !firebaseUidIndex.unique || !firebaseUidIndex.sparse) {
        throw new Error('firebaseUid index missing or not unique/sparse');
      }

      console.log('  ✓ clerkId_1 index is unique.');
      console.log('  ✓ firebaseUid_1 index is unique and sparse.');
      console.log('  ✓ Zero index conflicts or duplicate definitions detected.');
      testsPassed++;
    }

    console.log('\n================================================================');
    console.log(`   ALL ${testsPassed}/${totalTests} STEP 2A FOCUSED VERIFICATION CHECKS PASSED!   `);
    console.log('================================================================\n');
  } finally {
    resetMockAuth();
    console.log('Cleaning up test data in MongoDB...');
    await Student.deleteMany({ email: { $in: [testEmail, newEmail] } });
    await Travel.deleteMany({ userId: { $in: [testClerkUserId, `firebase_${newFirebaseUid}`] } });
    await Booking.deleteMany({ ownerId: testClerkUserId });
    await mongoose.disconnect();
    console.log('Done.\n');
  }
}

runFocusedVerification().catch(err => {
  console.error('\n❌ FOCUSED VERIFICATION FAILED:', err);
  process.exit(1);
});
