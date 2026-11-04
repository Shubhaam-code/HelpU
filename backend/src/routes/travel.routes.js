import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import Travel, { calculateExpiresAt } from '../models/Travel.js';
import Student from '../models/Student.js';
import Booking from '../models/Booking.js';
import { 
  findMatchesForTravel, 
  findMatchesForUser,
  isSameDirection, 
  isSameCalendarDay, 
  areLocationsMatching, 
  normalizeLocation 
} from '../services/matching.service.js';

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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @route   GET /api/travels
 * @desc    Get matching active travel posts based on Helpu Smart Matching Rules:
 *          - If user posted an OFFER: finds matching REQUESTS (same route, direction, date, time & seat compatibility).
 *          - If user posted a REQUEST: finds matching OFFERS (same route, direction, date, time & seat availability).
 *          - NEVER exposes a public feed. If user has no active post, returns hasPostedTravel: false.
 *          - Rejects opposite-direction rides and unrelated routes.
 * @access  Protected
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // 1. Check if authenticated user has created any active offer or request
    const myActiveTravels = await Travel.find({
      userId: req.userId,
      status: 'active',
      expiresAt: { $gt: now }
    }).lean();

    // STRICT RULE: If the user hasn't posted an offer/request yet, show 0 matches
    if (myActiveTravels.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        hasPostedTravel: false,
        message: 'Please post a ride offer or request first to see matching rides with compatible route, direction, date and time.',
        data: []
      });
    }

    // 2. Separate user's active posts into offers and requests
    const myOffers = myActiveTravels.filter(t => (t.type || 'offer') === 'offer');
    const myRequests = myActiveTravels.filter(t => t.type === 'request');

    // 3. Determine candidate types:
    // - If user specifically asks for ?type=offer, filter offers that match user's requests or offers
    // - If user asks for ?type=request, filter requests that match user's offers
    // - By default, show both matching offers and matching requests
    let candidateTypes = [];
    if (req.query.type === 'offer') {
      candidateTypes = ['offer'];
    } else if (req.query.type === 'request') {
      candidateTypes = ['request'];
    } else {
      if (myRequests.length > 0 || myOffers.length > 0) candidateTypes.push('offer');
      if (myOffers.length > 0) candidateTypes.push('request');
    }

    if (candidateTypes.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        hasPostedTravel: true,
        activeRoutes: myActiveTravels.map(t => ({ source: t.source, destination: t.destination, type: t.type })),
        data: []
      });
    }

    // 4. Query active unexpired candidate posts from other students
    const candidates = await Travel.find({
      userId: { $ne: req.userId },
      status: 'active',
      expiresAt: { $gt: now },
      type: { $in: candidateTypes }
    }).sort({ createdAt: -1 }).lean();

    // 5. Apply Smart Matching Engine across user's active travels
    const matchedMap = new Map();

    for (const cand of candidates) {
      const candBooked = cand.bookedSeats || 0;
      const candAvailableSeats = Math.max(0, (cand.seats || 1) - candBooked);

      // Check against user's relevant posts
      if (cand.type === 'offer') {
        // Candidate is an OFFER:
        // A. Match against user's active REQUESTS
        for (const reqPost of myRequests) {
          // Rule A: Same Direction & Normalized Locations (NEVER reverse direction)
          if (!isSameDirection(reqPost.source, reqPost.destination, cand.source, cand.destination)) {
            continue;
          }
          // Rule B: Same Calendar Day (Asia/Kolkata timezone)
          if (!isSameCalendarDay(reqPost.travelDate, cand.travelDate)) {
            continue;
          }
          // Rule C: Departure time compatibility (4-5 hours window)
          const timeDiff = Math.abs((reqPost.departureTime || 0) - (cand.departureTime || 0));
          if (timeDiff > 420) {
            continue;
          }
          // Rule D: Enough available seats for user's requested seats
          const neededSeats = reqPost.seats || 1;
          if (candAvailableSeats < neededSeats) {
            continue;
          }

          matchedMap.set(cand._id.toString(), {
            ...cand,
            availableSeats: candAvailableSeats,
            matchingReason: `Matches your request from ${reqPost.source} → ${reqPost.destination}`,
            matchingUserPostId: reqPost._id
          });
          break;
        }

        // B. Match against user's active OFFERS (co-travel / combined offers)
        if (!matchedMap.has(cand._id.toString()) && candAvailableSeats > 0) {
          for (const offerPost of myOffers) {
            if (!isSameDirection(offerPost.source, offerPost.destination, cand.source, cand.destination)) {
              continue;
            }
            if (!isSameCalendarDay(offerPost.travelDate, cand.travelDate)) {
              continue;
            }
            const timeDiff = Math.abs((offerPost.departureTime || 0) - (cand.departureTime || 0));
            if (timeDiff > 420) {
              continue;
            }

            matchedMap.set(cand._id.toString(), {
              ...cand,
              availableSeats: candAvailableSeats,
              matchingReason: `Co-travel offer on your route from ${offerPost.source} → ${offerPost.destination}`,
              matchingUserPostId: offerPost._id
            });
            break;
          }
        }
      } else if (cand.type === 'request') {
        // Candidate is a REQUEST: must match at least one of user's active OFFERS
        for (const offerPost of myOffers) {
          const offerBooked = offerPost.bookedSeats || 0;
          const offerAvailableSeats = Math.max(0, (offerPost.seats || 1) - offerBooked);

          // Rule A: Same Direction & Normalized Locations (NEVER reverse direction)
          if (!isSameDirection(offerPost.source, offerPost.destination, cand.source, cand.destination)) {
            continue;
          }
          // Rule B: Same Calendar Day (Asia/Kolkata timezone)
          if (!isSameCalendarDay(offerPost.travelDate, cand.travelDate)) {
            continue;
          }
          // Rule C: Departure time compatibility (maximum 7 hours / 420 minutes)
          const timeDiff = Math.abs((offerPost.departureTime || 0) - (cand.departureTime || 0));
          if (timeDiff > 420) {
            continue;
          }
          // Rule D: Offer has enough seats to fulfill the candidate request
          const requestedSeats = cand.seats || 1;
          if (offerAvailableSeats < requestedSeats) {
            continue;
          }

          matchedMap.set(cand._id.toString(), {
            ...cand,
            availableSeats: candAvailableSeats,
            matchingReason: `Passenger request for your ride from ${offerPost.source} → ${offerPost.destination}`,
            matchingUserPostId: offerPost._id
          });
          break;
        }
      }
    }

    let matchedList = Array.from(matchedMap.values());

    // Optional text search filter within matches
    if (req.query.search) {
      const term = req.query.search.trim().toLowerCase();
      matchedList = matchedList.filter(t =>
        (t.source || '').toLowerCase().includes(term) ||
        (t.destination || '').toLowerCase().includes(term) ||
        (t.authorName || '').toLowerCase().includes(term)
      );
    }

    // Enrich with creator student profile (strictly exclude phone number)
    const userIds = [...new Set(matchedList.map(t => t.userId))];
    const students = await Student.find(
      { clerkId: { $in: userIds } },
      { name: 1, email: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
    ).lean();
    const studentMap = new Map(students.map(s => [s.clerkId, s]));

    const enriched = matchedList.map(t => {
      const s = studentMap.get(t.userId);
      return {
        ...t,
        isMine: false,
        student: {
          name: s?.name || t.authorName || 'Campus Student',
          email: s?.email || t.authorEmail || '',
          imageUrl: s?.imageUrl || t.authorImage || null,
          avatarId: s?.avatarId || 'm1',
          college: s?.college || 'VIT, Bhopal',
          isVerified: s?.isVerified ?? true
        }
      };
    });

    return res.status(200).json({
      success: true,
      count: enriched.length,
      hasPostedTravel: true,
      activeRoutes: myActiveTravels.map(t => ({ source: t.source, destination: t.destination, type: t.type })),
      data: enriched
    });
  } catch (error) {
    console.error('Error fetching matching travel posts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching matching travel posts',
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

    const travelIds = travels.map(t => t._id);
    const bookings = await Booking.find({ travelId: { $in: travelIds } }).lean();

    const bookingsByTravel = new Map();
    for (const b of bookings) {
      const tid = b.travelId.toString();
      if (!bookingsByTravel.has(tid)) bookingsByTravel.set(tid, []);
      bookingsByTravel.get(tid).push(b);
    }

    const enriched = travels.map(t => {
      const reqs = bookingsByTravel.get(t._id.toString()) || [];
      return {
        ...t,
        requestsCount: reqs.length,
        pendingRequestsCount: reqs.filter(r => r.status === 'pending').length,
        acceptedRequestsCount: reqs.filter(r => ['accepted', 'confirmed'].includes(r.status)).length
      };
    });

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
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
 * @route   GET /api/travels/user/matches (and aliases /matches, /my-matches)
 * @desc    Find all matching travels for the logged-in user across their active posts
 * @access  Protected
 */
const handleGetUserMatches = async (req, res) => {
  try {
    const result = await findMatchesForUser(req.userId);
    return res.status(200).json({
      success: true,
      hasPostedTravel: result.hasPostedTravel,
      myTravels: result.myTravels,
      count: result.matches.length,
      data: result.matches
    });
  } catch (error) {
    console.error('Error fetching user matches:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user matches',
      error: error.message
    });
  }
};

router.get('/user/matches', requireAuth, handleGetUserMatches);
router.get('/matches', requireAuth, handleGetUserMatches);
router.get('/my-matches', requireAuth, handleGetUserMatches);

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

    const isMine = travel.userId === req.userId;
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
        isMine,
        student: {
          name: student?.name || travel.authorName || 'Campus Student',
          email: student?.email || travel.authorEmail || '',
          imageUrl: student?.imageUrl || travel.authorImage || null,
          college: student?.college || 'VIT, Bhopal',
          // Strictly withhold phone number if viewing own post to prevent self WhatsApp contact
          phone: isMine ? '' : (student?.phone || '')
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
