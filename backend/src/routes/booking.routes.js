import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireIdempotency } from '../middlewares/idempotency.js';
import {
  createBookingRequest,
  getReceivedBookings,
  getMyBookings,
  getConfirmedBookings,
  getBookingById,
  respondToBookingRequest,
  getWhatsAppDetails,
  confirmBooking,
  cancelBooking,
  completeBooking
} from '../controllers/booking.controller.js';

const router = express.Router();

/**
 * @route   POST /api/bookings
 * @desc    Create a booking request for an active, unexpired offer post
 * @access  Protected
 * @idempotency  Required — prevents duplicate booking on retries / double-clicks
 */
router.post('/', requireAuth, requireIdempotency(), createBookingRequest);

/**
 * @route   GET /api/bookings/received
 * @desc    Get booking requests received by the logged-in travel owner
 * @access  Protected
 */
router.get('/received', requireAuth, getReceivedBookings);

/**
 * @route   GET /api/bookings/my
 * @desc    Get booking requests created by the logged-in passenger
 * @access  Protected
 */
router.get('/my', requireAuth, getMyBookings);

/**
 * @route   GET /api/bookings/confirmed
 * @desc    Get all confirmed or completed bookings for the logged-in user
 * @access  Protected
 */
router.get('/confirmed', requireAuth, getConfirmedBookings);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking details by ID
 * @access  Protected (Owner or Passenger only)
 */
router.get('/:id', requireAuth, getBookingById);

/**
 * @route   GET /api/bookings/:id/whatsapp-details
 * @desc    Get WhatsApp coordination details and prefilled link for an accepted booking
 * @access  Protected (Owner and Passenger only)
 */
router.get('/:id/whatsapp-details', requireAuth, getWhatsAppDetails);

/**
 * @route   PATCH /api/bookings/:id/respond
 * @desc    Owner accept or reject a pending booking request
 * @access  Protected
 */
router.patch('/:id/respond', requireAuth, respondToBookingRequest);

/**
 * @route   POST /api/bookings/:id/confirm
 * @desc    Owner confirms an accepted booking and atomically reserves seats
 * @access  Protected (Travel Owner only)
 */
router.post('/:id/confirm', requireAuth, confirmBooking);
router.patch('/:id/confirm', requireAuth, confirmBooking);

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Owner or passenger cancels a confirmed booking and releases reserved seats
 * @access  Protected (Booking Owner or Passenger only)
 */
router.patch('/:id/cancel', requireAuth, cancelBooking);

/**
 * @route   PATCH /api/bookings/:id/complete
 * @desc    Owner or passenger marks a confirmed booking as completed
 * @access  Protected (Booking Owner or Passenger only)
 */
router.patch('/:id/complete', requireAuth, completeBooking);

export default router;




