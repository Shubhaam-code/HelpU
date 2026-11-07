import mongoose from 'mongoose';
import Travel from '../models/Travel.js';
import Booking from '../models/Booking.js';
import Student from '../models/Student.js';
import { formatNotificationContent, NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';

/**
 * Standard Helpu branded fallback image when a post has no user image attached.
 * Hosted on production backend & accessible publicly over HTTPS.
 */
export const HELPU_DEFAULT_NOTIFICATION_IMAGE =
  process.env.NOTIFICATION_FALLBACK_IMAGE_URL ||
  'https://helpu.onrender.com/images/helpu-fallback-ride.png';

/**
 * Format minutes from midnight (0..1439) into 12-hour AM/PM string
 */
export function formatMinutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format date cleanly for notification titles/subtitles (e.g. "Thu, 6 Nov")
 */
export function formatNotificationDate(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Checks if a string is a valid absolute HTTP or HTTPS URL
 */
export function isValidHttpUrl(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Central dynamic image resolver for Helpu notifications.
 *
 * Rules:
 * - Booking events: use the booking's associated ride post image.
 * - Match events: use the other student's matched post image.
 * - Confirmation events: use the confirmed ride image.
 * - Cancellation events: use the cancelled ride image.
 * - Rejection and withdrawal events: use the original associated post image.
 * - Ride update and expiry events: use the affected post image.
 * - Never use one hardcoded image for every notification.
 * - If post has no image, use the consistent Helpu-branded fallback image.
 *
 * @param {Object} params
 * @param {string} params.eventType - Notification event type
 * @param {string} [params.travelId] - Associated travel/ride ID
 * @param {string} [params.bookingId] - Associated booking ID
 * @param {Object} [params.payload] - Existing payload
 * @returns {Promise<{ imageUrl: string, travelDoc: Object|null, bookingDoc: Object|null, sourceField: string }>}
 */
export async function resolveNotificationImage({
  eventType,
  travelId,
  bookingId,
  payload = {}
}) {
  let bookingDoc = null;
  let targetTravelId = travelId;

  // 1. If bookingId is provided, fetch booking to obtain exact travelId if missing
  if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
    try {
      bookingDoc = await Booking.findById(bookingId).lean();
      if (bookingDoc && !targetTravelId) {
        targetTravelId = bookingDoc.travelId || bookingDoc.offerTravelId || bookingDoc.offerId;
      }
    } catch (err) {
      console.warn(`[ImageResolver] Error querying booking ${bookingId}:`, err.message);
    }
  }

  // 2. Fetch associated Travel document from MongoDB
  let travelDoc = null;
  if (targetTravelId && mongoose.Types.ObjectId.isValid(targetTravelId)) {
    try {
      travelDoc = await Travel.findById(targetTravelId).lean();
    } catch (err) {
      console.warn(`[ImageResolver] Error querying travel ${targetTravelId}:`, err.message);
    }
  }

  // 3. Inspect image fields hierarchically:
  // (a) Explicit valid image in payload (e.g., provided during event creation)
  if (isValidHttpUrl(payload.imageUrl)) {
    return {
      imageUrl: payload.imageUrl,
      travelDoc,
      bookingDoc,
      sourceField: 'payload.imageUrl'
    };
  }

  // (b) Travel post custom image / ride image
  if (travelDoc) {
    if (isValidHttpUrl(travelDoc.imageUrl)) {
      return {
        imageUrl: travelDoc.imageUrl,
        travelDoc,
        bookingDoc,
        sourceField: 'travelDoc.imageUrl'
      };
    }
    if (isValidHttpUrl(travelDoc.rideImage)) {
      return {
        imageUrl: travelDoc.rideImage,
        travelDoc,
        bookingDoc,
        sourceField: 'travelDoc.rideImage'
      };
    }
    if (isValidHttpUrl(travelDoc.carImage)) {
      return {
        imageUrl: travelDoc.carImage,
        travelDoc,
        bookingDoc,
        sourceField: 'travelDoc.carImage'
      };
    }

    // (c) Post author image / avatar
    if (isValidHttpUrl(travelDoc.authorImage)) {
      return {
        imageUrl: travelDoc.authorImage,
        travelDoc,
        bookingDoc,
        sourceField: 'travelDoc.authorImage'
      };
    }

    // (d) Query Student collection for author profile image
    if (travelDoc.userId) {
      try {
        const student = await Student.findOne({ clerkId: travelDoc.userId }, { imageUrl: 1 }).lean();
        if (student && isValidHttpUrl(student.imageUrl)) {
          return {
            imageUrl: student.imageUrl,
            travelDoc,
            bookingDoc,
            sourceField: 'student.imageUrl'
          };
        }
      } catch (studentErr) {
        console.warn(`[ImageResolver] Error querying student for travel author ${travelDoc.userId}:`, studentErr.message);
      }
    }
  }

  // (e) For booking requested / withdrawn: also check passenger image if host image absent
  if (bookingDoc && (eventType === NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED || eventType === NOTIFICATION_JOB_TYPES.BOOKING_WITHDRAWN)) {
    if (isValidHttpUrl(bookingDoc.passengerImage)) {
      return {
        imageUrl: bookingDoc.passengerImage,
        travelDoc,
        bookingDoc,
        sourceField: 'bookingDoc.passengerImage'
      };
    }
  }

  // (f) When no post/student image is available, return null so a clean text-only notification is delivered
  // This guarantees Android never fails or suppresses notifications due to image download errors.
  return {
    imageUrl: null,
    travelDoc,
    bookingDoc,
    sourceField: 'none'
  };
}

/**
 * Builds the complete, rich notification presentation and custom data payload
 * for all 9 Helpu notification cases.
 *
 * @param {Object} params
 * @param {string} params.eventType - e.g. BOOKING_REQUESTED, NEW_MATCH_FOUND, etc.
 * @param {string} params.recipientId - Canonical recipient user ID
 * @param {string} [params.relatedBookingId]
 * @param {string} [params.relatedTravelId]
 * @param {Object} [params.payload]
 * @returns {Promise<{ title: string, message: string, imageUrl: string, customData: Record<string, string>, targetRoute: string }>}
 */
export async function resolveNotificationContentAndPayload({
  eventType,
  recipientId,
  relatedBookingId,
  relatedTravelId,
  payload = {}
}) {
  // 1. Resolve dynamic image and related documents from database
  const { imageUrl, travelDoc, bookingDoc, sourceField } = await resolveNotificationImage({
    eventType,
    travelId: relatedTravelId,
    bookingId: relatedBookingId,
    payload
  });

  // 2. Extract normalized metadata
  const source = payload.source || travelDoc?.source || 'Source';
  const destination = payload.destination || travelDoc?.destination || 'Destination';
  const travelDate = payload.travelDate || travelDoc?.travelDate;
  const dateFormatted = formatNotificationDate(travelDate);
  const timeFormatted = formatMinutesToTime(payload.departureTime ?? travelDoc?.departureTime);
  const requestedSeats = payload.requestedSeats || bookingDoc?.requestedSeats || 1;
  const ownerName = payload.ownerName || travelDoc?.authorName || 'Ride Host';
  const passengerName = payload.passengerName || bookingDoc?.passengerName || 'A Student';

  // 3. Determine title, message, and deep-link targetRoute for each case
  let title = 'HelpU Notification';
  let message = '';
  let targetRoute = '/notifications';
  const effectiveTravelId = relatedTravelId ? String(relatedTravelId) : (travelDoc?._id ? String(travelDoc._id) : '');
  const effectiveBookingId = relatedBookingId ? String(relatedBookingId) : (bookingDoc?._id ? String(bookingDoc._id) : '');

  switch (eventType) {
    // ------------------------------------------------------------------------
    // CASE 1: New Booking Request (Recipient: Ride Owner)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED: {
      title = 'New Booking Request';
      const timeStr = timeFormatted ? ` at ${timeFormatted}` : '';
      message = `${passengerName} requested ${requestedSeats} seat(s) for your ride: ${source} → ${destination}${dateFormatted ? ' (' + dateFormatted + timeStr + ')' : ''}.`;
      targetRoute = effectiveBookingId ? `/bookings/${effectiveBookingId}` : (effectiveTravelId ? `/rides/${effectiveTravelId}` : '/bookings/received');
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 2: New Match Found (Recipients: Both eligible users)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND: {
      title = 'New Match Found!';
      const matchTypeDesc = (payload.type || travelDoc?.type) === 'offer' ? 'ride offer' : 'ride request';
      const timeStr = timeFormatted ? ` at ${timeFormatted}` : '';
      message = `Matching ${matchTypeDesc} found: ${source} → ${destination}${dateFormatted ? ' on ' + dateFormatted + timeStr : ''}. Tap to connect!`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/match';
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 3: Booking Confirmed (Recipient: Passenger)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED:
    case NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED: {
      title = 'Booking Confirmed!';
      const timeStr = timeFormatted ? ` at ${timeFormatted}` : '';
      message = `Your ride from ${source} to ${destination}${dateFormatted ? ' on ' + dateFormatted + timeStr : ''} is confirmed! (${requestedSeats} seat(s) reserved with ${ownerName}).`;
      targetRoute = effectiveBookingId ? `/bookings/${effectiveBookingId}` : (effectiveTravelId ? `/rides/${effectiveTravelId}` : '/bookings');
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 4: Booking Cancelled (Recipients: Affected Passenger or Owner)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER: {
      title = 'Booking Cancelled';
      message = `${passengerName} cancelled their booking for ${source} to ${destination}${dateFormatted ? ' on ' + dateFormatted : ''}.`;
      targetRoute = effectiveBookingId ? `/bookings/${effectiveBookingId}` : (effectiveTravelId ? `/rides/${effectiveTravelId}` : '/bookings');
      break;
    }

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER: {
      title = 'Booking Cancelled';
      message = `${ownerName} cancelled the booking for ${source} to ${destination}${dateFormatted ? ' on ' + dateFormatted : ''}.`;
      targetRoute = effectiveBookingId ? `/bookings/${effectiveBookingId}` : '/bookings';
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 5: Booking Request Rejected (Recipient: Passenger)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.BOOKING_REJECTED: {
      title = 'Booking Request Declined';
      message = `Your booking request for ${source} to ${destination}${dateFormatted ? ' on ' + dateFormatted : ''} was declined by ${ownerName}.`;
      targetRoute = effectiveBookingId ? `/bookings/${effectiveBookingId}` : '/bookings';
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 6: Booking Request Withdrawn (Recipient: Ride Owner)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.BOOKING_WITHDRAWN: {
      title = 'Booking Request Withdrawn';
      message = `${passengerName} withdrew their request for ${requestedSeats} seat(s) on your ride: ${source} → ${destination}.`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/bookings/received';
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 7: Ride Updated (Recipients: Affected Passengers)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.RIDE_UPDATED: {
      title = 'Ride Details Updated';
      const changeText = payload.changeSummary ? `: ${payload.changeSummary}` : '';
      const timeStr = timeFormatted ? ` (${timeFormatted})` : '';
      message = `Your ride from ${source} to ${destination}${dateFormatted ? ' on ' + dateFormatted + timeStr : ''} was updated by ${ownerName}${changeText}.`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/rides';
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 8: Ride Cancelled by Owner (Recipients: All confirmed/pending passengers)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.RIDE_CANCELLED: {
      title = 'Ride Cancelled';
      message = `The ride from ${source} to ${destination}${dateFormatted ? ' on ' + dateFormatted : ''} was cancelled by ${ownerName}. All reserved seats have been released.`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/rides';
      break;
    }

    // ------------------------------------------------------------------------
    // CASE 9: Ride Expired (Recipient: Original Post Owner)
    // ------------------------------------------------------------------------
    case NOTIFICATION_JOB_TYPES.RIDE_EXPIRED: {
      title = 'Your Ride Has Expired';
      message = `Your ride post from ${source} to ${destination}${dateFormatted ? ' for ' + dateFormatted : ''} has reached its departure date and is no longer active.`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/rides';
      break;
    }

    // Reminders
    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H:
      title = 'Upcoming Ride Reminder (24h)';
      message = `Reminder: Your ride from ${source} to ${destination} departs tomorrow${timeFormatted ? ' at ' + timeFormatted : ''}.`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/rides';
      break;

    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H:
      title = 'Ride Departing Soon (1h)';
      message = `Reminder: Your ride from ${source} to ${destination} departs in 1 hour. Please head to your pickup point.`;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/rides';
      break;

    default: {
      const fallback = formatNotificationContent(eventType, payload);
      title = fallback.title;
      message = fallback.message;
      targetRoute = effectiveTravelId ? `/rides/${effectiveTravelId}` : '/notifications';
      break;
    }
  }

  // 4. Build sanitized custom data for FCM delivery and Android native handling
  const customData = {
    eventType: String(eventType),
    type: String(eventType),
    recipientId: String(recipientId || ''),
    targetUserId: String(recipientId || ''),
    postId: effectiveTravelId,
    travelId: effectiveTravelId,
    bookingId: effectiveBookingId,
    route: targetRoute,
    imageUrl: imageUrl ? String(imageUrl) : '',
    imageSource: sourceField,
    source: String(source),
    destination: String(destination),
    travelDate: travelDate ? new Date(travelDate).toISOString() : '',
    departureTime: timeFormatted,
    requestedSeats: String(requestedSeats),
    ownerName: String(ownerName),
    passengerName: String(passengerName)
  };

  return {
    title,
    message,
    imageUrl,
    customData,
    targetRoute,
    imageSource: sourceField
  };
}

export default {
  resolveNotificationImage,
  resolveNotificationContentAndPayload,
  formatMinutesToTime,
  formatNotificationDate,
  isValidHttpUrl,
  HELPU_DEFAULT_NOTIFICATION_IMAGE
};
