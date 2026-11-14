import { VIT_TIME_COLUMNS, VIT_TIMETABLE_DAYS } from '../data/sampleCourses.js';

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Build reverse lookup: SLOT_CODE -> Array<{ day, columnId, start, end, startMin, endMin }>
const SLOT_TO_PERIODS_MAP = {};

VIT_TIMETABLE_DAYS.forEach((dRow) => {
  const day = dRow.day.toUpperCase();
  Object.entries(dRow.slots || {}).forEach(([colId, code]) => {
    if (!code || colId === 'lunch') return;
    const normCode = String(code).trim().toUpperCase();
    const timeCol = VIT_TIME_COLUMNS.find((c) => c.id === colId);
    if (!timeCol || timeCol.isLunch) return;

    if (!SLOT_TO_PERIODS_MAP[normCode]) {
      SLOT_TO_PERIODS_MAP[normCode] = [];
    }

    SLOT_TO_PERIODS_MAP[normCode].push({
      slotCode: normCode,
      day,
      columnId: colId,
      start: timeCol.start,
      end: timeCol.end,
      startMin: toMinutes(timeCol.start),
      endMin: toMinutes(timeCol.end)
    });
  });
});

/**
 * Extracts all day/time periods occupied by a slot combination and/or teacher schedule.
 */
export function getPeriodsForSlot(slotString, teacherSchedule = []) {
  const periods = [];
  const seenKeys = new Set();

  // 1. Parse slot tokens from string (e.g. "A11+A12" or "B14+B23+D21")
  if (slotString && typeof slotString === 'string') {
    const tokens = slotString
      .split(/[+,/]/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s !== 'SCHEDULE NOT AVAILABLE' && s !== 'SLOT N/A');

    tokens.forEach((token) => {
      const mapped = SLOT_TO_PERIODS_MAP[token];
      if (mapped && mapped.length > 0) {
        mapped.forEach((p) => {
          const key = `${p.day}-${p.columnId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            periods.push({ ...p, slotCode: token });
          }
        });
      } else {
        // Fallback for custom or lab slot tokens without explicit grid entry
        const fallbackKey = `TOKEN-${token}`;
        if (!seenKeys.has(fallbackKey)) {
          seenKeys.add(fallbackKey);
          periods.push({
            slotCode: token,
            day: null,
            columnId: null,
            start: null,
            end: null,
            startMin: null,
            endMin: null
          });
        }
      }
    });
  }

  // 2. Parse from teacherSchedule if available
  if (Array.isArray(teacherSchedule)) {
    teacherSchedule.forEach((entry) => {
      if (!entry.day || !entry.startTime) return;
      const dayKey = String(entry.day).slice(0, 3).toUpperCase();
      const startMin = toMinutes(entry.startTime);
      const endMin = entry.endTime ? toMinutes(entry.endTime) : startMin + 90;

      // Check if this time matches any grid column
      let matchedCol = null;
      let minDelta = Infinity;
      for (const col of VIT_TIME_COLUMNS) {
        if (col.isLunch || !col.start) continue;
        const cStart = toMinutes(col.start);
        const delta = Math.abs(cStart - startMin);
        if (delta < minDelta && delta <= 30) {
          minDelta = delta;
          matchedCol = col;
        }
      }

      const colId = matchedCol ? matchedCol.id : null;
      const key = colId ? `${dayKey}-${colId}` : `${dayKey}-${startMin}-${endMin}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        periods.push({
          slotCode: entry.slot || 'SCHEDULE',
          day: dayKey,
          columnId: colId,
          start: entry.startTime,
          end: entry.endTime || '',
          startMin,
          endMin
        });
      }
    });
  }

  return periods;
}

/**
 * Checks whether two timetable periods overlap in day and time.
 */
export function checkPeriodsOverlap(periodA, periodB) {
  if (!periodA || !periodB) return false;

  // Direct token match (e.g. identical custom slots)
  if (periodA.slotCode && periodB.slotCode && periodA.slotCode === periodB.slotCode) {
    return true;
  }

  // If days are known and differ, they cannot overlap
  if (periodA.day && periodB.day && periodA.day !== periodB.day) {
    return false;
  }

  // If both map to the same grid column on the same day
  if (periodA.day && periodB.day && periodA.day === periodB.day) {
    if (periodA.columnId && periodB.columnId) {
      return periodA.columnId === periodB.columnId;
    }

    // Time minutes interval overlap
    if (
      periodA.startMin !== null &&
      periodA.endMin !== null &&
      periodB.startMin !== null &&
      periodB.endMin !== null
    ) {
      return periodA.startMin < periodB.endMin && periodA.endMin > periodB.startMin;
    }
  }

  return false;
}

/**
 * Detects whether a candidate faculty's slot/schedule clashes with any previously
 * confirmed faculty for other courses.
 *
 * @param {Object} options
 * @param {string} options.candidateSlot - The candidate slot string (e.g. "A11+A12")
 * @param {Array}  options.candidateSchedule - The candidate's schedule array (optional)
 * @param {Object} options.confirmedFaculties - Map of courseId -> confirmed faculty object
 * @param {string} options.currentCourseId - ID of the course currently being edited (skipped)
 * @returns {Object} { hasClash, clashes, message, conflictingSlots }
 */
export function detectSlotClash({
  candidateSlot,
  candidateSchedule = [],
  confirmedFaculties = {},
  currentCourseId = null
}) {
  const candidatePeriods = getPeriodsForSlot(candidateSlot, candidateSchedule);
  if (candidatePeriods.length === 0) {
    return { hasClash: false, clashes: [], message: null, conflictingSlots: [] };
  }

  const clashes = [];
  const allConflictingSlots = new Set();

  Object.entries(confirmedFaculties).forEach(([courseId, fac]) => {
    // Skip evaluating the current course against its own prior selection
    if (currentCourseId && String(courseId) === String(currentCourseId)) {
      return;
    }
    if (!fac || !fac.slot) return;

    const confirmedPeriods = getPeriodsForSlot(fac.slot, fac.schedule);
    const conflictingSlotCodes = new Set();
    let isClashing = false;

    for (const cPeriod of candidatePeriods) {
      for (const confPeriod of confirmedPeriods) {
        if (checkPeriodsOverlap(cPeriod, confPeriod)) {
          isClashing = true;
          const code = cPeriod.slotCode || confPeriod.slotCode;
          if (code) conflictingSlotCodes.add(code);
        }
      }
    }

    if (isClashing) {
      conflictingSlotCodes.forEach((code) => allConflictingSlots.add(code));
      const courseTitle =
        fac.courseTitle || fac.subject || fac.courseCode || 'Another Course';

      clashes.push({
        courseId,
        courseCode: fac.courseCode || '',
        courseTitle,
        facultyName: fac.name || '',
        occupiedSlot: fac.slot || '',
        conflictingSlots: Array.from(conflictingSlotCodes)
      });
    }
  });

  if (clashes.length === 0) {
    return {
      hasClash: false,
      clashes: [],
      message: null,
      conflictingSlots: []
    };
  }

  // Generate clean, short human-readable message as requested:
  // e.g. "Clashes with Mathematics (A11 + A12)"
  const first = clashes[0];
  const message = `Clashes with ${first.courseTitle} (${first.occupiedSlot})`;

  return {
    hasClash: true,
    clashes,
    message,
    conflictingSlots: Array.from(allConflictingSlots)
  };
}

