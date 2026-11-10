import {
  searchFaculty,
  listFaculty,
  getFacultyById,
  getFacultyReviews,
  submitFacultyRating
} from '../services/faculty.service.js';
import mongoose from 'mongoose';

// ─── GET /api/faculty?limit=20 ───────────────────────────────────────────────

/**
 * List top faculty members (initial listing for discovery).
 * Query param: limit (default 20, max 50)
 */
export async function listFacultyHandler(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const results = await listFaculty(limit);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('[Faculty] List error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list faculty',
      error: error.message
    });
  }
}

// ─── GET /api/faculty/search?q=vij ───────────────────────────────────────────

/**
 * Faculty autocomplete search.
 * Query param: q (string, min 2 chars)
 * Returns up to 10 lightweight faculty suggestions.
 */
export async function searchFacultyHandler(req, res) {
  try {
    const query = String(req.query.q || req.query.query || req.query.search || '').trim();

    if (query.length < 2) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const results = await searchFaculty(query, 10);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('[Faculty] Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search faculty',
      error: error.message
    });
  }
}

// ─── GET /api/faculty/:id ────────────────────────────────────────────────────

/**
 * Full faculty profile.
 * :id accepts MongoDB ObjectId or VITB-xxxx facultyId string.
 */
export async function getFacultyDetailsHandler(req, res) {
  try {
    const { id } = req.params;

    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Faculty ID is required'
      });
    }

    const studentId = req.userId || null;
    const faculty = await getFacultyById(id.trim(), studentId);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: faculty
    });
  } catch (error) {
    console.error('[Faculty] Get details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve faculty details',
      error: error.message
    });
  }
}

// ─── POST /api/faculty/:id/ratings ───────────────────────────────────────────

/**
 * Submit or update a student rating for a faculty member.
 * Requires authenticated student (via requireAuth).
 */
export async function submitFacultyRatingHandler(req, res) {
  try {
    const { id } = req.params;
    const studentId = req.userId || req.student?.clerkId || req.firebaseUid;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required to submit rating'
      });
    }

    const {
      teachingRating,
      evaluationRating,
      behaviourRating,
      internalsRating
    } = req.body;

    const result = await submitFacultyRating({
      idOrFacultyId: id,
      studentId,
      teachingRating,
      evaluationRating,
      behaviourRating,
      internalsRating
    });

    return res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: result
    });
  } catch (error) {
    console.error('[Faculty] Submit rating error:', error);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to submit rating',
      error: error.message
    });
  }
}

// ─── GET /api/faculty/:id/reviews ────────────────────────────────────────────

/**
 * Paginated reviews for a faculty member.
 * Query params: page (default 1), limit (default 10, max 50)
 */
export async function getFacultyReviewsHandler(req, res) {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Faculty ID is required'
      });
    }

    const { reviews, total, faculty } = await getFacultyReviews(id.trim(), page, limit);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return res.status(200).json({
      success: true,
      faculty: {
        _id: faculty._id,
        name: faculty.name,
        facultyId: faculty.facultyId
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1
      },
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('[Faculty] Get reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve faculty reviews',
      error: error.message
    });
  }
}

