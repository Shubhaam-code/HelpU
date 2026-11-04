import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    travelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Travel',
      required: [true, 'travelId is required'],
      index: true
    },
    ownerId: {
      type: String,
      required: [true, 'ownerId is required'],
      trim: true,
      index: true
    },
    passengerId: {
      type: String,
      required: [true, 'passengerId is required'],
      trim: true,
      index: true,
      validate: {
        validator: function (val) {
          return this.ownerId !== val;
        },
        message: 'passengerId and ownerId must not be the same'
      }
    },
    requestedSeats: {
      type: Number,
      required: [true, 'requestedSeats is required'],
      min: [1, 'requestedSeats must be at least 1'],
      validate: {
        validator: function (val) {
          return Number.isInteger(val) && val >= 1;
        },
        message: 'requestedSeats must be a positive integer'
      }
    },
    passengerName: {
      type: String,
      trim: true
    },
    passengerEmail: {
      type: String,
      trim: true
    },
    passengerPhone: {
      type: String,
      trim: true
    },
    passengerImage: {
      type: String,
      trim: true
    },
    passengerNotes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    totalPrice: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'confirmed', 'rejected', 'cancelled'],
        message: 'Status must be one of: pending, accepted, confirmed, rejected, cancelled'
      },
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying a passenger's bookings for a specific travel post
bookingSchema.index({ travelId: 1, passengerId: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
