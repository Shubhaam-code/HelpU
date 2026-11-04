import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Travel from '../models/Travel.js';
import Student from '../models/Student.js';
import { createOutboxEvent, triggerOutboxSweep } from '../services/outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';
import { cancelBookingReminders } from '../services/reminder.service.js';

/**
 * @route   POST /api/bookings
 * @desc    Create a booking request for a travel offer post
 * @access  Protected
 */
export async function createBookingRequest(req, res) {
  try {
    const rawSeats = req.body.requestedSeats ?? req.body.seatsBooked ?? req.body.seats;
    const { travelId } = req.body;
    const requestedSeats = rawSeats;
    const passengerId = req.userId;

    // 1. Validate requestedSeats (must be a positive integer)
    if (
      requestedSeats === undefined ||
      requestedSeats === null ||
      isNaN(Number(requestedSeats)) ||
      !Number.isInteger(Number(requestedSeats)) ||
      Number(requestedSeats) < 1
    ) {
      return res.status(400).json({
        success: false,
        message: 'requestedSeats must be a positive integer of at least 1'
      });
    }
    const numSeats = Number(requestedSeats);

    // 2. Validate MongoDB ObjectId format
    if (!travelId || !mongoose.Types.ObjectId.isValid(travelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid travel ID format'
      });
    }

    // 3. Find target travel post
    const travel = await Travel.findById(travelId);
    if (!travel) {
      return res.status(404).json({
        success: false,
        message: 'Travel post not found'
      });
    }

    // 4. Prevent booking own travel post
    if (travel.userId === passengerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot request seats from your own travel post'
      });
    }

    // 5. Only allow booking requests for active, unexpired OFFER posts
    if (travel.type !== 'offer') {
      return res.status(400).json({
        success: false,
        message: 'Booking requests can only be made for travel offer posts'
      });
    }

    if (travel.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot book an inactive travel post'
      });
    }

    const now = new Date();
    if (travel.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book an expired travel post'
      });
    }

    // 6. Check available seats: availableSeats = total offer seats - confirmed booked seats
    const confirmedBookings = await Booking.find({
      travelId: travel._id,
      status: 'confirmed'
    });
    const confirmedSeats = confirmedBookings.reduce((sum, b) => sum + b.requestedSeats, 0);
    const totalBookedSeats = Math.max(confirmedSeats, travel.bookedSeats || 0);
    const availableSeats = travel.seats - totalBookedSeats;

    if (numSeats > availableSeats) {
      return res.status(400).json({
        success: false,
        message: `Requested ${numSeats} seat(s), but only ${Math.max(0, availableSeats)} seat(s) are available`
      });
    }

    // 7. Prevent duplicate pending, accepted, or confirmed booking requests by the same passenger
    const existingBooking = await Booking.findOne({
      travelId: travel._id,
      passengerId,
      status: { $in: ['pending', 'accepted', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: `You already have an active (${existingBooking.status}) booking for this travel post`
      });
    }

    const { passengerName, passengerEmail, passengerPhone, passengerImage, notes, passengerNotes } = req.body;
    const pricePerSeat = travel.pricePerSeat || 350;
    const totalPrice = numSeats * pricePerSeat;

    // 8. Create booking document with status: 'pending' inside transaction with Outbox event
    // Do NOT reserve or subtract seats at this stage (seats are deducted only upon final owner confirmation)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [booking] = await Booking.create(
        [
          {
            travelId: travel._id,
            ownerId: travel.userId,
            passengerId,
            requestedSeats: numSeats,
            passengerName: passengerName ? String(passengerName).trim() : undefined,
            passengerEmail: passengerEmail ? String(passengerEmail).trim() : undefined,
            passengerPhone: passengerPhone ? String(passengerPhone).trim() : undefined,
            passengerImage: passengerImage ? String(passengerImage).trim() : undefined,
            passengerNotes: (notes || passengerNotes) ? String(notes || passengerNotes).trim() : undefined,
            totalPrice,
            status: 'pending'
          }
        ],
        { session }
      );

      // Save Transactional Outbox event to notify travel owner
      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
          recipientId: travel.userId,
          relatedBookingId: booking._id,
          relatedTravelId: travel._id,
          payload: {
            source: travel.source,
            destination: travel.destination,
            travelDate: travel.travelDate,
            requestedSeats: numSeats
          }
        },
        session
      );

      await session.commitTransaction();
      triggerOutboxSweep();

      return res.status(201).json({
        success: true,
        message: 'Booking request created successfully',
        data: booking
      });
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      await session.endSession().catch(() => {});
    }
  } catch (error) {
    console.error('Error in createBookingRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating booking request',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/bookings/received
 * @desc    Get all booking requests received by the logged-in travel owner
 * @access  Protected
 */
export async function getReceivedBookings(req, res) {
  try {
    const ownerId = req.userId;

    const bookings = await Booking.find({ ownerId })
      .populate({
        path: 'travelId',
        select: 'source destination travelDate departureTime timeFlexibility seats bookedSeats status type expiresAt'
      })
      .sort({ createdAt: -1 });

    // Populate passenger public details
    const passengerIds = [...new Set(bookings.map((b) => b.passengerId))];
    const passengers = await Student.find(
      { clerkId: { $in: passengerIds } },
      { name: 1, email: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, phone: 1, clerkId: 1, _id: 0 }
    );

    const passengerMap = new Map();
    passengers.forEach((p) => passengerMap.set(p.clerkId, p));

    const data = bookings.map((b) => {
      const obj = b.toObject();
      const p = passengerMap.get(b.passengerId);
      const isAcceptedOrConfirmed = ['accepted', 'confirmed'].includes(b.status);
      obj.passenger = {
        name: p?.name || b.passengerName || 'Campus Student',
        email: p?.email || b.passengerEmail || '',
        college: p?.college || 'VIT, Bhopal',
        isVerified: p?.isVerified ?? true,
        avatarId: p?.avatarId || null,
        imageUrl: p?.imageUrl || b.passengerImage || null,
        // Expose passenger contact phone once booking is accepted/confirmed so host can coordinate
        phone: isAcceptedOrConfirmed ? (p?.phone || b.passengerPhone || '') : undefined
      };
      return obj;
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error in getReceivedBookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching received booking requests',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/bookings/my
 * @desc    Get all booking requests created by the logged-in passenger
 * @access  Protected
 */
export async function getMyBookings(req, res) {
  try {
    const passengerId = req.userId;

    const bookings = await Booking.find({ passengerId })
      .populate({
        path: 'travelId',
        select: 'source destination travelDate departureTime timeFlexibility seats bookedSeats status type expiresAt'
      })
      .sort({ createdAt: -1 });

    // Populate owner public details
    const ownerIds = [...new Set(bookings.map((b) => b.ownerId))];
    const owners = await Student.find(
      { clerkId: { $in: ownerIds } },
      { name: 1, email: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, phone: 1, clerkId: 1, _id: 0 }
    );

    const ownerMap = new Map();
    owners.forEach((o) => ownerMap.set(o.clerkId, o));

    const data = bookings.map((b) => {
      const obj = b.toObject();
      const o = ownerMap.get(b.ownerId);
      const isAcceptedOrConfirmed = ['accepted', 'confirmed'].includes(b.status);
      obj.owner = {
        name: o?.name || 'Ride Host',
        email: o?.email || '',
        college: o?.college || 'VIT, Bhopal',
        isVerified: o?.isVerified ?? true,
        avatarId: o?.avatarId || null,
        imageUrl: o?.imageUrl || null,
        // Expose owner contact phone once booking is accepted/confirmed
        phone: isAcceptedOrConfirmed ? (o?.phone || '') : undefined
      };
      return obj;
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error in getMyBookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching your booking requests',
      error: error.message
    });
  }
}

/**
 * @route   PATCH /api/bookings/:id/respond
 * @desc    Owner accept or reject a pending booking request
 * @access  Protected
 */
export async function respondToBookingRequest(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const ownerId = req.userId;

    // 1. Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // 2. Validate action (accept or reject only)
    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be either "accept" or "reject"'
      });
    }

    // 3. Find booking document
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking request not found'
      });
    }

    // 4. Authorization check: Only the owner of the travel post can respond
    if (booking.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to respond to this booking request'
      });
    }

    // 5. Only pending bookings can be accepted or rejected
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot respond to a booking request that is already ${booking.status}`
      });
    }

    // 6. Update status based on action inside transaction with Outbox event
    // When owner accepts, atomically reserve seats on Travel and transition to 'confirmed'
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const travel = await Travel.findById(booking.travelId).session(session);
      if (!travel) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Associated travel post not found'
        });
      }

      if (action === 'accept') {
        const currentBookedSeats = travel.bookedSeats || 0;
        const availableSeats = travel.seats - currentBookedSeats;

        if (booking.requestedSeats > availableSeats) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient seats available. Requested: ${booking.requestedSeats}, Available: ${Math.max(0, availableSeats)}`
          });
        }

        // Atomically reserve seats on Travel
        const reservedTravel = await Travel.findOneAndUpdate(
          {
            _id: travel._id,
            $expr: {
              $lte: [
                { $add: [{ $ifNull: ['$bookedSeats', 0] }, booking.requestedSeats] },
                '$seats'
              ]
            }
          },
          {
            $inc: { bookedSeats: booking.requestedSeats }
          },
          { returnDocument: 'after', session }
        );

        if (!reservedTravel) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Failed to reserve seats: insufficient seats or travel post has expired'
          });
        }

        booking.status = 'confirmed';
      } else {
        booking.status = 'rejected';
      }

      await booking.save({ session });

      const eventType =
        action === 'accept'
          ? NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED
          : NOTIFICATION_JOB_TYPES.BOOKING_REJECTED;

      await createOutboxEvent(
        {
          eventType,
          recipientId: booking.passengerId,
          relatedBookingId: booking._id,
          relatedTravelId: booking.travelId,
          payload: {
            source: travel?.source || 'Source',
            destination: travel?.destination || 'Destination',
            travelDate: travel?.travelDate,
            requestedSeats: booking.requestedSeats
          }
        },
        session
      );

      await session.commitTransaction();
      triggerOutboxSweep();

      return res.status(200).json({
        success: true,
        message: `Booking request ${action === 'accept' ? 'accepted and confirmed' : 'rejected'} successfully`,
        data: booking
      });
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      await session.endSession().catch(() => {});
    }
  } catch (error) {
    console.error('Error in respondToBookingRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while responding to booking request',
      error: error.message
    });
  }
}

