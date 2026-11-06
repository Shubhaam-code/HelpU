import mongoose from 'mongoose';

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'userId is required'],
      trim: true,
      index: true
    },
    token: {
      type: String,
      required: [true, 'Device token is required'],
      trim: true,
      unique: true,
      index: true
    },
    platform: {
      type: String,
      enum: {
        values: ['android', 'ios', 'web'],
        message: 'Platform must be one of: android, ios, web'
      },
      default: 'android',
      lowercase: true,
      trim: true
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying user devices sorted by latest activity
deviceTokenSchema.index({ userId: 1, lastSeenAt: -1 });

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

export default DeviceToken;

