import mongoose from 'mongoose';
import { normalizeCourseCode, normalizeCourseName, normalizeInstitution } from '../utils/ffcs.js';

const scheduleSchema = new mongoose.Schema(
  {
    slot: { type: String, default: null, trim: true },
    day: { type: String, default: null, trim: true },
    startTime: { type: String, default: null, trim: true },
    endTime: { type: String, default: null, trim: true },
    room: { type: String, default: null, trim: true }
  },
  { _id: false }
);

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, default: null, trim: true },
    subject: { type: String, default: null, trim: true },
    slot: { type: String, default: null, trim: true },
    venue: { type: String, default: null, trim: true },
    courseType: { type: String, default: null, trim: true },
    availableSeats: { type: Number, default: null },
    totalSeats: { type: Number, default: null },
    schedule: { type: [scheduleSchema], default: [] }
  },
  { _id: false }
);

const processingLockSchema = new mongoose.Schema(
  {
    token: { type: String, default: null },
    expiresAt: { type: Date, default: null }
  },
  { _id: false }
);

const courseCatalogSchema = new mongoose.Schema(
  {
    institution: {
      type: String,
      default: 'VIT',
      uppercase: true,
      trim: true,
      index: true
    },
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    courseName: { type: String, required: true, trim: true },
    normalizedCourseName: { type: String, trim: true, index: true },
    semester: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    academicYear: { type: String, required: true, trim: true, index: true },
    curriculumVersion: { type: String, required: true, trim: true },
    curriculumCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CurriculumCourse',
      default: null,
      index: true
    },
    teachers: { type: [teacherSchema], default: [] },
    extractionStatus: {
      type: String,
      enum: ['pending', 'extracting', 'completed', 'needs_review', 'failed'],
      default: 'pending',
      index: true
    },
    reviewStatus: {
      type: String,
      enum: ['unverified', 'verified', 'needs_review'],
      default: 'unverified',
      index: true
    },
    confidence: { type: Number, default: null },
    extractionSource: {
      type: String,
      enum: ['gemini', 'manual'],
      default: 'gemini'
    },
    processingLock: { type: processingLockSchema, default: () => ({}) },
    extractionAttempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    createdBy: { type: String, default: null }
  },
  { timestamps: true }
);

courseCatalogSchema.pre('validate', function () {
  this.institution = normalizeInstitution(this.institution);
  this.courseCode = normalizeCourseCode(this.courseCode);
  if (this.courseName) {
    this.normalizedCourseName = normalizeCourseName(this.courseName);
  }
});

courseCatalogSchema.index(
  {
    institution: 1,
    courseCode: 1,
    semester: 1,
    academicYear: 1,
    curriculumVersion: 1
  },
  { unique: true, name: 'ffcs_catalog_unique_academic_identity' }
);
courseCatalogSchema.index(
  { institution: 1, semester: 1, academicYear: 1, extractionStatus: 1 },
  { name: 'ffcs_catalog_academic_lookup' }
);

const CourseCatalog =
  mongoose.models.CourseCatalog || mongoose.model('CourseCatalog', courseCatalogSchema);

export default CourseCatalog;
