/**
 * Faculty CSV Import Script
 * ─────────────────────────
 * Imports faculty data from backend/data/faculty_reviews.csv into MongoDB.
 *
 * Usage:
 *   cd backend
 *   node scripts/importFaculty.js
 *
 * Features:
 * - Idempotent: safe to run multiple times (upserts by facultyId)
 * - Never deletes or wipes existing records
 * - Handles embedded JSON reviews column
 * - Reports detailed import statistics
 * - Validates required fields before import
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import { parseFacultyRow, bulkUpsertFaculty } from '../src/services/faculty.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── CSV Parser ──────────────────────────────────────────────────────────────
// Handles:
//   - Quoted fields (may contain commas and embedded double-quoted JSON)
//   - Windows (CRLF) and Unix (LF) line endings
//   - Empty fields

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text) {
  // Strip UTF-8 BOM if present (char code 0xFEFF)
  const stripped = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const rawLines = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = rawLines.filter((l) => l.trim() !== '');
  if (nonEmpty.length < 2) return { header: [], rows: [] };

  const header = parseCSVLine(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map((line) => parseCSVLine(line));
  return { header, rows };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const csvPath = path.join(__dirname, '../data/faculty_reviews.csv');

  console.log('══════════════════════════════════════════════════════');
  console.log('  HELPU – Faculty CSV Import Script');
  console.log('══════════════════════════════════════════════════════');
  console.log(`📄 CSV Path  : ${csvPath}`);
  console.log(`🕐 Started   : ${new Date().toISOString()}`);
  console.log('──────────────────────────────────────────────────────');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    console.error('   Place your faculty CSV at backend/data/faculty_reviews.csv');
    process.exit(1);
  }

  // Connect to MongoDB
  await connectDB();
  console.log('✅ Database connected');
  console.log('──────────────────────────────────────────────────────');

  // Read and parse CSV
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const { header, rows } = parseCSV(csvText);

  if (header.length === 0) {
    console.error('❌ CSV file is empty or header is missing');
    process.exit(1);
  }

  console.log(`📊 CSV Columns  : ${header.join(', ')}`);
  console.log(`📊 Total Rows   : ${rows.length}`);
  console.log('──────────────────────────────────────────────────────');

  // Statistics counters
  const stats = {
    total: rows.length,
    valid: 0,
    invalid: 0,
    invalidReasons: [],
    upserted: 0,
    matched: 0,
    modified: 0,
    skipped: 0
  };

  // Parse and validate records
  const validRecords = [];
  for (let i = 0; i < rows.length; i++) {
    const lineNum = i + 2; // 1-based, offset for header
    const record = parseFacultyRow(rows[i], header);

    if (!record) {
      stats.invalid++;
      stats.invalidReasons.push(`Line ${lineNum}: Missing facultyId or name`);
      continue;
    }

    stats.valid++;
    validRecords.push(record);
  }

  if (stats.invalid > 0) {
    console.warn(`⚠️  Invalid Records: ${stats.invalid}`);
    stats.invalidReasons.slice(0, 10).forEach((r) => console.warn(`   ${r}`));
    if (stats.invalidReasons.length > 10) {
      console.warn(`   ... and ${stats.invalidReasons.length - 10} more`);
    }
    console.log('──────────────────────────────────────────────────────');
  }

  if (validRecords.length === 0) {
    console.error('❌ No valid records to import');
    process.exit(1);
  }

  // Bulk upsert in batches of 100
  const BATCH_SIZE = 100;
  const startTime = Date.now();

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);
    const result = await bulkUpsertFaculty(batch);
    stats.upserted += result.upsertedCount;
    stats.matched += result.matchedCount;
    stats.modified += result.modifiedCount;
  }

  const durationMs = Date.now() - startTime;

  // Post-import count from DB
  const { default: Faculty } = await import('../src/models/Faculty.js');
  const totalInDb = await Faculty.countDocuments();
  const activeInDb = await Faculty.countDocuments({ isActive: true });

  // Final Report
  console.log('══════════════════════════════════════════════════════');
  console.log('  IMPORT REPORT');
  console.log('══════════════════════════════════════════════════════');
  console.log(`Status                : SUCCESS`);
  console.log(`Total CSV Records     : ${stats.total}`);
  console.log(`Valid Records         : ${stats.valid}`);
  console.log(`Invalid Records       : ${stats.invalid}`);
  console.log(`──────────────────────────────────────────────────────`);
  console.log(`New Inserted (Upsert) : ${stats.upserted}`);
  console.log(`Matched Existing      : ${stats.matched}`);
  console.log(`Updated Fields        : ${stats.modified}`);
  console.log(`──────────────────────────────────────────────────────`);
  console.log(`Total in Database     : ${totalInDb}`);
  console.log(`Active Faculty        : ${activeInDb}`);
  console.log(`Import Duration       : ${durationMs}ms`);
  console.log('══════════════════════════════════════════════════════');

  await mongoose.disconnect();
  console.log('✅ Database connection closed.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
