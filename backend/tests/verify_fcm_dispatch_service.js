import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import DeviceToken from '../src/models/DeviceToken.js';
import {
  sendPushToUser,
  sendPushToUsers,
  sendPushToTokens,
  removeInvalidTokens,
  sanitizeCustomData,
  batchTokens,
  isPermanentTokenError
} from '../src/services/fcm.service.js';

// Helper mock factory
function createMockMessaging({
  successTokens = [],
  permanentFailures = {}, // { token: 'messaging/registration-token-not-registered' }
  transientFailures = {}  // { token: 'messaging/server-unavailable' }
} = {}) {
  const capturedMessages = [];

  return {
    capturedMessages,
    sendEachForMulticast: async (message) => {
      capturedMessages.push(message);
      const responses = message.tokens.map((token) => {
        if (permanentFailures[token]) {
          return {
            success: false,
            error: {
              code: permanentFailures[token],
              message: 'Mock permanent failure'
            }
          };
        }
        if (transientFailures[token]) {
          return {
            success: false,
            error: {
              code: transientFailures[token],
              message: 'Mock transient failure'
            }
          };
        }
        return {
          success: true,
          messageId: 'projects/mock/messages/mock_' + Math.random().toString(36).substring(7)
        };
      });

      const successCount = responses.filter((r) => r.success).length;
      const failureCount = responses.filter((r) => !r.success).length;

      return {
        responses,
        successCount,
        failureCount
      };
    }
  };
}

