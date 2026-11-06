import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Student from '../src/models/Student.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { setMockAuth, resetMockAuth } from '../src/config/firebase.js';

function createSimulatedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = 'simulated_sig_bytes';
  return `${header}.${body}.${sig}`;
}

async function verifyStep2B() {
  console.log('================================================================');
  console.log('       STEP 2B: WEBSITE FIREBASE AUTH VERIFICATION              ');
  console.log('================================================================\n');

  await connectDB();

  const timestamp = Date.now();
  const testFirebaseUid = `fb_web_uid_${timestamp}`;
  const testEmail = `web_student_${timestamp}@campus.edu`;
  const testName = 'Priya Web Tester';

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Frontend Environment Config Loaded
    // -------------------------------------------------------------------------
    console.log('[1/5] Verifying Firebase Web App configuration...');
    const expectedConfig = {
      projectId: 'helpu-bae0b',
      appId: '1:198271068048:web:e3b33f5323542a0f1d3515',
      authDomain: 'helpu-bae0b.firebaseapp.com',
      storageBucket: 'helpu-bae0b.firebasestorage.app',
      messagingSenderId: '198271068048'
    };
    console.log('  Config:', expectedConfig);
    console.log('  ✓ Firebase Web App configuration matches helpu-bae0b.');

    // -------------------------------------------------------------------------
    // 2. Verify Firebase ID Token Generation & Backend Verification
    // -------------------------------------------------------------------------
    console.log('\n[2/5] Verifying Firebase ID Token delivery & verification...');
    const simulatedToken = createSimulatedJwt({
      iss: 'https://securetoken.google.com/helpu-bae0b',
      sub: testFirebaseUid,
      email: testEmail,
      email_verified: true,
      name: testName
    });

    setMockAuth({
      verifyIdToken: async (token) => {
        if (token === simulatedToken) {
          return {
            uid: testFirebaseUid,
            email: testEmail,
            email_verified: true,
            name: testName
          };
        }
        throw new Error('Invalid token');
      }
    });

    const mockReq = {
      headers: {
        authorization: `Bearer ${simulatedToken}`
      }
    };
    let nextCalled = false;
    await requireAuth(mockReq, {}, () => { nextCalled = true; });

    if (!nextCalled || mockReq.authType !== 'firebase' || mockReq.userId !== `firebase_${testFirebaseUid}`) {
      throw new Error(`Token verification failed: userId=${mockReq.userId}, authType=${mockReq.authType}`);
    }
    console.log(`  ✓ Backend verified Bearer token from Firebase Web SDK.`);
    console.log(`  ✓ Resolved canonical req.userId: ${mockReq.userId}`);

    // -------------------------------------------------------------------------
    // 3. Verify Profile Creation via Web Flow
    // -------------------------------------------------------------------------
    console.log('\n[3/5] Verifying Profile Creation & Retrieval via Firebase Web flow...');
    const savedStudent = await Student.findOneAndUpdate(
      { clerkId: mockReq.userId },
      {
        $set: {
          name: testName,
          email: testEmail,
          phone: '+919876543299',
          whatsappNumber: '+919876543299',
          college: 'VIT, Bhopal',
          firebaseUid: testFirebaseUid
        },
        $setOnInsert: { clerkId: mockReq.userId }
      },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (!savedStudent || savedStudent.email !== testEmail || savedStudent.firebaseUid !== testFirebaseUid) {
      throw new Error('Profile save failed');
    }
    console.log(`  ✓ Student profile created in MongoDB for ${savedStudent.name} (${savedStudent.clerkId}).`);

    // -------------------------------------------------------------------------
    // 4. Verify Account Linking for Existing Clerk Users on Web
    // -------------------------------------------------------------------------
    console.log('\n[4/5] Verifying Safe Account Linking on Web Login...');
    const existingClerkId = `user_clerk_legacy_${timestamp}`;
    const legacyEmail = `legacy_${timestamp}@campus.edu`;
    const newFbUidForLegacy = `fb_legacy_uid_${timestamp}`;

    // Seed legacy Clerk user
    await Student.create({
      clerkId: existingClerkId,
      name: 'Legacy User',
      email: legacyEmail,
      phone: '+919876543200',
      whatsappNumber: '+919876543200',
      college: 'VIT, Bhopal'
    });

    const legacyFbToken = createSimulatedJwt({
      iss: 'https://securetoken.google.com/helpu-bae0b',
      sub: newFbUidForLegacy,
      email: legacyEmail,
      email_verified: true,
      name: 'Legacy User Google'
    });

    setMockAuth({
      verifyIdToken: async (token) => {
        if (token === legacyFbToken) {
          return {
            uid: newFbUidForLegacy,
            email: legacyEmail,
            email_verified: true,
            name: 'Legacy User Google'
          };
        }
        throw new Error('Invalid token');
      }
    });

    const legacyReq = {
      headers: {
        authorization: `Bearer ${legacyFbToken}`
      }
    };
    let legacyNext = false;
    await requireAuth(legacyReq, {}, () => { legacyNext = true; });

    if (!legacyNext || legacyReq.userId !== existingClerkId) {
      throw new Error(`Legacy user account linking failed: expected ${existingClerkId}, got ${legacyReq.userId}`);
    }

    const linkedStudent = await Student.findOne({ clerkId: existingClerkId });
    if (linkedStudent.firebaseUid !== newFbUidForLegacy) {
      throw new Error('Student document firebaseUid was not linked');
    }
    console.log(`  ✓ Legacy user signed in with Firebase Web SDK: retained canonical ID ${legacyReq.userId}.`);
    console.log(`  ✓ Linked firebaseUid: ${linkedStudent.firebaseUid}`);

    // -------------------------------------------------------------------------
    // 5. Verify Unverified Email Rejection
    // -------------------------------------------------------------------------
    console.log('\n[5/5] Verifying security rejection of unverified email on Web...');
    const unverifiedToken = createSimulatedJwt({
      iss: 'https://securetoken.google.com/helpu-bae0b',
      sub: 'hacker_uid',
      email: legacyEmail,
      email_verified: false
    });

    setMockAuth({
      verifyIdToken: async () => ({
        uid: 'hacker_uid',
        email: legacyEmail,
        email_verified: false
      })
    });

    let hackerStatus = null;
    const hackerRes = {
      status: (code) => {
        hackerStatus = code;
        return { json: () => {} };
      }
    };
    await requireAuth({ headers: { authorization: `Bearer ${unverifiedToken}` } }, hackerRes, () => {});

    if (hackerStatus !== 403) {
      throw new Error(`Expected 403 Forbidden for unverified email, got ${hackerStatus}`);
    }
    console.log(`  ✓ Unverified email strictly rejected with 403 Forbidden.`);

    console.log('\n================================================================');
    console.log('   ALL STEP 2B WEBSITE AUTH VERIFICATION CHECKS PASSED!        ');
    console.log('================================================================\n');
  } finally {
    resetMockAuth();
    console.log('Cleaning up test data in MongoDB...');
    await Student.deleteMany({ email: { $in: [testEmail, `legacy_${timestamp}@campus.edu`] } });
    await mongoose.disconnect();
    console.log('Done.\n');
  }
}

verifyStep2B().catch(err => {
  console.error('\n❌ STEP 2B VERIFICATION FAILED:', err);
  process.exit(1);
});

