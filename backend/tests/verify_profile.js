import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';

async function testCompleteProfileFlow() {
  await mongoose.connect('mongodb://127.0.0.1:27017/campuspool');

  const userId = 'user_3LUaC2SwHxUuutmAWAdJk6AcWmy';
  console.log('Testing with Clerk userId:', userId);

  // 1. Clean up any previous test record
  await Student.deleteMany({ clerkId: userId });

  // 2. Simulate fresh profile submission (POST /api/students/profile)
  console.log('\n--- Step 1: Submitting Profile (POST /api/students/profile) ---');
  const profilePayload = {
    name: 'Campus Pool Student',
    email: 'campuspool_test@example.com',
    phone: '+91 98765 43210',
    college: 'Delhi Technological University'
  };

  const student = await Student.findOneAndUpdate(
    { clerkId: userId },
    {
      $set: profilePayload,
      $setOnInsert: { clerkId: userId }
    },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  );

  console.log('Saved Profile:\n', JSON.stringify(student, null, 2));

  // 3. Verify in MongoDB
  console.log('\n--- Step 2: Verifying in MongoDB ---');
  const docInDb = await Student.findOne({ clerkId: userId });
  console.log('Document found in MongoDB:', docInDb !== null);
  console.log('Stored Name:', docInDb.name);
  console.log('Stored Email:', docInDb.email);
  console.log('Stored Phone:', docInDb.phone);
  console.log('Stored College:', docInDb.college);
  console.log('Created At:', docInDb.createdAt);

  // 4. Simulate Page Refresh (GET /api/students/profile)
  console.log('\n--- Step 3: Simulating Page Refresh (Profile Check) ---');
  const existingProfile = await Student.findOne({ clerkId: userId });
  if (existingProfile) {
    console.log('Profile exists on page reload: YES');
    console.log('Display Profile Summary View:');
    console.log({
      name: existingProfile.name,
      email: existingProfile.email,
      phone: existingProfile.phone,
      college: existingProfile.college,
      isVerified: existingProfile.isVerified
    });
  } else {
    console.log('Profile exists on page reload: NO (show form)');
  }

  await mongoose.disconnect();
}

testCompleteProfileFlow();
