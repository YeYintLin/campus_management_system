const XLSX = require('xlsx');

// Helper to convert time string (e.g. "09:00 AM", "9:00am", "08:30") to minutes from midnight
const parseTimeToMinutes = (timeStr = '') => {
    if (!timeStr) return 0;
    const cleaned = timeStr.toString().toLowerCase().trim();

    const isPM = cleaned.includes('pm') && !cleaned.includes('12:');
    const is12AM = cleaned.includes('am') && cleaned.includes('12:');

    const digits = cleaned.match(/(\d+):(\d+)/);
    if (!digits) return 0;

    let hours = parseInt(digits[1], 10);
    const minutes = parseInt(digits[2], 10);

    if (isPM && hours < 12) hours += 12;
    if (is12AM && hours === 12) hours = 0;

    return hours * 60 + minutes;
};

// Helper to format date string or Excel serial number into YYYY-MM-DD Date
const parseExcelDate = (cell) => {
    if (!cell) return null;

    if (cell.t === 'n' && typeof cell.v === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(cell.v);
        if (dateObj) {
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            return new Date(`${dateObj.y}-${m}-${d}`);
        }
    }

    const strVal = String(cell.v || '').trim();
    if (!strVal) return null;

    if (strVal.toLowerCase().includes('saturday') || strVal.toLowerCase().includes('sunday') || strVal.toLowerCase().includes('lunch break')) {
        return null;
    }

    const parts = strVal.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})/);
    if (parts) {
        const day = String(parts[1]).padStart(2, '0');
        const month = String(parts[2]).padStart(2, '0');
        const year = parts[3];
        return new Date(`${year}-${month}-${day}`);
    }

    const isoDate = new Date(strVal);
    if (!isNaN(isoDate.getTime())) return isoDate;

    return null;
};

/**
 * Enhanced Multi-Sheet Server-Side Excel Parser for TU Hmawbi Official Timetables
 * @param {Buffer} fileBuffer 
 * @param {String} targetCategory ('Academic' | 'Practical' | 'Tutorial' | 'Exam')
 */
