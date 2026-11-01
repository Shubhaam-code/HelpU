import express from 'express';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated Clerk user ID
 * @access  Protected
 */
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      userId: req.userId
    }
  });
});

export default router;
