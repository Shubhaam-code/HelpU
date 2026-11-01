import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import Travel, { calculateExpiresAt } from '../models/Travel.js';
import { findMatchesForTravel } from '../services/matching.service.js';

const router = express.Router();

/**
 * @route   POST /api/travels
 * @desc    Create a new travel offer or request
 * @access  Protected
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { source, destination, travelDate, departureTime, timeFlexibility, seats, type } = req.body;

    // 1. Validation for travel type
    if (!type || !['offer', 'request'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel type. Must be either "offer" or "request"'
      });
    }

    // 2. Validation for locations
    if (!source || typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Source location is required'
      });
    }

    if (!destination || typeof destination !== 'string' || !destination.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Destination location is required'
      });
    }

    // 3. Validation for travel date
    if (!travelDate) {
      return res.status(400).json({
        success: false,
        message: 'Travel date is required'
      });
    }

    const parsedDate = new Date(travelDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid travel date'
      });
    }

    // 4. Validation for departure time (minutes from midnight: 0 to 1439)
    if (departureTime === undefined || departureTime === null || isNaN(Number(departureTime))) {
      return res.status(400).json({
        success: false,
        message: 'Departure time (minutes from midnight) is required'
      });
    }

    const numDepartureTime = Number(departureTime);
    if (!Number.isInteger(numDepartureTime) || numDepartureTime < 0 || numDepartureTime > 1439) {
      return res.status(400).json({
        success: false,
        message: 'Departure time must be an integer between 0 and 1439 minutes from midnight'
      });
    }

    // 5. Validation for time flexibility
    const allowedFlexibility = [30, 60, 180, 300];
    const numFlexibility = Number(timeFlexibility);
    if (!allowedFlexibility.includes(numFlexibility)) {
      return res.status(400).json({
        success: false,
        message: 'Time flexibility must be one of [30, 60, 180, 300] minutes'
      });
    }

    // 6. Validation for seats
    const numSeats = Number(seats);
    if (!seats || isNaN(numSeats) || !Number.isInteger(numSeats) || numSeats < 1) {
      return res.status(400).json({
        success: false,
        message: 'Seats must be an integer of at least 1'
      });
    }

    // 7. Calculate expiry date in Asia/Kolkata timezone
    const expiresAt = calculateExpiresAt(parsedDate);

    // 8. Save document (userId obtained strictly from verified Clerk authentication)
    const travel = await Travel.create({
      userId: req.userId,
      type,
      source: source.trim(),
      destination: destination.trim(),
      travelDate: parsedDate,
      departureTime: numDepartureTime,
      timeFlexibility: numFlexibility,
      seats: numSeats,
      status: 'active',
      expiresAt
    });

    return res.status(201).json({
      success: true,
      message: 'Travel post created successfully',
      data: travel
    });
  } catch (error) {
    console.error('Error creating travel post:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating travel post',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/travels
 * @desc    Get all active travel posts (excluding posts by the logged-in user and expired posts)
 * @access  Protected
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const travels = await Travel.find({
      status: 'active',
      userId: { $ne: req.userId },
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: travels.length,
      data: travels
    });
  } catch (error) {
    console.error('Error fetching travel posts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching travel posts',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/travels/my
 * @desc    Get all travel posts created by the logged-in user (excluding expired posts)
 * @access  Protected
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const travels = await Travel.find({
      userId: req.userId,
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: travels.length,
      data: travels
    });
  } catch (error) {
    console.error('Error fetching user travel posts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching your travel posts',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/travels/:id/status
 * @desc    Update status of a travel post (owner only: completed or cancelled)
 * @access  Protected
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel ID format'
      });
    }

    // 2. Validate target status
    const allowedStatuses = ['completed', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be updated to either "completed" or "cancelled"'
      });
    }

    // 3. Find travel post
    const travel = await Travel.findById(id);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Travel post not found'
      });
    }

    // 4. Owner authorization check
    if (travel.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to update this travel post'
      });
    }

    // 5. Update status
    travel.status = status;
    await travel.save();

    return res.status(200).json({
      success: true,
      message: `Travel post status updated to ${status}`,
      data: travel
    });
  } catch (error) {
    console.error('Error updating travel status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating travel status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/travels/:id/matches
 * @desc    Find compatible travel matches for a given post (owner only)
 * @access  Protected
 */
router.get('/:id/matches', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel ID format'
      });
    }

    // 2. Find target travel post
    const travel = await Travel.findById(id);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Travel post not found'
      });
    }

    // 3. Ownership verification
    if (travel.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to view matches for this travel post'
      });
    }

    // 4. Run matching engine
    const matches = await findMatchesForTravel(travel);

    return res.status(200).json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    console.error('Error finding travel matches:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while finding travel matches',
      error: error.message
    });
  }
});

export default router;
