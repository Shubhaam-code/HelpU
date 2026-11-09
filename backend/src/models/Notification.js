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
    module: {
      type: String,
      enum: ['poolmate', 'slotmate'],
      default: 'poolmate',
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
    imageUrl: {
      type: String,
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
    relatedSlotPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlotPost',
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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
notificationSchema.index({ recipientId: 1, module: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
