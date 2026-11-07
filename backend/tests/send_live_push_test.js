import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initFirebaseAdmin } from '../src/config/firebase.js';
import { sendPushToUser } from '../src/services/fcm.service.js';
import DeviceToken from '../src/models/DeviceToken.js';

async function sendLivePush() {
  console.log('=== DISPATCHING REAL LIVE PUSH NOTIFICATION TO AUTHENTICATED USER ===\n');

  // 1. Initialize Firebase Admin
  initFirebaseAdmin();

  // 2. Connect DB
  await mongoose.connect(process.env.MONGO_URI);

  const targetUserId = 'firebase_eKYKEaAVnFeRl06vtlywoCffqQg1';

  const userTokens = await DeviceToken.find({ userId: targetUserId }).lean();
  console.log(`Found ${userTokens.length} registered device token(s) for user ${targetUserId}:`);
  userTokens.forEach((t, i) => {
    console.log(` [${i+1}] Token Prefix: ${t.token.slice(0, 16)}... | Platform: ${t.platform} | Last Seen: ${t.lastSeenAt}`);
  });

  if (userTokens.length === 0) {
    console.error('FAIL: No device tokens found for this user.');
    process.exit(1);
  }

  // 3. Dispatch Live Push Notification via FCM
  console.log('\nSending test notification: "New Booking Request"...');
  const result = await sendPushToUser(
    targetUserId,
    {
      title: 'New Booking Request 🚗',
      body: 'Amit requested 2 seat(s) for your ride from VIT Bhopal to Bhopal Station.'
    },
    {
      type: 'BOOKING_REQUESTED',
      bookingId: 'test_live_booking_123',
      route: '/bookings',
      senderName: 'Amit Kumar'
    }
  );

  console.log('\nFCM Dispatch Result:');
  console.log(result);

  if (result.sent > 0) {
    console.log(`\nSUCCESS: Successfully delivered push notification to ${result.sent} live device(s)!`);
  } else {
    console.log(`\nFAILURE: Push notification was not delivered (Failed: ${result.failed}, Removed: ${result.removedTokens}).`);
  }

  await mongoose.disconnect();
}

sendLivePush().catch(err => {
  console.error('Live Push Error:', err);
  process.exit(1);
});

