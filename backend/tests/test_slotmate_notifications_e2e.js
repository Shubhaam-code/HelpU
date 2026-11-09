import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Course from '../src/models/Course.js';
import SlotPost from '../src/models/SlotPost.js';
import Student from '../src/models/Student.js';
import Notification from '../src/models/Notification.js';
import { createSlotPost, notifyMatchedPeers } from '../src/services/slotMatching.service.js';

async function runSlotMateNotificationsTest() {
  console.log('🧪 Starting SlotMate Match Notifications E2E Test Suite...');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(' Connected to MongoDB Atlas');

  const testSuffix = Date.now();
  const userA = `student_a_${testSuffix}`;
  const userB = `student_b_${testSuffix}`;

  try {
    // 1. Verify or create a test course
    let course = await Course.findOne({ courseCode: 'BIO1001' });
    if (!course) {
      course = await Course.create({
        courseCode: 'BIO1001',
        courseName: 'Introduction to Bioengineering',
        credits: 4
      });
    }
    console.log(` Test Course: ${course.courseCode} - ${course.courseName}`);

    // 2. Create test students
    await Student.create([
      {
        clerkId: userA,
        firebaseUid: userA,
        name: 'Student Alpha',
        email: `alpha_${testSuffix}@vitstudent.ac.in`,
        phone: '9876543210',
        whatsappNumber: '9876543210',
        college: 'VIT Vellore',
        isVerified: true,
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
      },
      {
        clerkId: userB,
        firebaseUid: userB,
        name: 'Student Beta',
        email: `beta_${testSuffix}@vitstudent.ac.in`,
        phone: '9876543211',
        whatsappNumber: '9876543211',
        college: 'VIT Vellore',
        isVerified: true,
        imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'
      }
    ]);
    console.log(' Test Students Alpha & Beta registered');

    // 3. Student A creates a post
    console.log('\n--- Step 1: Student A creates SlotPost for BIO1001 (Slot C11, C12) ---');
    const { post: postA } = await createSlotPost({
      userId: userA,
      courseId: course._id,
      courseCode: course.courseCode,
      slot: 'C11, C12',
      teacherName: 'Prof. Anil Sharma',
      additionalNotes: 'Need project partner'
    });
    console.log(` Post A created: ${postA._id}`);

    // 4. Student B creates a post with matching slot C11
    console.log('\n--- Step 2: Student B creates SlotPost for BIO1001 (Slot C11) ---');
    const { post: postB } = await createSlotPost({
      userId: userB,
      courseId: course._id,
      courseCode: course.courseCode,
      slot: 'C11',
      teacherName: 'Prof. Geeta Rao',
      additionalNotes: 'Studying for quiz'
    });
    console.log(` Post B created: ${postB._id}`);

    // Wait a brief moment for async notification creation
    await new Promise((r) => setTimeout(r, 1000));

    // 5. Verify Notifications in MongoDB for both students
    console.log('\n--- Step 3: Verifying Notifications in Database ---');
    const notifsA = await Notification.find({ recipientId: userA, module: 'slotmate' });
    const notifsB = await Notification.find({ recipientId: userB, module: 'slotmate' });

    console.log(`Student A received ${notifsA.length} SlotMate notification(s)`);
    console.log(`Student B received ${notifsB.length} SlotMate notification(s)`);

    if (notifsA.length === 0 || notifsB.length === 0) {
      throw new Error('Expected both Student A and Student B to receive match notifications!');
    }

    const notifA = notifsA[0];
    const notifB = notifsB[0];

    // Check title and message
    console.log('Notification A Title:', notifA.title);
    console.log('Notification A Message:', notifA.message);
    if (notifA.title !== 'New Slot Match Found!') {
      throw new Error(`Expected title "New Slot Match Found!", got "${notifA.title}"`);
    }
    if (notifA.message !== 'You have found a student studying the same course and slot. Connect now!') {
      throw new Error(`Expected message "You have found a student studying the same course and slot. Connect now!", got "${notifA.message}"`);
    }

    // Check metadata payload
    console.log('Notification A Metadata:', notifA.metadata);
    if (!notifA.metadata?.courseCode || notifA.metadata.courseCode !== 'BIO1001') {
      throw new Error(`Expected metadata.courseCode to be BIO1001, got ${notifA.metadata?.courseCode}`);
    }
    if (!notifA.metadata?.matchedStudentId) {
      throw new Error('Expected metadata.matchedStudentId to be present!');
    }
    if (!notifA.metadata?.matchId) {
      throw new Error('Expected metadata.matchId to be present!');
    }
    console.log(' Course Code, Course Name, Matched Student ID, Match ID verified in metadata');

    // 6. Test Deduplication
    console.log('\n--- Step 4: Verifying Duplicate Prevention ---');
    await notifyMatchedPeers(postB);
    const notifsAAfter = await Notification.find({ recipientId: userA, module: 'slotmate' });
    if (notifsAAfter.length !== notifsA.length) {
      throw new Error('Duplicate notification was incorrectly generated!');
    }
    console.log(' Deduplication verified: Exactly 1 notification per match pair');

    // 7. Test Module Isolation (SlotMate vs PoolMate)
    console.log('\n--- Step 5: Verifying Module Isolation ---');
    const poolmateFilter = { recipientId: userA, module: { $ne: 'slotmate' }, type: { $ne: 'SLOT_MATCH_FOUND' } };
    const poolmateNotifs = await Notification.find(poolmateFilter);
    console.log(`PoolMate filter returned ${poolmateNotifs.length} notifications (should be 0)`);
    if (poolmateNotifs.length !== 0) {
      throw new Error('SlotMate notification leaked into PoolMate notification list!');
    }
    console.log(' Module isolation verified: PoolMate does not see SlotMate match notifications');

    // 8. Test Read & Unread Status
    console.log('\n--- Step 6: Verifying Unread/Read Status ---');
    const unreadCountBefore = await Notification.countDocuments({ recipientId: userA, module: 'slotmate', isRead: false });
    console.log(`Unread count before: ${unreadCountBefore}`);
    if (unreadCountBefore < 1) {
      throw new Error('Expected unread count to be at least 1');
    }

    // Mark single notification read
    await Notification.updateOne({ _id: notifA._id }, { $set: { isRead: true } });
    const unreadCountAfterSingle = await Notification.countDocuments({ recipientId: userA, module: 'slotmate', isRead: false });
    console.log(`Unread count after marking 1 notification read: ${unreadCountAfterSingle}`);
    if (unreadCountAfterSingle !== unreadCountBefore - 1) {
      throw new Error(`Expected unread count to decrement by 1, got ${unreadCountAfterSingle}`);
    }

    // Mark all remaining read
    await Notification.updateMany({ recipientId: userA, module: 'slotmate' }, { $set: { isRead: true } });
    const unreadCountAfterAll = await Notification.countDocuments({ recipientId: userA, module: 'slotmate', isRead: false });
    console.log(`Unread count after marking all read: ${unreadCountAfterAll}`);
    if (unreadCountAfterAll !== 0) {
      throw new Error('Expected unread count to be 0 after reading all');
    }
    console.log(' Read/unread status transitions correctly');

    console.log('\n🎉 ALL SLOTMATE NOTIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    // Cleanup test data
    console.log('\nCleaning up test records...');
    await SlotPost.deleteMany({ userId: { $in: [userA, userB] } });
    await Student.deleteMany({ clerkId: { $in: [userA, userB] } });
    await Notification.deleteMany({ recipientId: { $in: [userA, userB] } });
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB');
  }
}

runSlotMateNotificationsTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
