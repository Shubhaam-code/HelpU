import fs from 'fs/promises';
import { ingestCurriculum } from '../services/curriculumIngestion.service.js';
import {
  listCurriculumCourses,
  searchCurriculumCourses,
  getCurriculumCourseById
} from '../services/curriculumSearch.service.js';
import { normalizeInstitution } from '../utils/ffcs.js';

export async function uploadCurriculumHandler(req, res) {
  let buffer;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'CURRICULUM_FILE_REQUIRED',
        message: 'A curriculum PDF file is required in the "curriculum" field.'
      });
    }

    buffer = await fs.readFile(req.file.path);

    const result = await ingestCurriculum({
      buffer,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      institution: req.body?.institution,
      curriculumVersion: req.body?.curriculumVersion || req.body?.version,
      uploadedBy: req.adminIdentity || req.userId,
      activate: req.body?.activate !== 'false'
    });

    return res.status(result.success ? 200 : 422).json(result);
  } catch (error) {
    console.error('[Curriculum] Upload failed:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'CURRICULUM_IMPORT_FAILED',
      message: error.message || 'Failed to import curriculum PDF.'
    });
  } finally {
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {
        // The stored file is no longer needed after ingestion.
      }
    }
  }
}

async function sendCourseList(req, res) {
  const q = String(req.query.q || req.query.query || req.query.search || '').trim();

  const result = await listCurriculumCourses({
    q,
    institution: req.query.institution,
    semester: req.query.semester,
    limit: req.query.limit,
    offset: req.query.offset,
    page: req.query.page
  });

  return res.status(200).json({
    success: true,
    count: result.courses.length,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    hasMore: result.hasMore,
    query: result.query,
    courses: result.courses
  });
}

export async function listCurriculumCoursesHandler(req, res) {
  try {
    return await sendCourseList(req, res);
  } catch (error) {
    console.error('[Curriculum] List failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load curriculum courses.'
    });
  }
}

export async function searchCurriculumCoursesHandler(req, res) {
  try {
    const q = String(req.query.q || req.query.query || req.query.search || '').trim();

    // Minimum 2 characters validation required
    if (q.length < 2) {
      return res.status(200).json({
        success: true,
        count: 0,
        courses: [],
        message: 'Type at least 2 characters to search courses.'
      });
    }

    const courses = await searchCurriculumCourses({
      q,
      institution: req.query.institution,
      semester: req.query.semester,
      limit: req.query.limit || 10
    });

    return res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('[Curriculum] Search failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to search curriculum courses.'
    });
  }
}

export async function getCurriculumCourseHandler(req, res) {
  try {
    const course = await getCurriculumCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curriculum course not found.'
      });
    }
    return res.status(200).json({ success: true, course });
  } catch (error) {
    console.error('[Curriculum] Get course failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve curriculum course.'
    });
  }
}

export async function getCurriculumMetaHandler(req, res) {
  return res.status(200).json({
    success: true,
    institution: normalizeInstitution(req.query.institution)
  });
}
