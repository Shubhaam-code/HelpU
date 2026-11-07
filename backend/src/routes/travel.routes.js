import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import Travel, { calculateExpiresAt } from '../models/Travel.js';
import Student from '../models/Student.js';
import Booking from '../models/Booking.js';
import { createOutboxEvent, triggerOutboxSweep } from '../services/outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';
import { 
  findMatchesForTravel, 
  findMatchesForUser,
  isSameDirection, 
  isSameCalendarDay, 
  getCanonicalCalendarDate,
  areLocationsMatching, 
  normalizeLocation 
} from '../services/matching.service.js';

/**
 * Automatically marks active rides past expiresAt as expired and creates Outbox events
 * notifying the post owners (Case 9: Ride Expired).
 */
export async function expireOverdueRidesAndNotify(filterUserId = null) {
  const now = new Date();
  const query = { status: 'active', expiresAt: { $lte: now } };
  if (filterUserId) query.userId = filterUserId;

  const overdue = await Travel.find(query);
  if (!overdue || overdue.length === 0) return 0;

  for (const t of overdue) {
    t.status = 'expired';
    await t.save();

    try {
      await createOutboxEvent({
        eventType: NOTIFICATION_JOB_TYPES.RIDE_EXPIRED,
        recipientId: t.userId,
        relatedTravelId: t._id,
        payload: {
          source: t.source,
          destination: t.destination,
          travelDate: t.travelDate,
          departureTime: t.departureTime
        }
      });
    } catch (notifErr) {
      console.warn(`[Expiry] Could not create outbox event for travel ${t._id}:`, notifErr.message);
    }
  }

  if (overdue.length > 0) {
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[Expiry] Outbox sweep warning:', sweepErr.message);
    }
  }
  return overdue.length;
}

const router = express.Router();

