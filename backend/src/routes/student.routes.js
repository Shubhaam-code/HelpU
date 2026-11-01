import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import Student from '../models/Student.js';

const router = express.Router();

/**
 * @route   GET /api/students/profile
 * @desc    Get student profile for the authenticated Clerk user
 * @access  Protected
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const clerkId = req.userId;
    const student = await Student.findOne({ clerkId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching student profile',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/students/profile
 * @desc    Create or update student profile for the authenticated Clerk user
 * @access  Protected
 */
router.post('/profile', requireAuth, async (req, res) => {
  try {
    // 1. Extract clerkId strictly from the verified Clerk authentication token
    const clerkId = req.userId;

    if (!clerkId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Unable to identify user from authentication token'
      });
    }

    // 2. Extract allowed fields from request body
    const { name, email, phone, college } = req.body;

    // 3. Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // 4. Build update data
    const updateData = {
      name: name.trim(),
      email: email.trim().toLowerCase()
    };

    if (phone !== undefined) {
      updateData.phone = typeof phone === 'string' ? phone.trim() : '';
    }

    if (college !== undefined) {
      updateData.college = typeof college === 'string' ? college.trim() : '';
    }

    // 5. Upsert student document by clerkId
    const student = await Student.findOneAndUpdate(
      { clerkId },
      {
        $set: updateData,
        $setOnInsert: { clerkId }
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Student profile saved successfully',
      data: student
    });
  } catch (error) {
    console.error('Error in /api/students/profile:', error);

    // Handle Mongoose duplicate key or validation errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A student profile with this record already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while saving student profile',
      error: error.message
    });
  }
});

export default router;
