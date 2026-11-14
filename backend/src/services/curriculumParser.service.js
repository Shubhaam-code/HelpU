import { PDFParse } from 'pdf-parse';
import { normalizeCourseCode, normalizeCourseName } from '../utils/ffcs.js';

const CATEGORY_HEADINGS = [
  'Programme Core',
  'Programme Elective',
  'University Core - Natural Science Core',
  'University Core - Basic Engineering Sciences Core',
  'University Core - Skill Development Courses',
  'University Core - Humanities Social Science and Management Core',
  'University Core - Project and Internships',
  'University Elective - Natural Science Electives',
  'University Elective - Multidisciplinary Electives',
  'University Elective - Humanities, Social Sciences and Management Electives',
  'University Elective - Open Electives',
  'Non - Graded Mandatory Courses'
].map((value) => value.toLowerCase());

const COURSE_START_RE = /^(\d{1,3})\s+([A-Z]{2,5}\d{3,4})\s+(.*)$/;

const CREDIT_TAIL_RE =
  /(\d+\.\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s*$/;

const COURSE_TYPE_PATTERNS = [
  /lecture\s+and\s+tutorial\s*,?\s*practical\s+hours\s+only$/i,
  /lecture\s+and\s+tutorial\s+hours\s+only$/i,
  /lecture\s+and\s+practical\s+hours\s+only$/i,
  /practical\s+hours\s+only$/i,
  /project\s+only$/i,
  /online\s+course$/i,
  /lecture\s+hours\s+only$/i
];

const NOISE_PATTERNS = [
  /^report on\s*:/i,
  /^--\s*\d+\s+of\s+\d+\s*--$/i,
  /^sl\.?\s*no\s+course\s+code\s+course\s+title\s+course\s+type/i,
  /^l\s+t\s+p\s+j\s+credits$/i,
  /^version$/i,
  /^sio$/i
];

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseLine(line) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function matchCategory(line) {
  const lower = line.toLowerCase();
  if (!CATEGORY_HEADINGS.includes(lower)) return null;
  return line;
}

function extractSemester(value) {
  const text = cleanText(value);
  const direct = text.match(/(?:semester|sem)\s*[:\-]?\s*(\d{1,2})/i);
  if (direct) {
    const number = Number(direct[1]);
    if (number >= 1 && number <= 12) return number;
  }
  const ordinal = text.match(/(\d{1,2})\s*(?:st|nd|rd|th)\s+semester/i);
  if (ordinal) {
    const number = Number(ordinal[1]);
    if (number >= 1 && number <= 12) return number;
  }
  return null;
}

/**
 * Parse a single course block that has been collapsed to one line.
 * Returns null when the block does not contain a valid course row.
 */
export function parseCourseBlock(blockText, { sourcePage = null, category = null } = {}) {
  const text = cleanText(blockText);
  if (!text) return null;

  const start = COURSE_START_RE.exec(text);
  if (!start) return null;

  const courseCode = normalizeCourseCode(start[2]);
  let remainder = start[3].trim();
  const reviewReasons = [];

  let version = null;
  let lecture = null;
  let tutorial = null;
  let practical = null;
  let project = null;
  let credits = null;

  const tail = CREDIT_TAIL_RE.exec(remainder);
  if (tail) {
    version = tail[1];
    lecture = Number(tail[2]);
    tutorial = Number(tail[3]);
    practical = Number(tail[4]);
    project = Number(tail[5]);
    credits = Number(tail[6]);
    remainder = remainder.slice(0, tail.index).trim();
  } else {
    reviewReasons.push('credit_columns_not_parsed');
  }

  let courseType = null;
  for (const pattern of COURSE_TYPE_PATTERNS) {
    const match = pattern.exec(remainder);
    if (match) {
      courseType = cleanText(match[0]);
      remainder = remainder.slice(0, match.index).trim();
      break;
    }
  }

  let semester = extractSemester(category);
  const semesterPrefix = remainder.match(/^semester\s*[:\-]?\s*(\d{1,2})\s+/i);
  if (semesterPrefix) {
    const number = Number(semesterPrefix[1]);
    if (number >= 1 && number <= 12) semester = number;
    remainder = remainder.slice(semesterPrefix[0].length).trim();
  }

  const courseName = cleanText(remainder);

  if (!courseType) reviewReasons.push('course_type_not_parsed');
  if (!courseName) reviewReasons.push('course_name_not_parsed');
  if (semester === null) reviewReasons.push('semester_not_present_in_source');

  return {
    courseCode,
    courseName,
    normalizedCourseName: normalizeCourseName(courseName),
    semester,
    credits,
    category: category ? cleanText(category) : null,
    courseType,
    version,
    lecture,
    tutorial,
    practical,
    project,
    sourcePage,
    needsReview: reviewReasons.length > 0,
    reviewReasons
  };
}

/**
 * Parse an array of PDF pages: [{ num, text }].
 */
export function parseCurriculumPages(pages = []) {
  const courses = [];
  let currentCategory = null;
  let pending = null;

  const flush = () => {
    if (!pending) return;
    const parsed = parseCourseBlock(pending.lines.join(' '), {
      sourcePage: pending.page,
      category: pending.category
    });
    if (parsed) courses.push(parsed);
    pending = null;
  };

  for (const page of pages) {
    const pageNumber = Number(page?.num) || null;
    const lines = String(page?.text || '').split(/\r?\n/);

    for (const rawLine of lines) {
      const line = cleanText(rawLine);
      if (!line) continue;
      if (isNoiseLine(line)) continue;

      const category = matchCategory(line);
      if (category) {
        flush();
        currentCategory = category;
        continue;
      }

      const courseStart = COURSE_START_RE.exec(line);
      if (courseStart) {
        flush();
        pending = { page: pageNumber, category: currentCategory, lines: [line] };
        continue;
      }

      if (pending) pending.lines.push(line);
    }
  }

  flush();
  return courses;
}

/**
 * Parse the complete text (kept for unit tests and text-only PDFs).
 * Page markers of the form "-- 1 of 8 --" are used to associate source pages.
 */
export function parseCurriculumText(text = '') {
  const pages = [];
  let currentPage = { num: 1, text: '' };

  for (const rawLine of String(text).split(/\r?\n/)) {
    const marker = cleanText(rawLine).match(/^--\s*(\d+)\s+of\s+\d+\s*--$/i);
    if (marker) {
      pages.push(currentPage);
      currentPage = { num: Number(marker[1]) + 1, text: '' };
      continue;
    }
    currentPage.text += `${rawLine}\n`;
  }
  pages.push(currentPage);

  return parseCurriculumPages(pages);
}

/**
 * Extract normalized curriculum course records from a PDF buffer.
 * Uses text extraction first. If the PDF is scanned/image-only, callers can
 * use the Gemini PDF fallback (see curriculumIngestion.service.js).
 */
export async function parseCurriculumPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const rawText = String(result?.text || '');
    const pages =
      Array.isArray(result?.pages) && result.pages.length > 0
        ? result.pages.map((page) => ({ num: page.num, text: page.text || '' }))
        : [{ num: 1, text: rawText }];

    const courses = parseCurriculumPages(pages);

    return {
      courses,
      pages: pages.map((page) => ({ num: page.num, textLength: String(page.text || '').length })),
      totalPages: result?.total || pages.length,
      textLength: rawText.length,
      scanned: rawText.trim().length < 100 || courses.length === 0,
      rawText
    };
  } finally {
    await parser.destroy();
  }
}
