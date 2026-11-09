import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import { importCoursesToDatabase } from '../src/services/courseCatalogue.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('🚀 Starting SlotMate Course Catalogue PDF Import...');
  
  await connectDB();

  const pdfPath = path.join(__dirname, '../circulam.pdf');
  console.log(`📄 Reading curriculum PDF from: ${pdfPath}`);

  const startTime = Date.now();
  const result = await importCoursesToDatabase(pdfPath);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================ IMPORT REPORT ================');
  console.log(`Status:              ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Total Courses:       ${result.totalExtracted}`);
  console.log(`Duplicates Prevented:${result.duplicateCount}`);
  console.log(`New Inserted/Upsert: ${result.upsertedCount}`);
  console.log(`Matched Existing:    ${result.matchedCount}`);
  console.log(`Total in Database:   ${result.totalInDb}`);
  console.log(`Execution Time:      ${duration}s`);
  console.log('================================================\n');

  await mongoose.disconnect();
  console.log('✅ MongoDB connection closed.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Course import failed:', err);
  process.exit(1);
});

