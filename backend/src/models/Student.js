import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      unique: true,
      trim: true,
      default: function () {
        return this.firebaseUid ? `firebase_${this.firebaseUid}` : undefined;
      }
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
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
      trim: true,
      default: ''
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: ''
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
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Prefer not to say', null],
      default: null,
      trim: true
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias: userId resolves to the canonical user ID (stored in clerkId)
studentSchema.virtual('userId').get(function () {
  return this.clerkId;
});

// Guarantee that phone and whatsappNumber are always 100% synchronized in MongoDB
function syncPhoneFields(obj) {
  if (!obj) return;
  const val = (obj.whatsappNumber !== undefined && obj.whatsappNumber !== null && String(obj.whatsappNumber).trim() !== '')
    ? String(obj.whatsappNumber).trim()
    : ((obj.phone !== undefined && obj.phone !== null && String(obj.phone).trim() !== '') ? String(obj.phone).trim() : '');
  
  obj.whatsappNumber = val;
  obj.phone = val;
}

studentSchema.pre('save', function () {
  syncPhoneFields(this);
});

studentSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
  const update = typeof this?.getUpdate === 'function' ? this.getUpdate() : null;
  if (update) {
    const target = update.$set || update;
    if (target.whatsappNumber !== undefined || target.phone !== undefined) {
      syncPhoneFields(target);
    }
  }
});

studentSchema.post(['find', 'findOne', 'findOneAndUpdate'], function (docs) {
  if (!docs) return;
  const list = Array.isArray(docs) ? docs : [docs];
  for (const doc of list) {
    if (doc) {
      const val = (doc.whatsappNumber || doc.phone || '').trim();
      doc.whatsappNumber = val;
      doc.phone = val;
    }
  }
});

const Student = mongoose.model('Student', studentSchema);

export default Student;
