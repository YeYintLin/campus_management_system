const ScheduledSession = require('../models/ScheduledSession');
const Timetable = require('../models/Timetable');
const ClassSection = require('../models/ClassSection');
const Semester = require('../models/Semester');
const TimetableFile = require('../models/TimetableFile');
const { parseTUHmawbiExcel } = require('../utils/excelParser');
const { parseTimetableBuffer } = require('../utils/parseTimetable');
const { parseTUHmawbiExamPdf } = require('../utils/pdfParser');

// @desc    Batch import Excel or PDF file for Timetable / Practical / Tutorial / Exam
// @route   POST /api/sessions/batch-import
// @access  Private (Admin, Teacher)
const batchImportSessions = async (req, res) => {
    try {
        const { year = '6th Year', semester = 'Semester 1', major = 'MC', sessionType = 'Practical' } = req.body;

        let parsedSessions = [];
        if (req.body.sessions) {
            try {
                parsedSessions = typeof req.body.sessions === 'string' ? JSON.parse(req.body.sessions) : req.body.sessions;
            } catch (e) {
                console.warn('Failed to parse req.body.sessions:', e.message);
            }
        }

        let parsedMatrix = [];
        let headerError = null;

        if ((!parsedSessions || parsedSessions.length === 0) && req.file) {
            const isPdf = req.file.mimetype === 'application/pdf' || String(req.file.originalname || '').toLowerCase().endsWith('.pdf');
            if (isPdf) {
                const pdfRes = await parseTUHmawbiExamPdf(req.file.buffer);
                parsedSessions = pdfRes.sessions.map(s => ({
                    ...s,
                    courseCode: s.courseCode || 'TBD',
                    courseName: s.courseName || 'Unscheduled Exam Slot',
                    title: s.title || 'Unscheduled Exam Slot',
                    year: s.year || year,
                    semester: s.semester || semester,
                    major: s.major || major,
                    sessionType: 'Exam',
                    examType: s.examType || 'Mid-Term',
                    place: s.place || '3/112 (B)',
                    status: s.isComplete ? 'Published' : 'Draft'
                }));
            } else {
                const resParsed = parseTUHmawbiExcel(req.file.buffer, sessionType);
                parsedMatrix = resParsed.parsedMatrix;
                parsedSessions = resParsed.parsedSessions;
                headerError = resParsed.headerError;
            }
        }

        if (!req.file && (!parsedSessions || parsedSessions.length === 0)) {
            return res.status(400).json({ message: 'Please upload an Excel file or provide sessions data.' });
        }

        // 3. Fallback extraction for Practical / Tutorial / Exam if multi-sheet timetable workbook is provided
        if (sessionType !== 'Academic' && (!parsedSessions || parsedSessions.length === 0)) {
            try {
                const parsedSemesters = await parseTimetableBuffer(req.file.buffer);
                if (parsedSemesters && parsedSemesters.length > 0) {
                    parsedSessions = parsedSessions || [];
                    parsedSemesters.forEach(s => {
                        const sYear = s.year_label || `${s.year_number || 1}th Year`;
                        const sSem = s.semester_label || `Semester ${s.semester_number || 1}`;
                        if (Array.isArray(s.days)) {
                            s.days.forEach(d => {
                                if (Array.isArray(d.periods)) {
                                    d.periods.forEach(p => {
                                        if (p && p.subject && p.subject.code) {
                                            const cleanCode = String(p.subject.code).trim();
                                            parsedSessions.push({
                                                year: sYear,
                                                semester: sSem,
                                                major: 'MC',
                                                sessionType: ['Practical', 'Tutorial', 'Exam'].includes(sessionType) ? sessionType : 'Practical',
                                                examType: 'N/A',
                                                courseCode: cleanCode,
                                                courseName: p.subject.name || cleanCode,
                                                title: p.subject.name || cleanCode,
                                                teacher: p.subject.teacher || s.family_teacher || 'Faculty Member',
                                                groupTag: 'All',
                                                date: new Date().toISOString(),
                                                day: d.day,
                                                startTime: p.time ? p.time.split('-')[0].trim() : '09:00 AM',
                                                endTime: p.time ? p.time.split('-')[1].trim() : '09:50 AM',
                                                startTimeMinutes: 540 + ((p.period_number || 1) - 1) * 60,
                                                endTimeMinutes: 590 + ((p.period_number || 1) - 1) * 60,
                                                place: p.subject.room || s.major_room || '3/212-A',
                                                status: 'Draft'
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                    headerError = null;
                }
            } catch (fbErr) {
                console.warn('Fallback timetable session parsing note:', fbErr.message);
            }
        }

        if (headerError && sessionType === 'Academic') {
            return res.status(400).json({ message: headerError });
        }

        // 4. Find or create authoritative ClassSections per parsed cohort (only for Academic imports)
        const ClassSection = require('../models/ClassSection');
        const sectionMap = new Map();
        const itemsForSections = sessionType === 'Academic' ? (parsedMatrix || []) : (parsedSessions || []);

        for (const item of itemsForSections) {
            const sYear = item.year || year;
            const sSem = item.semester || semester;
            const sMajor = item.major || major;
            const key = `${sYear}_${sSem}_${sMajor}`;
            if (!sectionMap.has(key)) {
                sectionMap.set(key, {
                    year: sYear,
                    semester: sSem,
                    major: sMajor,
                    familyTeacher: item.familyTeacher || 'Faculty Member',
                    majorRoom: item.majorRoom || item.room || '3/212-A'
                });
            }
        }

        if (sectionMap.size === 0) {
            sectionMap.set(`${year}_${semester}_${major}`, {
                year,
                semester,
                major,
                familyTeacher: 'Faculty Member',
                majorRoom: '3/212-A'
            });
        }

        const createdSections = new Map();
        if (sessionType === 'Academic') {
            for (const sec of sectionMap.values()) {
                const updated = await ClassSection.findOneAndUpdate(
                    { year: sec.year, semester: sec.semester, major: sec.major },
                    {
                        $set: {
                            familyTeacher: sec.familyTeacher,
                            majorRoom: sec.majorRoom
                        }
                    },
                    { upsert: true, new: true }
                );
                createdSections.set(`${sec.year}_${sec.semester}_${sec.major}`, updated);
            }
        }

        if (sessionType === 'Academic') {
            if (!parsedMatrix || parsedMatrix.length === 0) {
                return res.status(400).json({ message: 'No valid Academic matrix slots found in uploaded Excel file.' });
            }

            const bulkOps = parsedMatrix.map(slot => ({
                updateOne: {
                    filter: {
                        year: slot.year || year,
                        semester: slot.semester || semester,
                        major: slot.major || major,
                        day: slot.day,
                        startTimeMinutes: slot.startTimeMinutes
                    },
                    update: {
                        $set: {
                            year: slot.year || year,
                            semester: slot.semester || semester,
                            major: slot.major || major,
                            day: slot.day,
                            periodNumber: slot.periodNumber,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            time: slot.startTime,
                            startTimeMinutes: slot.startTimeMinutes,
                            endTimeMinutes: slot.endTimeMinutes,
                            courseCode: slot.courseCode,
                            courseName: slot.courseName,
                            room: slot.room || slot.majorRoom || '3/212-A',
                            type: 'Lecture',
                            sessionLabel: 'Lecture',
                            classSection: createdSections.get(`${slot.year || year}_${slot.semester || semester}_${slot.major || major}`)?._id
                        }
                    },
                    upsert: true
                }
            }));

            await Timetable.bulkWrite(bulkOps);
            
            const Notification = require('../models/Notification');
            await Notification.create({
                user: null,
                type: 'timetable',
                message: `📖 Academic Timetable Updated: Official university timetable spreadsheet (${parsedMatrix.length} class slots across all years) has been uploaded!`,
                link: '/timetable'
            });

            return res.json({
                message: `Successfully imported ${parsedMatrix.length} Academic matrix slots across all university years!`,
                count: parsedMatrix.length
            });
        } else {
            const validSessions = (parsedSessions || []).filter(s => s && s.courseCode).map(s => {
                const sYear = normalizeYear(s.year || year);
                const sSem = normalizeSemester(s.semester || semester);
                const sMajor = s.major || major || 'MC';
                const sDate = (s.date && !isNaN(new Date(s.date).getTime())) ? new Date(s.date) : new Date();
                const startM = Number(s.startTimeMinutes) || parseTimeToMinutes(s.startTime, 540);
                const endM = Number(s.endTimeMinutes) || parseTimeToMinutes(s.endTime, startM + 50);

                return {
                    year: sYear,
                    semester: sSem,
                    major: sMajor,
                    sessionType: ['Practical', 'Tutorial', 'Exam'].includes(s.sessionType) ? s.sessionType : (['Practical', 'Tutorial', 'Exam'].includes(sessionType) ? sessionType : 'Practical'),
                    examType: s.examType || 'N/A',
                    courseCode: String(s.courseCode).trim().toUpperCase(),
                    courseName: s.courseName || s.title || s.courseCode,
                    title: s.title || s.courseName || s.courseCode,
                    teacher: s.teacher || 'Faculty Member',
                    groupTag: s.groupTag || 'All',
                    date: sDate,
                    startTime: s.startTime || '09:00 AM',
                    endTime: s.endTime || '09:50 AM',
                    startTimeMinutes: startM,
                    endTimeMinutes: endM,
                    place: s.place || '3/212-A',
                    status: 'Draft'
                };
            });

            if (validSessions.length === 0) {
                return res.status(400).json({ message: `No valid ${sessionType} sessions found in uploaded Excel file.` });
            }

            const bulkOps = validSessions.map(session => ({
                updateOne: {
                    filter: {
                        year: session.year,
                        semester: session.semester,
                        major: session.major,
                        sessionType: session.sessionType,
                        courseCode: session.courseCode,
                        date: session.date,
                        startTimeMinutes: session.startTimeMinutes
                    },
                    update: {
                        $set: session
                    },
                    upsert: true
                }
            }));

            await ScheduledSession.bulkWrite(bulkOps);

            const Notification = require('../models/Notification');
            let notifType = sessionType.toLowerCase();
            let notifMsg = `🔬 ${sessionType} Timetable Uploaded: ${year} (${semester}) ${major} ${sessionType.toLowerCase()} schedule has been updated!`;
            let notifLink = '/timetable';

            if (sessionType === 'Exam') {
                notifType = 'exam';
                notifMsg = `📝 Exam Schedule Published: ${year} (${semester}) ${major} exam dates have been uploaded!`;
                notifLink = '/exams';
            }

            await Notification.create({
                user: null,
                type: notifType,
                message: notifMsg,
                link: notifLink
            });

            return res.json({
                message: `Successfully imported ${bulkOps.length} ${sessionType} sessions!`,
                count: bulkOps.length
            });
        }
    } catch (error) {
        console.error('Batch Import Error:', error.message);
        return res.status(400).json({ message: error.message || 'Failed to import Excel file.' });
    }
};

const parseTimeToMinutes = (timeStr, defaultMinutes = 540) => {
    if (!timeStr) return defaultMinutes;
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!match) return defaultMinutes;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridian = (match[3] || '').toLowerCase();
    if (meridian === 'pm' && h < 12) h += 12;
    if (meridian === 'am' && h === 12) h = 0;
    if (!meridian && h >= 1 && h <= 6) h += 12;
    return h * 60 + m;
};

const normalizeSemester = (sem = '') => {
    const s = String(sem).toUpperCase().trim();
    if (s.includes('II') || s.includes('2') || s.includes('SECOND') || s.includes('SEM 2')) return 'Semester 2';
    return 'Semester 1';
};

const normalizeYear = (yr = '') => {
    const y = String(yr).toUpperCase().trim();
    if (y.includes('6') || y.includes('VI') || y.includes('SIXTH') || y.includes('6TH')) return '6th Year';
    if (y.includes('5') || y.includes('V') || y.includes('FIFTH') || y.includes('5TH')) return '5th Year';
    if (y.includes('4') || y.includes('IV') || y.includes('FOURTH') || y.includes('4TH')) return '4th Year';
    if (y.includes('3') || y.includes('III') || y.includes('THIRD') || y.includes('3RD')) return '3rd Year';
    if (y.includes('2') || y.includes('II') || y.includes('SECOND') || y.includes('2ND')) return '2nd Year';
    if (y.includes('1') || y.includes('I') || y.includes('FIRST') || y.includes('1ST')) return '1st Year';
    if (y.includes('ME') || y.includes('MASTER')) return 'ME Program';
    return yr || '1st Year';
};

// @desc    Get scheduled sessions (Practical, Tutorial, Exam)
// @route   GET /api/sessions
// @access  Private
const getSessions = async (req, res) => {
    try {
        const { year, semester, major, sessionType, status } = req.query;
        let filter = {};

        if (year) {
            const normY = normalizeYear(year);
            filter.year = { $in: [year, normY] };
        }
        if (semester) {
            const normS = normalizeSemester(semester);
            const romanSem = normS === 'Semester 2' ? 'Semester II' : 'Semester I';
            filter.semester = { $in: [semester, normS, romanSem] };
        }
        if (major) filter.major = major;
        if (sessionType) filter.sessionType = sessionType;
        if (status) filter.status = status;

        if (req.user) {
            const User = require('../models/User');
            const userId = req.user._id || req.user.id;
            const userDoc = userId ? await User.findById(userId).select('department') : null;
            const dept = (userDoc?.department || '').toUpperCase().trim();
            const isMinorTeacher = ['MATH', 'MTH', 'ENGLISH', 'ENG', 'MYANMAR', 'MM', 'CHEM', 'CHM', 'PHYS', 'PHY'].some(m => dept.includes(m));

            if (req.user.role === 'Teacher' && !isMinorTeacher) {
                // Major department teacher (e.g. Mechatronics / MC): restricted to their own department
                const teacherMajor = (dept.includes('MC') || dept.includes('MECHA')) ? 'MC' : (major || 'MC');
                filter.major = teacherMajor;
            }
        }

        const sessions = await ScheduledSession.find(filter)
            .populate('course', 'name code')
            .populate('classSection', 'familyTeacher majorRoom')
            .sort({ date: 1, startTimeMinutes: 1 });

        res.json(sessions);
    } catch (error) {
        console.error('Get Sessions Error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Preview Excel or PDF import before committing
// @route   POST /api/sessions/preview-import
// @access  Private (Admin, Teacher)
const previewImportSessions = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an Excel file (.xlsx or .xls) or Exam PDF (.pdf).' });
        }

        const { sessionType = 'Practical' } = req.body;
        const isPdf = req.file.mimetype === 'application/pdf' || String(req.file.originalname || '').toLowerCase().endsWith('.pdf');

        if (isPdf) {
            const pdfRes = await parseTUHmawbiExamPdf(req.file.buffer);
            return res.json({
                success: true,
                count: pdfRes.totalRows,
                scheduledCount: pdfRes.scheduledCount,
                unscheduledCount: pdfRes.unscheduledCount,
                metadata: pdfRes.metadata,
                sessions: pdfRes.sessions,
                sessionType: 'Exam'
            });
        }

        const { parsedMatrix, parsedSessions, headerError } = parseTUHmawbiExcel(req.file.buffer, sessionType);

        if (headerError && sessionType === 'Academic') {
            return res.status(400).json({ message: headerError });
        }

        const sessions = (parsedSessions || []).filter(s => s && s.courseCode && s.courseCode.length >= 2);

        return res.json({
            success: true,
            count: sessions.length,
            sessions: sessions.slice(0, 100), // Preview up to 100 sessions
            sessionType
        });
    } catch (error) {
        console.error('Preview Import Error:', error.message);
        return res.status(400).json({ message: error.message || 'Failed to preview uploaded file.' });
    }
};

// @desc    Cleanup corrupted sessions in database
// @route   POST /api/sessions/cleanup-corrupted
// @access  Private (Admin, Teacher)
const cleanupCorruptedSessions = async (req, res) => {
    try {
        const deleteQuery = {
            $or: [
                { courseCode: { $regex: '^[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4}$' } },
                { courseCode: { $regex: '^GROUP', $options: 'i' } },
                { courseCode: { $regex: '^BATCH', $options: 'i' } },
                { courseCode: { $regex: '[0-9]{1,2}:[0-9]{2}' } },
                { courseCode: { $regex: 'APPROVED|PREPARED|DEPARTMENT|UNIVERSITY|HEAD', $options: 'i' } },
                { courseCode: { $in: ['', null, 'undefined', 'null', 'SR', 'NO', 'SR. NO', 'SR.NO'] } }
            ]
        };

        const result = await ScheduledSession.deleteMany(deleteQuery);
        console.log(`[Cleanup] Deleted ${result.deletedCount} corrupted ScheduledSession documents.`);

        return res.json({
            success: true,
            deletedCount: result.deletedCount,
            message: `Successfully cleaned up ${result.deletedCount} corrupted sessions.`
        });
    } catch (error) {
        console.error('Cleanup Corrupted Sessions Error:', error.message);
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    batchImportSessions,
    previewImportSessions,
    cleanupCorruptedSessions,
    getSessions
};

