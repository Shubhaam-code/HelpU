import fs from 'fs/promises';
import crypto from 'crypto';
import mongoose from 'mongoose';
import UserCourse from '../models/UserCourse.js';
import CourseCatalog from '../models/CourseCatalog.js';
import CourseUpload from '../models/CourseUpload.js';
import CurriculumCourse from '../models/CurriculumCourse.js';
import Faculty, { normalizeFacultyName } from '../models/Faculty.js';
import { calculatePositivePercentage, enrichTeachersWithReviews } from './faculty.service.js';
import {
  extractTeachersFromImages,
  isGeminiConfigured
} from './gemini.service.js';
import {
  escapeRegex,
  normalizeAcademicYear,
  normalizeCourseCode,
  normalizeCourseName,
  normalizeInstitution,
  toSemesterNumber
} from '../utils/ffcs.js';

const LOCK_TTL_MS = Number(process.env.FFCS_LOCK_TTL_MS) || 2 * 60 * 1000;
const WAIT_TIMEOUT_MS = Number(process.env.FFCS_WAIT_TIMEOUT_MS) || 60 * 1000;
const WAIT_INTERVAL_MS = Number(process.env.FFCS_WAIT_INTERVAL_MS) || 1500;
const MAX_EXTRACTION_ATTEMPTS = Number(process.env.FFCS_MAX_EXTRACTION_ATTEMPTS) || 2;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class FfcsError extends Error {
  constructor(message, status = 400, code = 'FFCS_ERROR') {
    super(message);
    this.name = 'FfcsError';
    this.status = status;
    this.code = code;
  }
}

function toFilter({ institution, courseCode, semester, academicYear, curriculumVersion }) {
  return {
    institution: normalizeInstitution(institution),
    courseCode: normalizeCourseCode(courseCode),
    semester: typeof semester === 'number' ? semester : (Number.isInteger(Number(semester)) && Number(semester) >= 1 && Number(semester) <= 12 ? Number(semester) : String(semester || '').trim()),
    academicYear: normalizeAcademicYear(academicYear),
    curriculumVersion: String(curriculumVersion || '').trim()
  };
}

function isLockActive(catalog) {
  const expiresAt = catalog?.processingLock?.expiresAt;
  return Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
}

function serializeCatalog(catalog) {
  if (!catalog) return null;
  return {
    catalogId: String(catalog._id),
    courseCode: catalog.courseCode,
    courseName: catalog.courseName,
    semester: catalog.semester,
    academicYear: catalog.academicYear,
    institution: catalog.institution,
    curriculumVersion: catalog.curriculumVersion,
    teachers: catalog.teachers || [],
    extractionStatus: catalog.extractionStatus,
    reviewStatus: catalog.reviewStatus,
    confidence: catalog.confidence ?? null,
    extractionSource: catalog.extractionSource,
    lastError: catalog.lastError || null,
    updatedAt: catalog.updatedAt
  };
}

export function serializeUserCourse(userCourse, catalog) {
  if (!userCourse) return null;
  return {
    courseId: String(userCourse._id),
    curriculumCourseId: String(userCourse.curriculumCourseId),
    catalogId: userCourse.catalogId ? String(userCourse.catalogId) : null,
    courseCode: userCourse.courseCode,
    courseName: userCourse.courseName,
    semester: userCourse.semester,
    academicYear: userCourse.academicYear,
    institution: userCourse.institution,
    curriculumVersion: userCourse.curriculumVersion,
    status: userCourse.status,
    statusMessage: userCourse.statusMessage || null,
    createdAt: userCourse.createdAt,
    updatedAt: userCourse.updatedAt,
    catalog: serializeCatalog(catalog)
  };
}

