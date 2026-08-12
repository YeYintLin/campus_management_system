// services/core/src/utils/parseTimetable.js
//
// Parses the "Technological University (Hmawbi)" style timetable workbook
// into structured JSON. Works for any number of semesters per year — the
// output is just an array of { year, semester, days, legend, ... } blocks,
// one per sheet, so a curriculum with 4 semesters produces 4 blocks with
// zero code changes.

const ExcelJS = require('exceljs');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ROMAN_MAP = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const ORDINAL_WORD_MAP = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 };

/**
 * Converts a label like "II", "Semester IV", "First Semester", "Second sem"
 * into a plain integer, so the UI can match on numbers instead of free text
 * that varies sheet-to-sheet. Returns null if nothing recognizable is found.
 */
function extractNumber(label) {
  if (!label) return null;
  const text = label.trim();

  // Ordinal word form: "First Semester", "Second sem", etc.
  const wordMatch = text.match(/\b(first|second|third|fourth|fifth|sixth)\b/i);
  if (wordMatch) return ORDINAL_WORD_MAP[wordMatch[1].toLowerCase()];

  // Roman numeral form: a standalone whole word, e.g. "II" in "Semester II"
  const ROMAN_STRICT = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
  const words = text.split(/[^A-Za-z]+/).filter(Boolean);
  for (const w of words) {
    if (ROMAN_STRICT.test(w) && ROMAN_MAP[w.toUpperCase()]) {
      return ROMAN_MAP[w.toUpperCase()];
    }
  }

  // Plain digit fallback: "Semester 4"
  const digitMatch = text.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  return null;
}

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