/**
 * @route   POST /api/travels
 * @desc    Create a new travel offer or request
 * @access  Protected
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { source, destination, travelDate, departureTime, timeFlexibility, seats, type, carModel, pricePerSeat, authorImage, authorName, authorEmail, notes, description, gender } = req.body;

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

    // 3. Validation and normalization for travel date
    if (!travelDate) {
      return res.status(400).json({
        success: false,
        message: 'Travel date is required'
      });
    }

    const canonicalDateStr = getCanonicalCalendarDate(travelDate);
    if (!canonicalDateStr) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid travel date'
      });
    }

    const parsedDate = new Date(`${canonicalDateStr}T00:00:00.000Z`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid travel date'
      });
    }

    // Optional gender validation
    const allowedGenders = ['Male', 'Female', 'Prefer not to say'];
    const validGender = allowedGenders.includes(gender) ? gender : null;

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

    // 6. Validation for seats (OFFER supports 1-6 seats; FIND/REQUEST is always exactly 1 seat)
    let numSeats = Number(seats);
    if (type === 'request') {
      // FIND post: always save exactly 1 seat regardless of incoming value
      numSeats = 1;
    } else {
      // OFFER post: must be an integer between 1 and 6
      if (!seats || isNaN(numSeats) || !Number.isInteger(numSeats) || numSeats < 1 || numSeats > 6) {
        return res.status(400).json({
          success: false,
          message: 'Seats for a ride offer must be an integer between 1 and 6'
        });
      }
    }

    // 7. Calculate expiry date in Asia/Kolkata timezone
    const expiresAt = calculateExpiresAt(parsedDate);

    // 8. Save document (userId obtained strictly from verified authentication)
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
      notes: (notes || description || '').trim(),
      authorImage: authorImage ? String(authorImage).trim() : null,
      authorName: authorName ? String(authorName).trim() : null,
      authorEmail: authorEmail ? String(authorEmail).trim() : null,
      gender: validGender,
      status: 'active',
      expiresAt
    });

    // Notify matching peers about this new ride in background (non-blocking)
    setImmediate(async () => {
      try {
        const matches = await findMatchesForTravel(travel);
        if (matches && matches.length > 0) {
          const notifiedUserIds = new Set();
          for (const match of matches) {
            const peerId = match.userId;
            if (peerId && peerId !== req.userId && !notifiedUserIds.has(peerId)) {
              notifiedUserIds.add(peerId);
              await createOutboxEvent({
                eventType: NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND,
                recipientId: peerId,
                relatedTravelId: travel._id,
                payload: {
                  source: travel.source,
                  destination: travel.destination,
                  travelDate: travel.travelDate,
                  type: travel.type,
                  authorName: travel.authorName || 'Campus Student',
                  carModel: travel.carModel
                }
              });
            }
          }
          if (notifiedUserIds.size > 0) {
            triggerOutboxSweep();
          }
        }
      } catch (matchErr) {
        console.warn('[Travel] Non-fatal match notification error:', matchErr.message);
      }
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

    // Automatically transition user's active posts that passed expiresAt to 'expired' and notify owner
    await expireOverdueRidesAndNotify(req.userId);

    // 1. Check if authenticated user has created any active offer or request
    let myActiveTravels = await Travel.find({
      userId: req.userId,
      status: 'active',
      expiresAt: { $gt: now }
    }).lean();

    // Allow filtering matches for a specific post or travel date
    const targetTravelId = req.query.travelId || req.query.postId;
    const targetDateStr = req.query.travelDate || req.query.date;

    if (targetTravelId && mongoose.Types.ObjectId.isValid(targetTravelId)) {
      myActiveTravels = myActiveTravels.filter(t => t._id.toString() === targetTravelId.toString());
    }

    if (targetDateStr) {
      myActiveTravels = myActiveTravels.filter(t => isSameCalendarDay(t.travelDate, targetDateStr));
    }

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

    // Enrich with creator student profile (including phone for direct WhatsApp contact)
    const userIds = [...new Set(matchedList.map(t => t.userId))];
    const students = await Student.find(
      { clerkId: { $in: userIds } },
      { name: 1, email: 1, phone: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
    ).lean();
    const studentMap = new Map(students.map(s => [s.clerkId, s]));

    const enriched = matchedList.map(t => {
      const s = studentMap.get(t.userId);
      const peerPhone = s?.phone || t.authorPhone || '';
      return {
        ...t,
        phone: peerPhone,
        isMine: false,
        student: {
          name: s?.name || t.authorName || 'Campus Student',
          email: s?.email || t.authorEmail || '',
          phone: peerPhone,
          gender: t.gender || s?.gender || null,
          imageUrl: s?.imageUrl || t.authorImage || null,
          avatarId: s?.avatarId || 'm1',
          college: s?.college || 'VIT, Bhopal',
          isVerified: Boolean(s?.isVerified)
        }
      };
    });

    // Normalize active routes so duplicate casing (e.g. "patna -> gaya" and "Patna -> Gaya") are unified
    const seenRoutes = new Set();
    const uniqueActiveRoutes = [];
    for (const t of myActiveTravels) {
      const normSource = (t.source || '').trim().toLowerCase();
      const normDest = (t.destination || '').trim().toLowerCase();
      const key = `${normSource}->${normDest}`;
      if (!seenRoutes.has(key)) {
        seenRoutes.add(key);
        uniqueActiveRoutes.push({
          source: normSource,
          destination: normDest,
          type: t.type
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: enriched.length,
      hasPostedTravel: true,
      activeRoutes: uniqueActiveRoutes,
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
 * @desc    Get all travel posts created by the logged-in user with status filtering
 * @access  Protected
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // 1. Auto-transition user's active posts that passed expiresAt to 'expired'
    await Travel.updateMany(
      { userId: req.userId, status: 'active', expiresAt: { $lte: now } },
      { $set: { status: 'expired' } }
    );

    // 2. Build status filter if requested
    const filter = { userId: req.userId };
    if (req.query.status) {
      const s = String(req.query.status).toLowerCase();
      if (s === 'active') {
        filter.status = 'active';
        filter.expiresAt = { $gt: now };
      } else if (s === 'expired') {
        filter.$or = [
          { status: 'expired' },
          { status: 'active', expiresAt: { $lte: now } }
        ];
      } else if (['cancelled', 'completed'].includes(s)) {
        filter.status = s;
      }
    }

    const travels = await Travel.find(filter).sort({ createdAt: -1 }).lean();

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
      const isExpired = t.status === 'expired' || (t.status === 'active' && new Date(t.expiresAt) <= now);
      const effectiveStatus = isExpired ? 'expired' : t.status;
      return {
        ...t,
        status: effectiveStatus,
        requestsCount: reqs.length,
        pendingRequestsCount: reqs.filter(r => r.status === 'pending').length,
        acceptedRequestsCount: reqs.filter(r => ['accepted', 'confirmed'].includes(r.status)).length,
        confirmedBookingsCount: reqs.filter(r => ['accepted', 'confirmed'].includes(r.status)).length,
        cancelledBookingsCount: reqs.filter(r => r.status === 'cancelled').length
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

    const now = new Date();
    const isExpired = travel.status === 'expired' || (travel.status === 'active' && new Date(travel.expiresAt) <= now);
    const effectiveStatus = isExpired ? 'expired' : travel.status;
    if (travel.status === 'active' && isExpired) {
      await Travel.updateOne({ _id: travel._id }, { $set: { status: 'expired' } });
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
        status: effectiveStatus,
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
          gender: travel.gender || student?.gender || null,
          isVerified: Boolean(student?.isVerified),
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
 * Safely cancels a travel post and all associated active bookings,
 * notifying all passengers and preventing orphaned or double-restored bookings.
 */
