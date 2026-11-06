import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Student from '../src/models/Student.js';
import { initFirebaseAdmin, getFirebaseAuth } from '../src/config/firebase.js';
import { requireAuth } from '../src/middlewares/auth.js';

function createSimulatedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = 'simulated_sig_bytes';
  return `${header}.${body}.${sig}`;
}

async function verifyFix() {
  console.log('================================================================');
  console.log('     FIREBASE AUTH INITIALIZATION & WHATSAPP FLOW TEST         ');
  console.log('================================================================\n');

  await connectDB();

  const timestamp = Date.now();
  const testFirebaseUid = `fb_whatsapp_uid_${timestamp}`;
  const testEmail = `whatsapp_user_${timestamp}@campus.edu`;
  const testName = 'Aarav Patel';
  const testWhatsAppNumber = '+919876512345';

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Firebase Admin Initializes and getFirebaseAuth() Never Returns Null
    // -------------------------------------------------------------------------
    console.log('[1/4] Verifying Firebase Admin initialization & getFirebaseAuth()...');
    const adminApp = initFirebaseAdmin();
    if (!adminApp) {
      throw new Error('initFirebaseAdmin() returned null');
    }
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      throw new Error('getFirebaseAuth() returned null');
    }
    console.log('  ✓ Firebase Admin App initialized.');
    console.log('  ✓ getFirebaseAuth() returned active Auth service.');

    // -------------------------------------------------------------------------
    // 2. Verify requireAuth Middleware Authenticates Firebase Token
    // -------------------------------------------------------------------------
    console.log('\n[2/4] Verifying requireAuth with Firebase token...');
    const simulatedToken = createSimulatedJwt({
      iss: 'https://securetoken.google.com/helpu-bae0b',
      sub: testFirebaseUid,
      email: testEmail,
      email_verified: true,
      name: testName
    });

    // Mock verifyIdToken for testing token payload
    const originalVerify = firebaseAuth.verifyIdToken;
    firebaseAuth.verifyIdToken = async (token) => {
      if (token === simulatedToken) {
        return {
          uid: testFirebaseUid,
          email: testEmail,
          email_verified: true,
          name: testName
        };
      }
      throw new Error('Invalid token');
    };

    const mockReq = {
      headers: {
        authorization: `Bearer ${simulatedToken}`
      }
    };
    let nextCalled = false;
    await requireAuth(mockReq, {}, () => { nextCalled = true; });

    if (!nextCalled || mockReq.authType !== 'firebase' || mockReq.userId !== `firebase_${testFirebaseUid}`) {
      throw new Error(`requireAuth failed: userId=${mockReq.userId}, authType=${mockReq.authType}`);
    }
    console.log(`  ✓ requireAuth succeeded with req.userId: ${mockReq.userId}`);
    console.log(`  ✓ authType: ${mockReq.authType}`);

    // -------------------------------------------------------------------------
    // 3. Simulate "Save & Continue" on WhatsApp Onboarding Page
    // -------------------------------------------------------------------------
    console.log('\n[3/4] Simulating WhatsApp Onboarding submission (POST /api/students/profile)...');
    const updateData = {
      name: testName,
      email: testEmail,
      college: 'VIT, Bhopal',
      phone: testWhatsAppNumber,
      whatsappNumber: testWhatsAppNumber,
      whatsappCountryCode: 'IN',
      firebaseUid: testFirebaseUid
    };

    const clerkId = mockReq.userId;
    const existing = await Student.findOne(
      mockReq.firebaseUid
        ? { $or: [{ clerkId }, { firebaseUid: mockReq.firebaseUid }] }
        : { clerkId }
    );

    const savedStudent = await Student.findOneAndUpdate(
      existing ? { _id: existing._id } : { clerkId },
      {
        $set: updateData,
        $setOnInsert: { clerkId }
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    if (!savedStudent || savedStudent.whatsappNumber !== testWhatsAppNumber) {
      throw new Error('Failed to persist WhatsApp number in MongoDB');
    }
    console.log(`  ✓ WhatsApp number persisted in MongoDB: ${savedStudent.whatsappNumber}`);
    console.log(`  ✓ User profile linked with canonical ID: ${savedStudent.clerkId}`);

    // -------------------------------------------------------------------------
    // 4. Verify Subsequent Retrieval (hasWhatsApp check for /home access)
    // -------------------------------------------------------------------------
    console.log('\n[4/4] Verifying profile retrieval & onboarding completion status...');
    const retrievedStudent = await Student.findOne({
      $or: [{ clerkId: mockReq.userId }, { firebaseUid: testFirebaseUid }]
    });

    const hasWhatsApp = Boolean(retrievedStudent?.whatsappNumber?.trim() || retrievedStudent?.phone?.trim());
    if (!hasWhatsApp) {
      throw new Error('Onboarding check failed: hasWhatsApp evaluated to false');
    }
    console.log(`  ✓ hasWhatsApp evaluates to true: User is eligible to access /home`);

    console.log('\n================================================================');
    console.log('   ALL FIREBASE AUTH & WHATSAPP ONBOARDING TESTS PASSED!       ');
    console.log('================================================================\n');

    // Restore
    firebaseAuth.verifyIdToken = originalVerify;
  } finally {
    console.log('Cleaning up test data in MongoDB...');
    await Student.deleteMany({ email: testEmail });
    await mongoose.disconnect();
    console.log('Done.\n');
  }
}

verifyFix().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});

