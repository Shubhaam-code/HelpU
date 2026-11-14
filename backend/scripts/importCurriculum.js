import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';
import { ingestCurriculum } from '../src/services/curriculumIngestion.service.js';

function resolvePdfPath() {
  const candidates = [
    process.argv[2],
    path.join(__dirname, '../circulam.pdf'),
    path.join(__dirname, '../curriculam.pdf'),
    path.join(__dirname, '../../curriculam.pdf'),
    path.join(__dirname, '../../circulam.pdf'),
    path.resolve('circulam.pdf'),
    path.resolve('curriculam.pdf')
  ].filter(Boolean);

  for (const c of candidates) {
    if (existsSync(c)) {
      return path.resolve(c);
    }
  }
  throw new Error(`Curriculum PDF not found. Looked in: ${candidates.join(', ')}`);
}

async function main() {
  const filePath = resolvePdfPath();
  const curriculumVersion = process.argv[3] || process.env.CURRICULUM_VERSION || '2024-2025';
  const institution = process.argv[4] || process.env.DEFAULT_INSTITUTION || 'VIT';

  console.log(`[importCurriculum] Ingesting PDF: ${filePath}`);
  console.log(`[importCurriculum] Version: ${curriculumVersion}, Institution: ${institution}`);

  const buffer = await fs.readFile(filePath);

  await connectDB();

  const result = await ingestCurriculum({
    buffer,
    fileName: path.basename(filePath),
    originalName: path.basename(filePath),
    mimeType: 'application/pdf',
    institution,
    curriculumVersion,
    uploadedBy: 'cli-import',
    activate: true
  });

  console.log('[importCurriculum] Ingestion Result:');
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[importCurriculum] Failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
