/**
 * CampusPool Notification Job Definitions & Types
 */

export const NOTIFICATION_JOB_TYPES = {
  TEST_NOTIFICATION: 'test-notification',
  BOOKING_REQUESTED: 'BOOKING_REQUESTED',
  BOOKING_ACCEPTED: 'BOOKING_ACCEPTED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED_BY_PASSENGER: 'BOOKING_CANCELLED_BY_PASSENGER',
  BOOKING_CANCELLED_BY_OWNER: 'BOOKING_CANCELLED_BY_OWNER',
  BOOKING_WITHDRAWN: 'BOOKING_WITHDRAWN',
  RIDE_UPDATED: 'RIDE_UPDATED',
  RIDE_CANCELLED: 'RIDE_CANCELLED',
  RIDE_EXPIRED: 'RIDE_EXPIRED',
  TRAVEL_REMINDER_24H: 'TRAVEL_REMINDER_24H',
  TRAVEL_REMINDER_1H: 'TRAVEL_REMINDER_1H',
  NEW_MATCH_FOUND: 'NEW_MATCH_FOUND'
};

/**
 * Validates and formats a test notification job payload
 */
export function buildTestNotificationPayload({
  recipientId = 'test-user',
  message = 'CampusPool test notification',
  shouldFail = false
} = {}) {
  return {
    recipientId,
    message,
    shouldFail,
    timestamp: new Date().toISOString()
  };
}

/**
 * Returns user-friendly title and message for each notification event type
 * strictly avoiding sensitive information like phone numbers.
 */
export function formatNotificationContent(eventType, payload = {}) {
  const { source = 'Source', destination = 'Destination', requestedSeats = 1, travelDate } = payload;
  const dateStr = travelDate ? new Date(travelDate).toLocaleDateString() : '';

  switch (eventType) {
    case NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED: {
      const studentName = payload.passengerName || payload.studentName || 'A student';
      return {
        title: 'New Booking Request',
        message: `${studentName} requested ${requestedSeats} seat(s) for your ride from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED:
      return {
        title: 'Booking Request Accepted',
        message: `Your booking request for ${source} to ${destination} was accepted by the ride owner. Final confirmation pending.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_REJECTED:
      return {
        title: 'Booking Request Declined',
        message: `Your booking request for ${source} to ${destination} was declined by the ride owner.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED:
      return {
        title: 'Booking Confirmed!',
        message: `Your ride booking from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} is confirmed! (${requestedSeats} seat(s) reserved).`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER:
      return {
        title: 'Booking Cancelled',
        message: `A passenger has cancelled their booking for the ride from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER: {
      const ownerName = payload.ownerName || 'The ride host';
      return {
        title: 'Booking Cancelled',
        message: `${ownerName} cancelled the booking for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.BOOKING_WITHDRAWN: {
      const passengerName = payload.passengerName || 'The passenger';
      return {
        title: 'Booking Request Withdrawn',
        message: `${passengerName} withdrew their request for ${requestedSeats} seat(s) on your ride from ${source} to ${destination}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.RIDE_UPDATED: {
      const changeText = payload.changeSummary ? `: ${payload.changeSummary}` : '';
      return {
        title: 'Ride Details Updated',
        message: `Your ride from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} was updated by the host${changeText}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.RIDE_CANCELLED: {
      const hostName = payload.ownerName || payload.hostName || 'The ride host';
      return {
        title: 'Ride Cancelled',
        message: `The ride from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} was cancelled by ${hostName}. All reserved seats have been released.`
      };
    }

    case NOTIFICATION_JOB_TYPES.RIDE_EXPIRED: {
      return {
        title: 'Your Ride Has Expired',
        message: `Your ride post from ${source} to ${destination}${dateStr ? ' for ' + dateStr : ''} has reached its departure date and is no longer active.`
      };
    }

    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_24H:
      return {
        title: 'Upcoming Ride Reminder (24h)',
        message: `Reminder: Your ride from ${source} to ${destination} is scheduled to depart in 24 hours.`
      };

    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H:
      return {
        title: 'Ride Departing Soon (1h)',
        message: `Reminder: Your ride from ${source} to ${destination} departs in 1 hour. Please be ready at your pickup point.`
      };

    case NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND: {
      const matchTypeDesc = payload.type === 'offer' ? 'ride offer' : 'ride request';
      return {
        title: 'New Ride Match Found! 🚗',
        message: `A new matching ${matchTypeDesc} was posted for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION:
    default:
      return {
        title: 'CampusPool Notification',
        message: payload.message || 'You have a new update in CampusPool.'
      };
  }
}