async function runStep3Tests() {
  console.log('=== STARTING STEP 3: FCM DISPATCH SERVICE UNIT & INTEGRATION TESTS ===\n');

  await connectDB();

  const testUser1 = 'user_dispatch_test_1_' + Date.now();
  const testUser2 = 'user_dispatch_test_2_' + Date.now();
  const testToken1 = 'test_token_valid_1_' + Date.now();
  const testToken2 = 'test_token_valid_2_' + Date.now();
  const testTokenInvalid = 'test_token_invalid_perm_' + Date.now();
  const testTokenTransient = 'test_token_transient_fail_' + Date.now();

  try {
    // -------------------------------------------------------------
    // TEST 1: Firebase unavailable -> graceful skipped result
    // -------------------------------------------------------------
    console.log('--- TEST 1: Firebase unavailable / unconfigured ---');
    {
      const result = await sendPushToTokens([testToken1], { title: 'Test' }, {}, { messaging: null });
      console.log('Result:', result);
      if (result.skipped === true && result.reason === 'firebase_not_configured' && result.sent === 0) {
        console.log('PASS: Graceful skipped result when Firebase is unavailable.\n');
      } else {
        throw new Error('FAIL: Expected skipped result when Firebase is unavailable');
      }
    }

    // -------------------------------------------------------------
    // TEST 2: User has no registered devices -> skipped result
    // -------------------------------------------------------------
    console.log('--- TEST 2: User has no registered devices ---');
    {
      const result = await sendPushToUser('non_existent_user_id_12345', { title: 'Test' });
      console.log('Result:', result);
      if (result.skipped === true && result.reason === 'no_registered_devices_for_users' && result.sent === 0) {
        console.log('PASS: Correctly skipped for user with no registered devices.\n');
      } else {
        throw new Error('FAIL: Expected skipped result for user without registered devices');
      }
    }

    // -------------------------------------------------------------
    // TEST 3: One valid device token -> successful send
    // -------------------------------------------------------------
    console.log('--- TEST 3: One valid device token ---');
    {
      const mock = createMockMessaging();
      const result = await sendPushToTokens(
        [testToken1],
        { title: 'New Booking', body: 'Passenger requested seats' },
        { bookingId: '123' },
        { messaging: mock }
      );
      console.log('Result:', result);
      if (result.success === true && result.sent === 1 && result.failed === 0 && mock.capturedMessages.length === 1) {
        console.log('PASS: One valid token successfully dispatched.\n');
      } else {
        throw new Error('FAIL: Single token send failed');
      }
    }

    // -------------------------------------------------------------
    // TEST 4: Multiple device tokens -> multicast send
    // -------------------------------------------------------------
    console.log('--- TEST 4: Multiple device tokens multicast ---');
    {
      const mock = createMockMessaging();
      const result = await sendPushToTokens(
        [testToken1, testToken2],
        { title: 'Ride Confirmed' },
        { travelId: '456' },
        { messaging: mock }
      );
      console.log('Result:', result);
      if (result.sent === 2 && mock.capturedMessages[0].tokens.length === 2) {
        console.log('PASS: Multicast message dispatched to all tokens in single batch.\n');
      } else {
        throw new Error('FAIL: Multicast send failed');
      }
    }

    // -------------------------------------------------------------
    // TEST 5: Multiple users -> recipients handled correctly
    // -------------------------------------------------------------
    console.log('--- TEST 5: Multiple users recipients handling ---');
    {
      // Seed tokens for two users
      await DeviceToken.create([
        { userId: testUser1, token: testToken1, platform: 'android' },
        { userId: testUser2, token: testToken2, platform: 'ios' }
      ]);

      const mock = createMockMessaging();
      const result = await sendPushToUsers(
        [testUser1, testUser2],
        { title: 'Campus Broadcast', body: 'Rain alert' },
        { type: 'BROADCAST' },
        { messaging: mock }
      );

      console.log('Result:', result);
      const dispatchedTokens = mock.capturedMessages[0]?.tokens || [];
      if (result.sent === 2 && dispatchedTokens.includes(testToken1) && dispatchedTokens.includes(testToken2)) {
        console.log('PASS: Multiple users resolved to their respective tokens and dispatched.\n');
      } else {
        throw new Error('FAIL: Multiple users handling failed');
      }
    }

    // -------------------------------------------------------------
    // TEST 6: Invalid/unregistered token -> only that token is deleted
    // -------------------------------------------------------------
    console.log('--- TEST 6: Permanent invalid token cleanup ---');
    {
      // Seed permanent invalid token and a valid token in DB
      await DeviceToken.create({ userId: testUser1, token: testTokenInvalid, platform: 'android' });

      const mock = createMockMessaging({
        permanentFailures: {
          [testTokenInvalid]: 'messaging/registration-token-not-registered'
        }
      });

      const result = await sendPushToTokens(
        [testToken1, testTokenInvalid],
        { title: 'Prune Test' },
        {},
        { messaging: mock }
      );

      console.log('Result:', result);

      const invalidInDb = await DeviceToken.findOne({ token: testTokenInvalid });
      const validInDb = await DeviceToken.findOne({ token: testToken1 });

      console.log(`Invalid token exists in DB: ${Boolean(invalidInDb)} (expected false)`);
      console.log(`Valid token exists in DB: ${Boolean(validInDb)} (expected true)`);

      if (!invalidInDb && validInDb && result.removedTokens === 1) {
        console.log('PASS: Invalid token was deleted from DB while valid token was preserved.\n');
      } else {
        throw new Error('FAIL: Permanent invalid token cleanup failed');
      }
    }

    // -------------------------------------------------------------
    // TEST 7: Temporary Firebase failure -> token is retained
    // -------------------------------------------------------------
    console.log('--- TEST 7: Temporary failure -> token retained ---');
    {
      await DeviceToken.create({ userId: testUser1, token: testTokenTransient, platform: 'android' });

      const mock = createMockMessaging({
        transientFailures: {
          [testTokenTransient]: 'messaging/server-unavailable'
        }
      });

      const result = await sendPushToTokens(
        [testTokenTransient],
        { title: 'Transient Error' },
        {},
        { messaging: mock }
      );

      console.log('Result:', result);
      const transientInDb = await DeviceToken.findOne({ token: testTokenTransient });

      if (transientInDb && result.removedTokens === 0 && result.failed === 1) {
        console.log('PASS: Token retained in DB after transient error (no improper deletion).\n');
      } else {
        throw new Error('FAIL: Transient error improperly deleted token');
      }
    }

    // -------------------------------------------------------------
    // TEST 8: More than 500 tokens -> split into batches of <= 500
    // -------------------------------------------------------------
    console.log('--- TEST 8: Batching of > 500 tokens ---');
    {
      // Generate 1250 dummy tokens
      const largeTokenList = Array.from({ length: 1250 }, (_, i) => `batch_test_token_${i}_${Date.now()}`);
      const mock = createMockMessaging();

      const result = await sendPushToTokens(largeTokenList, { title: 'Batch test' }, {}, { messaging: mock });

      console.log(`Total sent: ${result.sent}, Batch count: ${result.batchCount}`);
      console.log(`Batch sizes: ${mock.capturedMessages.map((m) => m.tokens.length).join(', ')}`);

      if (
        result.sent === 1250 &&
        result.batchCount === 3 &&
        mock.capturedMessages[0].tokens.length === 500 &&
        mock.capturedMessages[1].tokens.length === 500 &&
        mock.capturedMessages[2].tokens.length === 250
      ) {
        console.log('PASS: 1250 tokens properly split into 3 batches (500, 500, 250).\n');
      } else {
        throw new Error('FAIL: Batching logic failed for > 500 tokens');
      }
    }

    // -------------------------------------------------------------
    // TEST 9: Duplicate tokens -> no duplicate send
    // -------------------------------------------------------------
    console.log('--- TEST 9: Duplicate tokens deduplication ---');
    {
      const mock = createMockMessaging();
      const duplicateTokens = [testToken1, testToken1, testToken1, testToken2, testToken2];

      const result = await sendPushToTokens(duplicateTokens, { title: 'Dedup test' }, {}, { messaging: mock });

      console.log(`Input tokens count: ${duplicateTokens.length}`);
      console.log(`Tokens dispatched to Firebase: ${mock.capturedMessages[0]?.tokens?.length}`);

      if (result.sent === 2 && mock.capturedMessages[0].tokens.length === 2) {
        console.log('PASS: Duplicate tokens deduplicated before dispatch.\n');
      } else {
        throw new Error('FAIL: Duplicate tokens were not deduplicated');
      }
    }

    // -------------------------------------------------------------
    // TEST 10: Custom data payload -> values converted to strings
    // -------------------------------------------------------------
    console.log('--- TEST 10: Custom data payload string conversion ---');
    {
      const rawData = {
        bookingId: 'booking_abc_123',
        seats: 2, // number
        confirmed: true, // boolean
        fare: 150.5, // float
        extraInfo: { driver: 'Amit', vehicle: 'Swift' }, // nested object
        nullField: null,
        undefinedField: undefined
      };

      const sanitized = sanitizeCustomData(rawData);
      console.log('Sanitized Data:', sanitized);

      let allStrings = true;
      for (const [key, val] of Object.entries(sanitized)) {
        if (typeof val !== 'string') {
          allStrings = false;
          console.error(`Key "${key}" is not string! Type: ${typeof val}`);
        }
      }

      if (
        allStrings &&
        sanitized.seats === '2' &&
        sanitized.confirmed === 'true' &&
        sanitized.nullField === '' &&
        sanitized.undefinedField === '' &&
        typeof sanitized.extraInfo === 'string'
      ) {
        console.log('PASS: All custom data values strictly converted to strings.\n');
      } else {
        throw new Error('FAIL: Custom data sanitization failed string requirements');
      }
    }

    // Final cleanup of test fixtures
    await DeviceToken.deleteMany({
      token: { $in: [testToken1, testToken2, testTokenInvalid, testTokenTransient] }
    });

    console.log('=== ALL 10 STEP 3 VERIFICATION TESTS PASSED PERFECTLY! ===');
  } finally {
    await mongoose.disconnect();
  }
}

runStep3Tests().catch((err) => {
  console.error('STEP 3 TEST FAILED:', err);
  process.exit(1);
});

