import mongoose from 'mongoose';

/**
 * Calculates midnight immediately after the travel date in Asia/Kolkata timezone (UTC+05:30).
 * e.g., for travel date 2026-11-05, expiresAt is 2026-11-06 00:00:00.000 IST (2026-11-05T18:30:00.000Z).
 */
export function calculateExpiresAt(travelDate) {
  if (!travelDate) return null;
  const dateObj = new Date(travelDate);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [year, month, day] = formatter.format(dateObj).split('-').map(Number);
  const nextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  // Convert IST midnight to UTC (subtract 5 hours and 30 minutes)
  return new Date(nextDayUtc.getTime() - (5 * 60 + 30) * 60 * 1000);
}

const travelSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Travel type is required'],
      enum: {
        values: ['offer', 'request'],
        message: 'Type must be either "offer" or "request"'
      }
    },
    source: {
      type: String,
      required: [true, 'Source location is required'],
      trim: true
    },
    destination: {
      type: String,
      required: [true, 'Destination location is required'],
      trim: true
    },
    travelDate: {
      type: Date,
      required: [true, 'Travel date is required']
    },
    departureTime: {
      type: Number,
      required: [true, 'Departure time in minutes from midnight is required'],
      min: [0, 'Departure time must be between 0 and 1439 minutes'],
      max: [1439, 'Departure time must be between 0 and 1439 minutes']
    },
    timeFlexibility: {
      type: Number,
      required: [true, 'Time flexibility is required'],
      enum: {
        values: [30, 60, 180, 300],
        message: 'Time flexibility must be 30, 60, 180, or 300 minutes'
      }
    },
    seats: {
      type: Number,
      required: [true, 'Seats count is required'],
      min: [1, 'Seats must be at least 1']
    },
    bookedSeats: {
      type: Number,
      default: 0,
      min: [0, 'Booked seats cannot be negative']
    },
    pricePerSeat: {
      type: Number,
      default: 350,
      min: [0, 'Price per seat cannot be negative']
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    carModel: {
      type: String,
      default: 'Campus Ride',
      trim: true
    },
    authorImage: {
      type: String,
      trim: true
    },
    authorName: {
      type: String,
      trim: true
    },
    authorEmail: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'expired', 'completed', 'cancelled'],
        message: 'Status must be "active", "expired", "completed", or "cancelled"'
      },
      default: 'active'
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required']
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook to automatically populate expiresAt if not set
travelSchema.pre('validate', function () {
  if (this.travelDate && !this.expiresAt) {
    this.expiresAt = calculateExpiresAt(this.travelDate);
  }
});

// Standard indexes for fast lookup and sorting (No TTL background deletion - historical rides are permanently preserved)
travelSchema.index({ expiresAt: 1 });
travelSchema.index({ userId: 1, status: 1 });

const Travel = mongoose.model('Travel', travelSchema);

export default Travel;
