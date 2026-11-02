import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import Travel, { calculateExpiresAt } from '../models/Travel.js';
import Student from '../models/Student.js';
import Booking from '../models/Booking.js';
import { findMatchesForTravel } from '../services/matching.service.js';

const router = express.Router();

/**
 * @route   POST /api/travels
 * @desc    Create a new travel offer or request
 * @access  Protected
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { source, destination, travelDate, departureTime, timeFlexibility, seats, type, carModel, pricePerSeat, authorImage, authorName, authorEmail } = req.body;

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
    const numFlexibility = Number(timeFlexibility) || 30;
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
      pricePerSeat: Number(pricePerSeat) || 350,
      carModel: carModel?.trim() || (type === 'offer' ? 'Campus Ride' : 'Co-traveler'),
      authorImage: authorImage ? String(authorImage).trim() : null,
      authorName: authorName ? String(authorName).trim() : null,
      authorEmail: authorEmail ? String(authorEmail).trim() : null,
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
 * @desc    Get all active travel posts (with filters & student profile enrichment)
 * @access  Protected
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const query = {
      status: 'active',
      expiresAt: { $gt: now }
    };

    // If caller specifically requests to exclude their own rides
    if (req.query.excludeMine === 'true') {
      query.userId = { $ne: req.userId };
    }

    if (req.query.type && ['offer', 'request'].includes(req.query.type)) {
      query.type = req.query.type;
    }

    if (req.query.source) {
      query.source = { $regex: req.query.source.trim(), $options: 'i' };
    }

    if (req.query.destination) {
      query.destination = { $regex: req.query.destination.trim(), $options: 'i' };
    }

    if (req.query.search) {
      const term = req.query.search.trim();
      query.$or = [
        { source: { $regex: term, $options: 'i' } },
        { destination: { $regex: term, $options: 'i' } }
      ];
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const travels = await Travel.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    // Enrich with creator student profile
    const userIds = [...new Set(travels.map((t) => t.userId))];
    const students = await Student.find({ clerkId: { $in: userIds } }).lean();
    const studentMap = new Map(students.map((s) => [s.clerkId, s]));

    const enriched = travels.map((t) => {
      const s = studentMap.get(t.userId);
      return {
        ...t,
        isMine: t.userId === req.userId,
        student: {
          name: s?.name || t.authorName || 'Campus Student',
          email: s?.email || t.authorEmail || '',
          imageUrl: s?.imageUrl || t.authorImage || null,
          college: s?.college || 'VIT, Bhopal',
          phone: s?.phone || ''
        }
      };
    });

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
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
    }).sort({ createdAt: -1 }).lean();

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
 * @route   GET /api/travels/:id
 * @desc    Get single travel post by ID with student profile
 * @access  Protected
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel ID format'
      });
    }

    const travel = await Travel.findById(id).lean();
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Travel post not found'
      });
    }

    const student = await Student.findOne({ clerkId: travel.userId }).lean();

    // Compute real-time confirmed and available seats
    const confirmedBookings = await Booking.find({
      travelId: travel._id,
      status: 'confirmed'
    });
    const confirmedSeats = confirmedBookings.reduce((sum, b) => sum + (b.requestedSeats || 0), 0);
    const bookedSeats = Math.max(confirmedSeats, travel.bookedSeats || 0);
    const availableSeats = Math.max(0, (travel.seats || 1) - bookedSeats);

    return res.status(200).json({
      success: true,
      data: {
        ...travel,
        bookedSeats,
        availableSeats,
        pricePerSeat: travel.pricePerSeat || 350,
        carModel: travel.carModel || 'Campus Ride',
        isMine: travel.userId === req.userId,
        student: {
          name: student?.name || travel.authorName || 'Campus Student',
          email: student?.email || travel.authorEmail || '',
          imageUrl: student?.imageUrl || travel.authorImage || null,
          college: student?.college || 'VIT, Bhopal',
          phone: student?.phone || ''
        }
      }
    });
  } catch (error) {
    console.error('Error fetching travel post details:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching travel post details',
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
