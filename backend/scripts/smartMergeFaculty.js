/**
 * Smart Faculty JSON Data Merge & Database Import System
 * ───────────────────────────────────────────────────────
 * Features:
 * - Intelligent faculty matching (ID, normalizedName, token reordering)
 * - Review deduplication via content-hash / deterministic fingerprinting
 * - Weighted average rating calculations preserving 1.0-5.0 scale
 * - Safe pre-import backup creation
 * - Dry-run mode for previewing all changes
 * - Strict idempotency: running multiple times never duplicates reviews or changes stable ratings
 * - Comprehensive before/after statistics report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import Faculty, { normalizeFacultyName } from '../src/models/Faculty.js';
import { createFacultyBackup } from './backupFaculty.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Review Fingerprint Helper ────────────────────────────────────────────────
export function computeReviewFingerprint(rev) {
  const text = String(rev.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const rating = typeof rev.rating === 'number' && !isNaN(rev.rating) ? Number(rev.rating).toFixed(1) : 'none';
  const course = String(rev.course || '').trim().toLowerCase().replace(/\s+/g, ' ');

  let dateStr = 'none';
  if (rev.date) {
    const d = new Date(rev.date);
    dateStr = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : String(rev.date).trim();
  }

  return `${rating}|${course}|${dateStr}|${text}`;
}

// ─── Name Token Key (for reversed names like "Manikandan J" <-> "J. Manikandan")
export function getTokenKey(name = '') {
  const norm = normalizeFacultyName(name);
  return norm.split(' ').filter(Boolean).sort().join(' ');
}

// ─── Main Merge Function ──────────────────────────────────────────────────────
export async function smartMerge({ dryRun = false, jsonPath = null } = {}) {
  const targetJson = jsonPath || path.join(__dirname, '../data/new_faculty_records.json');

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`  HELPU – Smart Faculty JSON Data Merge & Database Import System`);
  console.log(`  Mode: ${dryRun ? '🔍 DRY RUN (Preview only - no DB writes)' : '🚀 LIVE IMPORT (Writing to DB)'}`);
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`📄 JSON Source : ${targetJson}`);
  console.log(`🕐 Started     : ${new Date().toISOString()}`);
  console.log('────────────────────────────────────────────────────────────────────────');

  if (!fs.existsSync(targetJson)) {
    throw new Error(`Target JSON file not found at: ${targetJson}`);
  }

  const rawJson = fs.readFileSync(targetJson, 'utf8');
  const incomingData = JSON.parse(rawJson);
  console.log(`📥 Total records in incoming JSON: ${incomingData.length}`);

  // Connect to DB
  await connectDB();
  console.log('✅ Connected to MongoDB.');

  // Pre-import Backup (only in live mode)
  if (!dryRun) {
    console.log('\n📦 Creating pre-import database backup...');
    const backupFile = await createFacultyBackup();
    console.log(`🛡️  Backup verified: ${path.basename(backupFile)}`);
  }

  // Load all existing faculty records
  console.log('\n🔍 Reading existing database faculty records...');
  const existingDocs = await Faculty.find({}).lean();
  console.log(`🏛️  Total existing faculty in DB: ${existingDocs.length}`);

  // Build lookup maps for existing faculty
  const byId = new Map();         // facultyId (e.g. "VITB-0001")
  const byExtId = new Map();      // externalId (e.g. "cmvy3ckiv000s...")
  const byNorm = new Map();       // normalizedName (e.g. "jagriti gupta")
  const byTokenKey = new Map();   // sorted tokens (e.g. "j manikandan")

  let maxVitbNum = 0;

  for (const doc of existingDocs) {
    if (doc.facultyId) {
      byId.set(doc.facultyId.toUpperCase(), doc);
      const match = doc.facultyId.match(/^VITB-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxVitbNum) maxVitbNum = num;
      }
    }
    if (doc.externalId) {
      byExtId.set(doc.externalId, doc);
    }
    if (doc.normalizedName) {
      byNorm.set(doc.normalizedName, doc);
      const tokenKey = getTokenKey(doc.name);
      if (tokenKey && !byTokenKey.has(tokenKey)) {
        byTokenKey.set(tokenKey, doc);
      }
    }
  }

  console.log(`🔢 Highest existing VITB ID: VITB-${String(maxVitbNum).padStart(4, '0')}`);

  // Metrics trackers
  let existingUpdatedCount = 0;
  let newFacultyAddedCount = 0;
  let totalUniqueReviewsAdded = 0;
  let totalDuplicateReviewsSkipped = 0;
  let departmentsUpdatedCount = 0;
  const ratingChanges = [];
  const operations = [];

  let nextVitbNum = maxVitbNum;

  // Process each incoming faculty
  for (const item of incomingData) {
    const rawName = String(item.name || '').trim();
    if (!rawName) continue;

    const normName = normalizeFacultyName(rawName);
    const tokenKey = getTokenKey(rawName);

    // Try finding existing match
    let matchedDoc = null;
    let matchType = null;

    if (item.facultyId && byExtId.has(item.facultyId)) {
      matchedDoc = byExtId.get(item.facultyId);
      matchType = 'EXTERNAL_ID';
    } else if (item.facultyId && byId.has(item.facultyId.toUpperCase())) {
      matchedDoc = byId.get(item.facultyId.toUpperCase());
      matchType = 'FACULTY_ID';
    } else if (byNorm.has(normName)) {
      matchedDoc = byNorm.get(normName);
      matchType = 'NORMALIZED_NAME';
    } else if (tokenKey && byTokenKey.has(tokenKey)) {
      matchedDoc = byTokenKey.get(tokenKey);
      matchType = 'TOKEN_KEY';
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 1: MATCHED EXISTING FACULTY -> UPDATE
    // ──────────────────────────────────────────────────────────────────────────
    if (matchedDoc) {
      existingUpdatedCount++;

      // 1. Existing Reviews & Deduplication
      const existingReviews = Array.isArray(matchedDoc.reviews) ? [...matchedDoc.reviews] : [];
      const seenFingerprints = new Set(existingReviews.map(computeReviewFingerprint));

      const newReviewsToAdd = [];
      const incomingReviews = Array.isArray(item.reviews) ? item.reviews : [];

      for (const rev of incomingReviews) {
        const fp = computeReviewFingerprint(rev);
        if (seenFingerprints.has(fp)) {
          totalDuplicateReviewsSkipped++;
        } else {
          seenFingerprints.add(fp);
          const reviewObj = {
            course: String(rev.course || '').trim(),
            text: String(rev.text || '').trim(),
            rating: typeof rev.rating === 'number' && !isNaN(rev.rating) ? rev.rating : null,
            date: rev.date ? new Date(rev.date) : null
          };
          newReviewsToAdd.push(reviewObj);
          totalUniqueReviewsAdded++;
        }
      }

      const mergedReviews = [...existingReviews, ...newReviewsToAdd];

      // 2. Weighted Rating Calculation
      const oldRating = matchedDoc.overall_rating;
      const oldTotalReviews = matchedDoc.totalReviews || existingReviews.length || 1;
      let newTotalReviews = oldTotalReviews;
      let finalOverallRating = oldRating;

      // Handle new ratings accurately:
      if (newReviewsToAdd.length > 0) {
        // Genuinely new unique reviews added: calculate weighted average
        const newReviewsSum = newReviewsToAdd.reduce((sum, r) => sum + (typeof r.rating === 'number' ? r.rating : 0), 0);
        const validNewReviewsCount = newReviewsToAdd.filter(r => typeof r.rating === 'number').length;

        if (validNewReviewsCount > 0) {
          const combinedSum = (oldRating * oldTotalReviews) + newReviewsSum;
          newTotalReviews = oldTotalReviews + validNewReviewsCount;
          finalOverallRating = Number((combinedSum / newTotalReviews).toFixed(2));
        }
      } else if (item.totalReviews > oldTotalReviews && typeof item.overall_rating === 'number' && item.overall_rating > 0) {
        // Additional review count reported in new source: weight them properly
        const additionalReviews = item.totalReviews - oldTotalReviews;
        const combinedSum = (oldRating * oldTotalReviews) + (item.overall_rating * additionalReviews);
        newTotalReviews = item.totalReviews;
        finalOverallRating = Number((combinedSum / newTotalReviews).toFixed(2));
      }

      if (oldRating !== finalOverallRating) {
        ratingChanges.push({
          facultyId: matchedDoc.facultyId,
          name: matchedDoc.name,
          oldRating,
          newRating: finalOverallRating,
          oldReviews: oldTotalReviews,
          newReviews: newTotalReviews
        });
      }

      // 3. Category Ratings Weighted Calculation
      const calcWeightedSubRating = (oldVal, newVal) => {
        if (newVal === null || newVal === undefined || isNaN(newVal)) return oldVal;
        if (oldVal === null || oldVal === undefined || isNaN(oldVal)) return newVal;
        if (newTotalReviews === oldTotalReviews) return oldVal; // stable
        const addCount = newTotalReviews - oldTotalReviews;
        return Number(((oldVal * oldTotalReviews + newVal * addCount) / newTotalReviews).toFixed(2));
      };

      const finalTeaching = calcWeightedSubRating(matchedDoc.teaching_rating, item.teaching_rating);
      const finalEvaluation = calcWeightedSubRating(matchedDoc.evaluation_rating, item.evaluation_rating);
      const finalBehaviour = calcWeightedSubRating(matchedDoc.behaviour_rating, item.behaviour_rating);
      const finalInternals = calcWeightedSubRating(matchedDoc.internals_rating, item.internals_rating);

      // 4. Update Profile Fields if empty in DB
      let deptToSet = matchedDoc.department;
      if ((!deptToSet || deptToSet.trim() === '') && item.department && item.department.trim() !== '') {
        deptToSet = item.department.trim();
        departmentsUpdatedCount++;
      }

      let designationToSet = matchedDoc.designation;
      if ((!designationToSet || designationToSet.trim() === '') && item.designation) {
        designationToSet = item.designation.trim();
      }

      const updatePayload = {
        externalId: matchedDoc.externalId || item.facultyId || '',
        department: deptToSet,
        designation: designationToSet,
        teaching_rating: finalTeaching,
        evaluation_rating: finalEvaluation,
        behaviour_rating: finalBehaviour,
        internals_rating: finalInternals,
        overall_rating: finalOverallRating,
        totalReviews: newTotalReviews,
        reviews: mergedReviews,
        source: matchedDoc.source ? `${matchedDoc.source}, vitbpl-facultymeter` : (item.source || 'vitbpl-facultymeter'),
        updatedAt: new Date()
      };

      operations.push({
        type: 'UPDATE',
        facultyId: matchedDoc.facultyId,
        filter: { _id: matchedDoc._id },
        update: { $set: updatePayload }
      });

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 2: NEW FACULTY -> INSERT
    // ──────────────────────────────────────────────────────────────────────────
    } else {
      newFacultyAddedCount++;
      nextVitbNum++;
      const assignedId = `VITB-${String(nextVitbNum).padStart(4, '0')}`;

      // Build reviews
      const newReviews = [];
      const seenFp = new Set();
      const incomingReviews = Array.isArray(item.reviews) ? item.reviews : [];

      for (const rev of incomingReviews) {
        const fp = computeReviewFingerprint(rev);
        if (!seenFp.has(fp)) {
          seenFp.add(fp);
          newReviews.push({
            course: String(rev.course || '').trim(),
            text: String(rev.text || '').trim(),
            rating: typeof rev.rating === 'number' && !isNaN(rev.rating) ? rev.rating : null,
            date: rev.date ? new Date(rev.date) : null
          });
          totalUniqueReviewsAdded++;
        } else {
          totalDuplicateReviewsSkipped++;
        }
      }

      const totalReviewsCount = item.totalReviews || newReviews.length || (item.overall_rating ? 1 : 0);

      const newDoc = {
        facultyId: assignedId,
        externalId: item.facultyId || '',
        name: rawName,
        normalizedName: normName,
        department: item.department ? item.department.trim() : '',
        designation: item.designation ? item.designation.trim() : 'Faculty',
        email: '',
        profileUrl: item.profileUrl || '',
        teaching_rating: typeof item.teaching_rating === 'number' ? item.teaching_rating : null,
        evaluation_rating: typeof item.evaluation_rating === 'number' ? item.evaluation_rating : null,
        behaviour_rating: typeof item.behaviour_rating === 'number' ? item.behaviour_rating : null,
        internals_rating: typeof item.internals_rating === 'number' ? item.internals_rating : null,
        overall_rating: typeof item.overall_rating === 'number' ? item.overall_rating : null,
        classAverage: item.classAverage && item.classAverage !== 'N/A' ? item.classAverage : null,
        finalRemark: item.finalRemark && item.finalRemark !== 'N/A' ? item.finalRemark : null,
        totalReviews: totalReviewsCount,
        reviews: newReviews,
        source: item.source || 'https://vitbpl-facultymeter.vercel.app',
        collectedAt: item.collectedAt ? new Date(item.collectedAt) : new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      operations.push({
        type: 'INSERT',
        facultyId: assignedId,
        document: newDoc
      });

      // Add to lookup maps so duplicate items within the incoming JSON file itself are handled
      byNorm.set(normName, newDoc);
      if (tokenKey) byTokenKey.set(tokenKey, newDoc);
      if (item.facultyId) byExtId.set(item.facultyId, newDoc);
      byId.set(assignedId, newDoc);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // EXECUTE OPERATIONS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n📊 Merge Operations Prepared:');
  console.log(` - Existing Faculty to Update : ${existingUpdatedCount}`);
  console.log(` - New Faculty to Insert      : ${newFacultyAddedCount}`);
  console.log(` - Unique Reviews Added       : ${totalUniqueReviewsAdded}`);
  console.log(` - Duplicate Reviews Skipped  : ${totalDuplicateReviewsSkipped}`);
  console.log(` - Departments Updated        : ${departmentsUpdatedCount}`);
  console.log(` - Total Operations           : ${operations.length}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN COMPLETE: 0 writes made to the database.');
  } else {
    console.log('\n🚀 Executing database operations...');
    const bulkUpdates = [];
    const bulkInserts = [];

    for (const op of operations) {
      if (op.type === 'UPDATE') {
        bulkUpdates.push({
          updateOne: {
            filter: op.filter,
            update: op.update
          }
        });
      } else if (op.type === 'INSERT') {
        bulkInserts.push(op.document);
      }
    }

    if (bulkUpdates.length > 0) {
      console.log(`  -> Executing ${bulkUpdates.length} updates via bulkWrite...`);
      const updateRes = await Faculty.bulkWrite(bulkUpdates, { ordered: false });
      console.log(`     ✅ Matched: ${updateRes.matchedCount}, Modified: ${updateRes.modifiedCount}`);
    }

    if (bulkInserts.length > 0) {
      console.log(`  -> Executing ${bulkInserts.length} inserts...`);
      const insertRes = await Faculty.insertMany(bulkInserts, { ordered: false });
      console.log(`     ✅ Inserted: ${insertRes.length} new faculty`);
    }

    console.log('✅ All operations executed successfully!');
  }

  // Post-Execution Verification
  const finalFacultyCount = dryRun ? existingDocs.length + newFacultyAddedCount : await Faculty.countDocuments();
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('                        IMPORT REPORT');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`Faculty Count (Before)  : ${existingDocs.length}`);
  console.log(`Faculty Count (After)   : ${finalFacultyCount} (+${newFacultyAddedCount} new)`);
  console.log(`Existing Updated        : ${existingUpdatedCount}`);
  console.log(`New Added               : ${newFacultyAddedCount}`);
  console.log(`Unique Reviews Added    : ${totalUniqueReviewsAdded}`);
  console.log(`Duplicate Reviews Skip  : ${totalDuplicateReviewsSkipped}`);
  console.log(`Departments Enriched    : ${departmentsUpdatedCount}`);
  console.log(`Rating Changes Count    : ${ratingChanges.length}`);

  if (ratingChanges.length > 0) {
    console.log('\nSample Rating Changes:');
    ratingChanges.slice(0, 5).forEach(c => {
      console.log(` - [${c.facultyId}] ${c.name}: Rating ${c.oldRating} -> ${c.newRating} (Reviews: ${c.oldReviews} -> ${c.newReviews})`);
    });
  }

  return {
    dryRun,
    beforeCount: existingDocs.length,
    afterCount: finalFacultyCount,
    newFacultyAdded: newFacultyAddedCount,
    existingUpdated: existingUpdatedCount,
    uniqueReviewsAdded: totalUniqueReviewsAdded,
    duplicateReviewsSkipped: totalDuplicateReviewsSkipped,
    departmentsEnriched: departmentsUpdatedCount,
    ratingChanges
  };
}

// CLI runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run');
  smartMerge({ dryRun: isDryRun })
    .then(async () => {
      await mongoose.disconnect();
      console.log('\nFinished.');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Smart merge failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
