import mongoose from 'mongoose';

const facultyRatingSchema = new mongoose.Schema(
  {
    facultyId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    teachingRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'teachingRating must be an integer between 1 and 5'
      }
    },
    evaluationRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'evaluationRating must be an integer between 1 and 5'
      }
    },
    behaviourRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'behaviourRating must be an integer between 1 and 5'
      }
    },
    internalsRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'internalsRating must be an integer between 1 and 5'
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: Enforces exactly ONE rating per student per faculty
facultyRatingSchema.index({ facultyId: 1, studentId: 1 }, { unique: true });

const FacultyRating =
  mongoose.models.FacultyRating || mongoose.model('FacultyRating', facultyRatingSchema);

export default FacultyRating;