function validateFiles(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length < 1) {
    throw new FfcsError('At least one teacher screenshot is required.', 400, 'MISSING_SCREENSHOTS');
  }
  if (list.length > 3) {
    throw new FfcsError('Maximum 3 screenshots are allowed per course.', 400, 'TOO_MANY_SCREENSHOTS');
  }
  for (const file of list) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new FfcsError(
        `Unsupported image type: ${file.mimetype}. Allowed: JPG, JPEG, PNG, WEBP.`,
        400,
        'UNSUPPORTED_IMAGE_TYPE'
      );
    }
  }
  return list;
}

async function setUserCourseStatus(userCourseId, status, statusMessage = null) {
  return UserCourse.findByIdAndUpdate(
    userCourseId,
    { $set: { status, statusMessage } },
    { new: true }
  );
}

async function persistUploads({ userId, userCourse, files, processingStatus }) {
  const references = [];
  for (const file of files) {
    const buffer = file.buffer || (file.path ? await fs.readFile(file.path) : Buffer.alloc(0));
    const sha256 = buffer.length
      ? crypto.createHash('sha256').update(buffer).digest('hex')
      : crypto.randomUUID();

    references.push({
      fileId: crypto.randomUUID(),
      originalName: file.originalname || 'screenshot.png',
      storedName: file.filename || file.originalname || 'screenshot.png',
      path: file.path || `memory://${sha256.slice(0, 16)}`,
      mimeType: file.mimetype || 'image/png',
      size: file.size || buffer.length,
      sha256
    });
  }

  return CourseUpload.findOneAndUpdate(
    { userCourseId: userCourse._id },
    {
      $set: {
        userId,
        courseCode: userCourse.courseCode,
        semester: userCourse.semester,
        academicYear: userCourse.academicYear,
        imageReferences: references,
        processingStatus
      }
    },
    { upsert: true, new: true }
  );
}

async function readImages(files) {
  const images = [];
  for (const file of files) {
    const buffer = file.buffer || (file.path ? await fs.readFile(file.path) : null);
    if (!buffer) continue;
    images.push({
      buffer,
      mimeType: file.mimetype,
      originalName: file.originalname
    });
  }
  return images;
}

async function findOrCreateUserCourse({ userId, curriculumCourse, semester, academicYear, curriculumVersion, idempotencyKey }) {
  const allowed = getEquivalentUserIds(userId);
  const cleanCode = normalizeCourseCode(curriculumCourse.courseCode);
  const targetCurriculumId = curriculumCourse._id;

  // Concurrency & race condition guard: check if already exists for this user
  const existing = await UserCourse.findOne({
    userId: { $in: allowed },
    $or: [
      { curriculumCourseId: targetCurriculumId },
      { courseCode: cleanCode }
    ],
    status: { $ne: 'failed' }
  });

  if (existing) {
    throw new FfcsError(
      'This course has already been added.',
      409,
      'COURSE_ALREADY_EXISTS'
    );
  }

  const filter = {
    userId,
    curriculumCourseId: curriculumCourse._id,
    semester,
    academicYear,
    curriculumVersion
  };

  try {
    const userCourse = await UserCourse.create({
      ...filter,
      courseCode: cleanCode,
      courseName: curriculumCourse.courseName,
      institution: curriculumCourse.institution,
      status: 'validating',
      statusMessage: 'Validating selected course and screenshots.',
      idempotencyKey: idempotencyKey || null
    });
    return userCourse;
  } catch (error) {
    if (error?.code === 11000) {
      throw new FfcsError(
        'This course has already been added.',
        409,
        'COURSE_ALREADY_EXISTS'
      );
    }
    throw error;
  }
}

