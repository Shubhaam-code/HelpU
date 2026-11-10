import Faculty, { normalizeFacultyName } from '../models/Faculty.js';
import mongoose from 'mongoose';

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Escape regex special characters to prevent injection.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely parse a floating-point rating from CSV.
 * Returns null if invalid or non-numeric.
 */
function safeFloat(val) {
  if (val === '' || val === null || val === undefined) return null;
  const f = parseFloat(val);
  return Number.isFinite(f) ? Math.round(f * 100) / 100 : null;
}

/**
 * Safely parse an integer from CSV.
 */
function safeInt(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : 0;
}

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Autocomplete faculty search.
 * - Minimum query length: 2 characters.
 * - Maximum results: 10.
 * - Case-insensitive prefix + partial name match on normalizedName.
 * - Returns lightweight projection only.
 *
 * @param {string} query  Raw search query from client
 * @param {number} limit  Max suggestions (default 10, max 10)
 * @returns {Array}
 */
export async function searchFaculty(query = '', limit = 10) {
  const q = normalizeFacultyName(query.trim());
  if (q.length < 2) return [];

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 10);
  const escaped = escapeRegex(q);
  const regex = new RegExp(escaped, 'i');

  const results = await Faculty.find({ normalizedName: regex, isActive: true })
    .select('_id facultyId name department designation overall_rating finalRemark totalReviews')
    .sort({ normalizedName: 1 })
    .limit(safeLimit)
    .lean();

  return results;
}

// ─── Faculty Details ─────────────────────────────────────────────────────────

/**
 * Retrieve full faculty profile by MongoDB _id or facultyId string (e.g. VITB-0001).
 * Does NOT embed reviews in the response (use getFacultyReviews for pagination).
 *
 * @param {string} idOrFacultyId  MongoDB ObjectId hex or VITB-xxxx string
 * @returns {object|null}
 */
export async function getFacultyById(idOrFacultyId) {
  const id = String(idOrFacultyId || '').trim();

  let doc = null;

  // Try MongoDB ObjectId first
  if (mongoose.isValidObjectId(id)) {
    doc = await Faculty.findById(id)
      .select('-reviews -__v')
      .lean();
  }

  // Fallback: match by facultyId (e.g. VITB-0001) case-insensitively
  if (!doc) {
    doc = await Faculty.findOne({ facultyId: id.toUpperCase() })
      .select('-reviews -__v')
      .lean();
  }

  return doc || null;
}

// ─── Paginated Reviews ───────────────────────────────────────────────────────

/**
 * Retrieve paginated reviews for a given faculty.
 *
 * @param {string} idOrFacultyId  MongoDB ObjectId hex or VITB-xxxx string
 * @param {number} page           1-based page number
 * @param {number} limit          Reviews per page (max 50)
 * @returns {{ reviews: Array, total: number, faculty: object|null }}
 */
export async function getFacultyReviews(idOrFacultyId, page = 1, limit = 10) {
  const id = String(idOrFacultyId || '').trim();
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (safePage - 1) * safeLimit;

  let doc = null;

  if (mongoose.isValidObjectId(id)) {
    doc = await Faculty.findById(id).select('reviews name facultyId totalReviews').lean();
  }
  if (!doc) {
    doc = await Faculty.findOne({ facultyId: id.toUpperCase() })
      .select('reviews name facultyId totalReviews')
      .lean();
  }

  if (!doc) return { reviews: [], total: 0, faculty: null };

  const allReviews = Array.isArray(doc.reviews) ? doc.reviews : [];
  const total = allReviews.length;
  const paged = allReviews.slice(skip, skip + safeLimit);

  return {
    reviews: paged,
    total,
    faculty: { _id: doc._id, name: doc.name, facultyId: doc.facultyId }
  };
}

// ─── Import Utilities (used by import script) ────────────────────────────────

/**
 * Parse and validate a single CSV row (already split into an array of fields).
 * Returns null if the record is invalid (missing required fields).
 *
 * @param {string[]} fields  Ordered CSV fields matching the header
 * @param {string[]} header  Column names
 * @returns {object|null}
 */
export function parseFacultyRow(fields, header) {
  const col = (name) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (fields[idx] || '').trim() : '';
  };

  const facultyId = col('facultyId').toUpperCase();
  const name = col('name');

  if (!facultyId || !name) return null;

  // Parse embedded reviews JSON safely
  let reviews = [];
  const rawReviews = col('reviews');
  if (rawReviews) {
    try {
      const parsed = JSON.parse(rawReviews);
      if (Array.isArray(parsed)) {
        reviews = parsed.map((r) => ({
          text: String(r.text || '').trim(),
          rating: safeFloat(r.rating),
          date: r.date && r.date !== 'null' ? new Date(r.date) : null
        }));
      }
    } catch {
      // Malformed JSON — keep reviews as empty
    }
  }

  return {
    facultyId,
    name,
    normalizedName: normalizeFacultyName(name),
    department: col('department'),
    designation: col('designation'),
    email: col('email') || '',
    profileUrl: col('profileUrl'),
    teaching_rating: safeFloat(col('teaching_rating')),
    evaluation_rating: safeFloat(col('evaluation_rating')),
    behaviour_rating: safeFloat(col('behaviour_rating')),
    internals_rating: safeFloat(col('internals_rating')),
    overall_rating: safeFloat(col('overall_rating')),
    classAverage: col('classAverage') || null,
    finalRemark: col('finalRemark') || null,
    totalReviews: safeInt(col('totalReviews')),
    reviews,
    source: col('source'),
    collectedAt: col('collectedAt') ? new Date(col('collectedAt')) : null,
    isActive: true
  };
}

/**
 * Bulk-upsert faculty records into MongoDB.
 * Idempotent: safe to run multiple times.
 *
 * @param {object[]} records  Validated faculty records
 * @returns {{ upsertedCount, matchedCount, modifiedCount }}
 */
export async function bulkUpsertFaculty(records) {
  if (!records || records.length === 0) {
    return { upsertedCount: 0, matchedCount: 0, modifiedCount: 0 };
  }

  const ops = records.map((r) => ({
    updateOne: {
      filter: { facultyId: r.facultyId },
      update: {
        $set: {
          name: r.name,
          normalizedName: r.normalizedName,
          department: r.department,
          designation: r.designation,
          email: r.email,
          profileUrl: r.profileUrl,
          teaching_rating: r.teaching_rating,
          evaluation_rating: r.evaluation_rating,
          behaviour_rating: r.behaviour_rating,
          internals_rating: r.internals_rating,
          overall_rating: r.overall_rating,
          classAverage: r.classAverage,
          finalRemark: r.finalRemark,
          totalReviews: r.totalReviews,
          reviews: r.reviews,
          source: r.source,
          collectedAt: r.collectedAt,
          isActive: r.isActive
        }
      },
      upsert: true
    }
  }));

  const result = await Faculty.bulkWrite(ops, { ordered: false });

  return {
    upsertedCount: result.upsertedCount || 0,
    matchedCount: result.matchedCount || 0,
    modifiedCount: result.modifiedCount || 0
  };
}

