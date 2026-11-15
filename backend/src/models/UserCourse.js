import mongoose from 'mongoose';
import { normalizeCourseCode, normalizeInstitution } from '../utils/ffcs.js';

export const USER_COURSE_STATES = [
  'uploading',
  'validating',
  'checking_database',
  'existing_data_found',
  'extracting_with_gemini',
  'saving_to_database',
  'completed',
  'failed',
  'needs_review'
];

const userCourseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    curriculumCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CurriculumCourse',
      required: true,
      index: true
    },
    catalogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseCatalog',
      default: null,
      index: true
    },
    courseCode: { type: String, required: true, uppercase: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    semester: { type: mongoose.Schema.Types.Mixed, required: true },
    academicYear: { type: String, required: true, trim: true },
    institution: {
      type: String,
      default: 'VIT',
      uppercase: true,
      trim: true
    },
    curriculumVersion: { type: String, required: true, trim: true },
    status: { type: String, enum: USER_COURSE_STATES, default: 'validating', index: true },
    statusMessage: { type: String, default: null },
    idempotencyKey: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

userCourseSchema.pre('validate', function () {
  this.institution = normalizeInstitution(this.institution);
  this.courseCode = normalizeCourseCode(this.courseCode);
});

userCourseSchema.index(
  {
    userId: 1,
    curriculumCourseId: 1,
    semester: 1,
    academicYear: 1,
    curriculumVersion: 1
  },
  { unique: true, name: 'ffcs_user_course_unique_registration' }
);
userCourseSchema.index({ userId: 1, courseCode: 1 }, { name: 'ffcs_user_course_code' });
userCourseSchema.index({ userId: 1, createdAt: -1 }, { name: 'ffcs_user_course_recent' });
userCourseSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: 'ffcs_user_course_idempotency',
    partialFilterExpression: { idempotencyKey: { $type: 'string' } }
  }
);

const UserCourse =
  mongoose.models.UserCourse || mongoose.model('UserCourse', userCourseSchema);

export default UserCourse;
