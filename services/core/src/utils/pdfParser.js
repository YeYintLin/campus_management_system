const fs = require('fs');

/**
 * Normalizes year string from PDF title (e.g. "Fifth Year" -> "5th Year")
 */
function normalizeYearLabel(text) {
    if (!text) return '5th Year';
    const lower = String(text).toLowerCase();
    if (lower.includes('first') || lower.includes('1st')) return '1st Year';
    if (lower.includes('second') || lower.includes('2nd')) return '2nd Year';
    if (lower.includes('third') || lower.includes('3rd')) return '3rd Year';
    if (lower.includes('fourth') || lower.includes('4th')) return '4th Year';
    if (lower.includes('fifth') || lower.includes('5th')) return '5th Year';
    if (lower.includes('sixth') || lower.includes('6th') || lower.includes('final')) return '6th Year';
    if (lower.includes('master') || lower.includes('me ')) return 'ME Program';
    return '5th Year';
}

/**
 * Converts date string "DD.MM.YYYY" or "DD-MM-YYYY" to Date object
 */
function parseDateString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().replace(/[/\-]/g, '.').split('.');
    if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(Date.UTC(year, month, day, 2, 0, 0)); // 08:30 Myanmar is UTC+6:30
    }
    return new Date(dateStr);
}

/**
 * Parses time string e.g. "08:30" to integer minutes from midnight
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 510; // Default 08:30 = 8*60+30
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        return hours * 60 + mins;
    }
    return 510;
}

/**
 * Extracts text from PDF buffer using pdf-parse (handles v1 function and v2 PDFParse class)
 */
async function extractRawPdfText(dataBuffer) {
    const pdfModule = require('pdf-parse');
    if (typeof pdfModule === 'function') {
        const res = await pdfModule(dataBuffer);
        return res.text || '';
    }
    if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: dataBuffer });
        const res = await parser.getText();
        return res.text || '';
    }
    throw new Error('Unsupported pdf-parse module version');
}

/**
 * Parses Technological University (Hmawbi) Exam Timetable PDFs
 * 
 * Strategy: Anchor-based Regex Segmentation
 * Matches each block by Date anchor (\d{1,2}\.\d{1,2}\.\d{4}), Day anchor,
 * Time range (\d{1,2}:\d{2} To \d{1,2}:\d{2}), and extracts Course Code and Subject.
 * Handles both complete rows and unscheduled placeholder rows (like rows 4-6 in 6th Year).
 */
