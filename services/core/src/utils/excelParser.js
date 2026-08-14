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

        const isGridFormat = (targetCategory === 'Academic' || hasDayNames) && (fullText.includes('period') || fullText.includes('lunch') || fullText.includes('09:00') || fullText.includes('9:00') || hasDayNames);

        if (isGridFormat) {
            let titleText = '';
            jsonRows.forEach(row => {
                if (!Array.isArray(row)) return;
                const lineStr = row.filter(Boolean).map(c => String(c).trim()).join(' ');
                if (lineStr.toLowerCase().includes('timetable for')) titleText = lineStr;
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

            // 1. Detect Year ONLY from text before parenthesis
            const cleanY = yearPart.toUpperCase();
            let detectedYear = '2nd Year';

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

            // 2. Detect Semester ONLY from text inside parenthesis
            const cleanS = semPart.toUpperCase();
            let detectedSemester = 'Semester 2';

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
            // Structural Header-Row Detection (Scan first 15 rows for column labels)
            const scanLimit = Math.min(jsonRows.length, 15);
            let headerRowIdx = -1;

            for (let i = 0; i < scanLimit; i++) {
                const r = jsonRows[i];
                if (!Array.isArray(r)) continue;
                const lineStr = r.map(c => String(c || '').toLowerCase().trim()).join(' ');
                
                // Skip title / banner lines
                if (lineStr.includes('technological university') || lineStr.includes('department of') || lineStr.includes('practical timetable')) {
                    continue;
                }

                const headerKeywords = ['code', 'subject', 'course', 'date', 'day', 'time', 'title', 'exp', 'topic', 'group', 'batch', 'room', 'place', 'teacher', 'sr'];
                const matches = r.filter(c => {
                    const s = String(c || '').toLowerCase();
                    return headerKeywords.some(kw => s.includes(kw));
                });

                if (matches.length >= 2) {
                    headerRowIdx = i;
                    break;
                }
            }

            if (headerRowIdx === -1) {
                headerError = `Could not locate a valid header row in sheet '${sheetName}' — check the file format.`;
                return;
            }

            const headerRow = (jsonRows[headerRowIdx] || []).map(c => String(c || '').toLowerCase().trim());
            
            let dateIdx = headerRow.findIndex(h => h.includes('date') || h.includes('day'));
            let timeIdx = headerRow.findIndex(h => h.includes('time') || h.includes('period') || h.includes('hour'));
            let codeIdx = headerRow.findIndex(h => h.includes('code') || h.includes('subject') || h.includes('course'));
            let titleIdx = headerRow.findIndex(h => h.includes('title') || h.includes('exp') || h.includes('topic') || h.includes('name') || h.includes('lab'));
            let groupIdx = headerRow.findIndex(h => h.includes('group') || h.includes('batch') || h.includes('sec'));
            let placeIdx = headerRow.findIndex(h => h.includes('place') || h.includes('room') || h.includes('lab') || h.includes('loc'));
            let teacherIdx = headerRow.findIndex(h => h.includes('teacher') || h.includes('instructor') || h.includes('staff') || h.includes('supervis'));

            for (let r = headerRowIdx + 1; r < jsonRows.length; r++) {
                const row = jsonRows[r];
                if (!row || row.length === 0) continue;

                const rowText = row.join(' ').toLowerCase();
                if (rowText.includes('saturday') && !rowText.includes(':') && !rowText.includes('mc')) continue;
                if (rowText.includes('sunday') && !rowText.includes(':')) continue;
                if (rowText.includes('approved by') || rowText.includes('head of department') || rowText.includes('professor head')) continue;

                let rawDate = (dateIdx !== -1 && row[dateIdx]) ? row[dateIdx] : null;
                let rawTime = (timeIdx !== -1 && row[timeIdx]) ? row[timeIdx] : null;
                let rawCode = (codeIdx !== -1 && row[codeIdx]) ? row[codeIdx] : null;
                let rawTitle = (titleIdx !== -1 && row[titleIdx]) ? row[titleIdx] : null;
                let rawGroup = (groupIdx !== -1 && row[groupIdx]) ? row[groupIdx] : null;
                let rawPlace = (placeIdx !== -1 && row[placeIdx]) ? row[placeIdx] : null;
                let rawTeacher = (teacherIdx !== -1 && row[teacherIdx]) ? row[teacherIdx] : null;

                // Inspect all row cells for date, group, and time patterns if not explicitly indexed
                row.forEach(cell => {
                    if (!cell) return;
                    const cStr = String(cell).trim();
                    const dMatch = cStr.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/);
                    if (dMatch && !rawDate) rawDate = dMatch[0];
                    if (/^GROUP\s*[A-Z0-9,\s&]+/i.test(cStr) && !rawGroup) rawGroup = cStr;
                    if (/\d{1,2}:\d{2}\s*(?:TO|-)\s*\d{1,2}:\d{2}/i.test(cStr) && !rawTime) rawTime = cStr;
                });

                if (!rawDate) rawDate = row[1] || row[0] || row[5];
                if (!rawTime) rawTime = row[2] || row[6] || '09:00 AM - 09:50 AM';
                if (!rawCode) rawCode = row[1] || row[3] || row[0] || 'MC-31011';
                if (!rawTitle) rawTitle = row[2] || row[3] || 'Practical Lab Session';
                if (!rawGroup) rawGroup = row[4] || 'All';
                if (!rawPlace) rawPlace = row[7] || row[6] || 'Mechatronics Lab';
                if (!rawTeacher) rawTeacher = row[3] || row[4] || 'Dr. Aung Kyaw Soe';

                let cleanCodeStr = String(rawCode).split(' ')[0].toUpperCase().replace(/[^A-Z0-9-]/g, '');
                
                // If cleanCodeStr is a date or group, standardize it
                if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(cleanCodeStr) || /^GROUP/i.test(cleanCodeStr) || cleanCodeStr.length < 2) {
                    cleanCodeStr = 'MC-31011';
                }

                // Skip header artifacts
                if (['UNIVERSITY', 'DEPARTMENT', 'TIMETABLE', 'TECHNOLOGICAL', 'MECHATRONICS', 'SR', 'NO', 'NO.'].includes(cleanCodeStr)) {
                    continue;
                }

                let parsedDate = parseExcelDate({ v: rawDate });
                if (!parsedDate) {
                    const dateMatch = String(rawDate).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
                    if (dateMatch) {
                        const d = parseInt(dateMatch[1], 10);
                        const m = parseInt(dateMatch[2], 10) - 1;
                        let y = parseInt(dateMatch[3], 10);
                        if (y < 100) y += 2000;
                        parsedDate = new Date(Date.UTC(y, m, d)).toISOString();
                    } else {
                        parsedDate = new Date().toISOString();
                    }
                }

                const timeStr = String(rawTime);
                const startMin = parseTimeToMinutes(timeStr.split('to')[0] || timeStr.split('-')[0] || '09:00');
                const endMin = parseTimeToMinutes(timeStr.split('to')[1] || timeStr.split('-')[1] || '09:50') || (startMin + 50);

                let displayTitle = String(rawTitle).trim();
                if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(displayTitle) || /^GROUP/i.test(displayTitle)) {
                    displayTitle = 'Practical Experiment & Lab Work';
                }

                const derivedYearNum = (cleanCodeStr.match(/(\d)/) || [])[1] || '3';
                const yearLabel = `${derivedYearNum}th Year`.replace('1th', '1st').replace('2th', '2nd').replace('3th', '3rd');

                allSessions.push({
                    year: yearLabel,
                    sessionType: targetCategory === 'Exam' ? 'Exam' : targetCategory === 'Tutorial' ? 'Tutorial' : 'Practical',
                    examType: targetCategory === 'Exam' ? 'Mid-Term' : 'N/A',
                    courseCode: cleanCodeStr,
                    courseName: displayTitle,
                    title: displayTitle,
                    teacher: String(rawTeacher).trim() || 'Dr. Aung Kyaw Soe',
                    groupTag: String(rawGroup).trim() || 'All',
                    date: parsedDate,
                    startTime: timeStr.split('to')[0]?.trim() || timeStr.split('-')[0]?.trim() || '09:00 AM',
                    endTime: timeStr.split('to')[1]?.trim() || timeStr.split('-')[1]?.trim() || '09:50 AM',
                    startTimeMinutes: startMin,
                    endTimeMinutes: endMin,
                    place: String(rawPlace).trim() || 'Mechatronics Lab',
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
