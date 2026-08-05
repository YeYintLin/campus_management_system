// services/core/src/utils/parseTimetable.js
const ExcelJS = require('exceljs');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Given a worksheet and a row/col, return the merged range that cell belongs to.
 */
function getMergedRange(mergeList, row, col) {
  for (const m of mergeList) {
    if (row >= m.top && row <= m.bottom && col >= m.left && col <= m.right) {
      return m;
    }
  }
  return { top: row, bottom: row, left: col, right: col };
}

function colLetterToNumber(letters) {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col;
}

function rangeToBounds(startAddr, endAddr) {
  const parse = (addr) => {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    return { col: colLetterToNumber(m[1]), row: parseInt(m[2], 10) };
  };
  const s = parse(startAddr);
  const e = parse(endAddr);
  return { top: s.row, bottom: e.row, left: s.col, right: e.col };
}

function getMergeList(worksheet) {
  const merges = worksheet.model.merges || [];
  return merges.map((rangeStr) => {
    const [start, end] = rangeStr.split(':');
    return rangeToBounds(start, end);
  });
}

function cellText(worksheet, row, col) {
  const v = worksheet.getRow(row).getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.richText) {
    return v.richText.map((t) => t.text).join('');
  }
  return String(v);
}

function cellTextIfOwn(worksheet, merges, row, col) {
  const range = getMergedRange(merges, row, col);
  const isSoleCell = range.top === row && range.bottom === row && range.left === col && range.right === col;
  const isMasterOfMerge = range.top === row && range.left === col && !isSoleCell;
  if (isSoleCell || isMasterOfMerge) return cellText(worksheet, row, col);
  return null;
}

