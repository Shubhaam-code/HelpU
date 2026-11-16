import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

export async function createFacultyBackup() {
  await connectDB();
  const collection = mongoose.connection.collection('faculties');
  const count = await collection.countDocuments();
  console.log(`📦 Creating backup of ${count} faculty records...`);

  const docs = await collection.find({}).toArray();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../data/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `faculties_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2), 'utf8');

  console.log(`✅ Backup successfully created at: ${backupFile}`);
  console.log(`   Total records saved: ${docs.length} (${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB)`);
  return backupFile;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createFacultyBackup()
    .then(async (file) => {
      console.log('Done creating standalone backup.');
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
