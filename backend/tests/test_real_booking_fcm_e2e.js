import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initFirebaseAdmin } from '../src/config/firebase.js';
import Notification from '../src/models/Notification.js';
import Outbox from '../src/models/Outbox.js';
import DeviceToken from '../src/models/DeviceToken.js';
import { createOutboxEvent, dispatchOutboxEvents } from '../src/services/outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';

async function runRealBookingFcmFlow() {
  console.log('=== TESTING REAL BOOKING REQUEST -> OUTBOX -> FCM DISPATCH FLOW ===\n');

  // 1. Initialize Firebase Admin
  initFirebaseAdmin();

  // 2. Connect DB
  await mongoose.connect(process.env.MONGO_URI);

  // Use the verified active user who has the active Android device token
  const hostUserId = 'firebase_eKYKEaAVnFeRl06vtlywoCffqQg1';
  const passengerUserId = 'user_passenger_amit_test_' + Date.now();

  const activeTokens = await DeviceToken.find({ userId: hostUserId }).lean();
  console.log(`Host ${hostUserId} has ${activeTokens.length} active device token(s):`);
  activeTokens.forEach(t => console.log(`- Token: ${t.token.slice(0, 16)}... (${t.platform})`));

  if (activeTokens.length === 0) {
    throw new Error('Host has no active device tokens');
  }

  const travelId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  // 3. Create Outbox event as happens during real POST /api/bookings
  console.log('\n1. Creating Outbox Event for BOOKING_REQUESTED...');
  const outboxEvent = await createOutboxEvent({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
    recipientId: hostUserId,
    relatedBookingId: bookingId,
    relatedTravelId: travelId,
    payload: {
      source: 'VIT Bhopal Campus',
      destination: 'Bhopal Junction Railway Station',
      requestedSeats: 1,
      passengerName: 'Ananya Sharma',
      travelDate: new Date('2026-11-08T08:00:00Z')
    }
  });

  console.log(`Outbox event created with ID: ${outboxEvent.eventId} (status: ${outboxEvent.status})`);

  // 4. Dispatch outbox events (simulates the periodic or immediate worker sweep)
  console.log('\n2. Outbox worker processing pending event...');
  const processedCount = await dispatchOutboxEvents({ eventId: outboxEvent.eventId });
  console.log(`Outbox processed count: ${processedCount}`);

  // 5. Verify database state
  const updatedOutbox = await Outbox.findById(outboxEvent._id).lean();
  console.log('\n3. Verification:');
  console.log(`- Outbox Status: ${updatedOutbox.status} (expected: "processed")`);
  console.log(`- Push Sent Timestamp: ${updatedOutbox.pushSentAt ? 'Recorded (' + updatedOutbox.pushSentAt + ')' : 'NONE'}`);

  const inAppNotif = await Notification.findOne({ eventId: outboxEvent.eventId }).lean();
  console.log(`- In-App Notification Created: ${Boolean(inAppNotif)}`);
  if (inAppNotif) {
    console.log(`  Title: "${inAppNotif.title}"`);
    console.log(`  Message: "${inAppNotif.message}"`);
    console.log(`  Recipient: "${inAppNotif.recipientId}"`);
  }

  const pass = updatedOutbox.status === 'processed' && updatedOutbox.pushSentAt && inAppNotif;
  if (pass) {
    console.log('\n>>> COMPLETE END-TO-END NOTIFICATION FLOW PASSED WITH LIVE FCM DISPATCH! <<<');
  } else {
    throw new Error('End-to-end notification flow failed');
  }

  await mongoose.disconnect();
}

runRealBookingFcmFlow().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