/**
 * Safe helper to normalize phone numbers for WhatsApp international format (digits only).
 */
function normalizeWhatsAppPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;

  // If 10 digits (e.g. Indian local mobile without country code), prepend 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * @route   GET /api/bookings/:id/whatsapp-details
 * @desc    Get WhatsApp coordination details and prefilled link for an accepted booking
 * @access  Protected (Owner and Passenger only)
 */
export async function getWhatsAppDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 1. Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // 2. Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking request not found'
      });
    }

    // 3. Authorization check: Only booking owner or passenger can access
    const isOwner = booking.ownerId === userId;
    const isPassenger = booking.passengerId === userId;

    if (!isOwner && !isPassenger) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to view coordination details for this booking'
      });
    }

    // 4. Prevent self-coordination if owner and passenger are the same user
    if (booking.ownerId === booking.passengerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot initiate WhatsApp coordination with yourself on your own post'
      });
    }

    // 4. State check: Allow access when booking status is "accepted" or "confirmed"
    if (!['accepted', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `WhatsApp coordination details are only available for accepted or confirmed bookings (current status: ${booking.status})`
      });
    }

    // 5. Fetch owner and passenger Student profiles
    const [ownerStudent, passengerStudent, travel] = await Promise.all([
      Student.findOne({ clerkId: booking.ownerId }),
      Student.findOne({ clerkId: booking.passengerId }),
      Travel.findById(booking.travelId).lean()
    ]);

    const passengerPhone = (passengerStudent?.phone || booking.passengerPhone || '').trim();
    const ownerPhone = (ownerStudent?.phone || '').trim();

    const otherRole = isOwner ? 'passenger' : 'owner';
    const targetPhone = isOwner ? passengerPhone : ownerPhone;

    if (!targetPhone) {
      return res.status(400).json({
        success: false,
        message: `${otherRole === 'passenger' ? 'Passenger' : 'Owner'} contact phone number is missing or unavailable`
      });
    }

    const otherStudent = isOwner ? passengerStudent : ownerStudent;
    const targetName = isOwner 
      ? (passengerStudent?.name || booking.passengerName || 'Fellow Student')
      : (ownerStudent?.name || 'Ride Host');

    // 7. Normalize phone number for WhatsApp
    const normalizedPhone = normalizeWhatsAppPhone(targetPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: `Invalid phone number format for ${otherRole}`
      });
    }

    // 8. Generate WhatsApp wa.me URL with prefilled message
    const routeText = travel ? `${travel.source} to ${travel.destination}` : 'campus route';
    const prefilledMessage = `Hi ${targetName}! Connecting via HelpU regarding Booking #${booking._id.toString().slice(-6).toUpperCase()} for ${routeText}. Let's coordinate pickup!`;
    const encodedMessage = encodeURIComponent(prefilledMessage);
    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

    return res.status(200).json({
      success: true,
      message: 'WhatsApp coordination details retrieved successfully',
      data: {
        bookingId: booking._id,
        role: isOwner ? 'owner' : 'passenger',
        contact: {
          name: targetName,
          phone: targetPhone,
          role: otherRole
        },
        name: targetName,
        phone: targetPhone,
        normalizedPhone,
        whatsappUrl,
        prefilledMessage
      }
    });
  } catch (error) {
    console.error('Error in getWhatsAppDetails:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching WhatsApp coordination details',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/bookings/:id/confirm
 * @desc    Owner confirms an accepted booking and atomically reserves seats
 * @access  Protected (Travel Owner only)
 */
export async function confirmBooking(req, res) {
  const { id } = req.params;
  const ownerId = req.userId;

  // 1. Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID format'
    });
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Find booking document with session
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Booking request not found'
        });
      }

      // 3. Authorization check: Only the travel owner can confirm
      if (booking.ownerId !== ownerId) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only the travel owner can confirm this booking'
        });
      }

      // 4. Status check: Booking must have status "accepted" or "confirmed"
      if (booking.status === 'confirmed') {
        await session.abortTransaction();
        return res.status(200).json({
          success: true,
          message: 'Booking is already confirmed',
          data: { booking }
        });
      }

      if (booking.status !== 'accepted') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Cannot confirm booking with status "${booking.status}". Only accepted bookings can be confirmed.`
        });
      }

      // 5. Find associated Travel post with session
      const travel = await Travel.findById(booking.travelId).session(session);
      if (!travel) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Travel post not found'
        });
      }

      // 6. Travel status and expiry checks
      if (travel.status !== 'active') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Cannot confirm booking for an inactive travel post'
        });
      }

      const now = new Date();
      if (travel.expiresAt <= now) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Cannot confirm booking for an expired travel post'
        });
      }

      // 7. Immediate available seats pre-check
      const currentBookedSeats = travel.bookedSeats || 0;
      const availableSeats = travel.seats - currentBookedSeats;
      if (booking.requestedSeats > availableSeats) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient seats available. Requested: ${booking.requestedSeats}, Available: ${Math.max(0, availableSeats)}`
        });
      }

      // 8. Atomically reserve seats on Travel within the transaction
      const reservedTravel = await Travel.findOneAndUpdate(
        {
          _id: travel._id,
          status: 'active',
          expiresAt: { $gt: now },
          $expr: {
            $lte: [
              { $add: [{ $ifNull: ['$bookedSeats', 0] }, booking.requestedSeats] },
              '$seats'
            ]
          }
        },
        {
          $inc: { bookedSeats: booking.requestedSeats }
        },
        { returnDocument: 'after', session }
      );

      if (!reservedTravel) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Failed to reserve seats: insufficient seats or travel post has expired/become inactive'
        });
      }

      // 9. Atomically update booking status from 'accepted' to 'confirmed' within the transaction
      const updatedBooking = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: 'accepted'
        },
        {
          $set: { status: 'confirmed' }
        },
        { returnDocument: 'after', session }
      );

      if (!updatedBooking) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Booking could not be confirmed because it is no longer in accepted status'
        });
      }

      // 10. Create Outbox event for booking confirmation inside transaction
      await createOutboxEvent(
        {
          eventType: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
          recipientId: booking.passengerId,
          relatedBookingId: booking._id,
          relatedTravelId: travel._id,
          payload: {
            source: reservedTravel.source,
            destination: reservedTravel.destination,
            travelDate: reservedTravel.travelDate,
            requestedSeats: booking.requestedSeats
          }
        },
        session
      );

      // Commit operations atomically
      await session.commitTransaction();

      // Trigger immediate outbox dispatch (reminders are reliably scheduled by the worker upon processing BOOKING_CONFIRMED)
      triggerOutboxSweep();

      const updatedAvailableSeats = reservedTravel.seats - reservedTravel.bookedSeats;

      return res.status(200).json({
        success: true,
        message: 'Booking confirmed and seats reserved successfully',
        data: {
          booking: updatedBooking,
          travel: {
            id: reservedTravel._id,
            totalSeats: reservedTravel.seats,
            bookedSeats: reservedTravel.bookedSeats,
            availableSeats: updatedAvailableSeats
          }
        }
      });
    } catch (error) {
      await session.abortTransaction();
      const isTransient =
        (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) ||
        (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) ||
        error.code === 112;

      if (isTransient && attempt < maxRetries) {
        await session.endSession().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }

      console.error('Error in confirmBooking transaction:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while confirming booking',
        error: error.message
      });
    } finally {
      await session.endSession().catch(() => {});
    }
  }
}

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Owner or passenger cancels a confirmed booking and releases reserved seats
 * @access  Protected (Booking Owner or Passenger only)
 */
