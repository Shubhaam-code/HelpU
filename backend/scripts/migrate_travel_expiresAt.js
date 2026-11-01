import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Travel, { calculateExpiresAt } from '../src/models/Travel.js';

async function migrateTravelExpiresAt() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  console.log('Connecting to MongoDB at:', mongoUri);
  await mongoose.connect(mongoUri);

  try {
    // 1. Sync indexes (ensuring the TTL index is registered in MongoDB)
    console.log('Syncing Travel model indexes in MongoDB...');
    await Travel.syncIndexes();
    console.log('Indexes synchronized successfully.');

    // 2. Find any posts without expiresAt
    const filter = {
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null }
      ]
    };

    const postsToMigrate = await Travel.find(filter);
    console.log(`Found ${postsToMigrate.length} travel post(s) without expiresAt.`);

    let updatedCount = 0;
    for (const post of postsToMigrate) {
      if (post.travelDate) {
        post.expiresAt = calculateExpiresAt(post.travelDate);
        await post.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete: Successfully updated ${updatedCount} post(s) with expiresAt.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrateTravelExpiresAt();
