import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Outbox from '../src/models/Outbox.js';
import Notification from '../src/models/Notification.js';
import DeviceToken from '../src/models/DeviceToken.js';
import { createOutboxEvent, dispatchOutboxEvents } from '../src/services/outbox.service.js';
import { setSocketIO } from '../src/services/socket.service.js';
import { setMockMessaging, resetMockMessaging } from '../src/config/firebase.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';
import { closeNotificationQueue } from '../src/queues/notification.queue.js';

// Mock Socket.IO store
const socketEmissions = [];
const mockSocketIO = {
  to: (room) => ({
    emit: (event, payload) => {
      socketEmissions.push({ room, event, payload });
    }
  })
};

// Mock Firebase Messaging store
const fcmDispatches = [];
const mockMessaging = {
  sendEachForMulticast: async (message) => {
    fcmDispatches.push(message);
    return {
      successCount: message.tokens.length,
      failureCount: 0,
      responses: message.tokens.map(() => ({
        success: true,
        messageId: 'mock_msg_' + Math.random().toString(36).substring(7)
      }))
    };
  }
};

async function runStep4Tests() {
  console.log('=== STARTING STEP 4: OUTBOX + FCM INTEGRATION TESTS ===\n');

  await connectDB();

  // Attach mock Socket.IO and mock Firebase Messaging
  setSocketIO(mockSocketIO);
  setMockMessaging(mockMessaging);

  const actorId = 'user_actor_' + Date.now();
  const recipientId = 'user_recipient_' + Date.now();
  const recipientToken = 'token_recipient_' + Date.now();
  const actorToken = 'token_actor_' + Date.now();

  try {
    // Seed device tokens
    await DeviceToken.create([
      { userId: recipientId, token: recipientToken, platform: 'android' },
      { userId: actorId, token: actorToken, platform: 'android' }
    ]);

    // -------------------------------------------------------------
    // TEST 1 & 2: In-app notification creation, FCM push, & Socket.IO
    // -------------------------------------------------------------
    console.log('--- TEST 1 & 2: Outbox creates in-app notification, dispatches FCM & emits Socket.IO ---');
    {
      socketEmissions.length = 0;
      fcmDispatches.length = 0;

      const eventId = `test_evt_1_${Date.now()}`;
      await createOutboxEvent({
        eventId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
        recipientId,
        payload: {
          passengerName: 'Rahul',
          source: 'Hostel A',
          destination: 'Main Gate',
          requestedSeats: 2
        }
      });

      const processedCount = await dispatchOutboxEvents({ eventId });
      console.log(`Processed count: ${processedCount}`);

      // Verify In-app notification created
      const notifDoc = await Notification.findOne({ eventId });
      console.log(`In-app notification created: ${Boolean(notifDoc)} (Title: "${notifDoc?.title}")`);

      // Verify Socket.IO emission
      const socketHit = socketEmissions.find((s) => s.room === `user_${recipientId}`);
      console.log(`Socket.IO emitted to user_${recipientId}: ${Boolean(socketHit)}`);

      // Verify FCM dispatch
      const fcmHit = fcmDispatches.find((m) => m.tokens.includes(recipientToken));
      console.log(`FCM dispatched to recipient token: ${Boolean(fcmHit)} (Title: "${fcmHit?.notification?.title}")`);

      if (notifDoc && socketHit && fcmHit && processedCount === 1) {
        console.log('PASS: In-app notification, Socket.IO, and FCM push all executed successfully.\n');
      } else {
        throw new Error('FAIL: Integration delivery check failed');
      }
    }

    // -------------------------------------------------------------
    // TEST 3: Firebase unavailable does not break in-app notifications
    // -------------------------------------------------------------
    console.log('--- TEST 3: Firebase unavailable does not break in-app notification ---');
    {
      resetMockMessaging(); // Firebase unconfigured
      const eventId = `test_evt_no_fcm_${Date.now()}`;

      await createOutboxEvent({
        eventId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED,
        recipientId,
        payload: { source: 'Campus', destination: 'City Center' }
      });

      const processedCount = await dispatchOutboxEvents({ eventId });
      const notifDoc = await Notification.findOne({ eventId });
      const outboxDoc = await Outbox.findOne({ eventId });

      console.log(`Outbox status: ${outboxDoc?.status}`);
      console.log(`In-app notification created: ${Boolean(notifDoc)}`);

      // Restore mock messaging
      setMockMessaging(mockMessaging);

      if (processedCount === 1 && notifDoc && outboxDoc?.status === 'processed') {
        console.log('PASS: When Firebase is unavailable, Outbox and in-app notifications succeed normally.\n');
      } else {
        throw new Error('FAIL: Firebase unavailable caused Outbox failure');
      }
    }

    // -------------------------------------------------------------
    // TEST 4: User with no device token handled safely
    // -------------------------------------------------------------
    console.log('--- TEST 4: User with no registered device token ---');
    {
      const userWithoutDevice = 'user_no_token_' + Date.now();
      const eventId = `test_evt_no_device_${Date.now()}`;

      await createOutboxEvent({
        eventId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
        recipientId: userWithoutDevice,
        payload: { source: 'Campus', destination: 'Station', requestedSeats: 1 }
      });

      const processedCount = await dispatchOutboxEvents({ eventId });
      const notifDoc = await Notification.findOne({ eventId });

      if (processedCount === 1 && notifDoc) {
        console.log('PASS: User without device tokens processed safely without errors.\n');
      } else {
        throw new Error('FAIL: User without device tokens caused unexpected failure');
      }
    }

    // -------------------------------------------------------------
    // TEST 5 & 6: Recipient isolation (Actor does NOT get push)
    // -------------------------------------------------------------
    console.log('--- TEST 5 & 6: Recipient receives push, Actor is NOT targeted ---');
    {
      fcmDispatches.length = 0;
      const eventId = `test_evt_actor_check_${Date.now()}`;

      // Actor requests booking, Recipient is ride owner
      await createOutboxEvent({
        eventId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
        recipientId,
        payload: { passengerName: 'Actor User', source: 'A', destination: 'B' }
      });

      await dispatchOutboxEvents({ eventId });

      const lastDispatch = fcmDispatches[fcmDispatches.length - 1];
      const sentToRecipient = lastDispatch?.tokens?.includes(recipientToken);
      const sentToActor = lastDispatch?.tokens?.includes(actorToken);

      console.log(`Sent to recipient token: ${sentToRecipient}`);
      console.log(`Sent to actor token: ${sentToActor} (expected false)`);

      if (sentToRecipient && !sentToActor) {
        console.log('PASS: Recipient received push, Actor was strictly excluded.\n');
      } else {
        throw new Error('FAIL: Push leaked to actor or missed recipient');
      }
    }

    // -------------------------------------------------------------
    // TEST 7: All 6 existing booking notification types mapped
    // -------------------------------------------------------------
    console.log('--- TEST 7: All 6 existing booking notification types mapped ---');
    {
      const eventTypes = [
        NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
        NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED,
        NOTIFICATION_JOB_TYPES.BOOKING_REJECTED,
        NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
        NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER,
        NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER
      ];

      for (const et of eventTypes) {
        fcmDispatches.length = 0;
        const eventId = `test_evt_type_${et}_${Date.now()}`;

        await createOutboxEvent({
          eventId,
          eventType: et,
          recipientId,
          payload: { source: 'A', destination: 'B', requestedSeats: 1 }
        });

        await dispatchOutboxEvents({ eventId });
        const lastDispatch = fcmDispatches[fcmDispatches.length - 1];

        if (!lastDispatch || !lastDispatch.notification?.title) {
          throw new Error(`FAIL: Event type ${et} did not produce a valid notification`);
        }
        console.log(`Event "${et}" -> Title: "${lastDispatch.notification.title}"`);
      }
      console.log('PASS: All 6 booking event types successfully mapped and dispatched.\n');
    }

    // -------------------------------------------------------------
    // TEST 8 & 9: Push idempotency during Outbox retries
    // -------------------------------------------------------------
    console.log('--- TEST 8 & 9: Push idempotency during Outbox retries ---');
    {
      fcmDispatches.length = 0;
      const eventId = `test_evt_retry_idempotent_${Date.now()}`;

      // Create event
      const event = await createOutboxEvent({
        eventId,
        eventType: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
        recipientId,
        payload: { source: 'Campus', destination: 'Airport' }
      });

      // First processing run
      await dispatchOutboxEvents({ eventId });
      const firstDispatchesCount = fcmDispatches.length;
      console.log(`FCM dispatches after initial processing: ${firstDispatchesCount}`);

      // Simulate transient failure afterwards: force outbox back to 'pending' to simulate retry
      await Outbox.updateOne({ eventId }, { $set: { status: 'pending', retries: 1 } });

      // Second processing run (the retry)
      await dispatchOutboxEvents({ eventId });
      const secondDispatchesCount = fcmDispatches.length;
      console.log(`FCM dispatches after Outbox retry: ${secondDispatchesCount}`);

      // Check Notification documents count (must remain exactly 1)
      const notifDocsCount = await Notification.countDocuments({ eventId });
      console.log(`In-app notification count in DB: ${notifDocsCount}`);

      if (firstDispatchesCount === 1 && secondDispatchesCount === 1 && notifDocsCount === 1) {
        console.log('PASS: Push idempotency verified! No duplicate FCM pushes and no duplicate in-app records during retries.\n');
      } else {
        throw new Error('FAIL: Outbox retry resulted in duplicate FCM pushes or duplicate notifications');
      }
    }

    // -------------------------------------------------------------
    // Clean up test fixtures
    // -------------------------------------------------------------
    await DeviceToken.deleteMany({
      token: { $in: [recipientToken, actorToken] }
    });
    await Outbox.deleteMany({
      recipientId: { $in: [recipientId, actorId] }
    });
    await Notification.deleteMany({
      recipientId: { $in: [recipientId, actorId] }
    });

    console.log('=== ALL STEP 4 TESTS PASSED PERFECTLY! ===');
  } finally {
    resetMockMessaging();
    await closeNotificationQueue().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

runStep4Tests().catch((err) => {
  console.error('STEP 4 TEST FAILED:', err);
  process.exit(1);
});