async function parseTUHmawbiExamPdf(input) {
    let dataBuffer;
    if (Buffer.isBuffer(input)) {
        dataBuffer = input;
    } else if (typeof input === 'string') {
        dataBuffer = fs.readFileSync(input);
    } else {
        throw new Error('Invalid input: Expected Buffer or file path string');
    }

    const text = await extractRawPdfText(dataBuffer);
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 1. Extract Header Metadata
    let institution = 'Technological University (Hmawbi)';
    let rawYear = 'Fifth Year';
    let academicYear = '2025-2026';
    let major = 'MC';
    let examType = 'Mid-Term';

    for (const line of rawLines.slice(0, 10)) {
        if (line.includes('Technological University')) {
            institution = line.trim();
        }
        if (line.includes('Exam Time Table')) {
            const yearMatch = line.match(/(First|Second|Third|Fourth|Fifth|Sixth|\d+(?:st|nd|rd|th)?)\s+Year/i);
            if (yearMatch) rawYear = yearMatch[0];
            if (line.includes('Final')) examType = 'Final';
            else if (line.includes('Mid-Term')) examType = 'Mid-Term';
        }
        if (line.includes('Academic Year')) {
            const acMatch = line.match(/\d{4}\s*-\s*\d{4}/);
            if (acMatch) academicYear = acMatch[0].replace(/\s+/g, '');
        }
        if (/^[A-Z]{2,4}$/.test(line)) {
            major = line.trim();
        }
    }

    const yearLabel = normalizeYearLabel(rawYear);
    const semester = 'Semester 1'; // Default or derived from course code

    // 2. Identify Data Row Anchors
    // Each row starts with Date (either "DD.MM.YYYY" or "1 17.3.2026") followed by Day of week
    const weekdayRegex = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i;
    const timeRegex = /^(\d{1,2}:\d{2})$/;
    const courseCodeRegex = /^([A-Za-z]{2,4}\s*\d{4,5})$/;

    const rowAnchors = [];
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        // Match line having a date e.g. "17.3.2026" or "1 17.3.2026"
        const dateMatch = line.match(/\b(\d{1,2}\.\d{1,2}\.\d{4})\b/);
        if (dateMatch) {
            // Check if next line is a weekday
            if (i + 1 < rawLines.length && weekdayRegex.test(rawLines[i + 1])) {
                // Extract optional Sr No
                let srNo = null;
                const srMatch = line.match(/^(\d+)\s+/);
                if (srMatch) {
                    srNo = parseInt(srMatch[1], 10);
                } else if (i > 0 && /^\d+$/.test(rawLines[i - 1])) {
                    srNo = parseInt(rawLines[i - 1], 10);
                }

                rowAnchors.push({
                    lineIndex: i,
                    srNo,
                    dateStr: dateMatch[1],
                    dayOfWeek: rawLines[i + 1]
                });
            }
        }
    }

    const sessions = [];

    for (let d = 0; d < rowAnchors.length; d++) {
        const anchor = rowAnchors[d];
        const nextAnchorLine = d + 1 < rowAnchors.length ? rowAnchors[d + 1].lineIndex : rawLines.length;

        let cursor = anchor.lineIndex + 2; // Move past date line and weekday line

        let startTime = '08:30';
        let endTime = '11:30';

        if (cursor < nextAnchorLine && timeRegex.test(rawLines[cursor])) {
            startTime = rawLines[cursor];
            cursor++;
        }
        if (cursor < nextAnchorLine && rawLines[cursor].toLowerCase() === 'to') {
            cursor++;
        }
        if (cursor < nextAnchorLine && timeRegex.test(rawLines[cursor])) {
            endTime = rawLines[cursor];
            cursor++;
        }

        // Collect remaining tokens until next anchor or footer markers
        const remainingTokens = [];
        while (cursor < nextAnchorLine) {
            const token = rawLines[cursor];
            // Stop if token is standalone number right before next date line
            if (cursor === nextAnchorLine - 1 && /^\d+$/.test(token)) {
                break;
            }
            if (token.includes('Page ') || token.includes('Saturday') || token.includes('Sunday') || token.includes('Sr.') || token.includes('No.')) {
                break;
            }
            remainingTokens.push(token);
            cursor++;
        }

        // Check for course code in remaining tokens
        let courseCode = null;
        let courseName = null;

        if (remainingTokens.length > 0) {
            let codeIdx = -1;
            for (let t = 0; t < remainingTokens.length; t++) {
                if (courseCodeRegex.test(remainingTokens[t])) {
                    codeIdx = t;
                    break;
                }
            }

            if (codeIdx !== -1) {
                // Normalize code (e.g. "McE 51018" or "HSS 61011")
                const rawCode = remainingTokens[codeIdx];
                const parts = rawCode.trim().split(/\s+/);
                courseCode = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : rawCode.trim();

                const nameTokens = remainingTokens.slice(codeIdx + 1);
                courseName = nameTokens.join(' ').replace(/\s+/g, ' ').trim();
            }
        }

        const dateObj = parseDateString(anchor.dateStr);
        const startTimeMins = timeToMinutes(startTime);
        const endTimeMins = timeToMinutes(endTime);

        const isComplete = Boolean(courseCode && courseName);

        sessions.push({
            srNo: anchor.srNo || (d + 1),
            year: yearLabel,
            semester,
            major,
            sessionType: 'Exam',
            examType,
            date: dateObj,
            dateString: anchor.dateStr,
            dayOfWeek: anchor.dayOfWeek,
            startTime,
            endTime,
            startTimeMinutes: startTimeMins,
            endTimeMinutes: endTimeMins,
            courseCode: isComplete ? courseCode : null,
            courseName: isComplete ? courseName : null,
            title: isComplete ? courseName : null,
            place: '3/112 (B)',
            status: isComplete ? 'Scheduled' : 'Unscheduled',
            isComplete
        });
    }

    const scheduledCount = sessions.filter(s => s.isComplete).length;
    const unscheduledCount = sessions.filter(s => !s.isComplete).length;

    return {
        success: true,
        institution,
        metadata: {
            academicYear,
            year: yearLabel,
            rawYear,
            semester,
            major,
            examType
        },
        totalRows: sessions.length,
        scheduledCount,
        unscheduledCount,
        sessions
    };
}

module.exports = {
    parseTUHmawbiExamPdf,
    normalizeYearLabel,
    parseDateString,
    timeToMinutes
};
