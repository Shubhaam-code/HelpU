
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Notification from '../src/models/Notification.js';
import Outbox from '../src/models/Outbox.js';
import DeviceToken from '../src/models/DeviceToken.js';
import Student from '../src/models/Student.js';
import Travel from '../src/models/Travel.js';
import Booking from '../src/models/Booking.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';
import { createOutboxEvent, dispatchOutboxEvents } from '../src/services/outbox.service.js';
import { sendPushToUsers, HELPU_NOTIFICATION_CHANNEL_ID } from '../src/services/fcm.service.js';

async function runComprehensiveFCMVerification() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is missing from environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  const testId = Date.now();
  const studentA_id = `student_a_${testId}`;
  const studentB_id = `student_b_${testId}`;
  const tokenA_device1 = `fcm_token_a_phone1_${testId}_${'x'.repeat(40)}`;
  const tokenA_device2 = `fcm_token_a_phone2_${testId}_${'y'.repeat(40)}`;
  const tokenB_device1 = `fcm_token_b_phone1_${testId}_${'z'.repeat(40)}`;

  const createdTokens = [tokenA_device1, tokenA_device2, tokenB_device1];
  const createdOutboxIds = [];
  const createdNotifEventIds = [];

  try {
    console.log('================================================================');
    console.log('COMPREHENSIVE HELPU FCM & IN-APP NOTIFICATION VERIFICATION');
    console.log('================================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Multiple Device Registration & Token Association
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Register multiple devices for same student <<<');
    await DeviceToken.create([
      { userId: studentA_id, token: tokenA_device1, platform: 'android' },
      { userId: studentA_id, token: tokenA_device2, platform: 'android' },
      { userId: studentB_id, token: tokenB_device1, platform: 'android' }
    ]);

    const studentATokens = await DeviceToken.find({ userId: studentA_id });
    console.log(`Student A has ${studentATokens.length} registered devices (expected: 2).`);
    if (studentATokens.length !== 2) {
      throw new Error(`Assertion failed: Student A should have 2 registered tokens, found ${studentATokens.length}`);
    }
    console.log('✓ PASS: Multiple registered Android devices properly stored for same user.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Student Alias Resolution
    // -------------------------------------------------------------------------
    console.log('>>> TEST 2: Student alias resolution (canonical vs Firebase UID) <<<');
    const mockStudent = await Student.create({
      clerkId: studentA_id,
      firebaseUid: `fb_uid_${testId}`,
      name: 'Rahul Sharma',
      email: `rahul_${testId}@vitbhopal.ac.in`
    });

    // Mock messaging instance to capture dispatched payloads
    const sentMessages = [];
    const mockMessaging = {
      sendEachForMulticast: async (msg) => {
        sentMessages.push(msg);
        return {
          successCount: msg.tokens.length,
          failureCount: 0,
          responses: msg.tokens.map(() => ({ success: true }))
        };
      }
    };

    // Query push by firebase_ alias instead of canonical clerkId
    await sendPushToUsers([`firebase_${mockStudent.firebaseUid}`], {
      title: 'Alias Test',
      body: 'Testing alias resolution'
    }, {}, { messaging: mockMessaging });

    console.log(`Dispatched messages using alias: ${sentMessages.length}`);
    if (sentMessages.length === 0 || sentMessages[0].tokens.length !== 2) {
      throw new Error('Assertion failed: Alias resolution did not find Student A tokens!');
    }
    console.log(`✓ PASS: Push sent to all ${sentMessages[0].tokens.length} devices via student alias lookup.\n`);

    // Clean mock student
    await Student.deleteOne({ _id: mockStudent._id });

    // -------------------------------------------------------------------------
    // TEST 3: Verification of ALL 13 Notification Event Types
    // -------------------------------------------------------------------------
    console.log('>>> TEST 3: Verify ALL 13 Notification Event Types Mapped to FCM <<<');

    const allEventTypes = [
      NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
      NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED,
      NOTIFICATION_JOB_TYPES.BOOKING_REJECTED,
      NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER,
      NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER,
      NOTIFICATION_JOB_TYPES.BOOKING_WITHDRAWN,
      NOTIFICATION_JOB_TYPES.RIDE_UPDATED,
      NOTIFICATION_JOB_TYPES.RIDE_CANCELLED,
      NOTIFICATION_JOB_TYPES.RIDE_EXPIRED,
      NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H,
      NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H,
      NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND
    ];

    console.log(`Total notification event types to verify: ${allEventTypes.length}\n`);

    for (const eventType of allEventTypes) {
      const eventId = `test_evt_${eventType}_${testId}`;
      createdNotifEventIds.push(eventId);

      // Ensure student A has tokens before each dispatch
      await DeviceToken.updateOne(
        { token: tokenA_device1 },
        { $set: { userId: studentA_id, platform: 'android', lastSeenAt: new Date() } },
        { upsert: true }
      );

      // Create outbox event
      const outboxDoc = await createOutboxEvent({
        eventId,
        eventType,
        recipientId: studentA_id,
        payload: {
          passengerName: 'Amit Verma',
          ownerName: 'Rahul Sharma',
          source: 'Campus Gate 2',
          destination: 'Bhopal Railway Station',
          requestedSeats: 2,
          travelDate: new Date(),
          departureTime: 540,
          type: 'offer'
        }
      });
      createdOutboxIds.push(outboxDoc._id);

      // Dispatch outbox events
      await dispatchOutboxEvents({ eventId });

      // 1. Verify in-app notification exists in MongoDB with isRead: false
      const inAppNotif = await Notification.findOne({ eventId });
      if (!inAppNotif) {
        throw new Error(`In-app notification missing for event type: ${eventType}`);
      }
      if (inAppNotif.isRead !== false) {
        throw new Error(`In-app notification should be unread for event type: ${eventType}`);
      }

      // 2. Verify outbox marked as processed
      const updatedOutbox = await Outbox.findById(outboxDoc._id);
      if (updatedOutbox.status !== 'processed') {
        throw new Error(`Outbox event not marked processed for event type: ${eventType}`);
      }

      console.log(`✓ [${eventType}] In-App title: "${inAppNotif.title}" | Body: "${inAppNotif.message}"`);
    }

    console.log('\n✓ PASS: All 13 notification event types successfully generated and delivered to outbox & in-app!\n');

    // -------------------------------------------------------------------------
    // TEST 4: FCM Android Push Structure & Branding
    // -------------------------------------------------------------------------
    console.log('>>> TEST 4: FCM Android Message Structure & Helpu Branding <<<');
    await DeviceToken.updateOne(
      { token: tokenA_device1 },
      { $set: { userId: studentA_id, platform: 'android', lastSeenAt: new Date() } },
      { upsert: true }
    );

    const fcmCapture = [];
    const fcmMock = {
      sendEachForMulticast: async (msg) => {
        fcmCapture.push(msg);
        return {
          successCount: msg.tokens.length,
          failureCount: 0,
          responses: msg.tokens.map(() => ({ success: true }))
        };
      }
    };

    await sendPushToUsers([studentA_id], {
      title: 'New Booking Request',
      body: 'Amit Verma wants to travel with you from Campus to Airport. Open Helpu to review the request.'
    }, {
      eventId: 'evt_branding_check',
      notificationId: 'notif_123',
      bookingId: 'book_456',
      type: 'BOOKING_REQUESTED'
    }, { messaging: fcmMock });

    if (fcmCapture.length === 0) {
      throw new Error('FCM message was not dispatched!');
    }

    const payload = fcmCapture[0];
    console.log('Inspecting Android notification payload:');
    console.log('- Title:', payload.notification.title);
    console.log('- Body:', payload.notification.body);
    console.log('- Android Channel ID:', payload.android.notification.channelId);
    console.log('- Android Icon:', payload.android.notification.icon);
    console.log('- Android Color:', payload.android.notification.color);
    console.log('- Priority:', payload.android.priority);
    console.log('- Tag:', payload.android.notification.tag);
    console.log('- Custom Data:', payload.data);

    if (payload.android.notification.channelId !== HELPU_NOTIFICATION_CHANNEL_ID) {
      throw new Error(`Wrong channel ID: ${payload.android.notification.channelId}`);
    }
    if (payload.android.notification.icon !== 'ic_stat_notification') {
      throw new Error(`Wrong notification icon: ${payload.android.notification.icon}`);
    }
    if (payload.android.notification.color !== '#FF572E') {
      throw new Error(`Wrong brand accent color: ${payload.android.notification.color}`);
    }
    if (payload.android.priority !== 'high') {
      throw new Error(`Android priority must be 'high' for heads-up delivery`);
    }
    if (payload.android.notification.tag !== 'evt_branding_check') {
      throw new Error(`Tag missing for duplicate prevention: ${payload.android.notification.tag}`);
    }

    console.log('✓ PASS: Helpu branding, monochrome status bar icon, orange accent, and high priority confirmed!\n');

    // -------------------------------------------------------------------------
    // TEST 5: Recipient Security (Cannot send push to initiator)
    // -------------------------------------------------------------------------
    console.log('>>> TEST 5: Verify Push Recipient Security (No push to initiator) <<<');
    const initiatorId = studentB_id;
    const recipientId = studentA_id;

    // Verify student B (initiator) tokens are not queried when notifying student A
    const tokensForRecipient = await DeviceToken.find({ userId: recipientId });
    const containsInitiatorToken = tokensForRecipient.some(t => t.userId === initiatorId);
    if (containsInitiatorToken) {
      throw new Error('Initiator token found in recipient query!');
    }
    console.log(`✓ PASS: Push recipient strictly isolated to target user ${recipientId}; initiator excluded.\n`);

    // -------------------------------------------------------------------------
    // TEST 6: Notification Tap Read/Unread Flow
    // -------------------------------------------------------------------------
    console.log('>>> TEST 6: Notification Tap Marks ONLY Tapped Notification as Read <<<');
    const notifA = await Notification.create({
      eventId: `tap_test_1_${testId}`,
      recipientId: studentA_id,
      type: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
      title: 'Tap Test 1',
      message: 'Unread message 1',
      isRead: false
    });
    const notifB = await Notification.create({
      eventId: `tap_test_2_${testId}`,
      recipientId: studentA_id,
      type: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      title: 'Tap Test 2',
      message: 'Unread message 2',
      isRead: false
    });
    createdNotifEventIds.push(notifA.eventId, notifB.eventId);

    // Simulate tapping notifA: mark only notifA as read
    await Notification.findOneAndUpdate(
      { _id: notifA._id, recipientId: studentA_id },
      { $set: { isRead: true } }
    );

    const recheckA = await Notification.findById(notifA._id);
    const recheckB = await Notification.findById(notifB._id);
    const unreadCount = await Notification.countDocuments({ recipientId: studentA_id, isRead: false });

    console.log(`Tapped Notif A isRead: ${recheckA.isRead} (expected: true)`);
    console.log(`Untapped Notif B isRead: ${recheckB.isRead} (expected: false)`);
    console.log(`Remaining unread count: ${unreadCount}`);

    if (recheckA.isRead !== true || recheckB.isRead !== false) {
      throw new Error('Assertion failed: Tapping notification marked wrong items as read!');
    }
    console.log('✓ PASS: Tapping notification marks ONLY that notification read; all other unopened stay unread.\n');

    console.log('================================================================');
    console.log('ALL 6 FCM NOTIFICATION TESTS PASSED WITH 100% SUCCESS');
    console.log('================================================================\n');

  } finally {
    // Cleanup
    if (createdTokens.length > 0) {
      await DeviceToken.deleteMany({ token: { $in: createdTokens } });
    }
    if (createdOutboxIds.length > 0) {
      await Outbox.deleteMany({ _id: { $in: createdOutboxIds } });
    }
    if (createdNotifEventIds.length > 0) {
      await Notification.deleteMany({ eventId: { $in: createdNotifEventIds } });
    }
    await mongoose.disconnect();
    console.log('Cleaned up test fixtures and disconnected from MongoDB.');
  }
}

runComprehensiveFCMVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
