import CurriculumCourse from '../models/CurriculumCourse.js';
import { parseCurriculumPdf } from './curriculumParser.service.js';
import { extractCurriculumFromPdf, isGeminiConfigured } from './gemini.service.js';
import {
  normalizeCourseCode,
  normalizeCourseName,
  normalizeInstitution,
  toSemesterNumber
} from '../utils/ffcs.js';

function normalizeGeminiCourse(course) {
  const courseCode = normalizeCourseCode(course?.courseCode);
  const courseName = String(course?.courseName || '').replace(/\s+/g, ' ').trim();
  const semester = toSemesterNumber(course?.semester);
  const credits = course?.credits === null || course?.credits === undefined ? null : Number(course.credits);
  const reviewReasons = [];
  if (!courseCode) reviewReasons.push('course_code_not_parsed');
  if (!courseName) reviewReasons.push('course_name_not_parsed');
  if (semester === null) reviewReasons.push('semester_not_present_in_source');

  return {
    courseCode,
    courseName,
    normalizedCourseName: normalizeCourseName(courseName),
    semester,
    credits: Number.isFinite(credits) ? credits : null,
    category: course?.category ? String(course.category).trim() : null,
    courseType: course?.courseType ? String(course.courseType).trim() : null,
    version: null,
    lecture: null,
    tutorial: null,
    practical: null,
    project: null,
    sourcePage: null,
    needsReview: reviewReasons.length > 0,
    reviewReasons
  };
}

function dedupeCourses(courses) {
  const byIdentity = new Map();
  const warnings = [];

  for (const course of courses) {
    if (!course?.courseCode || !course?.courseName) {
      warnings.push(
        `Skipped unparseable course row${course?.sourcePage ? ` on page ${course.sourcePage}` : ''}.`
      );
      continue;
    }

    const key = `${course.courseCode}|${course.semester ?? 'null'}`;
    const existing = byIdentity.get(key);

    if (!existing) {
      byIdentity.set(key, { ...course });
      continue;
    }

    existing.reviewReasons = Array.from(
      new Set([...(existing.reviewReasons || []), 'duplicate_course_code_in_source'])
    );
    existing.needsReview = true;

    if (
      normalizeCourseName(existing.courseName) !== normalizeCourseName(course.courseName)
    ) {
      warnings.push(
        `Duplicate course code ${course.courseCode} has conflicting names ("${existing.courseName}" vs "${course.courseName}"). Kept the first record for review.`
      );
    }
  }

  return { courses: Array.from(byIdentity.values()), warnings };
}

/**
 * Ingest an uploaded curriculum PDF into MongoDB.
 * Idempotent per (institution, curriculumVersion, courseCode, semester).
 */
export async function ingestCurriculum({
  buffer,
  fileName,
  originalName,
  mimeType,
  institution,
  curriculumVersion,
  uploadedBy,
  activate = true
}) {
  const normalizedInstitution = normalizeInstitution(institution);
  const version = String(curriculumVersion || '').trim() || `auto-${Date.now()}`;

  const parsed = await parseCurriculumPdf(buffer);
  let courses = parsed.courses;
  const warnings = [];
  let usedGeminiFallback = false;

  if (parsed.scanned) {
    if (!isGeminiConfigured()) {
      warnings.push(
        'PDF appears to be scanned/image-only and Gemini is not configured, so OCR fallback was skipped.'
      );
    } else {
      try {
        const fallback = await extractCurriculumFromPdf({ buffer, originalName });
        courses = fallback.courses.map(normalizeGeminiCourse);
        usedGeminiFallback = true;
        warnings.push('PDF text extraction was insufficient; Gemini PDF/OCR extraction was used.');
      } catch (error) {
        warnings.push(`Scanned-PDF OCR fallback failed: ${error.message}`);
      }
    }
  }

  const deduped = dedupeCourses(courses);
  warnings.push(...deduped.warnings);

  if (deduped.courses.length === 0) {
    return {
      success: false,
      imported: 0,
      inserted: 0,
      updated: 0,
      needsReview: 0,
      curriculumVersion: version,
      totalPages: parsed.totalPages,
      scanned: parsed.scanned,
      usedGeminiFallback,
      warnings,
      message: 'No course records could be extracted from this PDF.'
    };
  }

  const now = new Date();
  const sourceDocument = {
    fileName,
    originalName,
    mimeType,
    uploadedBy: uploadedBy || null,
    uploadedAt: now
  };

  const operations = deduped.courses.map((course) => ({
    updateOne: {
      filter: {
        institution: normalizedInstitution,
        curriculumVersion: version,
        courseCode: course.courseCode,
        semester: course.semester
      },
      update: {
        $set: {
          courseName: course.courseName,
          normalizedCourseName: course.normalizedCourseName,
          credits: course.credits,
          category: course.category,
          courseType: course.courseType,
          version: course.version,
          lecture: course.lecture,
          tutorial: course.tutorial,
          practical: course.practical,
          project: course.project,
          sourceDocument,
          sourcePage: course.sourcePage,
          isActive: activate !== false,
          needsReview: course.needsReview,
          reviewReasons: course.reviewReasons
        },
        $setOnInsert: {
          institution: normalizedInstitution,
          curriculumVersion: version,
          courseCode: course.courseCode,
          semester: course.semester
        }
      },
      upsert: true
    }
  }));

  const result = await CurriculumCourse.bulkWrite(operations, { ordered: false });

  if (activate !== false) {
    await CurriculumCourse.updateMany(
      { institution: normalizedInstitution, curriculumVersion: { $ne: version } },
      { $set: { isActive: false } }
    );
  }

  const needsReview = deduped.courses.filter((course) => course.needsReview).length;

  return {
    success: true,
    imported: deduped.courses.length,
    inserted: result.upsertedCount || 0,
    updated: result.modifiedCount || 0,
    matched: result.matchedCount || 0,
    needsReview,
    curriculumVersion: version,
    institution: normalizedInstitution,
    totalPages: parsed.totalPages,
    textLength: parsed.textLength,
    scanned: parsed.scanned,
    usedGeminiFallback,
    warnings
  };
}
