import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    college: {
      type: String,
      trim: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    avatarId: {
      type: String,
      default: null,
      trim: true
    },
    course: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Student = mongoose.model('Student', studentSchema);

export default Student;