function parseRow4Title(text) {
    if (!text) return { yearNum: 2, yearLabel: '2nd Year', semNum: 2, semLabel: 'Semester 2' };

    const parenIndex = text.indexOf('(');
    let yearPart = text;
    let semPart = text;

    if (parenIndex !== -1) {
        yearPart = text.substring(0, parenIndex).trim();
        const closeParenIndex = text.indexOf(')', parenIndex);
        if (closeParenIndex !== -1) {
            semPart = text.substring(parenIndex + 1, closeParenIndex).trim();
        } else {
            semPart = text.substring(parenIndex + 1).trim();
        }
    }

    // 1. Detect Year ONLY from text before parenthesis
    const cleanY = yearPart.toUpperCase();
    let yearNum = null;
    let yearLabel = null;

    if (/\bVI\b/.test(cleanY) || cleanY.includes('SIXTH') || cleanY.includes('6TH') || cleanY.includes('6')) {
        yearNum = 6; yearLabel = '6th Year';
    } else if (/\bV\b/.test(cleanY) || cleanY.includes('FIFTH') || cleanY.includes('5TH') || cleanY.includes('5')) {
        yearNum = 5; yearLabel = '5th Year';
    } else if (/\bIV\b/.test(cleanY) || cleanY.includes('FOURTH') || cleanY.includes('4TH') || cleanY.includes('4')) {
        yearNum = 4; yearLabel = '4th Year';
    } else if (/\bIII\b/.test(cleanY) || cleanY.includes('THIRD') || cleanY.includes('3RD') || cleanY.includes('3')) {
        yearNum = 3; yearLabel = '3rd Year';
    } else if (/\bII\b/.test(cleanY) || cleanY.includes('SECOND') || cleanY.includes('2ND') || cleanY.includes('2')) {
        yearNum = 2; yearLabel = '2nd Year';
    } else if (/\bI\b/.test(cleanY) || cleanY.includes('FIRST') || cleanY.includes('1ST') || cleanY.includes('1')) {
        yearNum = 1; yearLabel = '1st Year';
    } else if (cleanY.includes('ME') || cleanY.includes('MASTER')) {
        yearNum = 7; yearLabel = 'ME Program';
    }

    if (!yearNum) {
        yearNum = 2; yearLabel = '2nd Year';
    }

    // 2. Detect Semester ONLY from text inside parenthesis
    const cleanS = semPart.toUpperCase();
    let semNum = 2;
    let semLabel = 'Semester 2';

    if (
        /\b(2|4|6|8|10)\b/.test(cleanS) ||
        /\b(II|IV|VI|VIII|X)\b/.test(cleanS) ||
        cleanS.includes('SECOND') ||
        cleanS.includes('SEM 2') ||
        cleanS.includes('SEM 4') ||
        cleanS.includes('S2') ||
        cleanS.includes('S4')
    ) {
        semNum = 2;
        semLabel = 'Semester 2';
    } else if (
        /\b(1|3|5|7|9)\b/.test(cleanS) ||
        /\b(I|III|V|VII|IX)\b/.test(cleanS) ||
        cleanS.includes('FIRST') ||
        cleanS.includes('SEM 1') ||
        cleanS.includes('SEM 3') ||
        cleanS.includes('S1') ||
        cleanS.includes('S3')
    ) {
        semNum = 1;
        semLabel = 'Semester 1';
    }

    return { yearNum, yearLabel, semNum, semLabel };
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

  const rawRow4 = yearSemesterRaw || `${worksheet.name} ${titleLines.join(' ')}`;
  const parsedTitleInfo = parseRow4Title(rawRow4);

  const yearLabel = parsedTitleInfo.yearLabel;
  const yearNum = parsedTitleInfo.yearNum;
  const semesterLabel = parsedTitleInfo.semLabel;
  const semesterNum = parsedTitleInfo.semNum;

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
    const rowCells = [];
    for (let col = 1; col <= worksheet.columnCount; col++) {
      const txt = cellText(worksheet, rr, col);
      if (txt && txt.trim()) rowCells.push(txt.trim());
    }

    if (rowCells.length === 0) continue;

    const firstCell = rowCells[0];
    const m = firstCell.match(/^\((\d+)\)\s*(.+)$/);
    if (m) {
      let code = '';
      let subject = '';
      let teacher = '';

      if (rowCells.length >= 3) {
        code = m[2].trim().split(/\s+/)[0];
        subject = rowCells[1].trim();
        teacher = rowCells[rowCells.length - 1].trim();
      } else if (rowCells.length === 2) {
        code = m[2].trim().split(/\s+/)[0];
        subject = rowCells[1].trim();
        teacher = '';
      } else {
        const rest = m[2].trim();
        const parts = rest.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          code = parts[0];
          subject = parts.slice(1, parts.length - 1).join(' ');
          teacher = parts[parts.length - 1];
        } else if (parts.length === 2) {
          code = parts[0];
          subject = parts[1];
        } else {
          const subParts = rest.split(/\s+/);
          code = subParts[0];
          if (subParts.length > 2 && /^(daw|u|dr|prof)/i.test(subParts[subParts.length - 1])) {
            teacher = subParts.slice(-3).join(' ');
            subject = subParts.slice(1, -3).join(' ');
          } else {
            subject = subParts.slice(1).join(' ');
          }
        }
      }

      code = code.replace(/^\(\d+\)\s*/, '').trim();
      if (subject) {
        subject = subject.replace(/^\(\d+\)\s*/, '');
        if (subject.toUpperCase().startsWith(code.toUpperCase())) {
          subject = subject.substring(code.length).trim();
        }
        if (teacher && subject.toLowerCase().endsWith(teacher.toLowerCase())) {
          subject = subject.substring(0, subject.length - teacher.length).trim();
        }
      }

      legend.push({
        code: code,
        subject: subject || code,
        teacher: teacher ? teacher.trim() : null
      });
    }
  }

  return {
    sheet_name: worksheet.name.trim(),
    university: titleLines[0] || null,
    academic_year: academicYear,
    department,
    year_label: yearLabel,
    year_number: yearNum,
    semester_label: semesterLabel,
    semester_number: semesterNum,
    major_room: majorRoom,
    combined_room: combinedRoom,
    family_teacher: familyTeacher,
    periods: periods.map((p) => ({ period: p.period, time: p.time })),
    days,
    legend,
  };
}