const parseTUHmawbiExcel = (fileBuffer, targetCategory = 'Academic') => {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

    const allSessions = [];
    const allMatrix = [];
    let headerError = null;

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        if (!jsonRows || jsonRows.length === 0) return;

        const fullText = JSON.stringify(jsonRows).toLowerCase();
        
        const hasDayNames = jsonRows.some(row => Array.isArray(row) && row.some(cell => {
            const s = String(cell || '').toLowerCase().trim();
            return s === 'monday' || s === 'tuesday' || s === 'wednesday' || s === 'thursday' || s === 'friday' || s.startsWith('mon') || s.startsWith('tue') || s.startsWith('wed') || s.startsWith('thu') || s.startsWith('fri');
        }));

        let titleText = '';
        jsonRows.forEach(row => {
            if (!Array.isArray(row)) return;
            const lineStr = row.filter(Boolean).map(c => String(c).trim()).join(' ');
            if (lineStr.toLowerCase().includes('timetable for') || lineStr.toLowerCase().includes('technological university') || lineStr.toLowerCase().includes('department of')) {
                titleText = lineStr;
            }
        });

        const rawTitle = titleText || sheetName;
        const parenIndex = rawTitle.indexOf('(');
        let yearPart = rawTitle;
        let semPart = rawTitle;

        if (parenIndex !== -1) {
            yearPart = rawTitle.substring(0, parenIndex).trim();
            const closeParenIndex = rawTitle.indexOf(')', parenIndex);
            if (closeParenIndex !== -1) {
                semPart = rawTitle.substring(parenIndex + 1, closeParenIndex).trim();
            } else {
                semPart = rawTitle.substring(parenIndex + 1).trim();
            }
        }

        // 1. Detect Year
        const cleanY = yearPart.toUpperCase();
        let detectedYear = '3rd Year';

        if (/\bVI\b/.test(cleanY) || cleanY.includes('SIXTH') || cleanY.includes('6TH') || cleanY.includes('6')) {
            detectedYear = '6th Year';
        } else if (/\bV\b/.test(cleanY) || cleanY.includes('FIFTH') || cleanY.includes('5TH') || cleanY.includes('5')) {
            detectedYear = '5th Year';
        } else if (/\bIV\b/.test(cleanY) || cleanY.includes('FOURTH') || cleanY.includes('4TH') || cleanY.includes('4')) {
            detectedYear = '4th Year';
        } else if (/\bIII\b/.test(cleanY) || cleanY.includes('THIRD') || cleanY.includes('3RD') || cleanY.includes('3')) {
            detectedYear = '3rd Year';
        } else if (/\bII\b/.test(cleanY) || cleanY.includes('SECOND') || cleanY.includes('2ND') || cleanY.includes('2')) {
            detectedYear = '2nd Year';
        } else if (/\bI\b/.test(cleanY) || cleanY.includes('FIRST') || cleanY.includes('1ST') || cleanY.includes('1')) {
            detectedYear = '1st Year';
        } else if (cleanY.includes('ME') || cleanY.includes('MASTER')) {
            detectedYear = 'ME Program';
        }

        // 2. Detect Semester
        const cleanS = semPart.toUpperCase();
        let detectedSemester = 'Semester 1';

        if (
            /\b(2|4|6|8|10)\b/.test(cleanS) ||
            /\b(II|IV|VI|VIII|X)\b/.test(cleanS) ||
            cleanS.includes('SECOND') ||
            cleanS.includes('SEM 2') ||
            cleanS.includes('SEM 4') ||
            cleanS.includes('S2') ||
            cleanS.includes('S4')
        ) {
            detectedSemester = 'Semester 2';
        } else if (
            /\b(1|3|5|7|9)\b/.test(cleanS) ||
            /\b(I|III|V|VII|IX)\b/.test(cleanS) ||
            cleanS.includes('FIRST') ||
            cleanS.includes('SEM 1') ||
            cleanS.includes('SEM 3') ||
            cleanS.includes('S1') ||
            cleanS.includes('S3')
        ) {
            detectedSemester = 'Semester 1';
        }

        let majorRoom = '3/212-A';
        let familyTeacher = 'Faculty Member';

        jsonRows.forEach(row => {
            if (!Array.isArray(row)) return;
            const lineStr = row.filter(Boolean).map(c => String(c).trim()).join(' ');

            if (lineStr.toLowerCase().includes('major room')) {
                const match = lineStr.match(/major room\s*\(([^)]+)\)/i);
                if (match) majorRoom = match[1].trim();
            }

            if (lineStr.toLowerCase().includes('family teacher')) {
                const match = lineStr.match(/family teacher\s*[-:]?\s*(.+)/i);
                if (match) familyTeacher = match[1].trim();
            }
        });

        const isGridFormat = (targetCategory === 'Academic' || hasDayNames) && (fullText.includes('period') || fullText.includes('lunch') || fullText.includes('09:00') || fullText.includes('9:00') || hasDayNames);

        if (isGridFormat) {

            // Parse Legend Table at bottom for Course Codes, Names, and Teachers
            const courseLegend = {};
            jsonRows.forEach(row => {
                if (!Array.isArray(row) || row.length === 0) return;
                const nonEmp = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').map(c => String(c).trim());
                if (nonEmp.length === 0) return;

                const firstCell = nonEmp[0];
                const match = firstCell.match(/^\((\d+)\)\s*(.+)$/);
                if (match) {
                    let code = '';
                    let name = '';
                    let teacher = '';

                    if (nonEmp.length >= 3) {
                        code = match[2].trim().split(/\s+/)[0];
                        name = nonEmp[1].trim();
                        teacher = nonEmp[nonEmp.length - 1].trim();
                    } else if (nonEmp.length === 2) {
                        code = match[2].trim().split(/\s+/)[0];
                        name = nonEmp[1].trim();
                    } else {
                        const rest = match[2].trim();
                        const parts = rest.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
                        if (parts.length >= 3) {
                            code = parts[0];
                            name = parts.slice(1, parts.length - 1).join(' ');
                            teacher = parts[parts.length - 1];
                        } else if (parts.length === 2) {
                            code = parts[0];
                            name = parts[1];
                        } else {
                            const subParts = rest.split(/\s+/);
                            code = subParts[0];
                            if (subParts.length > 2 && /^(daw|u|dr|prof)/i.test(subParts[subParts.length - 1])) {
                                teacher = subParts.slice(-3).join(' ');
                                name = subParts.slice(1, -3).join(' ');
                            } else {
                                name = subParts.slice(1).join(' ');
                            }
                        }
                    }

                    code = code.replace(/^\(\d+\)\s*/, '').trim();
                    const cleanCodeKey = code.replace(/\s+/g, '').toUpperCase();
                    if (name) {
                        name = name.replace(/^\(\d+\)\s*/, '');
                        if (name.toUpperCase().startsWith(code.toUpperCase())) {
                            name = name.substring(code.length).trim();
                        }
                        if (teacher && name.toLowerCase().endsWith(teacher.toLowerCase())) {
                            name = name.substring(0, name.length - teacher.length).trim();
                        }
                    }

                    courseLegend[cleanCodeKey] = {
                        code: code,
                        name: name || code,
                        teacher: teacher ? teacher.trim() : ''
                    };
                }
            });

            const periodTimes = [
                { period: 1, start: '09:00 AM', end: '09:50 AM', startMin: 540, endMin: 590 },
                { period: 2, start: '10:00 AM', end: '10:50 AM', startMin: 600, endMin: 650 },
                { period: 3, start: '11:00 AM', end: '11:50 AM', startMin: 660, endMin: 710 },
                { period: 4, start: '01:00 PM', end: '01:50 PM', startMin: 780, endMin: 830 },
                { period: 5, start: '02:00 PM', end: '02:50 PM', startMin: 840, endMin: 890 },
                { period: 6, start: '03:00 PM', end: '03:50 PM', startMin: 900, endMin: 950 }
            ];

            const matchDayName = (str = '') => {
                const s = String(str).toLowerCase().trim();
                if (s.includes('mon')) return 'Monday';
                if (s.includes('tue')) return 'Tuesday';
                if (s.includes('wed')) return 'Wednesday';
                if (s.includes('thu')) return 'Thursday';
                if (s.includes('fri')) return 'Friday';
                return null;
            };

            jsonRows.forEach(row => {
                if (!Array.isArray(row) || row.length === 0) return;
                let matchedDay = null;
                let dayColIdx = -1;
                for (let i = 0; i < Math.min(row.length, 5); i++) {
                    const d = matchDayName(row[i]);
                    if (d) {
                        matchedDay = d;
                        dayColIdx = i;
                        break;
                    }
                }
                if (!matchedDay) return;

                let periodIdx = 0;
                for (let c = dayColIdx + 1; c < row.length; c++) {
                    const cellVal = String(row[c] || '').trim();
                    if (!cellVal || cellVal.toLowerCase().includes('lunch break')) continue;

                    if (periodIdx < periodTimes.length) {
                        const pInfo = periodTimes[periodIdx];

                        let sessionType = targetCategory || 'Lecture';
                        let cleanCode = cellVal;
                        if (cellVal.includes('(L)')) { sessionType = targetCategory === 'Academic' ? 'Lecture' : targetCategory; cleanCode = cellVal.replace('(L)', '').trim(); }
                        else if (cellVal.includes('(T)')) { sessionType = targetCategory === 'Academic' ? 'Tutorial' : targetCategory; cleanCode = cellVal.replace('(T)', '').trim(); }
                        else if (cellVal.includes('(P)')) { sessionType = targetCategory === 'Academic' ? 'Practical' : targetCategory; cleanCode = cellVal.replace('(P)', '').trim(); }

                        const legendInfo = courseLegend[cleanCode.replace(/\s+/g, '')] || {};

                        const slotItem = {
                            year: detectedYear,
                            semester: detectedSemester,
                            major: 'MC',
                            majorRoom,
                            familyTeacher,
                            day: matchedDay,
                            periodNumber: pInfo.period,
                            startTime: pInfo.start,
                            endTime: pInfo.end,
                            startTimeMinutes: pInfo.startMin,
                            endTimeMinutes: pInfo.endMin,
                            courseCode: cleanCode,
                            courseName: legendInfo.name || cleanCode,
                            teacher: legendInfo.teacher || familyTeacher,
                            room: majorRoom,
                            type: sessionType,
                            sessionLabel: sessionType
                        };

                        allMatrix.push(slotItem);

                        // Populate allSessions for Practical/Tutorial imports
                        allSessions.push({
                            year: detectedYear,
                            semester: detectedSemester,
                            major: 'MC',
                            sessionType: (targetCategory === 'Practical' || targetCategory === 'Tutorial') ? targetCategory : sessionType,
                            examType: 'N/A',
                            courseCode: cleanCode,
                            courseName: legendInfo.name || cleanCode,
                            title: legendInfo.name || cleanCode,
                            teacher: legendInfo.teacher || familyTeacher,
                            groupTag: 'All',
                            date: new Date().toISOString(),
                            day: matchedDay,
                            startTime: pInfo.start,
                            endTime: pInfo.end,
                            startTimeMinutes: pInfo.startMin,
                            endTimeMinutes: pInfo.endMin,
                            place: majorRoom,
                            status: 'Draft'
                        });
                        periodIdx++;
                    }
                }
            });
        } else {
            // ----------------------------------------------------
            // FIXED COLUMN TABULAR PARSER FOR PRACTICAL / TUTORIAL / EXAM
            // Mapping:
            // Col A (0): Year
            // Col B (1): Subject Code
            // Col C (2): Practical / Tutorial Title
            // Col D (3): Teacher / Instructor
            // Col E (4): Student Group / Batch
            // Col F (5): Date
            // Col G (6): Time
            // Col H (7): Place / Lab Room
            // ----------------------------------------------------
            const scanLimit = Math.min(jsonRows.length, 25);
            let headerRowIdx = -1;
            let colMap = {
                year: 0,
                code: 1,
                title: 2,
                teacher: 3,
                group: 4,
                date: 5,
                time: 6,
                place: 7
            };

            for (let i = 0; i < scanLimit; i++) {
                const r = jsonRows[i];
                if (!Array.isArray(r)) continue;
                const cells = r.map(c => String(c || '').toLowerCase().trim());
                
                // Skip title / banner lines
                const lineStr = cells.join(' ');
                if (lineStr.includes('technological university') || lineStr.includes('department of') || lineStr.includes('timetable for')) {
                    continue;
                }

                // Check if this row is the column header row
                const cIdxCode = cells.findIndex(h => h.includes('code') || h === 'subject' || h === 'course');
                const cIdxTitle = cells.findIndex(h => h.includes('title') || h.includes('topic') || h.includes('exp') || h.includes('name'));
                const cIdxDate = cells.findIndex(h => h.includes('date') || h.includes('day'));

                if (cIdxCode !== -1 || (cIdxTitle !== -1 && cIdxDate !== -1)) {
                    headerRowIdx = i;
                    
                    // Dynamically map columns if explicit headers exist
                    const cIdxYear = cells.findIndex(h => h.includes('year') || h.includes('yr'));
                    const cIdxTeacher = cells.findIndex(h => h.includes('teacher') || h.includes('instructor') || h.includes('faculty') || h.includes('staff'));
                    const cIdxGroup = cells.findIndex(h => h.includes('group') || h.includes('batch') || h.includes('sec'));
                    const cIdxTime = cells.findIndex(h => h.includes('time') || h.includes('hour') || h.includes('period'));
                    const cIdxPlace = cells.findIndex(h => h.includes('place') || h.includes('room') || h.includes('lab') || h.includes('loc'));

                    if (cIdxYear !== -1) colMap.year = cIdxYear;
                    if (cIdxCode !== -1) colMap.code = cIdxCode;
                    if (cIdxTitle !== -1) colMap.title = cIdxTitle;
                    if (cIdxTeacher !== -1) colMap.teacher = cIdxTeacher;
                    if (cIdxGroup !== -1) colMap.group = cIdxGroup;
                    if (cIdxDate !== -1) colMap.date = cIdxDate;
                    if (cIdxTime !== -1) colMap.time = cIdxTime;
                    if (cIdxPlace !== -1) colMap.place = cIdxPlace;
                    break;
                }
            }

            const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
            let consecutiveBlankCount = 0;
            let detectedApprovalNote = null;

            let bannerCode = '';
            const sheetMatch = sheetName.match(/([A-Za-z]{0,5}-?\s*\d{4,6})/i);
            if (sheetMatch) {
                const digits = sheetMatch[0].replace(/[^0-9]/g, '');
                if (digits.length >= 4) bannerCode = `McE-${digits}`;
                else bannerCode = sheetMatch[0].replace(/\s+/g, '').toUpperCase();
            }

            for (let i = 0; i < Math.min(jsonRows.length, 20); i++) {
                const r = jsonRows[i];
                if (!Array.isArray(r)) continue;
                const rText = r.filter(Boolean).map(c => String(c).trim()).join(' ');
                const codeMatch = rText.match(/([A-Za-z]{2,5}-?\s*\d{3,6})/i);
                if (codeMatch) {
                    bannerCode = codeMatch[1].replace(/\s+/g, '').toUpperCase();
                }
            }

            for (let r = startRow; r < jsonRows.length; r++) {
                const row = jsonRows[r];
                if (!Array.isArray(row) || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
                    consecutiveBlankCount++;
                    if (consecutiveBlankCount >= 3) break; // Stop at end of table
                    continue;
                }
                consecutiveBlankCount = 0;

                const fullRowText = row.map(c => String(c || '').trim()).join(' ');
                const lowerRowText = fullRowText.toLowerCase();

                // Stop at footer / signature block
                if (lowerRowText.includes('prepared by') || lowerRowText.includes('approved by') || lowerRowText.includes('head of department') || lowerRowText.includes('professor head') || lowerRowText.includes('authorized signature')) {
                    if (!detectedApprovalNote) detectedApprovalNote = fullRowText;
                    break; // STOP reading anything below
                }

                // Extract fields by column mapping - strictly one row = one timetable record
                let rawYear = row[colMap.year];
                let rawCode = row[colMap.code];
                let rawTitle = row[colMap.title];
                let rawTeacher = row[colMap.teacher];
                let rawGroup = row[colMap.group];
                let rawDate = row[colMap.date];
                let rawTime = row[colMap.time];
                let rawPlace = row[colMap.place];

                let cleanCode = String(rawCode || '').trim();

                // If code is empty or invalid, fallback to bannerCode
                if (!cleanCode || cleanCode.length < 2 || /^\d{1,2}[./-]\d{1,2}/.test(cleanCode) || /^GROUP/i.test(cleanCode) || /\d{1,2}:\d{2}/.test(cleanCode)) {
                    cleanCode = bannerCode || (targetCategory === 'Tutorial' ? 'McE-52039' : 'MC-31011');
                }
                if (['CODE', 'SUBJECT', 'COURSE', 'SR', 'NO', 'SR. NO', 'SR.NO', 'YEAR', 'DATE', 'TIME', 'TITLE', 'TOPIC', 'TEACHER', 'PLACE', 'ROOM', 'UNIVERSITY', 'DEPARTMENT'].includes(cleanCode.toUpperCase())) {
                    cleanCode = bannerCode || cleanCode;
                }

                if (!cleanCode || cleanCode.length < 2) {
                    continue;
                }

                // Clean and normalize fields
                let cleanTitle = String(rawTitle || '').trim();
                if (!cleanTitle || /^\d{1,2}[./-]\d{1,2}[./-](\d{2}|\d{4})$/.test(cleanTitle) || /^GROUP/i.test(cleanTitle)) {
                    cleanTitle = targetCategory === 'Tutorial' ? 'Tutorial Problem Solving & Discussion' : 'Practical Lab Experiment & Testing';
                }

                let cleanTeacher = String(rawTeacher || '').trim();
                if (!cleanTeacher || cleanTeacher.toLowerCase() === 'faculty member' || cleanTeacher.toLowerCase() === 'faculty supervisor') {
                    cleanTeacher = familyTeacher || 'Dr. Aung Kyaw Soe';
                }

                let cleanGroup = String(rawGroup || '').trim();
                if (!cleanGroup) cleanGroup = 'All';

                let cleanPlace = String(rawPlace || '').trim();
                if (!cleanPlace) cleanPlace = majorRoom || (targetCategory === 'Tutorial' ? 'Classroom 3/212-A' : 'Mechatronics Lab 3/212-A');

                // Date Parsing
                let parsedDate = parseExcelDate({ v: rawDate });
                if (!parsedDate && rawDate) {
                    const dMatch = String(rawDate).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
                    if (dMatch) {
                        const d = parseInt(dMatch[1], 10);
                        const m = parseInt(dMatch[2], 10) - 1;
                        let y = parseInt(dMatch[3], 10);
                        if (y < 100) y += 2000;
                        parsedDate = new Date(Date.UTC(y, m, d)).toISOString();
                    }
                }
                if (!parsedDate) {
                    parsedDate = new Date().toISOString();
                }

                // Time Parsing
                const timeStr = String(rawTime || '09:00 AM - 09:50 AM');
                const timeParts = timeStr.includes('to') ? timeStr.split('to') : timeStr.split('-');
                const startTime = timeParts[0]?.trim() || '09:00 AM';
                const endTime = timeParts[1]?.trim() || '09:50 AM';
                const startMin = parseTimeToMinutes(startTime);
                const endMin = parseTimeToMinutes(endTime) || (startMin + 50);

                // Year Label
                let yearLabel = detectedYear;
                if (rawYear && String(rawYear).trim().length > 0) {
                    const yStr = String(rawYear).trim().toUpperCase();
                    if (yStr.includes('1') || yStr.includes('FIRST') || yStr.includes('I')) yearLabel = '1st Year';
                    else if (yStr.includes('2') || yStr.includes('SECOND') || yStr.includes('II')) yearLabel = '2nd Year';
                    else if (yStr.includes('3') || yStr.includes('THIRD') || yStr.includes('III')) yearLabel = '3rd Year';
                    else if (yStr.includes('4') || yStr.includes('FOURTH') || yStr.includes('IV')) yearLabel = '4th Year';
                    else if (yStr.includes('5') || yStr.includes('FIFTH') || yStr.includes('V')) yearLabel = '5th Year';
                    else if (yStr.includes('6') || yStr.includes('SIXTH') || yStr.includes('VI')) yearLabel = '6th Year';
                }

                allSessions.push({
                    year: yearLabel,
                    semester: detectedSemester,
                    sessionType: targetCategory === 'Exam' ? 'Exam' : targetCategory === 'Tutorial' ? 'Tutorial' : 'Practical',
                    examType: targetCategory === 'Exam' ? 'Mid-Term' : 'N/A',
                    courseCode: cleanCode,
                    courseName: cleanTitle,
                    title: cleanTitle,
                    teacher: cleanTeacher,
                    groupTag: cleanGroup,
                    date: parsedDate,
                    startTime,
                    endTime,
                    startTimeMinutes: startMin,
                    endTimeMinutes: endMin,
                    place: cleanPlace,
                    status: 'Scheduled'
                });
            }
        }
    });

    return { parsedMatrix: allMatrix, parsedSessions: allSessions, headerError };
};

module.exports = {
    parseTUHmawbiExcel,
    parseTimeToMinutes,
    parseExcelDate
};
