import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import Course from '../models/Course.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Known section categories in university curriculum
export const KNOWN_CATEGORIES = [
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
];

// Common abbreviations/acronyms to keep uppercase
const ACRONYMS = new Set([
  'AI', 'ML', 'IOT', 'IoT', 'AWS', 'IT', 'CSE', 'ECE', 'EEE', 'MEE', 
  'DSA', 'SQL', 'ER', 'LINUX', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VLSI'
]);

// Course types appearing in table columns
const COURSE_TYPE_PREFIXES = [
  'Lecture and Tutorial ,practical hours only',
  'Lecture and Tutorial , practical hours only',
  'Lecture and Tutorial, practical hours only',
  'Lecture and Tutorial Hours Only',
  'Lecture and Tutorial Hours only',
  'Lecture and Practical Hours Only',
  'Lecture and Practical Hours only',
  'Practical Hours Only',
  'Practical Hours only',
  'Project Only',
  'Online Course'
];

/**
 * Normalizes course names by removing extra spaces,
 * and converting ALL-CAPS titles to clean Title Case while preserving acronyms.
 */
export function normalizeCourseName(name = '') {
  let cleaned = name.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const isAllCaps = cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned);

  if (isAllCaps) {
    cleaned = cleaned.split(' ').map((word) => {
      // Check word stripped of punctuation
      const cleanAlpha = word.replace(/[^a-zA-Z]/g, '').toUpperCase();
      if (ACRONYMS.has(cleanAlpha)) {
        return word.toUpperCase();
      }
      // If word has parentheses e.g. (LINUX or ADMINISTRATION)
      if (word.startsWith('(') && word.endsWith(')')) {
        const inner = word.slice(1, -1);
        if (ACRONYMS.has(inner.toUpperCase())) return `(${inner.toUpperCase()})`;
        return `(${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()})`;
      }
      if (word.startsWith('(')) {
        const inner = word.slice(1);
        if (ACRONYMS.has(inner.toUpperCase())) return `(${inner.toUpperCase()}`;
        return `(${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()}`;
      }
      if (word.endsWith(')')) {
        const inner = word.slice(0, -1);
        if (ACRONYMS.has(inner.toUpperCase())) return `${inner.toUpperCase()})`;
        return `${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()})`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  return cleaned;
}

/**
 * Extracts all courses from the curriculum PDF buffer or path.
 */
export async function extractCoursesFromPdf(pdfPathOrBuffer) {
  let buffer;
  if (typeof pdfPathOrBuffer === 'string') {
    buffer = fs.readFileSync(pdfPathOrBuffer);
  } else if (Buffer.isBuffer(pdfPathOrBuffer)) {
    buffer = pdfPathOrBuffer;
  } else {
    throw new Error('Invalid PDF source provided');
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const textResult = await parser.getText();

  const courses = [];
  const seenCodes = new Set();
  let duplicateCount = 0;
  let currentCategory = 'Programme Core';

  for (let pIdx = 0; pIdx < textResult.pages.length; pIdx++) {
    const pageText = textResult.pages[pIdx].text;
    const lines = pageText.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Check category headings
      for (const cat of KNOWN_CATEGORIES) {
        if (line === cat || line.startsWith(cat)) {
          currentCategory = cat;
          break;
        }
      }

      // Check course row start: <sl.no> <courseCode> <rest...>
      const rowMatch = line.match(/^(\d+)\s+([A-Z]{3,4}[0-9]{4})\s+(.*)$/);
      if (rowMatch) {
        const code = rowMatch[2].toUpperCase().trim();
        let remaining = rowMatch[3];

        // Gather continuation lines until next course row or page footer/header
        const blockLines = [remaining];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (/^\d+\s+[A-Z]{3,4}[0-9]{4}\b/.test(nextLine)) break;
          if (/^Report On\s*:/i.test(nextLine)) break;
          if (KNOWN_CATEGORIES.some((cat) => nextLine === cat || nextLine.startsWith(cat))) break;
          if (/^sl\.no\s+Course Code/i.test(nextLine)) break;
          if (/^L\s+T\s+P\s+J\s+Credits/i.test(nextLine)) break;
          if (/^CREDIT INFO/i.test(nextLine)) break;

          blockLines.push(nextLine);
          j++;
        }
        i = j - 1; // Advance pointer

        const blockText = blockLines.join(' ').replace(/\s+/g, ' ').trim();

        // Extract credits from end of row: <ver> <L> <T> <P> <J> <Credits>
        let credits = 0;
        const creditsMatch = blockText.match(/(\d+\.\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/);
        if (creditsMatch) {
          credits = parseFloat(creditsMatch[6]);
        } else {
          const fallbackCredits = blockText.match(/(\d+(?:\.\d+)?)$/);
          if (fallbackCredits) credits = parseFloat(fallbackCredits[1]);
        }

        // Extract course title by stripping course type and trailing version/credits
        let title = blockText;
        let typeIdx = -1;
        for (const type of COURSE_TYPE_PREFIXES) {
          const idx = title.toLowerCase().indexOf(type.toLowerCase());
          if (idx !== -1 && (typeIdx === -1 || idx < typeIdx)) {
            typeIdx = idx;
          }
        }

        if (typeIdx !== -1) {
          title = title.substring(0, typeIdx).trim();
        } else {
          const cutMatch = title.search(/\s+(?:Lecture|Practical|Project|Online|\d+\.\d+\s+\d+\s+\d+)/i);
          if (cutMatch !== -1) {
            title = title.substring(0, cutMatch).trim();
          }
        }

        const normalizedTitle = normalizeCourseName(title);

        if (seenCodes.has(code)) {
          duplicateCount++;
        } else {
          seenCodes.add(code);
          courses.push({
            courseCode: code,
            courseName: normalizedTitle,
            category: currentCategory,
            credits: Number.isFinite(credits) ? credits : 0,
            isActive: true
          });
        }
      }
      i++;
    }
  }

  return {
    courses,
    totalExtracted: courses.length,
    duplicateCount
  };
}

/**
 * Imports courses into MongoDB.
 * Uses bulkWrite with upsert to prevent duplicates and make it idempotent.
 */
export async function importCoursesToDatabase(pdfPathOrBuffer) {
  const { courses, totalExtracted, duplicateCount } = await extractCoursesFromPdf(pdfPathOrBuffer);

  if (!courses || courses.length === 0) {
    return {
      success: false,
      message: 'No courses extracted from PDF',
      totalExtracted: 0,
      upsertedCount: 0,
      modifiedCount: 0,
      duplicateCount: 0
    };
  }

  // Build bulkWrite operations with upsert
  const operations = courses.map((course) => ({
    updateOne: {
      filter: { courseCode: course.courseCode },
      update: {
        $set: {
          courseName: course.courseName,
          category: course.category,
          credits: course.credits,
          isActive: course.isActive
        }
      },
      upsert: true
    }
  }));

  const bulkResult = await Course.bulkWrite(operations, { ordered: false });

  const totalInDb = await Course.countDocuments();

  return {
    success: true,
    totalExtracted,
    duplicateCount,
    upsertedCount: bulkResult.upsertedCount || 0,
    matchedCount: bulkResult.matchedCount || 0,
    modifiedCount: bulkResult.modifiedCount || 0,
    totalInDb
  };
}

/**
 * Search courses by code or name.
 * Returns up to `limit` courses with id, code, name, category, credits.
 */
export async function searchCourses(query = '', limit = 10) {
  const trimmed = query.trim();
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  let filter = { isActive: true };

  if (trimmed) {
    // Escape regex special characters
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    filter.$or = [
      { courseCode: regex },
      { courseName: regex }
    ];
  }

  const courses = await Course.find(filter)
    .select('_id courseCode courseName category credits isActive')
    .sort({ courseCode: 1 })
    .limit(safeLimit)
    .lean();

  return courses.map((c) => ({
    id: c._id.toString(),
    courseCode: c.courseCode,
    courseName: c.courseName,
    category: c.category,
    credits: c.credits,
    isActive: c.isActive
  }));
}

