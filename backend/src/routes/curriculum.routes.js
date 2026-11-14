import express from 'express';
import {
  listCurriculumCoursesHandler,
  searchCurriculumCoursesHandler,
  getCurriculumCourseHandler
} from '../controllers/curriculum.controller.js';

const router = express.Router();

// GET /api/curriculum/courses?q=&limit=10&offset=0
router.get('/courses', listCurriculumCoursesHandler);

// GET /api/curriculum/courses/search?q=data
router.get('/courses/search', searchCurriculumCoursesHandler);

// GET /api/curriculum/courses/:courseId
router.get('/courses/:courseId', getCurriculumCourseHandler);

export default router;