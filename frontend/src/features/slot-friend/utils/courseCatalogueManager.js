import bundledCourses from '../data/coursesCatalogue.json';
import { searchCourses } from '../../../lib/api';

const CACHE_STORAGE_KEY = 'helpu_courses_catalogue_v2';
const CACHE_TIMESTAMP_KEY = 'helpu_courses_catalogue_ts_v2';
const CACHE_PERMANENT_KEY = 'helpu_courses_catalogue_persisted';
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Permanent cache: once loaded, stay loaded)

// Acronym and popular synonym mappings for student curriculum
const COURSE_SYNONYMS = {
  dsa: ['data structures', 'cse2002'],
  oop: ['object oriented', 'cse2001'],
  oops: ['object oriented', 'cse2001'],
  dbms: ['database', 'cse3001'],
  os: ['operating system', 'cse3003'],
  toc: ['theory of computation', 'compiler', 'cse2004'],
  cn: ['computer networks', 'cse3006'],
  coa: ['computer architecture', 'cse2003'],
  cao: ['computer architecture', 'cse2003'],
  daa: ['design and analysis of algorithms', 'cse3004'],
  se: ['software engineering', 'cse3005'],
  ai: ['artificial intelligence', 'csa2001'],
  ml: ['machine learning', 'cse4005'],
  aiml: ['machine learning', 'artificial intelligence', 'csa2001'],
  web: ['web programming', 'cse4001'],
  fswd: ['web programming', 'cse4001'],
  cloud: ['cloud computing', 'aws', 'csa3005', 'cse3015', 'cse3016'],
  aws: ['aws', 'cse3015', 'cse3016'],
  algo: ['algorithms', 'cse3004', 'cse2002'],
  algorithms: ['algorithms', 'cse3004', 'cse2002'],
  java: ['java', 'cse2006', 'cse4019'],
  python: ['python', 'cse3011'],
  cpp: ['c++', 'cse2001'],
  c: ['problem solving', 'cse1021']
};

/**
 * Standardize and clean course list ensuring unique courseCodes and required fields
 */
function normalizeCourseList(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const item of list) {
    if (!item || !item.courseCode) continue;
    const code = String(item.courseCode).toUpperCase().trim();
    if (!map.has(code)) {
      map.set(code, {
        id: item.id || item._id || code,
        courseCode: code,
        courseName: item.courseName || item.name || code,
        category: item.category || 'General',
        credits: typeof item.credits === 'number' ? item.credits : (parseFloat(item.credits) || 3),
        isActive: item.isActive !== false
      });
    }
  }
  return Array.from(map.values());
}

// 1. Initialize In-Memory Catalogue (Starts with bundled courses immediately - 0ms delay)
const initialBundled = normalizeCourseList(bundledCourses);
let inMemoryCatalogue = initialBundled;

// 2. Restore from localStorage if present
try {
  const cached = localStorage.getItem(CACHE_STORAGE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge cached with bundled to ensure no missing entries
      const merged = normalizeCourseList([...parsed, ...initialBundled]);
      inMemoryCatalogue = merged;
    }
  } else {
    // First time load: immediately persist bundled courses so it is permanently cached
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(initialBundled));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    localStorage.setItem(CACHE_PERMANENT_KEY, 'true');
  }
} catch (e) {
  // localStorage disabled or private browsing mode
}

/**
 * Get all available courses synchronously (0ms latency, always loaded, offline ready)
 */
export function getAllCourses() {
  return inMemoryCatalogue;
}

/**
 * Search and filter courses instantly in-memory with acronym & prefix support
 * @param {string} rawQuery User search input
 * @param {number} limit Maximum results to return
 */
