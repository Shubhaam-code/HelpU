import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import DeviceToken from '../src/models/DeviceToken.js';
import { registerDeviceToken, unregisterDeviceToken } from '../src/controllers/notification.controller.js';

// Helper to mock Express req and res
function createMockContext({ userId, body = {}, query = {} } = {}) {
  const req = {
    userId,
    body,
    query
  };

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

async function runStep2Tests() {
  console.log('=== STARTING STEP 2: FCM DEVICE TOKEN API TESTS ===\n');

  await connectDB();

  const testUserA = 'user_test_clerk_A_' + Date.now();
  const testUserB = 'user_test_clerk_B_' + Date.now();
  const testToken1 = 'test_fcm_token_1234567890_abcdef_' + Date.now();
  const testToken2 = 'test_fcm_token_9876543210_uvwxyz_' + Date.now();

  try {
    // Cleanup any leftovers
    await DeviceToken.deleteMany({
      token: { $in: [testToken1, testToken2] }
    });

    // TEST 1: Unauthenticated registration rejection
    console.log('--- TEST 1: Unauthenticated registration rejection ---');
    {
      const { req, res, getResult } = createMockContext({
        userId: null,
        body: { token: testToken1, platform: 'android' }
      });
      await registerDeviceToken(req, res);
      const { statusCode, responseData } = getResult();

      console.log(`Status: ${statusCode}, Success: ${responseData?.success}`);
      if (statusCode === 401 && responseData?.success === false) {
        console.log('PASS: Unauthenticated request rejected with 401.\n');
      } else {
        throw new Error('FAIL: Expected 401 for unauthenticated request.');
      }
    }

    // TEST 2: Invalid input handling (missing or short token)
    console.log('--- TEST 2: Invalid input validation ---');
    {
      const { req, res, getResult } = createMockContext({
        userId: testUserA,
        body: { token: 'short' } // < 10 chars
      });
      await registerDeviceToken(req, res);
      const { statusCode, responseData } = getResult();

      console.log(`Status: ${statusCode}, Message: ${responseData?.message}`);
      if (statusCode === 400 && responseData?.success === false) {
        console.log('PASS: Short/invalid token rejected with 400.\n');
      } else {
        throw new Error('FAIL: Expected 400 for short token.');
      }
    }

    // TEST 3: Valid token registration
    console.log('--- TEST 3: Valid token registration ---');
    {
      const { req, res, getResult } = createMockContext({
        userId: testUserA,
        body: { token: testToken1, platform: 'android' }
      });
      await registerDeviceToken(req, res);
      const { statusCode, responseData } = getResult();

      console.log(`Status: ${statusCode}, Message: ${responseData?.message}, Platform: ${responseData?.data?.platform}`);
      const saved = await DeviceToken.findOne({ token: testToken1 });

      if (statusCode === 200 && responseData?.success === true && saved && saved.userId === testUserA) {
        console.log('PASS: Valid token successfully saved in MongoDB.\n');
      } else {
        throw new Error('FAIL: Token not correctly saved in MongoDB.');
      }
    }

    // TEST 4: Duplicate token registration (safe idempotency & lastSeenAt update)
    console.log('--- TEST 4: Duplicate token registration (idempotency) ---');
    {
      const beforeDoc = await DeviceToken.findOne({ token: testToken1 });
      await new Promise(r => setTimeout(r, 20));

      const { req, res, getResult } = createMockContext({
        userId: testUserA,
        body: { token: testToken1, platform: 'android' }
      });
      await registerDeviceToken(req, res);
      const { statusCode, responseData } = getResult();

      const totalCount = await DeviceToken.countDocuments({ token: testToken1 });
      const afterDoc = await DeviceToken.findOne({ token: testToken1 });

      console.log(`Total records with token: ${totalCount}`);
      console.log(`Updated lastSeenAt: ${afterDoc.lastSeenAt >= beforeDoc.lastSeenAt}`);

      if (statusCode === 200 && totalCount === 1 && afterDoc.lastSeenAt >= beforeDoc.lastSeenAt) {
        console.log('PASS: Duplicate registration safely updated existing record without creating duplicates.\n');
      } else {
        throw new Error('FAIL: Duplicate registration created duplicate records.');
      }
    }

    // TEST 5: Account switching (User B logs in on same device)
    console.log('--- TEST 5: Account switching transfer ---');
    {
      const { req, res, getResult } = createMockContext({
        userId: testUserB,
        body: { token: testToken1, platform: 'android' }
      });
      await registerDeviceToken(req, res);
      const { statusCode, responseData } = getResult();

      const doc = await DeviceToken.findOne({ token: testToken1 });
      const userACount = await DeviceToken.countDocuments({ userId: testUserA, token: testToken1 });

      console.log(`New token owner: ${doc.userId}`);
      console.log(`User A ownership count: ${userACount}`);

      if (statusCode === 200 && doc.userId === testUserB && userACount === 0) {
        console.log('PASS: Token ownership transferred seamlessly from User A to User B.\n');
      } else {
        throw new Error('FAIL: Token ownership was not transferred to User B.');
      }
    }

    // TEST 6: Token unregistration (DELETE /api/notifications/fcm-token)
    console.log('--- TEST 6: Token unregistration ---');
    {
      // First register second token for user B
      await DeviceToken.create({
        userId: testUserB,
        token: testToken2,
        platform: 'android'
      });

      // User A attempts to delete User B's token (should fail to delete)
      const mockUnauthDelete = createMockContext({
        userId: testUserA,
        body: { token: testToken2 }
      });
      await unregisterDeviceToken(mockUnauthDelete.req, mockUnauthDelete.res);
      const unauthResult = mockUnauthDelete.getResult();

      const stillExists = await DeviceToken.findOne({ token: testToken2 });
      if (!stillExists) {
        throw new Error('FAIL: User A was able to delete User B token!');
      }
      console.log('Cross-user token deletion prevented: PASS');

      // User B deletes own token
      const mockAuthDelete = createMockContext({
        userId: testUserB,
        body: { token: testToken2 }
      });
      await unregisterDeviceToken(mockAuthDelete.req, mockAuthDelete.res);
      const authResult = mockAuthDelete.getResult();

      const deletedDoc = await DeviceToken.findOne({ token: testToken2 });
      if (authResult.statusCode === 200 && !deletedDoc) {
        console.log('PASS: User successfully unregistered own device token.\n');
      } else {
        throw new Error('FAIL: Token unregistration failed.');
      }
    }

    // Cleanup
    await DeviceToken.deleteMany({
      token: { $in: [testToken1, testToken2] }
    });

    console.log('=== ALL STEP 2 TESTS PASSED PERFECTLY! ===');
  } finally {
    await mongoose.disconnect();
  }
}

runStep2Tests().catch(err => {
  console.error('STEP 2 TEST FAILED:', err);
  process.exit(1);
});