async function claimCatalog({ filter, curriculumCourse, token, existingCatalogId }) {
  const now = new Date();
  const lock = { token, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) };

  let catalog = null;
  if (existingCatalogId) {
    catalog = await CourseCatalog.findById(existingCatalogId);
  }
  if (!catalog) {
    catalog = await CourseCatalog.findOne(filter);
  }

  if (!catalog) {
    try {
      catalog = await CourseCatalog.create({
        ...filter,
        courseName: curriculumCourse.courseName,
        normalizedCourseName: normalizeCourseName(curriculumCourse.courseName),
        curriculumCourseId: curriculumCourse._id,
        extractionStatus: 'extracting',
        reviewStatus: 'unverified',
        processingLock: lock,
        extractionAttempts: 1
      });
      return { catalog, acquired: true, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      catalog = await CourseCatalog.findOne(filter);
    }
  }

  if (!catalog) {
    throw new FfcsError('Unable to create or resolve the course catalog record.', 500);
  }

  if (
    Array.isArray(catalog.teachers) &&
    catalog.teachers.length > 0
  ) {
    return { catalog, acquired: false, reusable: true };
  }

  if (catalog.extractionStatus === 'extracting' && isLockActive(catalog)) {
    return { catalog, acquired: false, processing: true };
  }

  if (
    catalog.extractionStatus === 'needs_review' &&
    Number(catalog.extractionAttempts || 0) >= MAX_EXTRACTION_ATTEMPTS
  ) {
    return { catalog, acquired: false, reusable: false };
  }

  const claimed = await CourseCatalog.findOneAndUpdate(
    {
      _id: catalog._id,
      $or: [
        { extractionStatus: { $in: ['pending', 'failed', 'needs_review'] } },
        { 'teachers.0': { $exists: false } },
        { 'processingLock.expiresAt': null },
        { 'processingLock.expiresAt': { $lte: now } }
      ]
    },
    {
      $set: {
        extractionStatus: 'extracting',
        reviewStatus: 'unverified',
        processingLock: lock,
        lastError: null
      },
      $inc: { extractionAttempts: 1 }
    },
    { new: true }
  );

  if (claimed) return { catalog: claimed, acquired: true };

  const latest = await CourseCatalog.findById(catalog._id);
  if (latest?.extractionStatus === 'extracting') {
    return { catalog: latest, acquired: false, processing: true };
  }
  if (
    Array.isArray(latest?.teachers) &&
    latest.teachers.length > 0
  ) {
    return { catalog: latest, acquired: false, reusable: true };
  }
  return { catalog: latest || catalog, acquired: false, reusable: false };
}

export async function findCatalogForCourse({
  institution,
  courseCode,
  courseName,
  semester,
  academicYear
}) {
  const resolvedInstitution = normalizeInstitution(institution);
  const resolvedSemester = toSemesterNumber(semester);
  const resolvedYear = normalizeAcademicYear(academicYear);
  const normalizedName = normalizeCourseName(courseName);
  const escapedName = escapeRegex((courseName || '').trim());
  const normalizedCode = normalizeCourseCode(courseCode);

  const orConditions = [];
  if (normalizedName) {
    orConditions.push({ normalizedCourseName: normalizedName });
  }
  if (escapedName) {
    orConditions.push({ courseName: new RegExp(`^${escapedName}$`, 'i') });
  }
  if (normalizedCode) {
    orConditions.push({ courseCode: normalizedCode });
  }

  const query = {
    institution: resolvedInstitution,
    semester: resolvedSemester,
    academicYear: resolvedYear,
    ...(orConditions.length ? { $or: orConditions } : {})
  };

  const matches = await CourseCatalog.find(query).sort({ updatedAt: -1 });

  // Priority 1: A matching record that has non-empty teachers array
  const withTeachers = matches.find(
    (item) => Array.isArray(item.teachers) && item.teachers.length > 0
  );
  if (withTeachers) return withTeachers;

  // Priority 2: Any matching record (even if teachers array is empty)
  return matches[0] || null;
}

async function waitForCatalog(filter) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
    const catalog = await CourseCatalog.findOne(filter);
    if (!catalog) continue;
    if (catalog.extractionStatus === 'extracting' && isLockActive(catalog)) continue;
    return catalog;
  }

  return CourseCatalog.findOne(filter);
}

