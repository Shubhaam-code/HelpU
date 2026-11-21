import {
  normalizeCourseCode,
  normalizeCourseName,
  normalizeAcademicYear
} from '../utils/ffcs.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  constructor(message, code = 'GEMINI_ERROR', status = 502) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
  }
}

export function isGeminiConfigured() {
  return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

function getModel() {
  return String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
}

async function callGemini(parts, { responseMimeType = 'application/json' } = {}) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new GeminiError(
      'Gemini API is not configured on the server (GEMINI_API_KEY missing).',
      'GEMINI_NOT_CONFIGURED',
      503
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GEMINI_TIMEOUT_MS) || 120000);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(getModel())}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType,
          maxOutputTokens: 2500,
          thinkingConfig: { thinkingBudget: 0 }
        }
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload?.error?.message || `Gemini request failed with status ${response.status}`;
      throw new GeminiError(message, 'GEMINI_REQUEST_FAILED', 502);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim() || '';

    if (!text) {
      throw new GeminiError('Gemini returned an empty response.', 'GEMINI_EMPTY_RESPONSE', 502);
    }

    return { text, model: getModel() };
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error.name === 'AbortError') {
      throw new GeminiError('Gemini request timed out.', 'GEMINI_TIMEOUT', 504);
    }
    throw new GeminiError(error.message || 'Gemini request failed.', 'GEMINI_REQUEST_FAILED', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonResponse(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new GeminiError(
      'Gemini returned a response that is not valid JSON.',
      'GEMINI_INVALID_JSON',
      502
    );
  }
}

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || /^(null|undefined|n\/a|na|unknown|-)$/i.test(text)) return null;
  return text;
}

