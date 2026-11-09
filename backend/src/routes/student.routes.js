import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import Student from '../models/Student.js';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const router = express.Router();

/**
 * @route   GET /api/students/profile
 * @desc    Get student profile for the authenticated user
 * @access  Protected
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const canonicalUserId = req.userId;
    const student = await Student.findOne(
      req.firebaseUid
        ? { $or: [{ clerkId: canonicalUserId }, { firebaseUid: req.firebaseUid }] }
        : { clerkId: canonicalUserId }
    );

    if (!student) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Profile not created yet'
      });
    }

    // Ensure firebaseUid is persisted if user authenticated via Firebase
    if (req.firebaseUid && !student.firebaseUid) {
      student.firebaseUid = req.firebaseUid;
      await Student.updateOne({ _id: student._id }, { $set: { firebaseUid: req.firebaseUid } });
    }

    // Auto-heal and sync phone and whatsappNumber for seamless backward compatibility
    const canonical = (student.whatsappNumber || student.phone || '').trim();
    if (student.whatsappNumber !== canonical || student.phone !== canonical) {
      student.whatsappNumber = canonical;
      student.phone = canonical;
      await Student.updateOne(
        { _id: student._id },
        { $set: { whatsappNumber: canonical, phone: canonical } }
      );
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
    const canonicalUserId = req.userId;

    if (!canonicalUserId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Unable to identify user from authentication token'
      });
    }

    const { name, email, phone, college, course, avatarId, imageUrl, whatsappNumber, whatsappCountryCode, bio, gender, registrationNumber, branch, year } = req.body;

    // Check if student already exists so partial updates (e.g. adding WhatsApp number) work smoothly
    const existing = await Student.findOne(
      req.firebaseUid
        ? { $or: [{ clerkId: canonicalUserId }, { firebaseUid: req.firebaseUid }] }
        : { clerkId: canonicalUserId }
    );

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

    if (registrationNumber !== undefined) {
      updateData.registrationNumber = typeof registrationNumber === 'string' ? registrationNumber.trim().toUpperCase() : '';
    }

    if (branch !== undefined) {
      updateData.branch = typeof branch === 'string' ? branch.trim() : '';
    }

    if (year !== undefined) {
      updateData.year = typeof year === 'string' ? year.trim() : '';
    }

    if (bio !== undefined) {
      updateData.bio = typeof bio === 'string' ? bio.trim().substring(0, 200) : '';
    }

    if (gender !== undefined) {
      const allowedGenders = ['Male', 'Female', 'Prefer not to say'];
      updateData.gender = allowedGenders.includes(gender) ? gender : null;
    }

    if (avatarId !== undefined) {
      updateData.avatarId = typeof avatarId === 'string' ? avatarId.trim() : null;
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    }

    if (req.firebaseUid) {
      updateData.firebaseUid = req.firebaseUid;
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
    } else if (existing) {
      // Preserve existing phone/whatsapp number if this was a partial update without phone fields
      const existingVal = (existing.whatsappNumber || existing.phone || '').trim();
      updateData.whatsappNumber = existingVal;
      updateData.phone = existingVal;
    } else {
      // Brand new document: ensure both fields are explicitly initialized
      updateData.whatsappNumber = '';
      updateData.phone = '';
    }

    const student = await Student.findOneAndUpdate(
      existing ? { _id: existing._id } : { clerkId: canonicalUserId },
      {
        $set: updateData,
        $setOnInsert: { clerkId: canonicalUserId }
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
 * @desc    Create or update student profile for the authenticated user
 * @access  Protected
 */
router.post('/profile', requireAuth, handleSaveProfile);

/**
 * @route   PUT /api/students/profile
 * @desc    Update student profile for the authenticated user
 * @access  Protected
 */
router.put('/profile', requireAuth, handleSaveProfile);

export default router;