function parseScheduleListSheet(worksheet, headerRowIndex) {
  const titleLines = [];
  for (let r = 1; r < headerRowIndex; r++) {
    const v = cellText(worksheet, r, 1);
    if (v && String(v).trim()) titleLines.push(String(v).trim());
  }

  let academicYear = titleLines[2] || null;
  let timetableTitle = titleLines[3] || null;
  let department = titleLines[1] || 'Department of Mechatronic Engineering';

  const isTutorial = (timetableTitle || '').toLowerCase().includes('tutorial') || worksheet.name.toLowerCase().includes('tut');
  const sessionTypeDefault = isTutorial ? 'Tutorial' : 'Practical';

  const rows = [];
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const code = row.getCell(2).value ? String(row.getCell(2).value).trim() : '';
    if (!code || code.toLowerCase().startsWith('prepared') || code.toLowerCase().startsWith('approved')) continue;

    const yearVal = row.getCell(1).value ? String(row.getCell(1).value).trim() : '';
    const title = row.getCell(3).value ? String(row.getCell(3).value).trim() : '';
    const teacher = row.getCell(4).value ? String(row.getCell(4).value).trim() : '';
    const group = row.getCell(5).value ? String(row.getCell(5).value).trim() : '';
    const date = row.getCell(6).value ? String(row.getCell(6).value).trim() : '';
    const time = row.getCell(7).value ? String(row.getCell(7).value).trim() : '';
    const place = row.getCell(8).value ? String(row.getCell(8).value).trim() : '';

    rows.push({ year: yearVal, code, title, teacher, group, date, time, place });
  }

  if (rows.length === 0) return null;

  const sampleRow = rows[0];
  const yearNum = extractNumber(sampleRow.year);
  const yearLabel = sampleRow.year ? sampleRow.year + ' Year' : '4th Year';

  const dayMap = {};
  rows.forEach((r) => {
    const dayKey = r.date || 'Scheduled Date';
    if (!dayMap[dayKey]) dayMap[dayKey] = [];
    dayMap[dayKey].push({
      code: r.code,
      session_type: sessionTypeDefault,
      raw: `${r.title} (${r.group}) - ${r.place}`,
      time: [r.time],
      teacher: r.teacher,
      place: r.place,
      group: r.group
    });
  });

  const days = Object.entries(dayMap).map(([dayName, sessions]) => ({
    day: dayName,
    sessions
  }));

  const legend = Array.from(new Set(rows.map((r) => r.code))).map((code) => {
    const r = rows.find((x) => x.code === code);
    return { code: r.code, subject: r.title, teacher: r.teacher };
  });

  return {
    sheet_name: worksheet.name.trim(),
    academic_year: academicYear,
    department,
    year_label: yearLabel,
    year_number: yearNum,
    semester_label: academicYear && academicYear.includes('Second') ? 'Second Semester' : 'First Semester',
    semester_number: academicYear && academicYear.includes('Second') ? 2 : 1,
    periods: [{ period: 'Session 1', time: 'Scheduled Time' }],
    days,
    legend
  };
}

async function parseTimetableBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const result = [];
  workbook.eachSheet((worksheet) => {
    // Check if sheet is a Schedule List (Practical / Tutorial)
    let scheduleListHeaderRow = null;
    for (let r = 1; r <= 10; r++) {
      const rowVals = [];
      for (let c = 1; c <= 10; c++) {
        const v = cellText(worksheet, r, c);
        rowVals.push(v ? String(v).trim().toLowerCase() : '');
      }
      if (rowVals.some((v) => v.includes('subject code') || v.includes('tutorial title') || v.includes('practical title'))) {
        scheduleListHeaderRow = r;
        break;
      }
    }

    if (scheduleListHeaderRow) {
      const parsedList = parseScheduleListSheet(worksheet, scheduleListHeaderRow);
      if (parsedList && parsedList.days.length > 0) {
        result.push(parsedList);
      }
    } else {
      const parsed = parseSheet(worksheet);
      if (parsed && parsed.days.some((d) => d.sessions.length > 0)) {
        result.push(parsed);
      }
    }
  });
  return result;
}

module.exports = { parseTimetableBuffer };