async function completeWithCatalog({ userCourse, catalog, reused, reviewNote }) {
  const status =
    catalog.extractionStatus === 'completed'
      ? 'completed'
      : catalog.extractionStatus === 'needs_review'
        ? 'needs_review'
        : catalog.extractionStatus === 'failed'
          ? 'failed'
          : 'needs_review';

  const updated = await UserCourse.findByIdAndUpdate(
    userCourse._id,
    {
      $set: {
        catalogId: catalog._id,
        status,
        statusMessage:
          reviewNote ||
          (reused
            ? 'Existing verified catalog data reused; Gemini was not called.'
            : 'Teacher data processed.')
      }
    },
    { new: true }
  );

  return { userCourse: updated, catalog, reused, status };
}

/**
 * Main "Add course" flow: MongoDB first, Gemini second.
 * Uses a unique compound catalog index plus an atomic processing lock so
 * concurrent submissions for the same academic identity extract only once.
 */
export async function addCourseForUser({
  userId,
  curriculumCourseId,
  courseCode,
  courseName,
  semester,
  academicYear,
  institution,
  curriculumVersion,
  files,
  idempotencyKey
}) {
  const validatedFiles = validateFiles(files);

  let curriculumCourse = null;
  if (curriculumCourseId && mongoose.Types.ObjectId.isValid(curriculumCourseId)) {
    curriculumCourse = await CurriculumCourse.findById(curriculumCourseId).lean();
  }

  if (!curriculumCourse) {
    const rawCode = courseCode || (typeof curriculumCourseId === 'string' ? curriculumCourseId.replace(/^def-/i, '') : '');
    const cleanCode = normalizeCourseCode(rawCode);
    if (cleanCode) {
      curriculumCourse = await CurriculumCourse.findOne({
        courseCode: cleanCode,
        isActive: { $ne: false }
      }).lean();
    }
  }

  if (!curriculumCourse) {
    const rawCode = courseCode || (typeof curriculumCourseId === 'string' ? curriculumCourseId.replace(/^def-/i, '') : '');
    const cleanCode = normalizeCourseCode(rawCode);
    if (cleanCode) {
      const cleanName = (courseName || cleanCode).trim();
      const created = await CurriculumCourse.create({
        courseCode: cleanCode,
        courseName: cleanName,
        normalizedCourseName: normalizeCourseName(cleanName),
        semester: toSemesterNumber(semester) || 1,
        institution: normalizeInstitution(institution) || 'VIT',
        curriculumVersion: String(curriculumVersion || '2024-25').trim(),
        credits: 3,
        isActive: true
      });
      curriculumCourse = created.toObject ? created.toObject() : created;
    }
  }

  if (!curriculumCourse || !curriculumCourse.isActive) {
    throw new FfcsError('Selected curriculum course was not found or is inactive.', 404, 'CURRICULUM_COURSE_NOT_FOUND');
  }

  const resolvedSemester = toSemesterNumber(semester) ?? curriculumCourse.semester;
  if (!resolvedSemester) {
    throw new FfcsError(
      'Semester is required because the curriculum record does not contain a semester.',
      400,
      'SEMESTER_REQUIRED'
    );
  }

  const resolvedYear = normalizeAcademicYear(academicYear);
  if (!resolvedYear) {
    throw new FfcsError('Academic year is required (for example 2026-27).', 400, 'ACADEMIC_YEAR_REQUIRED');
  }

  const resolvedInstitution = normalizeInstitution(institution || curriculumCourse.institution);
  const resolvedVersion = String(
    curriculumVersion || curriculumCourse.curriculumVersion
  ).trim();

  const filter = toFilter({
    institution: resolvedInstitution,
    courseCode: curriculumCourse.courseCode,
    semester: resolvedSemester,
    academicYear: resolvedYear,
    curriculumVersion: resolvedVersion
  });

  const MAX_FFCS_COURSES = 8;
  const existingUserCourses = await UserCourse.find({
    userId: { $in: getEquivalentUserIds(userId) }
  }).lean();

  const cleanCourseCode = normalizeCourseCode(curriculumCourse.courseCode);
  const targetCurriculumId = String(curriculumCourse._id);

  // 1. Duplicate Validation: A user must be able to add a particular course only once.
  // Uses both unique curriculumCourseId and normalized courseCode to verify.
  const duplicateCourse = existingUserCourses.find((existing) => {
    const existingCurriculumId = String(existing.curriculumCourseId || '');
    const existingCode = normalizeCourseCode(existing.courseCode);
    const isSameCourse =
      (targetCurriculumId && existingCurriculumId === targetCurriculumId) ||
      (cleanCourseCode && existingCode === cleanCourseCode);

    return isSameCourse && existing.status !== 'failed';
  });

  if (duplicateCourse) {
    throw new FfcsError(
      'This course has already been added.',
      409,
      'COURSE_ALREADY_EXISTS'
    );
  }

  if (existingUserCourses.length >= MAX_FFCS_COURSES) {
    throw new FfcsError(
      'Maximum 8 courses allowed in FFCS. You cannot add more than 8 courses.',
      400,
      'COURSE_LIMIT_EXCEEDED'
    );
  }

  const userCourse = await findOrCreateUserCourse({
    userId,
    curriculumCourse,
    semester: resolvedSemester,
    academicYear: resolvedYear,
    curriculumVersion: resolvedVersion,
    idempotencyKey
  });

  await persistUploads({
    userId,
    userCourse,
    files: validatedFiles,
    processingStatus: 'processing'
  });

  // 1 & 2. Search MongoDB CourseCatalog using normalized courseName (case-insensitive)
  // and exact semester & academicYear
  await setUserCourseStatus(
    userCourse._id,
    'checking_database',
    'Checking teacher data...'
  );

  const existingCatalog = await findCatalogForCourse({
    institution: resolvedInstitution,
    courseCode: curriculumCourse.courseCode,
    courseName: curriculumCourse.courseName,
    semester: resolvedSemester,
    academicYear: resolvedYear
  });

  // 3. If a matching course has a non-empty teachers array:
  // - Return teachers from MongoDB
  // - Set source = "mongodb" (reused: true)
  // - Do NOT call Gemini
  if (
    existingCatalog &&
    Array.isArray(existingCatalog.teachers) &&
    existingCatalog.teachers.length > 0
  ) {
    await setUserCourseStatus(
      userCourse._id,
      'completed',
      'Existing teacher data found in MongoDB.'
    );
    await CourseUpload.updateOne(
      { userCourseId: userCourse._id },
      { $set: { processingStatus: 'completed' } }
    );
    return completeWithCatalog({
      userCourse,
      catalog: existingCatalog,
      reused: true,
      reviewNote: 'Existing verified catalog data reused; Gemini was not called.'
    });
  }

  // Claim catalog record or processing lock
  const token = crypto.randomUUID();
  const claim = await claimCatalog({
    filter,
    curriculumCourse,
    token,
    existingCatalogId: existingCatalog?._id
  });

  if (claim.reusable) {
    await CourseUpload.updateOne(
      { userCourseId: userCourse._id },
      { $set: { processingStatus: 'completed' } }
    );
    return completeWithCatalog({
      userCourse,
      catalog: claim.catalog,
      reused: true
    });
  }

  // 4. If course does not exist OR teachers array is empty:
  // - Check GEMINI_API_KEY
  // - If key is missing, return a clear API error. Do not show Zero Teachers.
  if (!isGeminiConfigured()) {
    const errorMsg = 'GEMINI_API_KEY is missing on the server. Teacher extraction requires a valid Gemini API key.';
    if (claim.catalog?._id) {
      await CourseCatalog.findByIdAndUpdate(claim.catalog._id, {
        $set: {
          extractionStatus: 'failed',
          lastError: errorMsg,
          processingLock: { token: null, expiresAt: null }
        }
      });
    }
    await setUserCourseStatus(userCourse._id, 'failed', errorMsg);
    throw new FfcsError(errorMsg, 503, 'GEMINI_KEY_MISSING');
  }

  if (claim.processing) {
    await setUserCourseStatus(
      userCourse._id,
      'extracting_with_gemini',
      'AI is extracting teacher details...'
    );

    const waited = await waitForCatalog(filter);

    if (
      waited &&
      waited.extractionStatus === 'completed' &&
      Array.isArray(waited.teachers) &&
      waited.teachers.length > 0
    ) {
      await CourseUpload.updateOne(
        { userCourseId: userCourse._id },
        { $set: { processingStatus: 'completed' } }
      );
      return completeWithCatalog({
        userCourse,
        catalog: waited,
        reused: true,
        reviewNote: 'Reused the record produced by the concurrent extraction.'
      });
    }

    if (waited && ['needs_review', 'failed', 'completed'].includes(waited.extractionStatus)) {
      await CourseUpload.updateOne(
        { userCourseId: userCourse._id },
        { $set: { processingStatus: waited.extractionStatus === 'completed' ? 'completed' : 'needs_review' } }
      );
      return completeWithCatalog({
        userCourse,
        catalog: waited,
        reused: true
      });
    }

    const stillProcessing = await UserCourse.findByIdAndUpdate(
      userCourse._id,
      {
        $set: {
          status: 'extracting_with_gemini',
          statusMessage: 'AI is extracting teacher details...'
        }
      },
      { new: true }
    );

    return {
      userCourse: stillProcessing,
      catalog: waited || claim.catalog,
      reused: false,
      processing: true,
      status: 'extracting_with_gemini',
      issues: []
    };
  }

  if (!claim.acquired) {
    await CourseUpload.updateOne(
      { userCourseId: userCourse._id },
      { $set: { processingStatus: 'needs_review' } }
    );
    return completeWithCatalog({
      userCourse,
      catalog: claim.catalog,
      reused: true,
      reviewNote: 'Existing extracted data requires manual review; it was not re-extracted.'
    });
  }

  try {
    setUserCourseStatus(
      userCourse._id,
      'extracting_with_gemini',
      'AI is extracting teacher details...'
    ).catch(() => {});

    const images = await readImages(validatedFiles);
    const extraction = await extractTeachersFromImages({
      images,
      context: {
        courseCode: curriculumCourse.courseCode,
        courseName: curriculumCourse.courseName,
        semester: resolvedSemester,
        academicYear: resolvedYear
      }
    });

    if (!Array.isArray(extraction.data?.teachers) || extraction.data.teachers.length === 0) {
      throw new FfcsError(
        'AI could not identify any teacher details from the uploaded screenshots. Please upload a clear timetable screenshot.',
        422,
        'NO_TEACHERS_EXTRACTED'
      );
    }

    setUserCourseStatus(
      userCourse._id,
      'saving_to_database',
      'Saving extracted teacher data to MongoDB.'
    ).catch(() => {});

    const catalog = await CourseCatalog.findByIdAndUpdate(
      claim.catalog._id,
      {
        $set: {
          courseName: extraction.data.courseName || curriculumCourse.courseName,
          normalizedCourseName: normalizeCourseName(extraction.data.courseName || curriculumCourse.courseName),
          teachers: extraction.data.teachers,
          extractionStatus: extraction.extractionStatus,
          reviewStatus: extraction.reviewStatus,
          confidence: extraction.confidence,
          extractionSource: 'gemini',
          lastError: extraction.issues.length ? extraction.issues.join(', ') : null,
          processingLock: { token: null, expiresAt: null }
        }
      },
      { new: true }
    );

    await CourseUpload.updateOne(
      { userCourseId: userCourse._id },
      {
        $set: {
          processingStatus:
            extraction.extractionStatus === 'completed' ? 'completed' : 'needs_review'
        }
      }
    );

    return {
      ...(await completeWithCatalog({ userCourse, catalog, reused: false })),
      issues: extraction.issues
    };
  } catch (error) {
    const message = error?.message || 'Teacher extraction failed.';
    await CourseCatalog.findByIdAndUpdate(claim.catalog._id, {
      $set: {
        extractionStatus: 'failed',
        lastError: message,
        processingLock: { token: null, expiresAt: null }
      }
    });
    await UserCourse.findByIdAndUpdate(userCourse._id, {
      $set: { status: 'failed', statusMessage: message }
    });
    await CourseUpload.updateOne(
      { userCourseId: userCourse._id },
      { $set: { processingStatus: 'failed' } }
    );

    if (error instanceof FfcsError) throw error;
    throw new FfcsError(message, error?.status || 502, error?.code || 'EXTRACTION_FAILED');
  }
}

