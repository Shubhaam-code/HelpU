export const VIT_TIME_COLUMNS = [
  { id: 't1', label: '08:30 - 10:00', start: '08:30', end: '10:00' },
  { id: 't2', label: '10:05 - 11:35', start: '10:05', end: '11:35' },
  { id: 't3', label: '11:40 - 13:10', start: '11:40', end: '13:10' },
  { id: 'lunch', label: 'Lunch', isLunch: true },
  { id: 't4', label: '13:15 - 14:45', start: '13:15', end: '14:45' },
  { id: 't5', label: '14:50 - 16:20', start: '14:50', end: '16:20' },
  { id: 't6', label: '16:25 - 17:55', start: '16:25', end: '17:55' },
  { id: 't7', label: '18:00 - 19:30', start: '18:00', end: '19:30' }
];

export const VIT_TIMETABLE_DAYS = [
  {
    day: 'MON',
    slots: { t1: 'A11', t2: 'B11', t3: 'C11', lunch: 'Lunch', t4: 'A21', t5: 'A14', t6: 'B21', t7: 'C21' }
  },
  {
    day: 'TUE',
    slots: { t1: 'D11', t2: 'E11', t3: 'F11', lunch: 'Lunch', t4: 'D21', t5: 'E14', t6: 'E21', t7: 'F21' }
  },
  {
    day: 'WED',
    slots: { t1: 'A12', t2: 'B12', t3: 'C12', lunch: 'Lunch', t4: 'A22', t5: 'B14', t6: 'B22', t7: 'A24' }
  },
  {
    day: 'THU',
    slots: { t1: 'D12', t2: 'E12', t3: 'F12', lunch: 'Lunch', t4: 'D22', t5: 'F14', t6: 'E22', t7: 'F22' }
  },
  {
    day: 'FRI',
    slots: { t1: 'A13', t2: 'B13', t3: 'C13', lunch: 'Lunch', t4: 'A23', t5: 'C14', t6: 'B23', t7: 'B24' }
  },
  {
    day: 'SAT',
    slots: { t1: 'D13', t2: 'E13', t3: 'F13', lunch: 'Lunch', t4: 'D23', t5: 'D14', t6: 'D24', t7: 'E23' }
  }
];

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

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

export function getPeriodsForSlot(slotString, teacherSchedule = []) {
  const periods = [];
  const seenKeys = new Set();

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

  if (Array.isArray(teacherSchedule)) {
    teacherSchedule.forEach((entry) => {
      if (!entry.day || !entry.startTime) return;
      const dayKey = String(entry.day).slice(0, 3).toUpperCase();
      const startMin = toMinutes(entry.startTime);
      const endMin = entry.endTime ? toMinutes(entry.endTime) : startMin + 90;

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

export function checkPeriodsOverlap(periodA, periodB) {
  if (!periodA || !periodB) return false;
  if (periodA.slotCode && periodB.slotCode && periodA.slotCode === periodB.slotCode) {
    return true;
  }
  if (periodA.day && periodB.day && periodA.day !== periodB.day) {
    return false;
  }
  if (periodA.day && periodB.day && periodA.day === periodB.day) {
    if (periodA.columnId && periodB.columnId) {
      return periodA.columnId === periodB.columnId;
    }
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

  const first = clashes[0];
  const message = `Clashes with ${first.courseTitle} (${first.occupiedSlot})`;

  return {
    hasClash: true,
    clashes,
    message,
    conflictingSlots: Array.from(allConflictingSlots)
  };
}

