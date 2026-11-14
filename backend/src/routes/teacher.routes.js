import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { listTeachersHandler } from '../controllers/teacher.controller.js';

const router = express.Router();

// GET /api/teachers
router.get('/', requireAuth, listTeachersHandler);

export default router;
