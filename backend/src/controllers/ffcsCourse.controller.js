import {
  addCourseForUser,
  listUserCourses,
  getUserCourse,
  getUserCourseStatus,
  getUserCourseTeachers,
  deleteUserCourse
} from '../services/ffcsCatalog.service.js';
import { detectSlotClash } from '../utils/slotClashDetector.js';

function handleError(res, error, fallbackMessage) {
  const status = error?.status || 500;
  if (status >= 500) {
    console.error(`[FFCS] ${fallbackMessage}:`, error);
  }
  return res.status(status).json({
    success: false,
    code: error?.code || 'FFCS_ERROR',
    message: error?.message || fallbackMessage
  });
}

export async function addCourseHandler(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: authentication is required to add a course.'
      });
    }

    const {
      curriculumCourseId,
      courseCode,
      courseName,
      semester,
      academicYear,
      institution,
      curriculumVersion,
      idempotencyKey
    } = req.body || {};

    if (!curriculumCourseId && !courseCode) {
      return res.status(400).json({
        success: false,
        code: 'CURRICULUM_COURSE_REQUIRED',
        message: 'curriculumCourseId or courseCode is required. Select a course from autocomplete.'
      });
    }

    const result = await addCourseForUser({
      userId,
      curriculumCourseId,
      courseCode,
      courseName,
      semester,
      academicYear,
      institution,
      curriculumVersion,
      files: req.files || [],
      idempotencyKey: idempotencyKey || req.headers['idempotency-key'] || null
    });

    const httpStatus = result.processing ? 202 : 200;

    return res.status(httpStatus).json({
      success: true,
      source: result.reused ? 'mongodb' : 'gemini',
      status: result.status,
      reusedExistingData: Boolean(result.reused),
      processing: Boolean(result.processing),
      issues: result.issues || [],
      course: result.userCourse ? {
        courseId: String(result.userCourse._id),
        curriculumCourseId: String(result.userCourse.curriculumCourseId),
        catalogId: result.userCourse.catalogId ? String(result.userCourse.catalogId) : null,
        courseCode: result.userCourse.courseCode,
        courseName: result.userCourse.courseName,
        semester: result.userCourse.semester,
        academicYear: result.userCourse.academicYear,
        institution: result.userCourse.institution,
        curriculumVersion: result.userCourse.curriculumVersion,
        status: result.userCourse.status,
        statusMessage: result.userCourse.statusMessage || null
      } : null,
      teachers: result.catalog?.teachers || [],
      catalog: result.catalog
        ? {
            catalogId: String(result.catalog._id),
            teachers: result.catalog.teachers || [],
            extractionStatus: result.catalog.extractionStatus,
            reviewStatus: result.catalog.reviewStatus,
            confidence: result.catalog.confidence ?? null
          }
        : null
    });
  } catch (error) {
    return handleError(res, error, 'Failed to add course');
  }
}

export async function listCoursesHandler(req, res) {
  try {
    const courses = await listUserCourses(req.userId);
    return res.status(200).json({ success: true, count: courses.length, courses });
  } catch (error) {
    return handleError(res, error, 'Failed to list courses');
  }
}

export async function getCourseHandler(req, res) {
  try {
    const course = await getUserCourse(req.userId, req.params.courseId);
    return res.status(200).json({ success: true, course });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve course');
  }
}

export async function getCourseStatusHandler(req, res) {
  try {
    const status = await getUserCourseStatus(req.userId, req.params.courseId);
    return res.status(200).json({ success: true, ...status });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve course status');
  }
}

export async function getCourseTeachersHandler(req, res) {
  try {
    const result = await getUserCourseTeachers(req.userId, req.params.courseId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve course teachers');
  }
}

export async function deleteCourseHandler(req, res) {
  try {
    const result = await deleteUserCourse(req.userId, req.params.courseId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Failed to delete course');
  }
}

export async function checkSlotClashHandler(req, res) {
  try {
    const { candidateSlot, candidateSchedule, confirmedFaculties, currentCourseId } = req.body || {};
    const clashResult = detectSlotClash({
      candidateSlot,
      candidateSchedule,
      confirmedFaculties: confirmedFaculties || {},
      currentCourseId
    });
    return res.status(200).json({ success: true, data: clashResult });
  } catch (error) {
    return handleError(res, error, 'Failed to check slot clash');
  }
}
