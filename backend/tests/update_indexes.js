import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';

async function updateIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await Travel.collection.indexes();
  const ttlIdx = indexes.find(i => i.name === 'expiresAt_1' && i.expireAfterSeconds !== undefined);
  if (ttlIdx) {
    console.log('Dropping legacy TTL index expiresAt_1...');
    await Travel.collection.dropIndex('expiresAt_1');
    console.log('Legacy TTL index dropped.');
  }
  console.log('Syncing Travel model indexes...');
  await Travel.syncIndexes();
  const updated = await Travel.collection.indexes();
  console.log('Updated indexes:');
  console.log(JSON.stringify(updated, null, 2));
  await mongoose.disconnect();
}
updateIndexes();

