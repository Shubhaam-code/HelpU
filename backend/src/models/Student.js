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
    whatsappNumber: {
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
    imageUrl: {
      type: String,
      trim: true
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

// Guarantee that phone and whatsappNumber are always 100% synchronized in MongoDB
studentSchema.pre('save', function () {
  if (this.whatsappNumber && !this.phone) {
    this.phone = this.whatsappNumber;
  } else if (this.phone && !this.whatsappNumber) {
    this.whatsappNumber = this.phone;
  } else if (this.whatsappNumber && this.phone && this.whatsappNumber !== this.phone) {
    this.phone = this.whatsappNumber;
  }
});

studentSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update) {
    const target = update.$set || update;
    if (target.whatsappNumber && !target.phone) {
      target.phone = target.whatsappNumber;
    } else if (target.phone && !target.whatsappNumber) {
      target.whatsappNumber = target.phone;
    } else if (target.whatsappNumber && target.phone && target.whatsappNumber !== target.phone) {
      target.phone = target.whatsappNumber;
    }
  }
});

const Student = mongoose.model('Student', studentSchema);

export default Student;
