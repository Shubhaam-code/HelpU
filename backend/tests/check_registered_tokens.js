import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import DeviceToken from '../src/models/DeviceToken.js';
import Student from '../src/models/Student.js';

async function checkTokens() {
  await connectDB();

  const motorolaToken = 'femR1AbQQZO7BTgIqVQCKL:APA91bGcv38H6xSOmAofawohTAPUerN6cbFgHGc8YOYAlMnIBk2FwlZPM4NAqo97a3cB5ylH_RwN2ctOAExrLuww5W3XW3s3q0RkECi_ziSZe1CfWBhJDgs';

  const tokens = await DeviceToken.find({}).lean();
  console.log('Total Device Tokens Registered in MongoDB:', tokens.length);

  const matched = tokens.find(t => t.token === motorolaToken);
  if (matched) {
    const student = await Student.findOne({ clerkId: matched.userId }).lean();
    console.log('\n[MATCH FOUND] Motorola Device Token IS registered in MongoDB!');
    console.log('- User Clerk ID:', matched.userId);
    console.log('- Student Name:', student?.name || 'Unknown');
    console.log('- Student Email:', student?.email || 'Unknown');
    console.log('- Platform:', matched.platform);
    console.log('- Last Seen:', matched.lastSeenAt);
  } else {
    console.log('\n[NOT REGISTERED YET] Motorola Device Token is NOT yet in the MongoDB DeviceToken collection.');
    console.log('Available tokens:');
    tokens.forEach(t => {
      console.log(`- User: ${t.userId} | Prefix: ${t.token.slice(0, 10)}... | Last Seen: ${t.lastSeenAt}`);
    });
  }

  await mongoose.disconnect();
}

checkTokens().catch(err => {
  console.error(err);
  process.exit(1);
});

