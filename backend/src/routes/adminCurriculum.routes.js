import express from 'express';
import { requireAdmin } from '../middlewares/admin.js';
import { handleCurriculumUpload } from '../middlewares/ffcsUpload.js';
import { uploadCurriculumHandler } from '../controllers/curriculum.controller.js';

const router = express.Router();

// POST /api/admin/curriculum/upload
// multipart/form-data: curriculum=<PDF>, institution?, curriculumVersion?, activate?
router.post(
  '/upload',
  requireAdmin,
  handleCurriculumUpload(),
  uploadCurriculumHandler
);

export default router;