function normalizeTime(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const match = text.match(/(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i);
  if (!match) return text;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = (match[3] || '').toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const DAY_ALIASES = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday'
};

function normalizeDay(value) {
  const text = normalizeString(value);
  if (!text) return null;
  return DAY_ALIASES[text.toLowerCase().replace(/[^a-z]/g, '')] || text;
}

function sanitizeSchedule(rawSchedule, issues) {
  if (!Array.isArray(rawSchedule)) {
    if (rawSchedule) issues.add('schedule_not_array');
    return [];
  }

  const seen = new Set();
  const schedule = [];

  for (const raw of rawSchedule) {
    if (!raw || typeof raw !== 'object') continue;
    const slot = normalizeString(raw.slot);
    const day = normalizeDay(raw.day);
    const startTime = normalizeTime(raw.startTime ?? raw.start);
    const endTime = normalizeTime(raw.endTime ?? raw.end);
    const room = normalizeString(raw.room ?? raw.classroom ?? raw.roomNumber ?? raw.venue);

    if (!slot && (!day || !startTime || !endTime) && !room) {
      issues.add('incomplete_schedule_entry');
      continue;
    }

    const key = `${(slot || '').toLowerCase()}|${(day || '').toLowerCase()}|${startTime || ''}|${endTime || ''}|${(room || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    schedule.push({
      slot: slot || null,
      day: day || null,
      startTime: startTime || null,
      endTime: endTime || null,
      room: room || null
    });
  }

  return schedule;
}

/**
 * Validate and normalize a Gemini teacher extraction payload against the
 * selected academic identity. Missing values stay null; they are never guessed.
 */
export function validateTeacherExtraction(payload, context = {}) {
  const issues = new Set();
  const raw = payload && typeof payload === 'object' ? payload : {};
  const teachersRaw = Array.isArray(raw.teachers) ? raw.teachers : [];

  const courseCode = normalizeCourseCode(raw.courseCode || context.courseCode);
  const courseName = normalizeString(raw.courseName || context.courseName);
  const semester =
    raw.semester === null || raw.semester === undefined ? null : Number(raw.semester);
  const academicYear = normalizeAcademicYear(raw.academicYear || context.academicYear);

  if (!courseCode) issues.add('course_code_missing');
  if (context.courseCode && courseCode && courseCode !== normalizeCourseCode(context.courseCode)) {
    issues.add('course_code_mismatch');
  }
  if (!courseName) issues.add('course_name_missing');
  if (semester === null) issues.add('semester_missing');
  if (context.semester && semester !== null && Number(context.semester) !== semester) {
    issues.add('semester_mismatch');
  }
  if (!academicYear) issues.add('academic_year_missing');

  const seenTeachers = new Set();
  const teachers = [];

  for (const entry of teachersRaw) {
    if (!entry || typeof entry !== 'object') continue;

    const name = normalizeString(entry.name ?? entry.teacherName ?? entry.facultyName);
    const subject = normalizeString(entry.subject ?? entry.subjectName) || courseName || null;
    const slot = normalizeString(entry.slot);
    const venue = normalizeString(entry.venue ?? entry.room);
    const courseType = normalizeString(entry.courseType);
    const availableSeats = Number.isInteger(entry.availableSeats) ? entry.availableSeats : null;
    const totalSeats = Number.isInteger(entry.totalSeats) ? entry.totalSeats : null;
    let schedule = sanitizeSchedule(entry.schedule ?? entry.slots, issues);

    if (schedule.length === 0 && (slot || venue)) {
      schedule = [{
        slot: slot || null,
        day: null,
        startTime: null,
        endTime: null,
        room: venue || null
      }];
    }

    if (!name) {
      issues.add('teacher_name_missing');
      continue;
    }
    if (schedule.length === 0) {
      issues.add('teacher_schedule_missing');
    }

    const key = `${normalizeCourseName(name)}|${normalizeCourseName(subject || '')}|${(slot || '').toLowerCase()}`;
    if (seenTeachers.has(key)) continue;
    seenTeachers.add(key);

    teachers.push({
      name,
      subject,
      slot: slot || null,
      venue: venue || null,
      courseType: courseType || null,
      availableSeats,
      totalSeats,
      schedule
    });
  }

  if (teachers.length === 0) issues.add('no_teachers_extracted');

  const issueList = Array.from(issues);
  const confidence = Math.max(0, Math.min(1, 0.92 - issueList.length * 0.08));
  const isComplete = issueList.length === 0 && teachers.length > 0;

  return {
    data: {
      courseCode: courseCode || null,
      courseName: courseName || null,
      semester: Number.isInteger(semester) ? semester : null,
      academicYear: academicYear || null,
      teachers
    },
    issues: issueList,
    confidence,
    extractionStatus: isComplete ? 'completed' : 'needs_review',
    reviewStatus: isComplete ? 'verified' : 'needs_review',
    isComplete
  };
}

export async function extractTeachersFromImages({ images = [], context = {} }) {
  const prompt = [
    'Extract FFCS university faculty and timetable slot data from screenshot(s) or PDF document(s).',
    'Return ONLY valid, compact JSON matching this exact structure:',
    '{"courseCode": string|null, "courseName": string|null, "semester": number|null, "academicYear": string|null, "teachers": [{"name": string, "slot": string|null, "venue": string|null, "courseType": string|null, "schedule": [{"slot": string|null, "day": string|null, "startTime": "HH:MM"|null, "endTime": "HH:MM"|null, "room": string|null}]}]}',
    `Expected course code: ${context.courseCode || 'unknown'}`,
    `Expected course name: ${context.courseName || 'unknown'}`,
    'Rules:',
    '- Extract every faculty/teacher row visible in the timetable, table, or PDF pages.',
    '- For PDF documents, parse the course timetable schedules and classroom venues.',
    '- Never invent teacher names. Deduplicate rows.',
    '- Keep output compact and do not include unnecessary verbose explanation.'
  ].join('\n');

  const parts = [{ text: prompt }];
  for (const image of images) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: Buffer.from(image.buffer).toString('base64')
      }
    });
  }

  const { text, model } = await callGemini(parts);
  const parsed = parseJsonResponse(text);
  const validated = validateTeacherExtraction(parsed, context);

  return { ...validated, raw: parsed, model };
}

export async function extractCurriculumFromPdf({ buffer, originalName = 'curriculum.pdf' }) {
  const prompt = [
    'Extract every course row from this university curriculum PDF.',
    'Return ONLY valid JSON:',
    '{"courses":[{"courseCode": string|null, "courseName": string|null, "semester": number|null, "credits": number|null, "category": string|null, "courseType": string|null}]}',
    'Rules:',
    '- Preserve the original course names exactly; do not invent or rename courses.',
    '- Only populate semester when the PDF explicitly contains semester information.',
    '- Use null for anything not present in the PDF.',
    '- Deduplicate repeated course rows.'
  ].join('\n');

  const { text, model } = await callGemini([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: Buffer.from(buffer).toString('base64')
      }
    }
  ]);

  const parsed = parseJsonResponse(text);
  const courses = Array.isArray(parsed?.courses) ? parsed.courses : [];

  return { courses, model, originalName };
}
