import express from 'express';
import {
  searchFacultyHandler,
  getFacultyDetailsHandler,
  getFacultyReviewsHandler
} from '../controllers/faculty.controller.js';

const router = express.Router();

// 1. Faculty autocomplete search - Public
// GET /api/faculty/search?q=vij
router.get('/search', searchFacultyHandler);

// 2. Faculty full profile - Public
// GET /api/faculty/:id  (accepts MongoDB _id or VITB-xxxx facultyId)
router.get('/:id/reviews', getFacultyReviewsHandler);
router.get('/:id', getFacultyDetailsHandler);

export default router;
