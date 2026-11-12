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
  NEW_MATCH_FOUND: 'NEW_MATCH_FOUND',
  GROUP_INVITATION_RECEIVED: 'GROUP_INVITATION_RECEIVED',
  GROUP_INVITATION_ACCEPTED: 'GROUP_INVITATION_ACCEPTED',
  GROUP_INVITATION_REJECTED: 'GROUP_INVITATION_REJECTED',
  GROUP_JOIN_REQUEST_RECEIVED: 'GROUP_JOIN_REQUEST_RECEIVED',
  GROUP_JOIN_REQUEST_ACCEPTED: 'GROUP_JOIN_REQUEST_ACCEPTED',
  GROUP_JOIN_REQUEST_REJECTED: 'GROUP_JOIN_REQUEST_REJECTED',
  GROUP_MEMBER_JOINED: 'GROUP_MEMBER_JOINED',
  GROUP_MEMBER_LEFT: 'GROUP_MEMBER_LEFT',
  GROUP_ADMIN_PROMOTED: 'GROUP_ADMIN_PROMOTED',
  GROUP_CLOSED: 'GROUP_CLOSED',
  COMPATIBLE_FIND_MATCH: 'COMPATIBLE_FIND_MATCH'
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
        message: `${studentName} wants to travel with you from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Open Helpu to review the request.`
      };
    }

    case NOTIFICATION_JOB_TYPES.BOOKING_ACCEPTED:
      return {
        title: 'Booking Request Accepted',
        message: `Your booking request for ${source} to ${destination} has been accepted. Open Helpu to view the booking.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_REJECTED:
      return {
        title: 'Booking Request Declined',
        message: `Your booking request for ${source} to ${destination} was declined. Open Helpu to find other rides.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED:
      return {
        title: 'Booking Confirmed',
        message: `Your ride booking from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} is confirmed (${requestedSeats} seat(s) reserved). Open Helpu to view the ride.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER:
      return {
        title: 'Booking Cancelled',
        message: `${payload.passengerName || 'A passenger'} cancelled their booking for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Released seat is now available.`
      };

    case NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER: {
      const ownerName = payload.ownerName || 'The ride host';
      return {
        title: 'Booking Cancelled',
        message: `${ownerName} cancelled the booking for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Open Helpu to find an alternative ride.`
      };
    }

    case NOTIFICATION_JOB_TYPES.BOOKING_WITHDRAWN: {
      const passengerName = payload.passengerName || 'The passenger';
      return {
        title: 'Booking Request Withdrawn',
        message: `${passengerName} withdrew their booking request for ${source} to ${destination}. Open Helpu to view your ride.`
      };
    }

    case NOTIFICATION_JOB_TYPES.RIDE_UPDATED: {
      const changeText = payload.changeSummary ? `: ${payload.changeSummary}` : '';
      return {
        title: 'Ride Details Updated',
        message: `Your ride from ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} was updated by the host${changeText}. Open Helpu to check the updated details.`
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
        title: 'Ride Reminder (24h)',
        message: `Reminder: Your ride from ${source} to ${destination} departs tomorrow. Open Helpu to view travel details.`
      };

    case NOTIFICATION_JOB_TYPES.TRAVEL_REMINDER_1H:
      return {
        title: 'Ride Departing Soon (1h)',
        message: `Reminder: Your ride from ${source} to ${destination} departs in 1 hour. Please head to your pickup point.`
      };

    case NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND: {
      return {
        title: 'New Ride Match',
        message: `A compatible ride has been found for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Open Helpu to view the match.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_INVITATION_RECEIVED: {
      if (payload.customTitle || payload.customMessage) {
        return {
          title: payload.customTitle || 'You have a Shared Group invitation!',
          message: payload.customMessage || 'A student wants to create a Shared Group with you for your trip. Review and accept the invitation to join.'
        };
      }
      if (payload.fromMatchProposal) {
        return {
          title: 'You have a Shared Group invitation!',
          message: 'A student wants to create a Shared Group with you for your trip. Review and accept the invitation to join.'
        };
      }
      const adminName = payload.adminName || payload.senderName || 'A campus peer';
      return {
        title: 'Shared Ride Group Invitation',
        message: `${adminName} invited you to join a Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Open Helpu to review and join.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_INVITATION_ACCEPTED: {
      const studentName = payload.memberName || 'A student';
      if (payload.isFormationProposal) {
        return {
          title: 'Group Formation Accepted',
          message: `${studentName} accepted your group formation request for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Your Shared Ride Group is now active.`
        };
      }
      return {
        title: 'Group Invitation Accepted',
        message: `${studentName} accepted your invitation to join the Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_INVITATION_REJECTED: {
      const studentName = payload.memberName || payload.studentName || 'A student';
      if (payload.isFormationProposal) {
        return {
          title: 'Group Formation Request Declined',
          message: `${studentName} declined your group formation request for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
        };
      }
      return {
        title: 'Group Invitation Declined',
        message: `${studentName} declined your invitation to join the Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_RECEIVED: {
      const requesterName = payload.requesterName || payload.senderName || 'A student';
      return {
        title: 'New Join Request',
        message: `${requesterName} requested to join your Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. Open Helpu to review and accept.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_ACCEPTED: {
      const approverName = payload.approvedByName || payload.adminName || 'A group member';
      return {
        title: 'Join Request Accepted',
        message: `Your request to join the Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} was accepted by ${approverName}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_JOIN_REQUEST_REJECTED: {
      return {
        title: 'Join Request Declined',
        message: `Your request to join the Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''} was declined by the host.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_MEMBER_JOINED: {
      const studentName = payload.memberName || payload.studentName || 'A student';
      return {
        title: 'New Student Joined Group',
        message: `${studentName} joined your Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_MEMBER_LEFT: {
      const studentName = payload.memberName || payload.studentName || 'A student';
      return {
        title: 'Member Left Group',
        message: `${studentName} left your Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. A spot has opened up.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_ADMIN_PROMOTED: {
      return {
        title: 'You Are Now Group Admin',
        message: `The previous organizer left the Shared Ride Group for ${source} to ${destination}${dateStr ? ' on ' + dateStr : ''}. You have been promoted to Group Admin.`
      };
    }

    case NOTIFICATION_JOB_TYPES.GROUP_CLOSED: {
      const customMessage = payload.message || `The Shared Ride Group for ${source} to ${destination} has been closed as all members have left.`;
      return {
        title: payload.title || 'Your Group Has Ended',
        message: customMessage
      };
    }

    case NOTIFICATION_JOB_TYPES.COMPATIBLE_FIND_MATCH: {
      const isExisting = Boolean(payload.isExistingPostOwner);
      const defaultTitle = isExisting
        ? 'Another student wants to travel on your route!'
        : 'A compatible student was found!';
      const defaultMessage = isExisting
        ? 'A compatible student has been found for your trip. You can create a Shared Group together.'
        : 'Another student wants to travel on the same route and date. You can create a Shared Group together.';

      return {
        title: payload.title || defaultTitle,
        message: payload.message || defaultMessage
      };
    }

    case NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION:
    default:
      return {
        title: 'Helpu Alert',
        message: payload.message || 'You have a new update in Helpu.'
      };
  }
}
