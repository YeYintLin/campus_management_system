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
        const { role } = req.user;
        const now = new Date();

        // Find currently active, non-expired session
        const sessionQuery = {
            status: 'active',
            expiresAt: { $gt: now },
        };

        // Department scoping for Student role
        if (role === 'Student' && req.user.department) {
            const userDept = req.user.department.trim();
            sessionQuery.$or = [
                { department: { $regex: new RegExp(userDept, 'i') } },
                { department: 'All' },
                { department: '' },
                { department: { $exists: false } }
            ];
        }

        let session = await AttendanceSession.findOne(sessionQuery).sort({ createdAt: -1 });

        if (!session) {
            return res.json(null);
        }

        // Generate qrToken if missing on older active session
        if (!session.qrToken) {
            const crypto = require('crypto');
            session.qrToken = crypto.randomBytes(16).toString('hex');
            await session.save();
        }

        // Return session info (including qrToken for QR rendering & URL matching)
        res.json({
            _id: session._id,
            courseId: session.courseId,
            courseName: session.courseName,
            code: role === 'Teacher' || role === 'Admin' || role === 'SuperAdmin' ? session.code : undefined,
            qrToken: session.qrToken,
            expiresAt: session.expiresAt,
            status: session.status,
        });
    } catch (error) {
        console.error('getActiveSession error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/attendance/create-session
// Teacher/Admin manually triggers a live attendance session
// ─────────────────────────────────────────────
const createSession = async (req, res) => {
    try {
        const { courseId, courseName, durationSeconds = 20, department, year } = req.body;

        if (!courseId) {
            return res.status(400).json({ message: 'courseId is required' });
        }

        // Expire any existing active sessions for this course
        await AttendanceSession.updateMany(
            { courseId, status: 'active' },
            { status: 'expired' }
        );

        // Generate random 4-digit code (1000-9999) & unique qrToken
        const crypto = require('crypto');
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const qrToken = crypto.randomBytes(16).toString('hex');
        const seconds = Number(durationSeconds) || 20;
        const expiresAt = new Date(Date.now() + seconds * 1000);

        const session = await AttendanceSession.create({
            courseId,
            courseName: courseName || courseId,
            department: department || req.user.department || 'Mechatronics Engineering',
            year: year || req.user.year || '',
            code,
            qrToken,
            expiresAt,
            status: 'active',
            createdBy: req.user._id.toString(),
        });

        res.status(201).json(session);
    } catch (error) {
        console.error('createSession error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/attendance/scan-qr
// Student scans QR code token to auto-verify attendance
// ─────────────────────────────────────────────
const scanQRAttendance = async (req, res) => {
    try {
        const { qrToken, code } = req.body;
        const studentId = req.user._id; // Never trust body studentId
        const now = new Date();

        if (!qrToken && !code) {
            return res.status(400).json({
                success: false,
                errorCode: 'MISSING_TOKEN',
                message: 'QR code token or passcode is required',
            });
        }

        // 1. Find session by qrToken or code
        const query = [];
        if (qrToken) query.push({ qrToken: qrToken.trim() });
        if (code) query.push({ code: code.trim() });

        const session = await AttendanceSession.findOne({ $or: query });

        if (!session) {
            return res.status(404).json({
                success: false,
                errorCode: 'NOT_FOUND',
                message: 'Invalid or unrecognized QR code session',
            });
        }

        // 2. Validate session status
        if (session.status !== 'active') {
            return res.status(400).json({
                success: false,
                errorCode: 'SESSION_ENDED',
                message: 'This attendance session is no longer active',
            });
        }

        // 3. Validate expiration time
        if (now > new Date(session.expiresAt)) {
            session.status = 'expired';
            await session.save();
            return res.status(400).json({
                success: false,
                errorCode: 'SESSION_EXPIRED',
                message: 'Attendance session has expired',
            });
        }

        // 3b. Validate Student Department Scope
        if (req.user.role === 'Student' && req.user.department && session.department && session.department !== 'All' && session.department !== '') {
            const userDept = req.user.department.toLowerCase().trim();
            const sessDept = session.department.toLowerCase().trim();
            if (!userDept.includes(sessDept) && !sessDept.includes(userDept)) {
                return res.status(403).json({
                    success: false,
                    errorCode: 'DEPARTMENT_MISMATCH',
                    message: `This session is restricted to ${session.department} students. Your department is ${req.user.department}.`,
                });
            }
        }

        // 4. Record attendance in DB for today
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
        const existingRecord = attendanceRecord.records.find(
            r => r.studentId.toString() === studentId.toString()
        );

        if (existingRecord) {
            return res.json({
                success: true,
                alreadyMarked: true,
                courseName: session.courseName || session.courseId,
                timestamp: existingRecord.updatedAt || now,
                message: 'Already marked Present for this session',
            });
        }

        // Push new Present record
        attendanceRecord.records.push({
            studentId: studentId,
            status: 'Present',
        });

        await attendanceRecord.save();

        res.json({
            success: true,
            alreadyMarked: false,
            courseName: session.courseName || session.courseId,
            timestamp: now,
            message: `Attendance marked Present for ${session.courseName || session.courseId}`,
        });
    } catch (error) {
        console.error('scanQRAttendance error:', error.message);
        res.status(500).json({
            success: false,
            errorCode: 'SERVER_ERROR',
            message: 'Failed to process QR attendance verification',
        });
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

        // Validate Student Department Scope
        if (req.user.role === 'Student' && req.user.department && session.department && session.department !== 'All' && session.department !== '') {
            const userDept = req.user.department.toLowerCase().trim();
            const sessDept = session.department.toLowerCase().trim();
            if (!userDept.includes(sessDept) && !sessDept.includes(userDept)) {
                return res.status(403).json({
                    message: `This session is restricted to ${session.department} students. Your department is ${req.user.department}.`,
                });
            }
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
    createSession,
    scanQRAttendance,
    submitAttendanceCode,
    createSessionOverride,
    getSessionOverrides,
};
