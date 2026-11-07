import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
  const student = await Student.findOne({
    $or: [
      { clerkId: 'firebase_eKYKEaAVnFeRl06vtlywoCffqQg1' },
      { firebaseUid: 'eKYKEaAVnFeRl06vtlywoCffqQg1' },
      { clerkId: 'eKYKEaAVnFeRl06vtlywoCffqQg1' }
    ]
  }).lean();
  console.log('Student:', student ? { name: student.name, email: student.email, clerkId: student.clerkId, firebaseUid: student.firebaseUid } : 'NOT FOUND');
  await mongoose.disconnect();
}
inspect().catch(console.error);