export async function cancelTravelPost(travelId, userId) {
  if (!mongoose.Types.ObjectId.isValid(travelId)) {
    return { status: 400, message: 'Invalid travel ID format' };
  }

  const travel = await Travel.findById(travelId);
  if (!travel) {
    return { status: 404, message: 'Travel post not found' };
  }

  // 1. Authorization: Only post owner can cancel
  if (travel.userId !== userId) {
    return { status: 403, message: 'Forbidden: You are not authorized to cancel this travel post' };
  }

  // 2. Lifecycle validation
  if (travel.status === 'cancelled') {
    return { status: 400, message: 'This ride is already cancelled' };
  }
  if (travel.status === 'completed') {
    return { status: 400, message: 'Cannot cancel a completed ride' };
  }
  const now = new Date();
  if (travel.status === 'expired' || travel.expiresAt <= now) {
    return { status: 400, message: 'Cannot cancel an expired ride' };
  }

  // 3. Mark travel status as cancelled
  travel.status = 'cancelled';
  await travel.save();

  // 4. Find all active bookings (pending, accepted, confirmed)
  const activeBookings = await Booking.find({
    travelId: travel._id,
    status: { $in: ['pending', 'accepted', 'confirmed'] }
  });

  // 5. Safely transition each booking to cancelled and notify passenger
  for (const b of activeBookings) {
    b.status = 'cancelled';
    b.cancelledAt = now;
    b.cancellationReason = 'Ride cancelled by host';
    await b.save();

    // Create outbox notification for passenger
    try {
      await createOutboxEvent({
        eventType: NOTIFICATION_JOB_TYPES.RIDE_CANCELLED,
        recipientId: b.passengerId,
        relatedBookingId: b._id,
        relatedTravelId: travel._id,
        payload: {
          source: travel.source,
          destination: travel.destination,
          travelDate: travel.travelDate,
          departureTime: travel.departureTime,
          requestedSeats: b.requestedSeats || 1,
          ownerName: travel.authorName || 'The ride host'
        }
      });
    } catch (notifErr) {
      console.warn(`Could not create cancellation outbox event for booking ${b._id}:`, notifErr.message);
    }
  }

  // Trigger outbox sweep to deliver notifications
  try {
    triggerOutboxSweep();
  } catch (sweepErr) {
    console.warn('Outbox sweep error during ride cancellation:', sweepErr.message);
  }

  return {
    status: 200,
    message: 'Ride cancelled successfully. All passenger bookings have been cancelled and passengers notified.',
    data: travel,
    affectedBookingsCount: activeBookings.length
  };
}

