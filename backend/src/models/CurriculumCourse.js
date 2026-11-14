import mongoose from 'mongoose';
import { normalizeCourseCode, normalizeCourseName, normalizeInstitution } from '../utils/ffcs.js';

const sourceDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, default: null },
    originalName: { type: String, default: null },
    mimeType: { type: String, default: null },
    uploadedBy: { type: String, default: null },
    uploadedAt: { type: Date, default: null }
  },
  { _id: false }
);

const curriculumCourseSchema = new mongoose.Schema(
  {
    institution: {
      type: String,
      default: 'VIT',
      uppercase: true,
      trim: true,
      index: true
    },
    curriculumVersion: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    courseName: {
      type: String,
      required: true,
      trim: true
    },
    normalizedCourseName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    semester: {
      type: Number,
      default: null
    },
    credits: { type: Number, default: null },
    category: { type: String, default: null, trim: true },
    courseType: { type: String, default: null, trim: true },
    version: { type: String, default: null, trim: true },
    lecture: { type: Number, default: null },
    tutorial: { type: Number, default: null },
    practical: { type: Number, default: null },
    project: { type: Number, default: null },
    sourceDocument: { type: sourceDocumentSchema, default: () => ({}) },
    sourcePage: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
    needsReview: { type: Boolean, default: false, index: true },
    reviewReasons: { type: [String], default: [] }
  },
  { timestamps: true }
);

curriculumCourseSchema.pre('validate', function () {
  this.institution = normalizeInstitution(this.institution);
  this.courseCode = normalizeCourseCode(this.courseCode);
  this.normalizedCourseName = normalizeCourseName(this.courseName);
});

curriculumCourseSchema.index(
  { institution: 1, curriculumVersion: 1, courseCode: 1, semester: 1 },
  { unique: true, name: 'ffcs_curriculum_unique_identity' }
);
curriculumCourseSchema.index(
  { institution: 1, isActive: 1, normalizedCourseName: 1 },
  { name: 'ffcs_curriculum_name_lookup' }
);
curriculumCourseSchema.index(
  { institution: 1, isActive: 1, courseCode: 1 },
  { name: 'ffcs_curriculum_code_lookup' }
);
curriculumCourseSchema.index(
  { courseName: 'text', courseCode: 'text', normalizedCourseName: 'text' },
  { name: 'ffcs_curriculum_text' }
);

const CurriculumCourse =
  mongoose.models.CurriculumCourse ||
  mongoose.model('CurriculumCourse', curriculumCourseSchema);

export default CurriculumCourse;
