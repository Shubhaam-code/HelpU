import mongoose from 'mongoose';
import Travel from '../src/models/Travel.js';

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await Travel.collection.indexes();
  console.log('TRAVEL INDEXES:');
  console.log(JSON.stringify(indexes, null, 2));
  await mongoose.disconnect();
}
check();