/**
 * @route   PATCH /api/travels/:id/cancel
 * @desc    Owner cancels an active travel post and safely cancels all passenger bookings
 * @access  Protected (Owner only)
 */
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const result = await cancelTravelPost(req.params.id, req.userId);
    return res.status(result.status).json({
      success: result.status === 200,
      message: result.message,
      data: result.data,
      affectedBookingsCount: result.affectedBookingsCount
    });
  } catch (error) {
    console.error('Error in PATCH /api/travels/:id/cancel:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while cancelling travel post',
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

    // If cancelled, delegate to safe cancellation logic
    if (status === 'cancelled') {
      const result = await cancelTravelPost(id, req.userId);
      return res.status(result.status).json({
        success: result.status === 200,
        message: result.message,
        data: result.data,
        affectedBookingsCount: result.affectedBookingsCount
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

    // Only active rides can transition to completed
    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete a ride with status "${travel.status}"`
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

/**
 * @route   PUT /api/travels/:id
 * @desc    Update existing travel post details (owner only) and safely handle bookings
 * @access  Protected
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate ID format
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

    // 3. Ownership verification: Only post owner can edit
    if (travel.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to edit this travel post'
      });
    }

    const now = new Date();
    const isExpired = travel.status === 'expired' || (travel.status === 'active' && new Date(travel.expiresAt) <= now);

    // Lifecycle check: Cannot edit cancelled, completed, or expired rides
    if (travel.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled ride'
      });
    }
    if (travel.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a completed ride'
      });
    }
    if (isExpired) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit an expired ride'
      });
    }

    const {
      source,
      destination,
      travelDate,
      departureTime,
      timeFlexibility,
      seats,
      pricePerSeat,
      carModel,
      status,
      gender
    } = req.body;

    // Do not allow reactivating an inactive ride through edit
    if (status && status === 'active' && travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reactivate a non-active ride'
      });
    }

    // If requested status is cancelled, route to safe cancellation
    if (status === 'cancelled') {
      const cancelResult = await cancelTravelPost(id, req.userId);
      return res.status(cancelResult.status).json({
        success: cancelResult.status === 200,
        message: cancelResult.message,
        data: cancelResult.data
      });
    }

    const bookedSeats = travel.bookedSeats || 0;

    // 4. Validate and handle seats safely: cannot reduce below bookedSeats
    if (travel.type === 'request') {
      // FIND post: always exactly 1 seat
      travel.seats = 1;
    } else if (seats !== undefined && seats !== null) {
      const numSeats = Number(seats);
      if (isNaN(numSeats) || !Number.isInteger(numSeats) || numSeats < 1 || numSeats > 6) {
        return res.status(400).json({
          success: false,
          message: 'Seats for a ride offer must be an integer between 1 and 6'
        });
      }
      if (numSeats < bookedSeats) {
        return res.status(400).json({
          success: false,
          message: `Total seats cannot be reduced below already confirmed booked seats (${bookedSeats})`
        });
      }
      travel.seats = numSeats;
    }

    // 5. Handle route and date modifications safely with respect to existing bookings
    const isSourceChanged = source && typeof source === 'string' && source.trim() !== travel.source;
    const isDestChanged = destination && typeof destination === 'string' && destination.trim() !== travel.destination;
    let isDateChanged = false;
    let newParsedDate = null;

    if (gender !== undefined) {
      const allowedGenders = ['Male', 'Female', 'Prefer not to say'];
      travel.gender = allowedGenders.includes(gender) ? gender : null;
    }

    if (travelDate) {
      const canonicalDateStr = getCanonicalCalendarDate(travelDate);
      if (!canonicalDateStr) {
        return res.status(400).json({
          success: false,
          message: 'Invalid travel date format'
        });
      }
      newParsedDate = new Date(`${canonicalDateStr}T00:00:00.000Z`);
      if (isNaN(newParsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid travel date format'
        });
      }
      const newExpiresAt = calculateExpiresAt(newParsedDate);
      if (newExpiresAt <= now) {
        return res.status(400).json({
          success: false,
          message: 'Travel date cannot be in the past or expired'
        });
      }
      const existingDateStr = travel.travelDate ? new Date(travel.travelDate).toISOString().split('T')[0] : '';
      const newDateStr = newParsedDate.toISOString().split('T')[0];
      if (newDateStr !== existingDateStr) {
        isDateChanged = true;
      }
    }

    // If there are already booked/confirmed seats, prevent changing route/date to avoid stranding confirmed passengers
    if (bookedSeats > 0 && (isSourceChanged || isDestChanged || isDateChanged)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change route or date for a ride with confirmed bookings. Please coordinate or cancel those bookings first.'
      });
    }

    // If route or date changed (and no confirmed bookings), cancel pending requests so they don't remain orphaned
    if (isSourceChanged || isDestChanged || isDateChanged) {
      await Booking.updateMany(
        { travelId: travel._id, status: 'pending' },
        { $set: { status: 'cancelled', cancellationReason: 'Ride details updated by host' } }
      );
    }

    if (source && typeof source === 'string' && source.trim()) {
      travel.source = source.trim();
    }
    if (destination && typeof destination === 'string' && destination.trim()) {
      travel.destination = destination.trim();
    }
    if (newParsedDate) {
      travel.travelDate = newParsedDate;
      travel.expiresAt = calculateExpiresAt(newParsedDate);
    }

    // 6. Departure time validation
    if (departureTime !== undefined && departureTime !== null) {
      const numDepartureTime = Number(departureTime);
      if (!Number.isInteger(numDepartureTime) || numDepartureTime < 0 || numDepartureTime > 1439) {
        return res.status(400).json({
          success: false,
          message: 'Departure time must be an integer between 0 and 1439 minutes from midnight'
        });
      }
      travel.departureTime = numDepartureTime;
    }

    // 7. Time flexibility validation
    if (timeFlexibility !== undefined && timeFlexibility !== null) {
      const numFlex = Number(timeFlexibility);
      if ([30, 60, 180, 300].includes(numFlex)) {
        travel.timeFlexibility = numFlex;
      }
    }

    // 8. Price per seat
    if (pricePerSeat !== undefined && pricePerSeat !== null) {
      const numPrice = Number(pricePerSeat);
      if (!isNaN(numPrice) && numPrice >= 0) {
        travel.pricePerSeat = numPrice;
      }
    }

    // 9. Vehicle / Car Model
    if (carModel !== undefined && carModel !== null) {
      travel.carModel = String(carModel).trim();
    }

    // 10. Status change (e.g. completed)
    if (status && status === 'completed') {
      travel.status = 'completed';
    }

    await travel.save();

    // Notify affected passengers about the ride update
    try {
      const affectedBookings = await Booking.find({
        travelId: travel._id,
        status: { $in: ['confirmed', 'accepted', 'pending'] }
      }).lean();

      if (affectedBookings.length > 0) {
        const changes = [];
        if (departureTime !== undefined) changes.push('departure time');
        if (pricePerSeat !== undefined) changes.push('price');
        if (carModel !== undefined) changes.push('vehicle');
        const changeSummary = changes.length > 0 ? changes.join(', ') : 'details';

        for (const b of affectedBookings) {
          if (b.passengerId && b.passengerId !== req.userId) {
            await createOutboxEvent({
              eventType: NOTIFICATION_JOB_TYPES.RIDE_UPDATED,
              recipientId: b.passengerId,
              relatedBookingId: b._id,
              relatedTravelId: travel._id,
              payload: {
                source: travel.source,
                destination: travel.destination,
                travelDate: travel.travelDate,
                departureTime: travel.departureTime,
                ownerName: travel.authorName || 'The ride host',
                changeSummary
              }
            });
          }
        }
        triggerOutboxSweep();
      }
    } catch (notifErr) {
      console.warn('[TravelUpdate] Non-fatal notification error:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Travel post updated successfully',
      data: travel
    });
  } catch (error) {
    console.error('Error updating travel post:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating travel post',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/travels/:id
 * @desc    Permanently delete a travel post (owner only) and safely cancel associated bookings
 * @access  Protected
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate ID format
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

    // 3. Ownership verification: Only post owner can delete
    if (travel.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to delete this travel post'
      });
    }

    // 4. Safely handle associated bookings:
    // Mark any active, pending, or accepted bookings as cancelled so passengers are not left stranded
    await Booking.updateMany(
      { travelId: travel._id, status: { $in: ['pending', 'accepted', 'confirmed'] } },
      { $set: { status: 'cancelled', cancellationReason: 'Travel post deleted by host' } }
    );

    // 5. Permanently remove the travel post from database
    await Travel.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Travel post successfully deleted',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting travel post:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting travel post',
      error: error.message
    });
  }
});

export default router;