export async function cancelBooking(req, res) {
  const { id } = req.params;
  const userId = req.userId;

  // 1. Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID format'
    });
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Find booking document with session
      const booking = await Booking.findById(id).session(session);
      if (!booking) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Booking request not found'
        });
      }

      // 3. Authorization check: Only booking owner or passenger can cancel
      const isOwner = booking.ownerId === userId;
      const isPassenger = booking.passengerId === userId;

      if (!isOwner && !isPassenger) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not authorized to cancel this booking'
        });
      }

      // 4. Status check: Allow cancelling pending, accepted, or confirmed bookings
      if (!['pending', 'accepted', 'confirmed'].includes(booking.status)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Cannot cancel a booking with status "${booking.status}".`
        });
      }

      // If pending, no seats were reserved on Travel yet - cancel immediately
      if (booking.status === 'pending') {
        booking.status = 'cancelled';
        const cancelledBooking = await booking.save({ session });
        await session.commitTransaction();
        return res.status(200).json({
          success: true,
          message: 'Booking request cancelled successfully',
          data: { booking: cancelledBooking }
        });
      }

      // 5. Verify associated Travel post exists with session
      const travel = await Travel.findById(booking.travelId).session(session);
      if (!travel) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Associated travel post not found'
        });
      }

      // 6. Atomically transition booking status from 'confirmed' to 'cancelled' within the transaction
      const cancelledBooking = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: 'confirmed'
        },
        {
          $set: { status: 'cancelled' }
        },
        { returnDocument: 'after', session }
      );

      if (!cancelledBooking) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Booking is no longer in confirmed status or was already cancelled'
        });
      }

      // 7. Atomically decrement bookedSeats on Travel within the transaction
      const updatedTravel = await Travel.findOneAndUpdate(
        {
          _id: travel._id,
          bookedSeats: { $gte: booking.requestedSeats }
        },
        {
          $inc: { bookedSeats: -booking.requestedSeats }
        },
        { returnDocument: 'after', session }
      );

      if (!updatedTravel) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Cannot release seats: Travel bookedSeats is less than requested seats'
        });
      }

      // 8. Create Outbox event for cancellation inside transaction
      const eventType = isOwner
        ? NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER
        : NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER;
      const recipientId = isOwner ? booking.passengerId : booking.ownerId;

      await createOutboxEvent(
        {
          eventType,
          recipientId,
          relatedBookingId: booking._id,
          relatedTravelId: travel._id,
          payload: {
            source: travel.source,
            destination: travel.destination,
            travelDate: travel.travelDate,
            cancelledBy: isOwner ? 'owner' : 'passenger'
          }
        },
        session
      );

      // Commit operations atomically
      await session.commitTransaction();

      // Trigger immediate outbox dispatch and cancel pending reminders
      triggerOutboxSweep();
      await cancelBookingReminders(booking._id).catch((err) => {
        console.error('[Reminders] Error removing reminders:', err.message);
      });

      const availableSeats = updatedTravel.seats - updatedTravel.bookedSeats;

      return res.status(200).json({
        success: true,
        message: 'Booking cancelled and seats released successfully',
        data: {
          booking: cancelledBooking,
          cancelledBy: isOwner ? 'owner' : 'passenger',
          travel: {
            id: updatedTravel._id,
            totalSeats: updatedTravel.seats,
            bookedSeats: updatedTravel.bookedSeats,
            availableSeats
          }
        }
      });
    } catch (error) {
      await session.abortTransaction();
      const isTransient =
        (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) ||
        (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) ||
        error.code === 112;

      if (isTransient && attempt < maxRetries) {
        await session.endSession().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }

      console.error('Error in cancelBooking transaction:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while cancelling booking',
        error: error.message
      });
    } finally {
      await session.endSession().catch(() => {});
    }
  }
}

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking details by ID
 * @access  Protected (Owner or Passenger)
 */
export async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(id).populate('travelId').lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.ownerId !== req.userId && booking.passengerId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Not authorized to view this booking' });
    }

    const [ownerStudent, passengerStudent] = await Promise.all([
      Student.findOne({ clerkId: booking.ownerId }).lean(),
      Student.findOne({ clerkId: booking.passengerId }).lean()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...booking,
        ownerStudent,
        passengerStudent
      }
    });
  } catch (error) {
    console.error('Error fetching booking by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching booking',
      error: error.message
    });
  }
}






