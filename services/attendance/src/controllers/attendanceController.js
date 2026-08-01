const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const SessionOverride = require('../models/SessionOverride');
const axios = require('axios');

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:5002';

// ─────────────────────────────────────────────
// GET /api/attendance/active-session
// Polled by banners. Returns active session & code to Teacher; session info (NO code) to Student.
// ─────────────────────────────────────────────
const getActiveSession = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        const now = new Date();

        // Find currently active, non-expired session
        const session = await AttendanceSession.findOne({
            status: 'active',
            expiresAt: { $gt: now },
        }).sort({ createdAt: -1 });

        if (!session) {
            return res.json(null);
        }

        // Teacher sees the code; Student gets metadata without code
        if (role === 'Teacher' || role === 'Admin' || role === 'SuperAdmin') {
            return res.json({
                _id: session._id,
                courseId: session.courseId,
                courseName: session.courseName,
                code: session.code,
                expiresAt: session.expiresAt,
                status: session.status,
            });
        }

        // Student payload — hide code field
        res.json({
            _id: session._id,
            courseId: session.courseId,
            courseName: session.courseName,
            expiresAt: session.expiresAt,
            status: session.status,
        });
    } catch (error) {
        console.error('getActiveSession error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/attendance/submit-code
// Student submits 4-digit code to mark attendance
// ─────────────────────────────────────────────
const submitAttendanceCode = async (req, res) => {
    try {
        const { code, courseId } = req.body;
        const studentId = req.user._id;
        const now = new Date();

        if (!code) {
            return res.status(400).json({ message: '4-digit attendance code is required' });
        }

        // 1. Find active session
        const session = await AttendanceSession.findOne({
            code: code.trim(),
            status: 'active',
            expiresAt: { $gt: now },
        });

        if (!session) {
            return res.status(400).json({ message: 'Invalid or expired attendance code' });
        }

        if (courseId && session.courseId !== courseId) {
            return res.status(400).json({ message: 'Code does not match this course session' });
        }

        // 2. Mark attendance in DB for today's date
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        let attendanceRecord = await Attendance.findOne({
            courseId: session.courseId,
            date: { $gte: todayStart, $lte: todayEnd },
        });

        if (!attendanceRecord) {
            attendanceRecord = new Attendance({
                courseId: session.courseId,
                date: todayStart,
                records: [],
            });
        }

        // Check if student already marked
        const existingIdx = attendanceRecord.records.findIndex(
            r => r.studentId.toString() === studentId.toString()
        );

        if (existingIdx >= 0) {
            attendanceRecord.records[existingIdx].status = 'Present';
        } else {
            attendanceRecord.records.push({
                studentId: studentId,
                status: 'Present',
            });
        }

        await attendanceRecord.save();

        res.json({
            message: `Attendance marked present for ${session.courseName || session.courseId}`,
            courseId: session.courseId,
            status: 'Present',
        });
    } catch (error) {
        console.error('submitAttendanceCode error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/attendance/override
// Teacher creates a session cancellation/reschedule override
// ─────────────────────────────────────────────
const createSessionOverride = async (req, res) => {
    try {
        const {
            courseCode,
            originalDate,
            originalTime,
            type,
            reason,
            reasonCategory,
            newDate,
            newStartTime,
            newEndTime,
            newRoom,
        } = req.body;

        if (!courseCode || !originalDate || !originalTime || !type || !reason) {
            return res.status(400).json({ message: 'Missing required override parameters' });
        }

        const override = await SessionOverride.create({
            courseCode,
            originalDate: new Date(originalDate),
            originalTime,
            type,
            reason,
            reasonCategory: reasonCategory || 'Other',
            newDate: newDate ? new Date(newDate) : null,
            newStartTime: newStartTime || null,
            newEndTime: newEndTime || null,
            newRoom: newRoom || null,
            createdBy: req.user._id.toString(),
            notifyStudents: true,
            status: 'Active',
        });

        res.status(201).json(override);
    } catch (error) {
        console.error('createSessionOverride error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/attendance/overrides
// ─────────────────────────────────────────────
const getSessionOverrides = async (req, res) => {
    try {
        const { courseCode } = req.query;
        const query = courseCode ? { courseCode } : {};

        const overrides = await SessionOverride.find(query).sort({ originalDate: -1 });
        res.json(overrides);
    } catch (error) {
        console.error('getSessionOverrides error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get attendance for a course (can filter by date)
// @route   GET /api/attendance/course/:courseId
// @access  Private
const getAttendance = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { date } = req.query;

        let query = { courseId: courseId };

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const attendanceRecords = await Attendance.find(query).sort({ date: -1 });

        // Resolve student details via Core Service
        const token = req.headers.authorization;
        const resolvedRecords = [];

        for (const record of attendanceRecords) {
            const resolvedStudentRecords = [];
            for (const r of record.records) {
                let studentData = { _id: r.studentId, name: 'Unknown Student', email: '' };
                try {
                    const response = await axios.get(`${CORE_SERVICE_URL}/api/users/${r.studentId}`, {
                        headers: { Authorization: token }
                    });
                    if (response.data) {
                        studentData = {
                            _id: response.data._id,
                            name: response.data.name,
                            email: response.data.email
                        };
                    }
                } catch (err) {
                    console.error(`Failed to fetch user ${r.studentId} from Core Service:`, err.message);
                }
                
                resolvedStudentRecords.push({
                    student: studentData,
                    status: r.status,
                    _id: r._id
                });
            }

            resolvedRecords.push({
                _id: record._id,
                course: record.courseId,
                date: record.date,
                records: resolvedStudentRecords,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt
            });
        }

        res.json(resolvedRecords);
    } catch (error) {
        console.error('getAttendance error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark attendance for a course on a specific date
// @route   POST /api/attendance
// @access  Private (Teacher, Admin)
const markAttendance = async (req, res) => {
    try {
        const { course, date, records } = req.body;

        // Enforce course ownership for Teachers (Admins bypass)
        if (req.user.role === 'Teacher') {
            try {
                const response = await axios.get(`${CORE_SERVICE_URL}/api/courses/${course}`, {
                    headers: { Authorization: req.headers.authorization },
                    timeout: 5000
                });

                const teacherId = response.data.teacher && typeof response.data.teacher === 'object'
                    ? response.data.teacher._id
                    : response.data.teacher;

                if (!teacherId || teacherId.toString() !== req.user._id.toString()) {
                    return res.status(403).json({ message: 'Not authorized: You do not teach this course' });
                }
            } catch (err) {
                console.error(`Failed to verify course assignment for ${course}:`, err.message);
                const status = err.response ? err.response.status : 503;
                return res.status(status === 403 ? 403 : 503).json({
                    message: 'Unable to verify course assignment, please try again'
                });
            }
        }

        const parsedDate = new Date(date);
        parsedDate.setHours(0, 0, 0, 0);

        const start = new Date(parsedDate);
        const end = new Date(parsedDate);
        end.setHours(23, 59, 59, 999);

        const dbRecords = records.map(r => ({
            studentId: r.student,
            status: r.status
        }));

        let attendance = await Attendance.findOne({
            courseId: course,
            date: { $gte: start, $lte: end },
        });

        if (attendance) {
            attendance.records = dbRecords;
            await attendance.save();
        } else {
            attendance = await Attendance.create({
                courseId: course,
                date: parsedDate,
                records: dbRecords,
            });
        }

        const token = req.headers.authorization;
        const resolvedStudentRecords = [];
        for (const r of attendance.records) {
            let studentData = { _id: r.studentId, name: 'Unknown Student', email: '' };
            try {
                const response = await axios.get(`${CORE_SERVICE_URL}/api/users/${r.studentId}`, {
                    headers: { Authorization: token }
                });
                if (response.data) {
                    studentData = {
                        _id: response.data._id,
                        name: response.data.name,
                        email: response.data.email
                    };
                }
            } catch (err) {
                console.error(`Failed to fetch user ${r.studentId} from Core Service:`, err.message);
            }
            resolvedStudentRecords.push({
                student: studentData,
                status: r.status,
                _id: r._id
            });
        }

        res.status(200).json({
            _id: attendance._id,
            course: attendance.courseId,
            date: attendance.date,
            records: resolvedStudentRecords,
            createdAt: attendance.createdAt,
            updatedAt: attendance.updatedAt
        });
    } catch (error) {
        console.error('markAttendance error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get attendance records (Admin/Teacher gets all, Student gets their own)
// @route   GET /api/attendance
// @access  Private
const getUserAttendance = async (req, res) => {
    try {
        const { student, course } = req.query;
        let query = {};

        if (course) {
            query.courseId = course;
        }

        // Student role validation: must query their own ID
        let targetStudentId = student;
        if (req.user.role === 'Student') {
            if (student && student.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to view other students\' attendance' });
            }
            targetStudentId = req.user._id.toString();
        }

        const attendanceRecords = await Attendance.find(query).sort({ date: -1 });
        const resolvedRecords = [];

        for (const record of attendanceRecords) {
            let recordsToInclude = record.records;
            if (targetStudentId) {
                recordsToInclude = record.records.filter(r => r.studentId.toString() === targetStudentId.toString());
            }

            if (recordsToInclude.length === 0) continue;

            const resolvedStudentRecords = [];
            for (const r of recordsToInclude) {
                let studentData = { _id: r.studentId, name: 'Unknown Student', email: '' };
                try {
                    const response = await axios.get(`${CORE_SERVICE_URL}/api/users/${r.studentId}`, {
                        headers: { Authorization: req.headers.authorization }
                    });
                    if (response.data) {
                        studentData = {
                            _id: response.data._id,
                            name: response.data.name,
                            email: response.data.email
                        };
                    }
                } catch (err) {
                    console.error(`Failed to fetch user ${r.studentId} from Core Service:`, err.message);
                }

                resolvedStudentRecords.push({
                    student: studentData,
                    status: r.status,
                    _id: r._id
                });
            }

            resolvedRecords.push({
                _id: record._id,
                course: record.courseId,
                date: record.date,
                records: resolvedStudentRecords,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt
            });
        }

        res.json(resolvedRecords);
    } catch (error) {
        console.error('getUserAttendance error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAttendance,
    markAttendance,
    getUserAttendance,
    getActiveSession,
    submitAttendanceCode,
    createSessionOverride,
    getSessionOverrides,
};
