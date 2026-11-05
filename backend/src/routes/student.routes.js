import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import Student from '../models/Student.js';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

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

    // Auto-heal and sync phone and whatsappNumber for seamless backward compatibility
    if (!student.whatsappNumber && student.phone) {
      student.whatsappNumber = student.phone;
      await Student.updateOne({ _id: student._id }, { $set: { whatsappNumber: student.phone } });
    } else if (student.whatsappNumber && !student.phone) {
      student.phone = student.whatsappNumber;
      await Student.updateOne({ _id: student._id }, { $set: { phone: student.whatsappNumber } });
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

    const { name, email, phone, college, course, avatarId, imageUrl, whatsappNumber, whatsappCountryCode } = req.body;

    // Check if student already exists so partial updates (e.g. adding WhatsApp number) work smoothly
    const existing = await Student.findOne({ clerkId });

    const finalName = (name && typeof name === 'string' && name.trim()) ? name.trim() : existing?.name;
    const finalEmail = (email && typeof email === 'string' && email.trim()) ? email.trim().toLowerCase() : existing?.email;

    if (!finalName) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!finalEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const updateData = {
      name: finalName,
      email: finalEmail
    };

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

    // Canonical WhatsApp / Phone Number Resolution:
    // Accept either whatsappNumber or phone, prioritizing whatsappNumber if both are supplied.
    // Keeps both fields in MongoDB 100% synchronized for seamless persistence and compatibility.
    const incomingNumber = whatsappNumber !== undefined ? whatsappNumber : phone;

    if (incomingNumber !== undefined && incomingNumber !== null) {
      const numStr = String(incomingNumber).trim();
      
      if (numStr) {
        try {
          const countryCode = whatsappCountryCode || 'IN';
          
          if (!isValidPhoneNumber(numStr, countryCode)) {
            return res.status(400).json({
              success: false,
              message: 'Invalid WhatsApp number format. Please provide a valid phone number.'
            });
          }

          const parsed = parsePhoneNumber(numStr, countryCode);
          const e164Number = parsed.number; // e.g. +919876543210
          updateData.whatsappNumber = e164Number;
          updateData.phone = e164Number;
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: 'Invalid WhatsApp number. Please check the number and country code.'
          });
        }
      } else {
        // Explicitly clearing number
        updateData.whatsappNumber = '';
        updateData.phone = '';
      }
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
