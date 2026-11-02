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
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Profile not created yet'
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

// Helper for save/update profile
async function handleSaveProfile(req, res) {
  try {
    const clerkId = req.userId;

    if (!clerkId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Unable to identify user from authentication token'
      });
    }

    const { name, email, phone, college, course, avatarId, imageUrl } = req.body;

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

    if (course !== undefined) {
      updateData.course = typeof course === 'string' ? course.trim() : '';
    }

    if (avatarId !== undefined) {
      updateData.avatarId = typeof avatarId === 'string' ? avatarId.trim() : null;
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    }

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
    console.error('Error in saving student profile:', error);

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
}

/**
 * @route   POST /api/students/profile
 * @desc    Create or update student profile for the authenticated Clerk user
 * @access  Protected
 */
router.post('/profile', requireAuth, handleSaveProfile);

/**
 * @route   PUT /api/students/profile
 * @desc    Update student profile for the authenticated Clerk user
 * @access  Protected
 */
router.put('/profile', requireAuth, handleSaveProfile);

export default router;
