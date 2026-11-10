import express from 'express';
import {
  searchFacultyHandler,
  listFacultyHandler,
  getFacultyDetailsHandler,
  getFacultyReviewsHandler,
  submitFacultyRatingHandler
} from '../controllers/faculty.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';

const router = express.Router();

// 1. Faculty autocomplete search - Public
// GET /api/faculty/search?q=vij
router.get('/search', searchFacultyHandler);

// 2. Initial faculty listing - Public
// GET /api/faculty?limit=20
router.get('/', listFacultyHandler);

// 3. Faculty full profile - Public (optionalAuth resolves studentId if logged in)
// GET /api/faculty/:id  (accepts MongoDB _id or VITB-xxxx facultyId)
router.get('/:id/reviews', getFacultyReviewsHandler);
router.get('/:id', optionalAuth, getFacultyDetailsHandler);

// 4. Submit or update student rating - Authenticated students only
// POST /api/faculty/:id/ratings
router.post('/:id/ratings', requireAuth, submitFacultyRatingHandler);

export default router;

