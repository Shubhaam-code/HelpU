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
  TRAVEL_REMINDER_24H: 'TRAVEL_REMINDER_24H',
  TRAVEL_REMINDER_1H: 'TRAVEL_REMINDER_1H'
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
    case NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED:
      return {
        title: 'New Booking Request',
        message: `A passenger requested ${requestedSeats} seat(s) for your ride from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };

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
        message: `Your seat(s) from ${source} to ${destination} have been confirmed! View ride details in CampusPool.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER:
      return {
        title: 'Booking Cancelled by Passenger',
        message: `A passenger has cancelled their booking for your ride from ${source} to ${destination}. The seats have been released.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER:
      return {
        title: 'Ride Cancelled by Owner',
        message: `The ride owner has cancelled the booking from ${source} to ${destination}.`
      };

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

    case NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION:
    default:
      return {
        title: 'CampusPool Notification',
        message: payload.message || 'You have a new update in CampusPool.'
      };
  }
}
