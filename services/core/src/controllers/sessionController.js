const ScheduledSession = require('../models/ScheduledSession');
const Timetable = require('../models/Timetable');
const ClassSection = require('../models/ClassSection');
const Semester = require('../models/Semester');
const TimetableFile = require('../models/TimetableFile');
const { parseTUHmawbiExcel } = require('../utils/excelParser');
const { parseTimetableBuffer } = require('../utils/parseTimetable');

// @desc    Batch import Excel file for Timetable / Practical / Tutorial / Exam
// @route   POST /api/sessions/batch-import
// @access  Private (Admin, Teacher)
const batchImportSessions = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an Excel file (.xlsx or .xls).' });
        }

        const { year = '6th Year', semester = 'Semester 1', major = 'MC', sessionType = 'Academic' } = req.body;

        // 0. Store original uploaded file bytes untouched for exact byte-for-byte export
        const fileDoc = await TimetableFile.create({
            originalName: req.file.originalname || 'TimeTable.xlsx',
            mimeType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data: req.file.buffer
        });

        // 1. Parse ExcelJS structured Semester blocks
        try {
            const parsedSemesters = await parseTimetableBuffer(req.file.buffer);
            if (parsedSemesters && parsedSemesters.length > 0) {
                await Semester.deleteMany({ sheetName: { $in: parsedSemesters.map(s => s.sheet_name) } });
                await Semester.insertMany(
                    parsedSemesters.map((s, i) => ({
                        sourceFile: fileDoc._id,
                        sheetName: s.sheet_name,
                        department: s.department,
                        academicYear: s.academic_year,
                        yearLabel: s.year_label,
                        semesterLabel: s.semester_label,
                        semesterOrder: i,
                        majorRoom: s.major_room,
                        combinedRoom: s.combined_room,
                        familyTeacher: s.family_teacher,
                        periods: s.periods,
                        days: s.days,
                        legend: s.legend
                    }))
                );
            }
        } catch (semErr) {
            console.error('Semester insert notice:', semErr.message);
        }

        // 2. Parse Excel file via server-side parser
        const { parsedMatrix, parsedSessions } = parseTUHmawbiExcel(req.file.buffer, sessionType);

        // 2. Find or create authoritative ClassSections per parsed cohort
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

        // 3. Find-or-create subject courses cleanly (deduplicating subject folders)
        const Course = require('../models/Course');
        const itemsToProcess = sessionType === 'Academic' ? (parsedMatrix || []) : (parsedSessions || []);
        for (const item of itemsToProcess) {
            const cCode = (item.courseCode || '').trim();
            if (cCode) {
                const existingCourse = await Course.findOne({ code: cCode });
                if (!existingCourse) {
                    await Course.create({
                        code: cCode,
                        name: item.courseName || cCode,
                        department: major,
                        year: item.year || year,
                        semester: item.semester || semester,
                        teacher: req.user._id
                    });
                }
            }
        }

        // In-memory validation pass before DB writes
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
                            type: slot.type || 'Lecture',
                            sessionLabel: slot.sessionLabel || 'Lecture',
                            classSection: createdSections.get(`${slot.year || year}_${slot.semester || semester}_${slot.major || major}`)?. _id
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
            if ((!parsedSessions || parsedSessions.length === 0) && (!parsedMatrix || parsedMatrix.length === 0)) {
                return res.status(400).json({ message: `No valid ${sessionType} sessions found in uploaded Excel file.` });
            }

            // Write matrix slots to Timetable model if present
            let timetableBulk = [];
            if (Array.isArray(parsedMatrix) && parsedMatrix.length > 0) {
                timetableBulk = parsedMatrix.map(slot => ({
                    updateOne: {
                        filter: {
                            year: slot.year || year,
                            semester: slot.semester || semester,
                            major: slot.major || major,
                            day: slot.day,
                            periodNumber: slot.periodNumber,
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
                                type: sessionType,
                                sessionLabel: sessionType,
                            }
                        },
                        upsert: true
                    }
                }));
                if (timetableBulk.length > 0) {
                    await Timetable.bulkWrite(timetableBulk);
                }
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
                            classSection: createdSections.get(`${session.year || year}_${session.semester || semester}_${session.major || major}`)?. _id
                        }
                    },
                    upsert: true
                }
            }));

            if (bulkOps.length > 0) {
                await ScheduledSession.bulkWrite(bulkOps);
            }

            const Notification = require('../models/Notification');
            let notifType = 'system';
            let notifMsg = '';
            let notifLink = '/timetable';

            if (sessionType === 'Exam') {
                notifType = 'exam';
                notifMsg = `📝 Exam Schedule Published: ${year} (${semester}) ${major} exam dates have been uploaded! Check your Exam Schedule now.`;
                notifLink = '/exams';
            } else if (sessionType === 'Practical') {
                notifType = 'practical';
                notifMsg = `🔬 Practical Timetable Uploaded: ${year} (${semester}) ${major} practical experiment sessions are now scheduled!`;
                notifLink = '/timetable';
            } else if (sessionType === 'Tutorial') {
                notifType = 'tutorial';
                notifMsg = `✍️ Tutorial Timetable Uploaded: ${year} (${semester}) ${major} tutorial sessions are now scheduled!`;
                notifLink = '/timetable';
            }

            if (notifMsg) {
                await Notification.create({
                    user: null,
                    type: notifType,
                    message: notifMsg,
                    link: notifLink
                });
            }

            const totalCount = (timetableBulk ? timetableBulk.length : 0) + bulkOps.length;

            return res.json({
                message: `Successfully imported ${totalCount} ${sessionType} sessions!`,
                count: totalCount
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

module.exports = {
    batchImportSessions,
    getSessions
};
