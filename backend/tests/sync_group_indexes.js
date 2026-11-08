import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import SharedRideGroup from '../src/models/SharedRideGroup.js';

async function sync() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  try {
    await SharedRideGroup.collection.dropIndex('proposalKey_1');
    console.log('Dropped old proposalKey_1 index');
  } catch (err) {
    console.log('Index drop note:', err.message);
  }
  await SharedRideGroup.syncIndexes();
  const indexes = await SharedRideGroup.collection.indexes();
  console.log('Updated indexes on SharedRideGroup:', indexes.map(i => ({ name: i.name, partial: i.partialFilterExpression })));
  await mongoose.disconnect();
  console.log('Disconnected.');
}

sync().catch(console.error);
