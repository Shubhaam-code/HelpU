import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import mongoose from 'mongoose';

async function cleanup() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const notificationsCol = mongoose.connection.collection('notifications');
  
  // Find notifications where student name is Student Beta or Student Alpha, or test data
  const testNotifs = await notificationsCol.find({
    $or: [
      { 'metadata.matchedStudentName': { $in: ['Student Beta', 'Student Alpha'] } },
      { 'sender.name': { $in: ['Student Beta', 'Student Alpha'] } },
      { recipientId: { $regex: /^student_/ } }
    ]
  }).toArray();

  console.log(`Found ${testNotifs.length} dummy/test notifications to clean up:`);
  testNotifs.forEach(n => {
    console.log(`- ID: ${n._id}, recipient: ${n.recipientId}, student: ${n.metadata?.matchedStudentName || n.sender?.name}, created: ${n.createdAt}`);
  });

  const deleteResult = await notificationsCol.deleteMany({
    $or: [
      { 'metadata.matchedStudentName': { $in: ['Student Beta', 'Student Alpha'] } },
      { 'sender.name': { $in: ['Student Beta', 'Student Alpha'] } },
      { recipientId: { $regex: /^student_/ } }
    ]
  });

  console.log(`Deleted ${deleteResult.deletedCount} dummy notifications successfully.`);

  // Check remaining notifications
  const remaining = await notificationsCol.find({ module: 'slotmate' }).toArray();
  console.log(`Remaining SlotMate notifications in DB: ${remaining.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
