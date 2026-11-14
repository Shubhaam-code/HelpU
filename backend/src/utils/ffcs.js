const INSTITUTION_DEFAULT = 'VIT';

export function normalizeInstitution(value) {
  const text = String(value || '').trim().toUpperCase();
  return text || INSTITUTION_DEFAULT;
}

export function normalizeCourseCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizeCourseName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAcademicYear(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (match) {
    const start = match[1];
    const endRaw = match[2];
    const end = endRaw.length === 2 ? endRaw : endRaw.slice(-2);
    return `${start}-${end}`;
  }
  return text;
}

export function toSemesterNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isInteger(num) && num >= 1 && num <= 12) return num;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function academicKey({ institution, courseCode, semester, academicYear, curriculumVersion }) {
  return [
    normalizeInstitution(institution),
    normalizeCourseCode(courseCode),
    typeof semester === 'number' ? semester : String(semester || '').trim(),
    normalizeAcademicYear(academicYear),
    String(curriculumVersion || '').trim()
  ].join('|');
}

export function serializeTeacher(teacher) {
  if (!teacher) return null;
  return {
    name: teacher.name || null,
    subject: teacher.subject || null,
    slot: teacher.slot || null,
    venue: teacher.venue || null,
    courseType: teacher.courseType || null,
    availableSeats: teacher.availableSeats ?? null,
    totalSeats: teacher.totalSeats ?? null,
    schedule: Array.isArray(teacher.schedule)
      ? teacher.schedule.map((slot) => ({
          slot: slot?.slot || null,
          day: slot?.day || null,
          startTime: slot?.startTime || null,
          endTime: slot?.endTime || null,
          room: slot?.room || null
        }))
      : []
  };
}
