const XLSX = require('xlsx');

// Helper to convert time string (e.g. "09:00 AM", "9:00am", "08:30") to minutes from midnight
const parseTimeToMinutes = (timeStr = '') => {
    if (!timeStr) return 0;
    const cleaned = timeStr.toString().toLowerCase().trim();
    
    // Check AM/PM
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
    
    // If Excel serial number (numeric cell type 'n')
    if (cell.t === 'n' && typeof cell.v === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(cell.v);
        if (dateObj) {
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            return new Date(`${dateObj.y}-${m}-${d}`);
        }
    }

    // String cell type 's' or raw text (e.g. "20.1.2025" or "17.3.2026")
    const strVal = String(cell.v || '').trim();
    if (!strVal) return null;

    // Filter out holiday headers e.g. "28.9.2024 Saturday" with no subject data
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
 * Main Server-Side Excel Parser for TU Hmawbi Timetables
 * @param {Buffer} fileBuffer 
 * @param {String} targetCategory ('Academic' | 'Practical' | 'Tutorial' | 'Exam')
 */
const parseTUHmawbiExcel = (fileBuffer, targetCategory = 'Academic') => {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    if (!jsonRows || jsonRows.length === 0) {
        throw new Error('Empty or unreadable Excel spreadsheet.');
    }

    // Header Detection & Mismatch Guard
    const fullText = JSON.stringify(jsonRows).toLowerCase();
    const isExamFormat = fullText.includes('sr. no') || fullText.includes('exam timetable') || fullText.includes('mid-term') || fullText.includes('final exam');
    const isPracticalFormat = fullText.includes('practical title') || fullText.includes('testing job');
    const isTutorialFormat = fullText.includes('tutorial title') || fullText.includes('tutorial i');
    const isAcademicFormat = fullText.includes('monday') || fullText.includes('tuesday') || fullText.includes('lunch break');

    // Category Mismatch Check
    if (targetCategory === 'Exam' && !isExamFormat && !isPracticalFormat && !isAcademicFormat) {
        throw new Error('Uploaded sheet layout does not match Exam Timetable format.');
    }

    const parsedSessions = [];
    const parsedMatrix = [];

    if (targetCategory === 'Academic' || isAcademicFormat) {
        // Parse Academic Matrix (Periods 1 to 6)
        // Find header row containing Monday - Friday
        let headerRowIdx = jsonRows.findIndex(r => Array.isArray(r) && r.some(c => String(c).toLowerCase().includes('monday')));
        if (headerRowIdx === -1) headerRowIdx = 0;

        const periodTimes = [
            { period: 1, start: '09:00 AM', end: '09:50 AM', startMin: 540, endMin: 590 },
            { period: 2, start: '10:00 AM', end: '10:50 AM', startMin: 600, endMin: 650 },
            { period: 3, start: '11:00 AM', end: '11:50 AM', startMin: 660, endMin: 710 },
            { period: 4, start: '01:00 PM', end: '01:50 PM', startMin: 780, endMin: 830 },
            { period: 5, start: '02:00 PM', end: '02:50 PM', startMin: 840, endMin: 890 },
            { period: 6, start: '03:00 PM', end: '03:50 PM', startMin: 900, endMin: 950 }
        ];

        const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        for (let r = headerRowIdx + 1; r < jsonRows.length; r++) {
            const row = jsonRows[r];
            if (!row || row.length === 0) continue;
            const dayName = String(row[0] || '').trim();
            const matchedDay = daysList.find(d => d.toLowerCase() === dayName.toLowerCase());
            if (!matchedDay) continue;

            // Iterate period columns (skipping Lunch Break)
            let periodIdx = 0;
            for (let c = 1; c < row.length; c++) {
                const cellVal = String(row[c] || '').trim();
                if (!cellVal || cellVal.toLowerCase().includes('lunch break')) continue;

                if (periodIdx < periodTimes.length) {
                    const pInfo = periodTimes[periodIdx];
                    parsedMatrix.push({
                        day: matchedDay,
                        periodNumber: pInfo.period,
                        startTime: pInfo.start,
                        endTime: pInfo.end,
                        startTimeMinutes: pInfo.startMin,
                        endTimeMinutes: pInfo.endMin,
                        courseCode: cellVal,
                        courseName: cellVal,
                        room: '3/212-A',
                        type: 'Lecture',
                        sessionLabel: 'Lecture'
                    });
                    periodIdx++;
                }
            }
        }
    } else {
        // Parse Date-Based Table (Practical, Tutorial, Exam)
        // Find header row containing Date / Day & Date / Subject Code
        let headerRowIdx = jsonRows.findIndex(r => Array.isArray(r) && r.some(c => String(c).toLowerCase().includes('subject code') || String(c).toLowerCase().includes('day & date')));
        if (headerRowIdx === -1) headerRowIdx = 0;

        for (let r = headerRowIdx + 1; r < jsonRows.length; r++) {
            const row = jsonRows[r];
            if (!row || row.length === 0) continue;

            const rowText = row.join(' ').toLowerCase();
            // Skip holiday / break rows
            if (rowText.includes('saturday') && !rowText.includes(':') && !rowText.includes('mc')) continue;
            if (rowText.includes('sunday') && !rowText.includes(':')) continue;

            const rawDate = row[1] || row[0] || row[5];
            const rawTime = row[2] || row[6] || '08:30 AM to 11:30 AM';
            const rawCode = row[1] || row[3] || row[0] || 'SUBJ101';
            const rawTitle = row[2] || row[3] || 'Academic Session';
            const rawPlace = row[7] || row[6] || '3/212-A';
            const rawTeacher = row[3] || row[4] || 'Faculty Member';
            const rawGroup = row[4] || 'All';

            const parsedDate = parseExcelDate({ v: rawDate });
            if (!parsedDate) continue; // Skip invalid date rows

            const startMin = parseTimeToMinutes(String(rawTime).split('to')[0] || '08:30');
            const endMin = parseTimeToMinutes(String(rawTime).split('to')[1] || '11:30') || (startMin + 180);

            parsedSessions.push({
                sessionType: targetCategory === 'Exam' ? 'Exam' : targetCategory === 'Tutorial' ? 'Tutorial' : 'Practical',
                examType: targetCategory === 'Exam' ? 'Mid-Term' : 'N/A',
                courseCode: String(rawCode).split(' ')[0].toUpperCase(),
                courseName: String(rawTitle).trim(),
                title: String(rawTitle).trim(),
                teacher: String(rawTeacher).trim(),
                groupTag: String(rawGroup).trim(),
                date: parsedDate,
                startTime: String(rawTime).split('to')[0]?.trim() || '08:30 AM',
                endTime: String(rawTime).split('to')[1]?.trim() || '11:30 AM',
                startTimeMinutes: startMin,
                endTimeMinutes: endMin,
                place: String(rawPlace).trim(),
                status: 'Draft'
            });
        }
    }

    return { parsedMatrix, parsedSessions };
};

module.exports = {
    parseTUHmawbiExcel,
    parseTimeToMinutes,
    parseExcelDate
};