export function getEquivalentUserIds(userId) {
  const str = String(userId || '').trim();
  const set = new Set([str]);
  if (str.startsWith('firebase_')) {
    set.add(str.replace('firebase_', ''));
  } else if (str) {
    set.add(`firebase_${str}`);
  }
  return Array.from(set);
}

export async function listUserCourses(userId) {
  const allowed = getEquivalentUserIds(userId);
  const userCourses = await UserCourse.find({ userId: { $in: allowed } }).sort({ createdAt: -1 }).lean();
  if (userCourses.length === 0) return [];

  // Deduplicate by courseCode and curriculumCourseId so each course appears only once
  const seen = new Set();
  const uniqueUserCourses = [];
  for (const course of userCourses) {
    const codeKey = normalizeCourseCode(course.courseCode);
    const idKey = String(course.curriculumCourseId || '');
    if ((codeKey && seen.has(codeKey)) || (idKey && seen.has(idKey))) {
      continue;
    }
    if (codeKey) seen.add(codeKey);
    if (idKey) seen.add(idKey);
    uniqueUserCourses.push(course);
  }

  const catalogIds = uniqueUserCourses.map((course) => course.catalogId).filter(Boolean);
  const catalogs = catalogIds.length
    ? await CourseCatalog.find({ _id: { $in: catalogIds } }).lean()
    : [];

  // Enrich teachers in all catalogs with reviews so coursesList has reviews pre-loaded
  for (const cat of catalogs) {
    if (Array.isArray(cat.teachers) && cat.teachers.length > 0) {
      cat.teachers = await enrichTeachersWithReviews(cat.teachers);
    }
  }

  const catalogMap = new Map(catalogs.map((catalog) => [String(catalog._id), catalog]));

  return uniqueUserCourses.map((course) =>
    serializeUserCourse(course, catalogMap.get(String(course.catalogId)))
  );
}

