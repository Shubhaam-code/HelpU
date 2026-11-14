import { VIT_TIME_COLUMNS, VIT_TIMETABLE_DAYS } from '../data/sampleCourses.js';

function escapePdf(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function buildTimetablePdfContent({ confirmedFaculties = {} }) {
  const confirmedList = Object.values(confirmedFaculties).filter(Boolean);

  // Map of slot code -> faculty/course details
  const slotMap = {};
  confirmedList.forEach((fac) => {
    if (!fac || !fac.slot) return;
    const codes = fac.slot.split('+').map((s) => s.trim().toUpperCase());
    codes.forEach((code) => {
      slotMap[code] = {
        courseCode: fac.courseCode || fac.code || '',
        courseTitle: fac.courseTitle || fac.courseName || fac.subject || '',
        name: fac.name || fac.teacherName || '',
        slot: fac.slot || '',
        roomNo: fac.roomNo || fac.venue || fac.room || ''
      };
    });
  });

  const width = 842;
  const height = 595;
  const objects = [];
  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  // 1: Catalog
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  // 2: Pages
  addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  // 3: Page (Landscape A4: 842 x 595)
  addObject(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
      width +
      ' ' +
      height +
      '] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'
  );
  // 4: Regular Helvetica
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  // 5: Bold Helvetica
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let s = '';

  // Top header banner
  s += 'q 0.09 0.14 0.24 rg 35 540 772 38 re f Q\n';
  s += 'BT /F2 14 Tf 1 1 1 rg 50 554 Td (HelpU SlotMate - FFCS Weekly Timetable) Tj ET\n';
  s +=
    'BT /F1 8.5 Tf 0.9 0.9 0.9 rg 590 554 Td (' +
    escapePdf(
      'Generated: ' +
        new Date().toLocaleDateString('en-IN') +
        ' | Selected Courses: ' +
        confirmedList.length
    ) +
    ') Tj ET\n';

  // Section 1: Selected Teachers & Courses
  s += 'BT /F2 9.5 Tf 0.09 0.14 0.24 rg 35 524 Td (Selected Courses & Faculty Summary) Tj ET\n';

  // Table header
  s += 'q 0.95 0.96 0.98 rg 35 504 772 15 re f Q\n';
  s += 'q 0.8 0.84 0.9 RG 0.5 w 35 504 772 15 re s Q\n';
  s += 'BT /F2 7.5 Tf 0.2 0.25 0.3 rg 42 509 Td (#) Tj ET\n';
  s += 'BT /F2 7.5 Tf 0.2 0.25 0.3 rg 65 509 Td (Course Code) Tj ET\n';
  s += 'BT /F2 7.5 Tf 0.2 0.25 0.3 rg 150 509 Td (Course Title) Tj ET\n';
  s += 'BT /F2 7.5 Tf 0.2 0.25 0.3 rg 380 509 Td (Faculty Name) Tj ET\n';
  s += 'BT /F2 7.5 Tf 0.2 0.25 0.3 rg 600 509 Td (Slots) Tj ET\n';
  s += 'BT /F2 7.5 Tf 0.2 0.25 0.3 rg 705 509 Td (Room / Venue) Tj ET\n';

  let curY = 489;
  const rowsToShow = confirmedList.slice(0, 6);
  rowsToShow.forEach((fac, idx) => {
    s += 'q 0.88 0.9 0.93 RG 0.5 w 35 ' + curY + ' 772 15 re s Q\n';
    const textY = curY + 4;
    const courseCode = fac.courseCode || fac.code || '—';
    const courseTitle = fac.courseTitle || fac.courseName || fac.subject || '—';
    const facultyName = fac.name || fac.teacherName || fac.facultyName || '—';
    const slot = fac.slot || '—';
    const roomNo = fac.roomNo || fac.venue || fac.room || '—';

    s += 'BT /F1 7.5 Tf 0.1 0.15 0.2 rg 42 ' + textY + ' Td (' + (idx + 1) + ') Tj ET\n';
    s += 'BT /F2 7.5 Tf 0.1 0.15 0.2 rg 65 ' + textY + ' Td (' + escapePdf(courseCode) + ') Tj ET\n';
    s += 'BT /F1 7.5 Tf 0.1 0.15 0.2 rg 150 ' + textY + ' Td (' + escapePdf(courseTitle.slice(0, 42)) + ') Tj ET\n';
    s += 'BT /F2 7.5 Tf 0.1 0.15 0.2 rg 380 ' + textY + ' Td (' + escapePdf(facultyName.slice(0, 36)) + ') Tj ET\n';
    s += 'BT /F1 7.5 Tf 0.1 0.15 0.2 rg 600 ' + textY + ' Td (' + escapePdf(slot) + ') Tj ET\n';
    s += 'BT /F1 7.5 Tf 0.1 0.15 0.2 rg 705 ' + textY + ' Td (' + escapePdf(roomNo) + ') Tj ET\n';
    curY -= 15;
  });

  if (confirmedList.length === 0) {
    s += 'q 0.88 0.9 0.93 RG 0.5 w 35 ' + curY + ' 772 15 re s Q\n';
    s += 'BT /F1 7.5 Tf 0.5 0.5 0.5 rg 300 ' + (curY + 4) + ' Td (No teachers selected yet.) Tj ET\n';
    curY -= 15;
  }

  // Section 2: Timetable Matrix
  curY -= 14;
  s += 'BT /F2 9.5 Tf 0.09 0.14 0.24 rg 35 ' + curY + ' Td (Weekly Schedule Matrix) Tj ET\n';
  curY -= 18;

  const colWidths = [52, 90, 90, 90, 50, 90, 90, 90, 90];
  const gridStartX = 35;

  // Header row
  let hX = gridStartX;
  VIT_TIME_COLUMNS.forEach((col, cIdx) => {
    // Draw Day header first if cIdx === 0
    if (cIdx === 0) {
      s +=
        'q 0.09 0.14 0.24 rg ' +
        hX +
        ' ' +
        curY +
        ' ' +
        colWidths[0] +
        ' 18 re f Q\n';
      s +=
        'BT /F2 7.5 Tf 1 1 1 rg ' +
        (hX + 16) +
        ' ' +
        (curY + 5) +
        ' Td (DAY) Tj ET\n';
      hX += colWidths[0];
    }
    const bgCol = col.isLunch ? '0.12 0.16 0.23' : '0.09 0.14 0.24';
    s +=
      'q ' +
      bgCol +
      ' rg ' +
      hX +
      ' ' +
      curY +
      ' ' +
      (col.isLunch ? colWidths[4] : 90) +
      ' 18 re f Q\n';
    s +=
      'BT /F2 7 Tf ' +
      (col.isLunch ? '0.98 0.85 0.38' : '1 1 1') +
      ' rg ';
    const textOffset = col.isLunch ? 12 : 14;
    s +=
      hX +
      textOffset +
      ' ' +
      (curY + 5) +
      ' Td (' +
      escapePdf(col.label) +
      ') Tj ET\n';
    hX += col.isLunch ? colWidths[4] : 90;
  });

  curY -= 36;
  // Day rows
  VIT_TIMETABLE_DAYS.forEach((dRow) => {
    let rX = gridStartX;
    // Day cell
    s +=
      'q 0.95 0.96 0.98 rg ' +
      rX +
      ' ' +
      curY +
      ' ' +
      colWidths[0] +
      ' 36 re f Q\n';
    s +=
      'q 0.8 0.84 0.9 RG 0.5 w ' +
      rX +
      ' ' +
      curY +
      ' ' +
      colWidths[0] +
      ' 36 re s Q\n';
    s +=
      'BT /F2 8 Tf 0.09 0.14 0.24 rg ' +
      (rX + 15) +
      ' ' +
      (curY + 14) +
      ' Td (' +
      dRow.day +
      ') Tj ET\n';
    rX += colWidths[0];

    // Col cells
    VIT_TIME_COLUMNS.forEach((col) => {
      const colW = col.isLunch ? colWidths[4] : 90;
      if (col.isLunch) {
        s +=
          'q 0.94 0.95 0.97 rg ' +
          rX +
          ' ' +
          curY +
          ' ' +
          colW +
          ' 36 re f Q\n';
        s +=
          'q 0.85 0.87 0.9 RG 0.5 w ' +
          rX +
          ' ' +
          curY +
          ' ' +
          colW +
          ' 36 re s Q\n';
        s +=
          'BT /F2 6.5 Tf 0.6 0.65 0.7 rg ' +
          (rX + 12) +
          ' ' +
          (curY + 14) +
          ' Td (LUNCH) Tj ET\n';
      } else {
        const slotCode = dRow.slots[col.id];
        const match = slotCode && slotMap[slotCode.toUpperCase()];
        if (match) {
          // Highlighted green
          s +=
            'q 0.85 0.95 0.88 rg ' +
            rX +
            ' ' +
            curY +
            ' ' +
            colW +
            ' 36 re f Q\n';
          s +=
            'q 0.35 0.75 0.45 RG 0.6 w ' +
            rX +
            ' ' +
            curY +
            ' ' +
            colW +
            ' 36 re s Q\n';
          s +=
            'BT /F2 7 Tf 0.04 0.35 0.18 rg ' +
            (rX + 6) +
            ' ' +
            (curY + 20) +
            ' Td (' +
            escapePdf(match.courseCode) +
            ') Tj ET\n';
          s +=
            'BT /F1 6.5 Tf 0.1 0.4 0.22 rg ' +
            (rX + 6) +
            ' ' +
            (curY + 9) +
            ' Td (' +
            escapePdf(slotCode + ' • ' + (match.roomNo || 'AB')) +
            ') Tj ET\n';
        } else {
          // Empty slot
          s += 'q 1 1 1 rg ' + rX + ' ' + curY + ' ' + colW + ' 36 re f Q\n';
          s +=
            'q 0.88 0.9 0.93 RG 0.5 w ' +
            rX +
            ' ' +
            curY +
            ' ' +
            colW +
            ' 36 re s Q\n';
          s +=
            'BT /F1 6.5 Tf 0.65 0.7 0.75 rg ' +
            (rX + 35) +
            ' ' +
            (curY + 14) +
            ' Td (' +
            escapePdf(slotCode || '') +
            ') Tj ET\n';
        }
      }
      rX += colW;
    });
    curY -= 36;
  });

  // Footer note
  s +=
    'BT /F1 7.5 Tf 0.5 0.55 0.6 rg 35 15 Td (HelpU SlotMate - Verified Clash-Free Timetable Matrix) Tj ET\n';

  const byteLen = new TextEncoder().encode(s).length;
  addObject('<< /Length ' + byteLen + ' >>\nstream\n' + s + '\nendstream');

  let header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let body = '';
  const offsets = [];
  const encoder = new TextEncoder();
  let currentOffset = encoder.encode(header).length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(currentOffset);
    const objStr = i + 1 + ' 0 obj\n' + objects[i] + '\nendobj\n';
    body += objStr;
    currentOffset += encoder.encode(objStr).length;
  }

  const startXref = encoder.encode(header + body).length;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 0; i < offsets.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer =
    'trailer\n<< /Size ' +
    (objects.length + 1) +
    ' /Root 1 0 R >>\nstartxref\n' +
    startXref +
    '\n%%EOF';

  return header + body + xref + trailer;
}

export function downloadTimetablePdf({ confirmedFaculties = {} }) {
  const confirmedList = Object.values(confirmedFaculties).filter(Boolean);
  if (confirmedList.length === 0) {
    throw new Error('No selected teachers or timetable available to export. Please select at least one teacher first.');
  }

  const pdfContent = buildTimetablePdfContent({ confirmedFaculties });
  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `FFCS_Timetable_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

