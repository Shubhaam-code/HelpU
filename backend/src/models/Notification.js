import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: String,
      required: [true, 'recipientId is required'],
      trim: true,
      index: true
    },
    eventId: {
      type: String,
      required: [true, 'eventId is required'],
      unique: true,
      trim: true,
      index: true
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    relatedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true
    },
    relatedTravelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Travel'
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast user notification listing sorted newest first
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
