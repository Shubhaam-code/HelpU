import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import CurriculumCourse from '../src/models/CurriculumCourse.js';
import CourseCatalog from '../src/models/CourseCatalog.js';
import UserCourse from '../src/models/UserCourse.js';
import CourseUpload from '../src/models/CourseUpload.js';

async function main() {
  await connectDB();

  for (const model of [CurriculumCourse, CourseCatalog, UserCourse, CourseUpload]) {
    await model.syncIndexes();
    const indexes = await model.collection.indexes();
    console.log(`\n${model.collection.collectionName}:`);
    for (const index of indexes) {
      console.log(`  ${index.name} ${JSON.stringify(index.key)}${index.unique ? ' UNIQUE' : ''}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[ffcsEnsureIndexes] Failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
