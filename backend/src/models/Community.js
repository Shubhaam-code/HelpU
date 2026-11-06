import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, trim: true },
    authorName: { type: String, trim: true, default: 'Student' },
    authorImage: { type: String, trim: true, default: '' },
    text: { type: String, required: true, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

const communityPostSchema = new mongoose.Schema(
  {
    authorId: {
      type: String,
      required: [true, 'authorId is required'],
      trim: true,
      index: true
    },
    authorName: {
      type: String,
      trim: true,
      default: 'Student'
    },
    authorImage: {
      type: String,
      trim: true,
      default: ''
    },
    authorAvatar: {
      type: String,
      trim: true,
      default: 'm1'
    },
    college: {
      type: String,
      trim: true,
      default: 'VIT, Bhopal'
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      maxlength: [1000, 'Post content cannot exceed 1000 characters']
    },
    category: {
      type: String,
      enum: ['Ride Sharing', 'Weekend Trips', 'Campus Life', 'Hostel & Mess', 'Lost & Found', 'General'],
      default: 'General'
    },
    likes: {
      type: [String], // array of userIds who liked
      default: []
    },
    comments: {
      type: [commentSchema],
      default: []
    },
    whatsapp: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Index for efficient pagination by date
communityPostSchema.index({ createdAt: -1 });

const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

export default CommunityPost;

