import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    credits: {
      type: Number,
      required: true,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound text index for fuzzy / text search on code and name
courseSchema.index({ courseCode: 'text', courseName: 'text' });

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

export default Course;

