import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Notification from '../src/models/Notification.js';
import { NOTIFICATION_JOB_TYPES } from '../src/jobs/notification.jobs.js';

async function testNotificationReadUnreadUX() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI is missing from environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  const studentA = 'student_test_a_' + Date.now();
  const studentB = 'student_test_b_' + Date.now();
  const createdNotifIds = [];

  try {
    console.log('================================================================');
    console.log('VERIFYING NOTIFICATION READ/UNREAD UX & PERSISTENCE RULES');
    console.log('================================================================\n');

    // SCENARIO 1: Create multiple notifications for studentA
    console.log('--- SCENARIO 1: Newly created notifications must be unread (isRead: false) ---');
    const notif1 = await Notification.create({
      eventId: 'evt_test_1_' + Date.now(),
      recipientId: studentA,
      type: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
      title: 'New Ride Request',
      message: 'Student X requested 1 seat for Bhopal Station',
      isRead: false
    });
    createdNotifIds.push(notif1._id);

    const notif2 = await Notification.create({
      eventId: 'evt_test_2_' + Date.now(),
      recipientId: studentA,
      type: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
      title: 'Ride Confirmed',
      message: 'Your ride from Campus to Airport is confirmed',
      isRead: false
    });
    createdNotifIds.push(notif2._id);

    const notif3 = await Notification.create({
      eventId: 'evt_test_3_' + Date.now(),
      recipientId: studentA,
      type: NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND,
      title: 'New Match Found',
      message: 'A matching ride was found for your trip',
      isRead: false
    });
    createdNotifIds.push(notif3._id);
    createdNotifIds.push(notif3._id);

    console.log(`Created 3 notifications for ${studentA}`);
    console.log(`- Notif 1 (ID: ${notif1._id}): isRead = ${notif1.isRead}`);
    console.log(`- Notif 2 (ID: ${notif2._id}): isRead = ${notif2.isRead}`);
    console.log(`- Notif 3 (ID: ${notif3._id}): isRead = ${notif3.isRead}`);

    if (notif1.isRead || notif2.isRead || notif3.isRead) {
      throw new Error('Assertion failed: New notifications should have isRead === false');
    }
    console.log('✓ PASS: All new notifications initialized as unread.\n');

    // SCENARIO 2: Opening the notification list must NOT mark notifications as read
    console.log('--- SCENARIO 2: Querying notifications list must preserve unread status ---');
    const fetchedList = await Notification.find({ recipientId: studentA }).sort({ createdAt: -1 });
    const unreadCount1 = await Notification.countDocuments({ recipientId: studentA, isRead: false });

    console.log(`Fetched ${fetchedList.length} notifications. Unread count in DB: ${unreadCount1}`);
    const anyMarkedRead = fetchedList.some(n => n.isRead === true);
    if (anyMarkedRead || unreadCount1 !== 3) {
      throw new Error(`Assertion failed: Querying notifications must not alter isRead. Unread count was ${unreadCount1}, expected 3`);
    }
    console.log('✓ PASS: Opening/fetching notification list does NOT mark them as read.\n');

    // SCENARIO 3: Opening/clicking a single notification marks ONLY that notification as read
    console.log('--- SCENARIO 3: Marking single notification as read (Isolation Test) ---');
    const targetId = notif2._id;
    const updatedNotif = await Notification.findOneAndUpdate(
      { _id: targetId, recipientId: studentA },
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    );

    console.log(`Marked notif2 (${targetId}) as read.`);
    console.log(`Updated notif isRead: ${updatedNotif.isRead}`);

    const remainingUnread = await Notification.countDocuments({ recipientId: studentA, isRead: false });
    console.log(`Remaining unread count: ${remainingUnread} (expected: 2)`);

    const checkNotif1 = await Notification.findById(notif1._id);
    const checkNotif2 = await Notification.findById(notif2._id);
    const checkNotif3 = await Notification.findById(notif3._id);

    console.log(`- Notif 1 isRead: ${checkNotif1.isRead} (expected: false)`);
    console.log(`- Notif 2 isRead: ${checkNotif2.isRead} (expected: true)`);
    console.log(`- Notif 3 isRead: ${checkNotif3.isRead} (expected: false)`);

    if (checkNotif1.isRead !== false || checkNotif2.isRead !== true || checkNotif3.isRead !== false) {
      throw new Error('Assertion failed: Only the target notification must be marked read; other notifications must stay unread!');
    }
    if (remainingUnread !== 2) {
      throw new Error(`Assertion failed: Expected unread count of 2, got ${remainingUnread}`);
    }
    console.log('✓ PASS: Target notification marked read; remaining notifications remain completely unread.\n');

    // SCENARIO 4: Ownership isolation (Student B cannot mark Student A's notification)
    console.log('--- SCENARIO 4: Recipient isolation / unauthorized mark read ---');
    const unauthorizedAttempt = await Notification.findOneAndUpdate(
      { _id: notif1._id, recipientId: studentB },
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    );
    if (unauthorizedAttempt !== null) {
      throw new Error('Assertion failed: Another user should not be able to mark notification as read!');
    }
    const checkStillUnread = await Notification.findById(notif1._id);
    if (checkStillUnread.isRead !== false) {
      throw new Error('Assertion failed: Notification was altered by unauthorized user!');
    }
    console.log('✓ PASS: Recipient security verified. Another user cannot mark notification as read.\n');

    // SCENARIO 5: Persistence across re-reads
    console.log('--- SCENARIO 5: Read status persistence ---');
    const reFetchedList = await Notification.find({ recipientId: studentA }).sort({ createdAt: -1 });
    const readItems = reFetchedList.filter(n => n.isRead === true);
    const unreadItems = reFetchedList.filter(n => n.isRead === false);

    console.log(`Total items: ${reFetchedList.length}, Read items: ${readItems.length}, Unread items: ${unreadItems.length}`);
    if (readItems.length !== 1 || unreadItems.length !== 2) {
      throw new Error('Assertion failed: Notification read state did not persist properly across queries.');
    }
    console.log('✓ PASS: Read/unread states permanently persist in database.\n');

    console.log('================================================================');
    console.log('ALL NOTIFICATION READ/UNREAD UX & PERSISTENCE TESTS PASSED 100%');
    console.log('================================================================\n');

  } finally {
    // Cleanup
    if (createdNotifIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotifIds } });
      console.log(`Cleaned up ${createdNotifIds.length} test notifications.`);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

testNotificationReadUnreadUX().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
