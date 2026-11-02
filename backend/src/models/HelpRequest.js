import mongoose from 'mongoose';

const helpRequestSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    category: {
      type: String,
      enum: ['emergency-travel', 'errands-parcels', 'peer-tutoring', 'hostel-luggage', 'lost-found', 'other'],
      default: 'other'
    },
    location: {
      type: String,
      trim: true,
      default: ''
    },
    urgency: {
      type: String,
      enum: ['Normal', 'High'],
      default: 'Normal'
    },
    status: {
      type: String,
      enum: ['Open', 'InProgress', 'Resolved'],
      default: 'Open',
      index: true
    },
    whatsapp: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Index for listing by date descending
helpRequestSchema.index({ createdAt: -1 });

const HelpRequest = mongoose.model('HelpRequest', helpRequestSchema);

export default HelpRequest;

