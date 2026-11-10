import bundledCourses from '../data/coursesCatalogue.json';
import { searchCourses } from '../../../lib/api';

const CACHE_STORAGE_KEY = 'helpu_courses_catalogue_v1';
const CACHE_TIMESTAMP_KEY = 'helpu_courses_catalogue_ts';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory master list (starts with bundled courses immediately)
let inMemoryCatalogue = Array.isArray(bundledCourses) && bundledCourses.length > 0 ? bundledCourses : [];

// Attempt instant restore from localStorage
try {
  const cached = localStorage.getItem(CACHE_STORAGE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryCatalogue = parsed;
    }
  }
} catch (e) {
  // ignore storage errors
}

/**
 * Get all available courses synchronously (0ms latency, always loaded)
 */
export function getAllCourses() {
  return inMemoryCatalogue;
}

/**
 * Search and filter courses instantly in-memory
 * @param {string} rawQuery User search input
 * @param {number} limit Maximum results to return
 */
export function filterCourses(rawQuery = '', limit = 25) {
  let q = (rawQuery || '').trim().toLowerCase();

  // If query starts with [COURSECODE] e.g. from an existing selection, strip code bracket to allow search by title or code
  if (q.startsWith('[')) {
    const closeBracketIdx = q.indexOf(']');
    if (closeBracketIdx !== -1) {
      q = q.slice(closeBracketIdx + 1).trim();
    }
  }

  if (!q) {
    // If search is empty, return top featured/core courses immediately
    return inMemoryCatalogue.slice(0, limit);
  }

  const qClean = q.replace(/[^a-z0-9]/g, '');
  const seenCodes = new Set();
  const exactCodeMatches = [];
  const startCodeMatches = [];
  const partialCodeMatches = [];
  const startNameMatches = [];
  const partialNameMatches = [];

  for (const course of inMemoryCatalogue) {
    const code = (course.courseCode || '').toLowerCase();
    const codeClean = code.replace(/[^a-z0-9]/g, '');
    const name = (course.courseName || '').toLowerCase();

    if (codeClean === qClean) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        exactCodeMatches.push(course);
      }
    } else if (codeClean.startsWith(qClean)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        startCodeMatches.push(course);
      }
    } else if (codeClean.includes(qClean) || (code && code.includes(q))) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        partialCodeMatches.push(course);
      }
    } else if (name.startsWith(q)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        startNameMatches.push(course);
      }
    } else if (name.includes(q)) {
      if (!seenCodes.has(course.courseCode)) {
        seenCodes.add(course.courseCode);
        partialNameMatches.push(course);
      }
    }
  }

  return [
    ...exactCodeMatches,
    ...startCodeMatches,
    ...partialCodeMatches,
    ...startNameMatches,
    ...partialNameMatches
  ].slice(0, limit);
}

/**
 * Silently refresh courses in the background from backend without blocking UI
 */
export async function syncCourseCatalogueInBackground() {
  try {
    const now = Date.now();
    const lastSync = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0', 10);
    // If synced recently and catalogue is already well populated, skip network call
    if (inMemoryCatalogue.length >= 100 && (now - lastSync) < SYNC_INTERVAL_MS) {
      return inMemoryCatalogue;
    }

    const res = await searchCourses('', 200);
    const remoteList = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : null);
    if (Array.isArray(remoteList) && remoteList.length > 0) {
      inMemoryCatalogue = remoteList;
      try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(remoteList));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, String(now));
      } catch (err) {
        // Storage quota full or restricted
      }
    }
  } catch (err) {
    console.warn('[CourseManager] Background course sync notice:', err?.message || err);
  }
  return inMemoryCatalogue;
}