export function filterCourses(rawQuery = '', limit = 30) {
  let q = (rawQuery || '').trim().toLowerCase();

  // Strip brackets if selected query format e.g. [CSE2001] Data Structures
  if (q.startsWith('[')) {
    const closeBracketIdx = q.indexOf(']');
    if (closeBracketIdx !== -1) {
      q = q.slice(closeBracketIdx + 1).trim();
    }
  }

  // If query is empty, return top featured curriculum courses
  if (!q) {
    return inMemoryCatalogue.slice(0, limit);
  }

  const qClean = q.replace(/[^a-z0-9]/g, '');
  const synonyms = COURSE_SYNONYMS[qClean] || [];

  const exactCodeMatches = [];
  const startCodeMatches = [];
  const partialCodeMatches = [];
  const acronymMatches = [];
  const startNameMatches = [];
  const partialNameMatches = [];
  const categoryMatches = [];

  const seenCodes = new Set();

  for (const course of inMemoryCatalogue) {
    const code = (course.courseCode || '').toLowerCase();
    const codeClean = code.replace(/[^a-z0-9]/g, '');
    const name = (course.courseName || '').toLowerCase();
    const category = (course.category || '').toLowerCase();

    // 1. Exact Course Code match (e.g. CSE2001)
    if (codeClean === qClean) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        exactCodeMatches.push(course);
      }
      continue;
    }

    // 2. Acronym match (e.g. 'dsa' -> CSE2002, 'dbms' -> CSE3001)
    if (synonyms.length > 0) {
      let isSynonymMatch = false;
      for (const syn of synonyms) {
        if (code.includes(syn) || name.includes(syn)) {
          isSynonymMatch = true;
          break;
        }
      }
      if (isSynonymMatch && !seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        acronymMatches.push(course);
        continue;
      }
    }

    // 3. Course Code starts with query (e.g. 'cse' or 'cse2')
    if (codeClean.startsWith(qClean)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        startCodeMatches.push(course);
      }
      continue;
    }

    // 4. Course Code contains query
    if (codeClean.includes(qClean) || code.includes(q)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        partialCodeMatches.push(course);
      }
      continue;
    }

    // 5. Course Name starts with query (e.g. 'Data Structures')
    if (name.startsWith(q)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        startNameMatches.push(course);
      }
      continue;
    }

    // 6. Course Name contains query (e.g. 'Structures')
    if (name.includes(q)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        partialNameMatches.push(course);
      }
      continue;
    }

    // 7. Category match (e.g. 'Core', 'Elective')
    if (category.includes(q)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        categoryMatches.push(course);
      }
      continue;
    }
  }

  return [
    ...exactCodeMatches,
    ...startCodeMatches,
    ...acronymMatches,
    ...partialCodeMatches,
    ...startNameMatches,
    ...partialNameMatches,
    ...categoryMatches
  ].slice(0, limit);
}

/**
 * Permanently sync courses in background without blocking UI
 * Once loaded, stays permanently cached in localStorage & in-memory.
 */
export async function syncCourseCatalogueInBackground() {
  try {
    const now = Date.now();
    const lastSync = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0', 10);

    // If catalogue is already populated and synced within SYNC_INTERVAL_MS, keep existing cache
    if (inMemoryCatalogue.length >= 100 && (now - lastSync) < SYNC_INTERVAL_MS) {
      return inMemoryCatalogue;
    }

    // Fetch up to 500 courses from backend
    const res = await searchCourses('', 500);
    const remoteList = Array.isArray(res?.data?.data) 
      ? res.data.data 
      : (Array.isArray(res?.data) ? res.data : null);

    if (Array.isArray(remoteList) && remoteList.length > 0) {
      // Merge remote list with existing catalogue to preserve all courses
      const merged = normalizeCourseList([...remoteList, ...inMemoryCatalogue]);
      inMemoryCatalogue = merged;

      try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, String(now));
        localStorage.setItem(CACHE_PERMANENT_KEY, 'true');
      } catch (err) {
        // Storage limit exceeded or disabled
      }
    }
  } catch (err) {
    // If backend is offline or slow, silently maintain existing cached list
    console.warn('[CourseManager] Offline or backend unreachable, using permanent cache:', err?.message || err);
  }
  return inMemoryCatalogue;
}
