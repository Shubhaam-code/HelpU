import mongoose from 'mongoose';

const outboxSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'eventId is required'],
      unique: true,
      trim: true,
      index: true
    },
    eventType: {
      type: String,
      required: [true, 'eventType is required'],
      trim: true,
      index: true
    },
    recipientId: {
      type: String,
      required: [true, 'recipientId is required'],
      trim: true,
      index: true
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
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed'],
      default: 'pending',
      index: true
    },
    retries: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    lastError: {
      type: String
    },
    lockedAt: {
      type: Date
    },
    processedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient pending event polling with lock lease reclamation
outboxSchema.index({ status: 1, lockedAt: 1, createdAt: 1 });

const Outbox = mongoose.model('Outbox', outboxSchema);

export default Outbox;
