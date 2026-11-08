import mongoose from 'mongoose';
import { calculateExpiresAt } from './Travel.js';

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'Member user ID is required'],
      trim: true
    },
    travelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Travel',
      required: [true, 'Member travel post ID is required']
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'member'],
        message: 'Member role must be either "admin" or "member"'
      },
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const sharedRideGroupSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      required: [true, 'Admin user ID is required'],
      trim: true,
      index: true
    },
    originatingTravelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Travel',
      required: [true, 'Originating travel post ID is required'],
      index: true
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
      required: [true, 'Travel date is required'],
      index: true
    },
    departureTime: {
      type: Number,
      required: [true, 'Departure time in minutes from midnight is required'],
      min: [0, 'Departure time must be between 0 and 1439 minutes'],
      max: [1439, 'Departure time must be between 0 and 1439 minutes']
    },
    targetCapacity: {
      type: Number,
      required: [true, 'Target capacity is required'],
      min: [1, 'Target capacity must be at least 1'],
      validate: {
        validator: function (val) {
          return Number.isInteger(val) && val >= 1;
        },
        message: 'Target capacity must be a positive integer'
      }
    },
    actualCabCapacity: {
      type: Number,
      default: null,
      validate: {
        validator: function (val) {
          return val === null || val === undefined || (Number.isInteger(val) && val >= 1);
        },
        message: 'Actual cab capacity must be a positive integer or null'
      }
    },
    members: {
      type: [memberSchema],
      default: []
    },
    whatsappGroupUrl: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (val) {
          if (!val) return true;
          return /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[a-zA-Z0-9_\-]+$/i.test(val);
        },
        message: 'Must be a valid WhatsApp invite or chat URL'
      }
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'full', 'completed', 'cancelled', 'expired'],
        message: 'Status must be "open", "full", "completed", "cancelled", or "expired"'
      },
      default: 'open',
      index: true
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true
    },
    proposalKey: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for dynamic member count (guarantees consistency without redundant out-of-sync fields)
sharedRideGroupSchema.virtual('currentMemberCount').get(function () {
  return Array.isArray(this.members) ? this.members.length : 0;
});

// Virtual for remaining spots until target capacity
sharedRideGroupSchema.virtual('availableSpots').get(function () {
  const count = Array.isArray(this.members) ? this.members.length : 0;
  if (typeof this.targetCapacity !== 'number') return 0;
  return Math.max(0, this.targetCapacity - count);
});

// Virtual boolean to check if target capacity has been reached
sharedRideGroupSchema.virtual('isFull').get(function () {
  const count = Array.isArray(this.members) ? this.members.length : 0;
  if (typeof this.targetCapacity !== 'number') return false;
  return count >= this.targetCapacity;
});

// Pre-validate hook:
// 1. Calculate expiresAt from travelDate if missing
// 2. Ensure creator is automatically initialized as admin in members list if members array is empty
sharedRideGroupSchema.pre('validate', function () {
  if (this.travelDate && !this.expiresAt) {
    this.expiresAt = calculateExpiresAt(this.travelDate);
  }

  if (Array.isArray(this.members) && this.members.length === 0 && this.adminId && this.originatingTravelId) {
    this.members.push({
      userId: this.adminId,
      travelId: this.originatingTravelId,
      role: 'admin',
      joinedAt: new Date()
    });
  }
});

// Compound indexes for matching and filtering
sharedRideGroupSchema.index({ source: 1, destination: 1, travelDate: 1, status: 1 });
sharedRideGroupSchema.index({ adminId: 1, status: 1 });
sharedRideGroupSchema.index({ 'members.userId': 1, status: 1 });
sharedRideGroupSchema.index({ expiresAt: 1, status: 1 });

// Compound index: optimizes lookups for active groups originating from a travel post
sharedRideGroupSchema.index({ originatingTravelId: 1, status: 1 });

// Unique index with partialFilterExpression: prevents duplicate group proposals for the same pair of FIND matches
// Only indexes documents where proposalKey is a non-null string, allowing multiple standard groups without proposalKey
sharedRideGroupSchema.index(
  { proposalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { proposalKey: { $type: 'string' } }
  }
);

const SharedRideGroup = mongoose.model('SharedRideGroup', sharedRideGroupSchema);

export default SharedRideGroup;

