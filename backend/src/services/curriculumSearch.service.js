import CurriculumCourse from '../models/CurriculumCourse.js';
import {
  escapeRegex,
  normalizeCourseName,
  normalizeInstitution,
  toSemesterNumber
} from '../utils/ffcs.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function serializeCourse(course) {
  const idStr = String(course._id);
  return {
    _id: idStr,
    courseId: idStr,
    courseName: course.courseName,
    courseCode: course.courseCode,
    semester: course.semester ?? null,
    credits: course.credits ?? null,
    category: course.category || null,
    curriculumVersion: course.curriculumVersion || null,
    institution: course.institution || 'VIT',
    needsReview: Boolean(course.needsReview),
    reviewReasons: course.reviewReasons || []
  };
}

function buildFilter({ q, institution, semester }) {
  const query = String(q || '').trim();
  const filter = {
    institution: normalizeInstitution(institution),
    isActive: true
  };

  const semesterNumber = toSemesterNumber(semester);
  if (semesterNumber !== null) filter.semester = semesterNumber;

  if (query) {
    const escapedQuery = escapeRegex(query).replace(/\s+/g, '\\s+');
    const compactCode = query.replace(/\s+/g, '').toUpperCase();
    const escapedCompactCode = escapeRegex(compactCode);
    const normalizedQuery = normalizeCourseName(query);

    filter.$or = [
      { courseCode: new RegExp(escapedCompactCode, 'i') },
      { courseName: new RegExp(escapedQuery, 'i') },
      { normalizedCourseName: new RegExp(escapeRegex(normalizedQuery), 'i') }
    ];
  }

  return { filter, query };
}

function resolveLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function resolveOffset({ offset, page, limit }) {
  const parsedOffset = Number(offset);
  if (Number.isFinite(parsedOffset) && parsedOffset >= 0) {
    return Math.floor(parsedOffset);
  }
  const parsedPage = Number(page);
  if (Number.isFinite(parsedPage) && parsedPage > 0) {
    return (Math.floor(parsedPage) - 1) * limit;
  }
  return 0;
}

/**
 * Paginated curriculum listing and live search.
 * An empty query returns every active curriculum course.
 */
export async function listCurriculumCourses({
  q = '',
  institution,
  semester,
  limit = DEFAULT_LIMIT,
  offset = 0,
  page
} = {}) {
  const safeLimit = resolveLimit(limit);
  const safeOffset = resolveOffset({ offset, page, limit: safeLimit });
  const { filter, query } = buildFilter({ q, institution, semester });

  const [total, courses] = await Promise.all([
    CurriculumCourse.countDocuments(filter),
    CurriculumCourse.find(filter)
      .sort({ courseCode: 1, courseName: 1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean()
  ]);

  return {
    courses: courses.map(serializeCourse),
    total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: safeOffset + courses.length < total,
    query
  };
}

/**
 * Autocomplete over the imported curriculum.
 * Case-insensitive partial matching with ranking.
 * Returns up to limit suggestions matching courseCode or courseName.
 */
export async function searchCurriculumCourses({
  q = '',
  institution,
  semester,
  limit = DEFAULT_LIMIT
} = {}) {
  const trimmed = String(q || '').trim();
  if (trimmed.length < 2) {
    return [];
  }

  const safeLimit = resolveLimit(limit);
  const { filter } = buildFilter({ q: trimmed, institution, semester });

  let courses = await CurriculumCourse.find(filter)
    .limit(safeLimit * 3)
    .lean();

  // If CurriculumCourse returned no records, fallback to legacy Course collection
  if (courses.length === 0) {
    try {
      const Course = (await import('../models/Course.js')).default;
      const compactCode = trimmed.replace(/\s+/g, '').toUpperCase();
      const escapedQuery = escapeRegex(trimmed).replace(/\s+/g, '\\s+');
      const legacyFilter = {
        isActive: true,
        $or: [
          { courseCode: new RegExp(escapeRegex(compactCode), 'i') },
          { courseName: new RegExp(escapedQuery, 'i') }
        ]
      };
      const legacyCourses = await Course.find(legacyFilter).limit(safeLimit * 2).lean();
      courses = legacyCourses.map((c) => ({
        ...c,
        curriculumVersion: 'legacy',
        institution: 'VIT'
      }));
    } catch {
      // Fallback non-fatal
    }
  }

  // Smart ranking: prefix match on code or name comes first
  const upperTrimmed = trimmed.toUpperCase();
  const lowerTrimmed = trimmed.toLowerCase();
  const compactQuery = upperTrimmed.replace(/\s+/g, '');

  courses.sort((a, b) => {
    const aCode = (a.courseCode || '').toUpperCase();
    const bCode = (b.courseCode || '').toUpperCase();
    const aName = (a.courseName || '').toLowerCase();
    const bName = (b.courseName || '').toLowerCase();

    // 1. Exact course code match
    const aExactCode = aCode === compactQuery;
    const bExactCode = bCode === compactQuery;
    if (aExactCode !== bExactCode) return aExactCode ? -1 : 1;

    // 2. Course code starts with query
    const aCodeStarts = aCode.startsWith(compactQuery);
    const bCodeStarts = bCode.startsWith(compactQuery);
    if (aCodeStarts !== bCodeStarts) return aCodeStarts ? -1 : 1;

    // 3. Course name starts with query
    const aNameStarts = aName.startsWith(lowerTrimmed);
    const bNameStarts = bName.startsWith(lowerTrimmed);
    if (aNameStarts !== bNameStarts) return aNameStarts ? -1 : 1;

    // 4. Alphabetical by courseCode then courseName
    if (aCode !== bCode) return aCode.localeCompare(bCode);
    return aName.localeCompare(bName);
  });

  return courses.slice(0, safeLimit).map(serializeCourse);
}

export async function getCurriculumCourseById(courseId) {
  const course = await CurriculumCourse.findById(courseId).lean();
  if (!course || !course.isActive) return null;
  return serializeCourse(course);
}