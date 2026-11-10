import Faculty, { normalizeFacultyName } from '../models/Faculty.js';
import FacultyRating from '../models/FacultyRating.js';
import mongoose from 'mongoose';

// ─── Rating Status Helper ───────────────────────────────────────────────────

/**
 * Dynamically computes a professional, neutral status label based on actual overall rating.
 * If ratingsCount is 0, gracefully returns 'Not enough ratings yet'.
 *
 * @param {number|null} overallRating
 * @param {number} ratingsCount
 * @returns {string}
 */
export function calculateRatingStatus(overallRating, ratingsCount = 0) {
  if (ratingsCount === 0 || overallRating === null || overallRating === undefined || Number.isNaN(Number(overallRating))) {
    return 'Not enough ratings yet';
  }
  const r = Number(overallRating);
  if (r >= 4.5) return 'Excellent';
  if (r >= 3.5) return 'Good';
  if (r >= 2.5) return 'Average';
  if (r >= 1.5) return 'Needs Improvement';
  return 'Below Expectations';
}

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
 * List top faculty members (for initial landing / explore view).
 * Returns real records sorted by overall rating and total reviews.
 *
 * @param {number} limit  Max results (default 20, max 50)
 * @returns {Array}
 */
export async function listFaculty(limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const results = await Faculty.find({ isActive: true })
    .select('_id facultyId name department designation overall_rating finalRemark totalReviews classAverage teaching_rating evaluation_rating behaviour_rating internals_rating')
    .sort({ overall_rating: -1, totalReviews: -1 })
    .limit(safeLimit)
    .lean();
  return results;
}

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
export async function getFacultyById(idOrFacultyId, studentId = null) {
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

  if (!doc) return null;

  // Query actual student ratings count from FacultyRating
  const dbRatingsCount = await FacultyRating.countDocuments({ facultyId: doc.facultyId });
  const hasBaseline = doc.overall_rating !== null && doc.overall_rating !== undefined;
  const effectiveCount = dbRatingsCount > 0 ? dbRatingsCount : (hasBaseline ? 1 : 0);
  const status = calculateRatingStatus(doc.overall_rating, effectiveCount);

  // If student is authenticated, check if they have submitted a rating
  let userRating = null;
  if (studentId) {
    const existing = await FacultyRating.findOne({ facultyId: doc.facultyId, studentId })
      .select('teachingRating evaluationRating behaviourRating internalsRating updatedAt')
      .lean();
    if (existing) {
      userRating = {
        teachingRating: existing.teachingRating,
        evaluationRating: existing.evaluationRating,
        behaviourRating: existing.behaviourRating,
        internalsRating: existing.internalsRating,
        updatedAt: existing.updatedAt
      };
    }
  }

  return {
    ...doc,
    ratingsCount: effectiveCount,
    status,
    userRating
  };
}

// ─── Student Rating Submission ───────────────────────────────────────────────

/**
 * Submit or update a student rating for a faculty member.
 * - Enforces integer ratings 1-5 for all four categories.
 * - Upserts by { facultyId, studentId } to prevent duplicates.
 * - Recalculates category averages and overall rating.
 * - Updates the Faculty document in MongoDB.
 *
 * @param {object} params
 * @returns {object} Updated ratings summary
 */
export async function submitFacultyRating({
  idOrFacultyId,
  studentId,
  teachingRating,
  evaluationRating,
  behaviourRating,
  internalsRating
}) {
  const id = String(idOrFacultyId || '').trim();
  if (!id) {
    const err = new Error('Faculty ID is required');
    err.status = 400;
    throw err;
  }

  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    const err = new Error('Authenticated student identity is required');
    err.status = 401;
    throw err;
  }

  let faculty = null;
  if (mongoose.isValidObjectId(id)) {
    faculty = await Faculty.findById(id);
  }
  if (!faculty) {
    faculty = await Faculty.findOne({ facultyId: id.toUpperCase() });
  }

  if (!faculty) {
    const err = new Error('Faculty not found');
    err.status = 404;
    throw err;
  }

  // Validate all four ratings are integers between 1 and 5
  const rawScores = {
    teachingRating,
    evaluationRating,
    behaviourRating,
    internalsRating
  };

  const parsedScores = {};
  for (const [key, val] of Object.entries(rawScores)) {
    if (val === undefined || val === null || val === '') {
      const err = new Error(`Missing required rating category: ${key}`);
      err.status = 400;
      throw err;
    }
    const num = Number(val);
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      const err = new Error(`${key} must be an integer between 1 and 5`);
      err.status = 400;
      throw err;
    }
    parsedScores[key] = num;
  }

  // 1. Upsert student rating in MongoDB (Prevents duplicate submissions)
  const ratingDoc = await FacultyRating.findOneAndUpdate(
    { facultyId: faculty.facultyId, studentId: studentId.trim() },
    {
      facultyId: faculty.facultyId,
      studentId: studentId.trim(),
      ...parsedScores
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );

  // 2. Fetch all student ratings for this faculty to recalculate averages
  const allRatings = await FacultyRating.find({ facultyId: faculty.facultyId }).lean();
  const count = allRatings.length;

  const teachingSum = allRatings.reduce((acc, r) => acc + r.teachingRating, 0);
  const evalSum = allRatings.reduce((acc, r) => acc + r.evaluationRating, 0);
  const behaviourSum = allRatings.reduce((acc, r) => acc + r.behaviourRating, 0);
  const internalsSum = allRatings.reduce((acc, r) => acc + r.internalsRating, 0);

  const teachingAvg = teachingSum / count;
  const evaluationAvg = evalSum / count;
  const behaviourAvg = behaviourSum / count;
  const internalsAvg = internalsSum / count;
  const overallAvg = (teachingAvg + evaluationAvg + behaviourAvg + internalsAvg) / 4;

  faculty.teaching_rating = Math.round(teachingAvg * 100) / 100;
  faculty.evaluation_rating = Math.round(evaluationAvg * 100) / 100;
  faculty.behaviour_rating = Math.round(behaviourAvg * 100) / 100;
  faculty.internals_rating = Math.round(internalsAvg * 100) / 100;
  faculty.overall_rating = Math.round(overallAvg * 100) / 100;
  faculty.totalReviews = count;
  await faculty.save();

  const status = calculateRatingStatus(faculty.overall_rating, count);

  return {
    facultyId: faculty.facultyId,
    _id: faculty._id,
    name: faculty.name,
    overall_rating: faculty.overall_rating,
    teaching_rating: faculty.teaching_rating,
    evaluation_rating: faculty.evaluation_rating,
    behaviour_rating: faculty.behaviour_rating,
    internals_rating: faculty.internals_rating,
    ratingsCount: count,
    status,
    userRating: {
      teachingRating: ratingDoc.teachingRating,
      evaluationRating: ratingDoc.evaluationRating,
      behaviourRating: ratingDoc.behaviourRating,
      internalsRating: ratingDoc.internalsRating,
      updatedAt: ratingDoc.updatedAt
    }
  };
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