function parseSheet(worksheet) {
  const merges = getMergeList(worksheet);

  // ---- Title block (rows 1-5) ----
  const titleLines = [];
  for (let r = 1; r <= 5; r++) {
    const v = cellText(worksheet, r, 1);
    if (v && v.trim()) titleLines.push(v.trim());
  }

  let academicYear = null, department = null, yearSemesterRaw = null, majorRoomRaw = null;
  for (const line of titleLines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('timetable for') && lower.includes('academic year')) academicYear = line;
    else if (lower.startsWith('department')) department = line;
    else if (lower.startsWith('timetable for')) yearSemesterRaw = line;
    else if (lower.includes('major room')) majorRoomRaw = line;
  }

  let yearLabel = null, semesterLabel = null;
  if (yearSemesterRaw) {
    const m = yearSemesterRaw.match(/for\s+(.*?)\s*MC/i);
    if (m) yearLabel = m[1].trim();
    const m2 = yearSemesterRaw.match(/\((.*?)\)/);
    if (m2) semesterLabel = m2[1].trim();
  }

  // Fallback sheet name matching if title line yearLabel missing
  const sName = worksheet.name.trim();
  if (!yearLabel) {
    if (sName.match(/\b(me|master)\b/i)) yearLabel = 'ME Program';
    else if (sName.match(/\b(fifth|5th|v)\b/i)) yearLabel = '5th Year';
    else if (sName.match(/\b(fourth|4th|iv)\b/i)) yearLabel = '4th Year';
    else if (sName.match(/\b(third|3rd|iii)\b/i)) yearLabel = '3rd Year';
    else if (sName.match(/\b(second|2nd|ii)\b/i)) yearLabel = '2nd Year';
    else if (sName.match(/\b(first|1st|i)\b/i)) yearLabel = '1st Year';
  } else {
    // Normalize yearLabel to standard CMS string format
    if (yearLabel === 'I' || yearLabel === 'First') yearLabel = '1st Year';
    else if (yearLabel === 'II' || yearLabel === 'Second') yearLabel = '2nd Year';
    else if (yearLabel === 'III' || yearLabel === 'Third') yearLabel = '3rd Year';
    else if (yearLabel === 'IV' || yearLabel === 'Fourth') yearLabel = '4th Year';
    else if (yearLabel === 'V' || yearLabel === 'Fifth') yearLabel = '5th Year';
    else if (yearLabel === 'ME') yearLabel = 'ME Program';
  }

  if (!semesterLabel) {
    if (sName.match(/\b(s1|sem\s*1|sem\s*i|first\s*semester|first\s*sem)\b/i)) semesterLabel = 'Semester 1';
    else if (sName.match(/\b(s2|sem\s*2|sem\s*ii|second\s*semester|second\s*sem)\b/i)) semesterLabel = 'Semester 2';
    else if (sName.match(/\b(s3|sem\s*3|sem\s*iii|third\s*semester)\b/i)) semesterLabel = 'Semester 3';
    else if (sName.match(/\b(s4|sem\s*4|sem\s*iv|fourth\s*semester)\b/i)) semesterLabel = 'Semester 4';
    else semesterLabel = 'Semester 2';
  } else {
    if (semesterLabel.match(/\b(semester i|sem i|semester 1|sem 1|first semester)\b/i)) semesterLabel = 'Semester 1';
    else if (semesterLabel.match(/\b(semester ii|sem ii|semester 2|sem 2|second semester)\b/i)) semesterLabel = 'Semester 2';
    else if (semesterLabel.match(/\b(semester iii|sem iii|semester 3|sem 3|third semester)\b/i)) semesterLabel = 'Semester 3';
    else if (semesterLabel.match(/\b(semester iv|sem iv|semester 4|sem 4|fourth semester)\b/i)) semesterLabel = 'Semester 4';
  }

  let majorRoom = null, combinedRoom = null;
  if (majorRoomRaw) {
    const mm = majorRoomRaw.match(/Major Room\s*\((.*?)\)/i);
    if (mm) majorRoom = mm[1].trim();
    const cm = majorRoomRaw.match(/Combin\w*[^(]*\((.*?)\)/i);
    if (cm) combinedRoom = cm[1].trim();
  }

  // ---- Find header row containing "Day" ----
  let headerRow = null;
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const v = cellText(worksheet, r, 1);
    if (v && v.trim().toLowerCase() === 'day') { headerRow = r; break; }
  }
  if (headerRow === null) return null; // blank template, skip

  // ---- Periods ----
  const periods = [];
  for (let c = 2; c <= worksheet.columnCount; c++) {
    const v = cellText(worksheet, headerRow, c);
    if (v && v.trim()) {
      if (v.toLowerCase().includes('lunch')) continue;
      const parts = v.split('\n');
      periods.push({ col: c, period: parts[0].trim(), time: (parts[1] || '').trim() });
    }
  }

  // ---- Day rows ----
  const days = [];
  let r = headerRow + 1;
  let blankStreak = 0;
  while (r <= worksheet.rowCount && blankStreak < 4) {
    const dayName = (cellText(worksheet, r, 1) || '').trim();
    if (!dayName) { blankStreak++; r++; continue; }
    if (dayName.toLowerCase().startsWith('family teacher')) break;
    if (!DAY_NAMES.includes(dayName)) { r++; continue; }
    blankStreak = 0;

    const sessions = [];
    const seenCols = new Set();
    for (const p of periods) {
      if (seenCols.has(p.col)) continue;
      const range = getMergedRange(merges, r, p.col);
      for (let cc = range.left; cc <= range.right; cc++) seenCols.add(cc);
      const val = cellText(worksheet, r, p.col);
      if (!val || !val.trim()) continue;
      const coveredPeriods = periods.filter((pp) => pp.col >= range.left && pp.col <= range.right).map((pp) => pp.period);
      const coveredTimes = periods.filter((pp) => pp.col >= range.left && pp.col <= range.right).map((pp) => pp.time);
      const raw = val.trim();
      const codeMatch = raw.match(/^(.*?)\(([LTP])\)\s*$/);
      let code = raw, sessionType = null;
      if (codeMatch) {
        code = codeMatch[1].trim();
        sessionType = { L: 'Lecture', T: 'Tutorial', P: 'Practical' }[codeMatch[2]];
      }
      sessions.push({ periods: coveredPeriods, time: coveredTimes, code, session_type: sessionType, raw });
    }
    days.push({ day: dayName, sessions });
    r++;
  }

  // ---- Family teacher ----
  let familyTeacher = null;
  while (r <= worksheet.rowCount) {
    const v = cellText(worksheet, r, 1);
    if (v && v.toLowerCase().includes('family teacher')) {
      familyTeacher = v.split('-').slice(1).join('-').trim();
      r++;
      break;
    }
    r++;
  }

  // ---- Legend: (n)CODE | subject | teacher ----
  const legend = [];
  for (let rr = r; rr <= worksheet.rowCount; rr++) {
    const codeCell = cellText(worksheet, rr, 1);
    if (!codeCell || !codeCell.trim()) continue;
    const m = codeCell.trim().match(/^\((\d+)\)\s*(.+)$/);
    if (!m) continue;
    let code = m[2].trim();
    let subject = cellTextIfOwn(worksheet, merges, rr, 3);
    let teacher = cellTextIfOwn(worksheet, merges, rr, 6);
    if (!subject && !teacher) {
      const rest = codeCell.trim().replace(/^\(\d+\)\s*/, '');
      const bits = rest.split(/\s{2,}|\t|\s+-\s+/).map((b) => b.trim()).filter(Boolean);
      if (bits.length >= 3) { code = bits[0]; subject = bits[1]; teacher = bits[bits.length - 1]; }
      else if (bits.length === 2) { code = bits[0]; subject = bits[1]; }
    }
    legend.push({ code: code.trim(), subject: subject ? subject.trim() : null, teacher: teacher ? teacher.trim() : null });
  }

  return {
    sheet_name: worksheet.name.trim(),
    university: titleLines[0] || null,
    academic_year: academicYear,
    department,
    year_label: yearLabel,
    semester_label: semesterLabel,
    major_room: majorRoom,
    combined_room: combinedRoom,
    family_teacher: familyTeacher,
    periods: periods.map((p) => ({ period: p.period, time: p.time })),
    days,
    legend,
  };
}

/**
 * Parse an uploaded .xlsx file buffer into an array of timetable blocks.
 * @param {Buffer} buffer
 * @returns {Promise<Array>}
 */
async function parseTimetableBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const result = [];
  workbook.eachSheet((worksheet) => {
    const parsed = parseSheet(worksheet);
    if (parsed && parsed.days.some((d) => d.sessions.length > 0)) {
      result.push(parsed);
    }
  });
  return result;
}

module.exports = { parseTimetableBuffer };