async function resolveOwnedUserCourse(userId, userCourseId) {
  const userCourse = await UserCourse.findById(userCourseId).lean();
  if (!userCourse) {
    throw new FfcsError('Course not found.', 404, 'COURSE_NOT_FOUND');
  }
  const allowed = getEquivalentUserIds(userId);
  if (!allowed.includes(String(userCourse.userId))) {
    throw new FfcsError('You are not allowed to access this course.', 403, 'FORBIDDEN');
  }
  return userCourse;
}

export async function getUserCourse(userId, userCourseId) {
  const userCourse = await resolveOwnedUserCourse(userId, userCourseId);
  const catalog = userCourse.catalogId
    ? await CourseCatalog.findById(userCourse.catalogId).lean()
    : null;
  if (catalog && Array.isArray(catalog.teachers) && catalog.teachers.length > 0) {
    catalog.teachers = await enrichTeachersWithReviews(catalog.teachers);
  }
  return serializeUserCourse(userCourse, catalog);
}

export async function getUserCourseStatus(userId, userCourseId) {
  const userCourse = await resolveOwnedUserCourse(userId, userCourseId);
  const catalog = userCourse.catalogId
    ? await CourseCatalog.findById(userCourse.catalogId).lean()
    : null;
  return {
    courseId: String(userCourse._id),
    status: userCourse.status,
    statusMessage: userCourse.statusMessage || null,
    extractionStatus: catalog?.extractionStatus || null,
    reviewStatus: catalog?.reviewStatus || null,
    teacherCount: catalog?.teachers?.length || 0,
    updatedAt: userCourse.updatedAt
  };
}

