import mongoose from 'mongoose';

const groupJoinRequestSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SharedRideGroup',
      required: [
        function () {
          return this.type !== 'formation_proposal';
        },
        'Group ID is required for group invites and join requests'
      ],
      default: null,
      index: true
    },
    requesterId: {
      type: String, // Canonical Student.clerkId of the candidate student
      required: [true, 'Requester ID is required'],
      trim: true,
      index: true
    },
    requesterTravelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Travel',
      required: [true, 'Requester travel post ID is required'],
      index: true
    },
    senderId: {
      type: String, // Initiator: student for join_request / formation_proposal, member for invite
      required: [true, 'Sender ID is required'],
      trim: true,
      index: true
    },
    senderTravelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Travel',
      default: null,
      index: true
    },
    recipientId: {
      type: String, // Recipient: admin for join_request, student for invite / formation_proposal
      required: [true, 'Recipient ID is required'],
      trim: true,
      index: true
    },
    type: {
      type: String,
      required: [true, 'Request type is required'],
      enum: {
        values: ['invite', 'join_request', 'formation_proposal'],
        message: 'Request type must be "invite", "join_request", or "formation_proposal"'
      },
      index: true
    },
    proposedCapacity: {
      type: Number,
      min: [2, 'Proposed capacity must be at least 2'],
      max: [6, 'Proposed capacity cannot exceed 6'],
      default: 4
    },
    proposalKey: {
      type: String,
      trim: true,
      default: null
    },
    pairUserKey: {
      type: String,
      trim: true,
      default: null
    },
    status: {
      type: String,
      required: [true, 'Request status is required'],
      enum: {
        values: ['pending', 'accepted', 'rejected', 'cancelled', 'expired'],
        message: 'Status must be one of: pending, accepted, rejected, cancelled, expired'
      },
      default: 'pending',
      index: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
      default: ''
    },
    respondedAt: {
      type: Date,
      default: null
    },
    respondedBy: {
      type: String,
      trim: true,
      default: null
    },
    expiresAt: {
      type: Date,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound partial unique index to prevent duplicate pending invitations or join requests
// for the same user and group. Once a request is accepted, rejected, cancelled, or expired,
// a new request can be created.
groupJoinRequestSchema.index(
  { groupId: 1, requesterId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending', groupId: { $type: 'objectId' } }
  }
);

// Prevent duplicate pending formation proposals between the same two travel posts
groupJoinRequestSchema.index(
  { proposalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'formation_proposal', status: 'pending', proposalKey: { $type: 'string' } }
  }
);

// Auxiliary indexes for fast listing
groupJoinRequestSchema.index({ recipientId: 1, status: 1 });
groupJoinRequestSchema.index({ senderId: 1, status: 1 });
groupJoinRequestSchema.index({ groupId: 1, status: 1 });
groupJoinRequestSchema.index({ pairUserKey: 1, type: 1, status: 1 });

const GroupJoinRequest = mongoose.model('GroupJoinRequest', groupJoinRequestSchema);

export default GroupJoinRequest;

