import mongoose from 'mongoose';

const slotPostSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      index: true
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course ID is required'],
      index: true
    },
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      uppercase: true,
      trim: true,
      index: true
    },
    normalizedCourseCode: {
      type: String,
      uppercase: true,
      trim: true,
      index: true
    },
    courseName: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true
    },
    slot: {
      type: String,
      required: [true, 'Slot is required'],
      uppercase: true,
      trim: true,
      index: true
    },
    slotTokens: {
      type: [String],
      default: [],
      index: true
    },
    teacherName: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true
    },
    additionalNotes: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'closed'],
        message: 'Status must be either "active" or "closed"'
      },
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: automatically compute normalizedCourseCode and slotTokens
slotPostSchema.pre('save', function () {
  if (this.courseCode) {
    this.normalizedCourseCode = this.courseCode.trim().toUpperCase().replace(/\s+/g, '');
  }
  if (this.slot) {
    this.slotTokens = Array.from(
      new Set(
        this.slot
          .split(/[,/;+]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      )
    );
  }
});

// Compound indexes for optimal matching engine lookups
slotPostSchema.index({ normalizedCourseCode: 1, slotTokens: 1, status: 1 });
slotPostSchema.index({ courseCode: 1, slot: 1, status: 1 });
slotPostSchema.index({ userId: 1, status: 1 });

const SlotPost = mongoose.models.SlotPost || mongoose.model('SlotPost', slotPostSchema);

export default SlotPost;