export async function getUserCourseTeachers(userId, userCourseId) {
  const userCourse = await resolveOwnedUserCourse(userId, userCourseId);
  const catalog = userCourse.catalogId
    ? await CourseCatalog.findById(userCourse.catalogId).lean()
    : await CourseCatalog.findOne(
        toFilter({
          institution: userCourse.institution,
          courseCode: userCourse.courseCode,
          semester: userCourse.semester,
          academicYear: userCourse.academicYear,
          curriculumVersion: userCourse.curriculumVersion
        })
      ).lean();

  if (!catalog) {
    throw new FfcsError(
      'Teacher data is not available yet for this course.',
      404,
      'TEACHERS_NOT_AVAILABLE'
    );
  }

  const rawTeachers = catalog.teachers || [];
  const enrichedTeachers = await enrichTeachersWithReviews(rawTeachers);

  return {
    courseId: String(userCourse._id),
    courseCode: userCourse.courseCode,
    courseName: userCourse.courseName,
    semester: userCourse.semester,
    academicYear: userCourse.academicYear,
    status: userCourse.status,
    extractionStatus: catalog.extractionStatus,
    reviewStatus: catalog.reviewStatus,
    confidence: catalog.confidence ?? null,
    teachers: enrichedTeachers
  };
}

export async function listTeachersForUser(userId) {
  const allowed = getEquivalentUserIds(userId);
  const userCourses = await UserCourse.find({
    userId: { $in: allowed },
    status: { $in: ['completed', 'needs_review', 'existing_data_found'] }
  })
    .sort({ createdAt: -1 })
    .lean();

  if (userCourses.length === 0) return [];

  const catalogIds = userCourses.map((course) => course.catalogId).filter(Boolean);
  const catalogs = catalogIds.length
    ? await CourseCatalog.find({ _id: { $in: catalogIds } }).lean()
    : [];
  const catalogMap = new Map(catalogs.map((catalog) => [String(catalog._id), catalog]));

  return userCourses
    .map((course) => {
      const catalog = catalogMap.get(String(course.catalogId));
      if (!catalog) return null;
      return {
        courseId: String(course._id),
        courseCode: course.courseCode,
        courseName: course.courseName,
        semester: course.semester,
        academicYear: course.academicYear,
        reviewStatus: catalog.reviewStatus,
        teachers: catalog.teachers || []
      };
    })
    .filter(Boolean);
}

export async function deleteUserCourse(userId, userCourseId) {
  const userCourse = await resolveOwnedUserCourse(userId, userCourseId);

  const upload = await CourseUpload.findOne({ userCourseId: userCourse._id }).lean();
  if (upload?.imageReferences?.length) {
    await Promise.all(
      upload.imageReferences.map(async (reference) => {
        try {
          if (reference.path && !reference.path.startsWith('memory:')) {
            await fs.unlink(reference.path);
          }
        } catch {
          // File may already be gone; deletion is best-effort.
        }
      })
    );
  }

  await CourseUpload.deleteMany({ userCourseId: userCourse._id });

  const allowed = getEquivalentUserIds(userId);
  await UserCourse.deleteMany({
    userId: { $in: allowed },
    $or: [
      { _id: userCourse._id },
      { curriculumCourseId: userCourse.curriculumCourseId },
      { courseCode: normalizeCourseCode(userCourse.courseCode) }
    ]
  });

  return { courseId: String(userCourse._id), deleted: true };
}
