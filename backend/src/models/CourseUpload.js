import mongoose from 'mongoose';
import { normalizeCourseCode } from '../utils/ffcs.js';

const imageReferenceSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    originalName: { type: String, default: null },
    storedName: { type: String, default: null },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, default: null },
    sha256: { type: String, default: null }
  },
  { _id: false }
);

const courseUploadSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    userCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserCourse',
      required: true,
      index: true
    },
    courseCode: { type: String, required: true, uppercase: true, trim: true },
    semester: { type: mongoose.Schema.Types.Mixed, required: true },
    academicYear: { type: String, required: true, trim: true },
    imageReferences: { type: [imageReferenceSchema], default: [] },
    processingStatus: {
      type: String,
      enum: ['stored', 'processing', 'completed', 'failed', 'needs_review'],
      default: 'stored',
      index: true
    }
  },
  { timestamps: true }
);

courseUploadSchema.pre('validate', function () {
  this.courseCode = normalizeCourseCode(this.courseCode);
});

courseUploadSchema.index({ userId: 1, createdAt: -1 }, { name: 'ffcs_upload_recent' });

const CourseUpload =
  mongoose.models.CourseUpload || mongoose.model('CourseUpload', courseUploadSchema);

export default CourseUpload;
