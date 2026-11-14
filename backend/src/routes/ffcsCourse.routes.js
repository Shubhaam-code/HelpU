import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireIdempotency } from '../middlewares/idempotency.js';
import { handleScreenshotUpload } from '../middlewares/ffcsUpload.js';
import {
  addCourseHandler,
  listCoursesHandler,
  getCourseHandler,
  getCourseStatusHandler,
  getCourseTeachersHandler,
  deleteCourseHandler,
  checkSlotClashHandler
} from '../controllers/ffcsCourse.controller.js';

const router = express.Router();

// POST /api/courses/add (multipart: screenshots[] + course identity fields)
router.post(
  '/add',
  requireAuth,
  requireIdempotency({ required: false }),
  handleScreenshotUpload(),
  addCourseHandler
);

// GET /api/courses
router.get('/', requireAuth, listCoursesHandler);

// GET /api/courses/:courseId/teachers
router.get('/:courseId/teachers', requireAuth, getCourseTeachersHandler);

// GET /api/courses/:courseId/status
router.get('/:courseId/status', requireAuth, getCourseStatusHandler);

// GET /api/courses/:courseId
router.get('/:courseId', requireAuth, getCourseHandler);

// POST /api/courses/check-clash
router.post('/check-clash', requireAuth, checkSlotClashHandler);

// DELETE /api/courses/:courseId
router.delete('/:courseId', requireAuth, deleteCourseHandler);

export default router;
