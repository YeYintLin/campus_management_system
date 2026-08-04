const ScheduledSession = require('../models/ScheduledSession');
const Timetable = require('../models/Timetable');
const ClassSection = require('../models/ClassSection');
const { parseTUHmawbiExcel } = require('../utils/excelParser');

// @desc    Batch import Excel file for Timetable / Practical / Tutorial / Exam
// @route   POST /api/sessions/batch-import
// @access  Private (Admin, Teacher)
const batchImportSessions = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an Excel file (.xlsx or .xls).' });
        }

        const { year = '6th Year', semester = 'Semester 1', major = 'MC', sessionType = 'Academic' } = req.body;

        // 1. Find or create authoritative ClassSection
        let classSection = await ClassSection.findOne({ year, semester, major });
        if (!classSection) {
            classSection = await ClassSection.create({
                year,
                semester,
                major,
                familyTeacher: 'Daw Thin Yu Maw',
                majorRoom: '3/212-A'
            });
        }

        // 2. Parse Excel file via server-side parser
        const { parsedMatrix, parsedSessions } = parseTUHmawbiExcel(req.file.buffer, sessionType);

        // In-memory validation pass before DB writes
        if (sessionType === 'Academic') {
            if (!parsedMatrix || parsedMatrix.length === 0) {
                return res.status(400).json({ message: 'No valid Academic matrix slots found in uploaded Excel file.' });
            }

            const bulkOps = parsedMatrix.map(slot => ({
                updateOne: {
                    filter: {
                        year,
                        semester,
                        major,
                        day: slot.day,
                        startTimeMinutes: slot.startTimeMinutes
                    },
                    update: {
                        $set: {
                            year,
                            semester,
                            major,
                            day: slot.day,
                            periodNumber: slot.periodNumber,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            startTimeMinutes: slot.startTimeMinutes,
                            endTimeMinutes: slot.endTimeMinutes,
                            courseCode: slot.courseCode,
                            courseName: slot.courseName,
                            room: slot.room,
                            type: slot.type,
                            sessionLabel: slot.sessionLabel,
                            classSection: classSection._id
                        }
                    },
                    upsert: true
                }
            }));

            await Timetable.bulkWrite(bulkOps);
            return res.json({
                message: `Successfully imported ${parsedMatrix.length} Academic matrix slots for ${year} ${semester} (${major})`,
                count: parsedMatrix.length
            });
        } else {
            if (!parsedSessions || parsedSessions.length === 0) {
                return res.status(400).json({ message: `No valid ${sessionType} sessions found in uploaded Excel file.` });
            }

            const bulkOps = parsedSessions.map(session => ({
                updateOne: {
                    filter: {
                        year,
                        semester,
                        major,
                        sessionType: session.sessionType,
                        courseCode: session.courseCode,
                        date: session.date,
                        startTimeMinutes: session.startTimeMinutes
                    },
                    update: {
                        $set: {
                            year,
                            semester,
                            major,
                            sessionType: session.sessionType,
                            examType: session.examType,
                            courseCode: session.courseCode,
                            courseName: session.courseName,
                            title: session.title,
                            teacher: session.teacher,
                            groupTag: session.groupTag,
                            date: session.date,
                            startTime: session.startTime,
                            endTime: session.endTime,
                            startTimeMinutes: session.startTimeMinutes,
                            endTimeMinutes: session.endTimeMinutes,
                            place: session.place,
                            status: 'Draft',
                            classSection: classSection._id
                        }
                    },
                    upsert: true
                }
            }));

            await ScheduledSession.bulkWrite(bulkOps);
            return res.json({
                message: `Successfully imported ${parsedSessions.length} ${sessionType} sessions for ${year} ${semester} (${major})`,
                count: parsedSessions.length
            });
        }
    } catch (error) {
        console.error('Batch Import Error:', error.message);
        return res.status(400).json({ message: error.message || 'Failed to import Excel file.' });
    }
};

// @desc    Get scheduled sessions (Practical, Tutorial, Exam)
// @route   GET /api/sessions
// @access  Private
const getSessions = async (req, res) => {
    try {
        const { year, semester, major, sessionType, status } = req.query;
        let filter = {};

        if (year) filter.year = year;
        if (semester) filter.semester = semester;
        if (major) filter.major = major;
        if (sessionType) filter.sessionType = sessionType;
        if (status) filter.status = status;

        if (req.user?.role === 'Teacher') {
            const User = require('../models/User');
            const userDoc = await User.findById(req.user._id).select('department');
            const dept = (userDoc?.department || '').toUpperCase().trim();
            const isMinorTeacher = ['MATH', 'MTH', 'ENGLISH', 'ENG', 'MYANMAR', 'MM', 'CHEM', 'CHM', 'PHYS', 'PHY'].some(m => dept.includes(m));

            if (!isMinorTeacher) {
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

module.exports = {
    batchImportSessions,
    getSessions
};
