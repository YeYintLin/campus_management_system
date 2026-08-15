const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const SessionOverride = require('../models/SessionOverride');
const axios = require('axios');

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:5002';
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'cms-internal-secret-token';

// Helper: Fire async attendance rate recalculation to core service
const notifyAttendanceRecalculation = async (studentIds) => {
    if (!studentIds) return;
    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    for (const sid of ids) {
        if (!sid) continue;
        try {
            axios.post(
                `${CORE_SERVICE_URL}/api/enrollments/recalculate-attendance`,
                { studentId: sid.toString() },
                {
                    headers: { 'x-internal-service-token': INTERNAL_SERVICE_SECRET },
                    timeout: 4000,
                }
            ).catch(err => {
                // Non-blocking background sync
            });
        } catch {}
    }
};

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
        const { courseId, courseName, durationSeconds = 30, department, year } = req.body;

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
        const seconds = Number(durationSeconds) || 30;
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
        notifyAttendanceRecalculation(studentId);

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

const getAttendance = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { date } = req.query;

        // Build flexible query supporting both course._id and course.code
        let query = {
            $or: [
                { courseId: courseId },
                { courseId: courseId.toUpperCase() },
                { courseId: courseId.toLowerCase() }
            ]
        };

        // Try to fetch course details to resolve both code and _id
        try {
            const token = req.headers.authorization;
            const courseRes = await axios.get(`${CORE_SERVICE_URL}/api/courses/${courseId}`, {
                headers: { Authorization: token },
                timeout: 3000
            }).catch(() => null);

            if (courseRes?.data) {
                const c = courseRes.data;
                if (c._id) query.$or.push({ courseId: c._id.toString() });
                if (c.code) {
                    query.$or.push({ courseId: c.code });
                    query.$or.push({ courseId: c.code.toUpperCase() });
                    query.$or.push({ courseId: c.code.toLowerCase() });
                }
            }
        } catch (e) {}

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

        notifyAttendanceRecalculation(dbRecords.map(r => r.studentId));

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
        const roleStr = (req.user.role || '').toLowerCase();
        if (roleStr === 'student') {
            if (student && student.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to view other students\' attendance' });
            }
            targetStudentId = req.user._id.toString();
        }

        // Optimization: if filtering by student, use $elemMatch to only fetch records containing them
        if (targetStudentId) {
            query['records'] = { $elemMatch: { studentId: targetStudentId } };
        }

        const attendanceRecords = await Attendance.find(query).sort({ date: -1 });
        const resolvedRecords = [];

        // For students viewing their own records, skip the expensive per-record HTTP resolution
        const isOwnStudentView = roleStr === 'student' && targetStudentId;
        const selfStudentData = isOwnStudentView ? {
            _id: req.user._id,
            name: req.user.name || 'Student',
            email: req.user.email || ''
        } : null;

        for (const record of attendanceRecords) {
            let recordsToInclude = record.records;
            if (targetStudentId) {
                recordsToInclude = record.records.filter(r => r.studentId.toString() === targetStudentId.toString());
            }

            if (recordsToInclude.length === 0) continue;

            const resolvedStudentRecords = [];
            for (const r of recordsToInclude) {
                let studentData = selfStudentData || { _id: r.studentId, name: 'Unknown Student', email: '' };

                // Only call Core Service for non-student (teacher/admin) views
                if (!isOwnStudentView) {
                    try {
                        const response = await axios.get(`${CORE_SERVICE_URL}/api/users/${r.studentId}`, {
                            headers: { Authorization: req.headers.authorization },
                            timeout: 3000
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
                courseCode: record.courseId,
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

// ─────────────────────────────────────────────
// GET /api/attendance/summary
// Calculates weekly and monthly attendance percentage per subject with year multipliers
// ─────────────────────────────────────────────
const getAttendanceSummary = async (req, res) => {
    try {
        const { courseId, year, semester = '1' } = req.query;

        const yrStr = String(year || req.user?.year || '').toLowerCase();
        const semStr = String(semester || '1').toLowerCase();

        // 6th Year Semester 2 Exemption Check
        const is6thYear = yrStr.includes('6') || yrStr.includes('sixth') || yrStr.includes('final');
        const isSem2 = semStr === '2' || semStr.includes('second') || semStr.includes('ii');

        if (is6thYear && isSem2) {
            return res.json({
                isExempt: true,
                message: 'Attendance tracking is exempt for 6th Year Semester 2 (Thesis / Project Presentations)',
                weeklyPercentage: '100%',
                monthlyPercentage: '100%',
                totalSessions: 0,
                totalSubjectHours: 0
            });
        }

        // Determine hour weight: 1 hr for Y1-Y4, 3 hrs for Y5-Y6
        const isUpperYear = yrStr.includes('5') || yrStr.includes('fifth') || yrStr.includes('6') || yrStr.includes('sixth') || yrStr.includes('final');
        const hourWeight = isUpperYear ? 3 : 1;

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

        let query = {};
        if (courseId) {
            query.courseId = new RegExp(`^${courseId.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}$`, 'i');
        }

        const monthlyRecords = await Attendance.find({
            ...query,
            date: { $gte: thirtyDaysAgo }
        });

        const weeklyRecords = monthlyRecords.filter(r => new Date(r.date) >= sevenDaysAgo);

        // Compute Student's attendance percentage if Student role, else class average
        const targetStudentId = req.user.role === 'Student' ? req.user._id.toString() : null;

        const calcStats = (records) => {
            if (!records || records.length === 0) return { attendedHours: 0, totalHours: 0, percentage: '100%' };

            let totalHours = records.length * hourWeight;
            let attendedHours = 0;

            if (targetStudentId) {
                records.forEach(rec => {
                    const studentEntry = rec.records.find(sr => sr.studentId.toString() === targetStudentId);
                    if (studentEntry && studentEntry.status === 'Present') {
                        attendedHours += hourWeight;
                    }
                });
            } else {
                // Class Average
                let sumAttended = 0;
                let sumTotalPossible = 0;
                records.forEach(rec => {
                    const presentCount = rec.records.filter(sr => sr.status === 'Present').length;
                    const totalStudents = rec.records.length || 1;
                    sumAttended += presentCount * hourWeight;
                    sumTotalPossible += totalStudents * hourWeight;
                });

                if (sumTotalPossible > 0) {
                    const pct = Math.round((sumAttended / sumTotalPossible) * 1000) / 10;
                    return {
                        attendedHours: sumAttended,
                        totalHours: sumTotalPossible,
                        percentage: `${pct}%`
                    };
                }
            }

            const percentage = totalHours > 0 ? `${(Math.round((attendedHours / totalHours) * 1000) / 10)}%` : '100%';
            return { attendedHours, totalHours, percentage };
        };

        const weeklyStats = calcStats(weeklyRecords);
        const monthlyStats = calcStats(monthlyRecords);

        res.json({
            courseId: courseId || 'All',
            isExempt: false,
            hourWeight,
            totalMonthlySessions: monthlyRecords.length,
            totalMonthlyHours: monthlyRecords.length * hourWeight,
            weeklyPercentage: weeklyStats.percentage,
            monthlyPercentage: monthlyStats.percentage,
        });

    } catch (error) {
        console.error('getAttendanceSummary error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/attendance/export-excel
// Exports official Technological University (Hmawbi) Roll Call Excel workbook
// ─────────────────────────────────────────────
const exportRollCallExcel = async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const { courseId = 'McE-52039', year = '5th Year', month = 'ဇန်နဝါရီ (Jan)', templateType = 'daily', semester = '1' } = req.query;

        const yrStr = String(year || req.user?.year || '').toLowerCase();
        const semStr = String(semester || '1').toLowerCase();

        // 6th Year Semester 2 Exemption Check
        const is6thYear = yrStr.includes('6') || yrStr.includes('sixth') || yrStr.includes('final');
        const isSem2 = semStr === '2' || semStr.includes('second') || semStr.includes('ii');

        if (is6thYear && isSem2) {
            return res.status(400).json({
                message: 'Attendance export is exempt for 6th Year Semester 2 (Thesis / Project Presentations)'
            });
        }

        const isUpperYear = yrStr.includes('5') || yrStr.includes('fifth') || yrStr.includes('6') || yrStr.includes('sixth') || yrStr.includes('final');
        const hourWeight = isUpperYear ? 3 : 1;

        // Fetch Course Details & Enrolled Students from Core Service
        const token = req.headers.authorization;
        let courseInfo = { code: courseId, name: courseId, teacher: req.user.name || 'Subject Teacher', year: year };
        let studentsList = [];

        try {
            const courseRes = await axios.get(`${CORE_SERVICE_URL}/api/courses/${courseId}`, {
                headers: { Authorization: token },
                timeout: 5000
            }).catch(() => null);

            if (courseRes?.data) {
                courseInfo.code = courseRes.data.code || courseId;
                courseInfo.name = courseRes.data.name || courseId;
                if (courseRes.data.yearLabel || courseRes.data.year) {
                    courseInfo.year = courseRes.data.yearLabel || `${courseRes.data.year}th Year`;
                }
                if (courseRes.data.teacher?.name) {
                    courseInfo.teacher = courseRes.data.teacher.name;
                }

                if (Array.isArray(courseRes.data.students) && courseRes.data.students.length > 0) {
                    studentsList = courseRes.data.students.map(s => typeof s === 'object' ? s : { _id: s });
                }
            }

            // If course.students wasn't populated, fetch students from Core API
            if (studentsList.length === 0 || !studentsList[0].name) {
                const usersRes = await axios.get(`${CORE_SERVICE_URL}/api/users?role=Student`, {
                    headers: { Authorization: token },
                    timeout: 5000
                }).catch(() => null);

                if (usersRes?.data && Array.isArray(usersRes.data)) {
                    const deriveDeptFromCode = (code = '') => {
                        const c = code.toUpperCase();
                        if (c.includes('MCE') || c.match(/\bMC\b/)) return 'mechatronics';
                        if (c.includes('CE') && !c.includes('MCE') && !c.includes('ECE')) return 'civil';
                        if (c.includes('EP')) return 'electrical power';
                        if (c.includes('ECE') || (c.includes('EC') && !c.includes('MCE'))) return 'electronic';
                        if (c.includes('IT')) return 'information';
                        if (c.includes('ME') && !c.includes('MCE')) return 'mechanical';
                        if (c.includes('ARCH') || c.includes('AR') || c.includes('AG')) return 'architecture';
                        return '';
                    };

                    const deriveDeptFromEmail = (email = '') => {
                        if (!email) return '';
                        const parts = email.split('@')[0].toLowerCase().split('.');
                        if (parts.length >= 2) {
                            const d = parts[1];
                            if (d === 'mc' || d === 'mce') return 'mechatronics';
                            if (d === 'arch' || d === 'ar') return 'architecture';
                            if (d === 'c' || d === 'ce') return 'civil';
                            if (d === 'ep') return 'electrical power';
                            if (d === 'ec' || d === 'ece') return 'electronic';
                            if (d === 'it') return 'information';
                            if (d === 'me') return 'mechanical';
                        }
                        return '';
                    };

                    const targetDept = deriveDeptFromCode(courseId);
                    const cYrLabel = (courseInfo.year || yrStr).toLowerCase();
                    const targetYrNum = cYrLabel.includes('1') || cYrLabel.includes('first') ? '1' :
                                       cYrLabel.includes('2') || cYrLabel.includes('second') ? '2' :
                                       cYrLabel.includes('3') || cYrLabel.includes('third') ? '3' :
                                       cYrLabel.includes('4') || cYrLabel.includes('fourth') ? '4' :
                                       cYrLabel.includes('5') || cYrLabel.includes('fifth') ? '5' :
                                       cYrLabel.includes('6') || cYrLabel.includes('sixth') ? '6' : '';

                    studentsList = usersRes.data.filter(s => {
                        // Filter out test demo accounts
                        const sName = (s.name || '').toLowerCase();
                        if (sName.includes('demo') || sName.includes('test') || sName === 'rohit' || sName === 'jxuddnjd' || sName.includes('user')) {
                            return false;
                        }

                        // Year filter
                        const sYr = String(s.year || '').toLowerCase();
                        const yearMatch = !targetYrNum || sYr.includes(targetYrNum);
                        if (!yearMatch) return false;

                        // Department filter
                        if (!targetDept) return true;
                        const sDept = (s.department || '').toLowerCase();
                        const emailDept = deriveDeptFromEmail(s.email);
                        return sDept.includes(targetDept) || targetDept.includes(sDept) || emailDept === targetDept;
                    });
                }
            }
        } catch (e) {
            console.error('Core service fetch error during Excel export:', e.message);
        }

        // Derive Roman Numeral Prefix (e.g., V, IV, III, II, I)
        const cYr = (courseInfo.year || yrStr || '').toLowerCase();
        const romanYr = cYr.includes('1') || cYr.includes('first') ? 'I' :
                        cYr.includes('2') || cYr.includes('second') ? 'II' :
                        cYr.includes('3') || cYr.includes('third') ? 'III' :
                        cYr.includes('4') || cYr.includes('fourth') ? 'IV' :
                        cYr.includes('5') || cYr.includes('fifth') ? 'V' :
                        cYr.includes('6') || cYr.includes('sixth') ? 'VI' : 'ME';

        // Fallback students if no students returned
        if (studentsList.length === 0) {
            studentsList = [
                { _id: '1', rollNo: `${romanYr}-MC-1`, name: 'မဟန်နီစိုး' },
                { _id: '2', rollNo: `${romanYr}-MC-2`, name: 'မဆူးအိလှိုင်' },
                { _id: '3', rollNo: `${romanYr}-MC-3`, name: 'မခိုင်ရတနာထွဋ်' },
                { _id: '4', rollNo: `${romanYr}-MC-4`, name: 'မရွှန်းလဲ့လဲ့ဖြိုး' },
                { _id: '5', rollNo: `${romanYr}-MC-5`, name: 'မအိမ့်ဖူးစံ' },
                { _id: '6', rollNo: `${romanYr}-MC-6`, name: 'မောင်ကောင်းထက်မြတ်' },
                { _id: '7', rollNo: `${romanYr}-MC-7`, name: 'မလင်းလဲ့ကြည်ဖြူသန့်' },
                { _id: '8', rollNo: `${romanYr}-MC-8`, name: 'မောင်ဇင်မင်းထက်' },
                { _id: '9', rollNo: `${romanYr}-MC-9`, name: 'မောင်နိုင်လင်းအောင်' },
                { _id: '10', rollNo: `${romanYr}-MC-10`, name: 'မောင်ကောင်းသီဟသူ' },
                { _id: '11', rollNo: `${romanYr}-MC-11`, name: 'မောင်ပိုင်စွမ်းပြည့်' },
                { _id: '12', rollNo: `${romanYr}-MC-12`, name: 'မောင်စွမ်းရည်ကောင်းမြတ်' },
                { _id: '13', rollNo: `${romanYr}-MC-13`, name: 'မောင်စိုးရဲထက်' },
                { _id: '14', rollNo: `${romanYr}-MC-14`, name: 'မောင်ဇေညီညီစိုး' }
            ];
        }

        // Sort students list numerically by roll number
        const deriveRollNo = (student, index) => {
            if (student.rollNo && String(student.rollNo).trim()) {
                return String(student.rollNo).trim().toUpperCase();
            }
            if (student.email) {
                const prefix = student.email.split('@')[0];
                const parts = prefix.split('.');
                if (parts.length >= 3) {
                    return `${parts[0].toUpperCase()}-${parts[1].toUpperCase()}-${parts[2]}`;
                } else if (parts.length === 2) {
                    return `${parts[0].toUpperCase()}-${parts[1].toUpperCase()}`;
                }
            }
            return `${romanYr}-MC-${index + 1}`;
        };

        studentsList.sort((a, b) => {
            const rollA = deriveRollNo(a, 0);
            const rollB = deriveRollNo(b, 0);

            const numAMatches = rollA.match(/\d+/g);
            const numBMatches = rollB.match(/\d+/g);

            const numA = numAMatches ? parseInt(numAMatches[numAMatches.length - 1], 10) : 999999;
            const numB = numBMatches ? parseInt(numBMatches[numBMatches.length - 1], 10) : 999999;

            const prefixA = rollA.replace(/\d+/g, '').toLowerCase();
            const prefixB = rollB.replace(/\d+/g, '').toLowerCase();

            if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
            return numA - numB;
        });

        // Fetch Attendance Records for date mapping
        const attendanceRecords = await Attendance.find({
            courseId: new RegExp(`^${courseId.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}$`, 'i')
        }).sort({ date: 1 });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Campus Management System (CMS)';
        workbook.created = new Date();

        const toMyanmarDigits = (num) => {
            const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
            return String(num).replace(/\d/g, d => myanmarNumbers[parseInt(d, 10)]);
        };

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        if (templateType === 'tutorial') {
            // ── TUTORIAL GRID (Sheet1 Style) ──
            const sheet = workbook.addWorksheet('Sheet1', {
                pageSetup: {
                    paperSize: 9, // A4
                    orientation: 'portrait',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 1,
                    horizontalDpi: 300,
                    verticalDpi: 300,
                    margins: { left: 0.45, right: 0.0, top: 0.5, bottom: 0.5 }
                }
            });
            
            sheet.columns = [
                { width: 4.44 },
                { width: 13.55 },
                { width: 26.33 },
                { width: 10 },
                { width: 10 },
                { width: 10 },
                { width: 10 },
                { width: 10 }
            ];

            const titleRow = sheet.addRow([`${courseInfo.code}, ${courseInfo.name}\nTutorial Sign`]);
            sheet.mergeCells('A1:H1');
            titleRow.font = { bold: true, size: 12 };
            titleRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

            const headerRow = sheet.addRow(['No ', 'Roll No ', 'Name', 'Tutorial I', 'Tutorial II', 'Tutorial III', 'Tutorial IV', 'Tutorial V']);
            headerRow.font = { bold: true };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

            studentsList.forEach((st, idx) => {
                const row = sheet.addRow([idx + 1, deriveRollNo(st, idx), st.name, '', '', '', '', '']);
                row.alignment = { vertical: 'middle' };
                row.getCell(1).alignment = { horizontal: 'center' };
                row.getCell(2).alignment = { horizontal: 'center' };
            });
        } else {
            // ── OFFICIAL ROLL CALL GRID (Exact 1-to-1 V Year MC Roll Call ( 2025-2026 ).xlsx Replica) ──
            const sheet = workbook.addWorksheet('V', {
                headerFooter: {
                    oddHeader: '&RForm No. TUHMB-028',
                    oddFooter: '&LTUHMB/F-028/Rev-0/25.2.2022'
                },
                pageSetup: {
                    paperSize: 9, // A4 Portrait
                    orientation: 'portrait',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 1,
                    horizontalDpi: 300,
                    verticalDpi: 300,
                    margins: { left: 0.45, right: 0.0, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
                }
            });

            // Exact Column Widths matching official V Year MC Roll Call template
            sheet.columns = [
                { width: 4.44 },   // Col A: Serial (စဉ်)
                { width: 13.55 },  // Col B: Roll No (ခုံအမှတ်)
                { width: 26.33 },  // Col C: Name (အမည်)
                ...Array(19).fill({ width: 2.11 }), // Cols D-V: 19 Period columns
                { width: 3.44 },   // Col W: Attended (တက်ချိန်ပေါင်း)
                { width: 3.89 },   // Col X: Absent (ပျက်ချိန်ပေါင်း)
                { width: 3.89 }    // Col Y: Pct (ရာခိုင်နှုန်း)
            ];

            // Row 1: Technological University ( Hmawbi ) (Height 22.8)
            const row1 = sheet.addRow(['Technological University ( Hmawbi )']);
            row1.height = 22.8;
            sheet.mergeCells('A1:Y1');
            sheet.getCell('A1').font = { bold: true, size: 14 };
            sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Row 2: Attendance Record ( 2025 - 2026 ) (Height 22.8)
            const row2 = sheet.addRow(['Attendance Record ( 2025 - 2026 )']);
            row2.height = 22.8;
            sheet.mergeCells('A2:Y2');
            sheet.getCell('A2').font = { bold: true, size: 12 };
            sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

            const classCode = `${romanYr} MC`;

            // Row 3: Class Code & Subject Header
            const row3 = sheet.addRow([classCode, '', '', '', '', '', `ဘာသာရပ် - ${courseInfo.name || courseInfo.code}`]);
            sheet.mergeCells('A3:F3');
            sheet.mergeCells('G3:Y3');
            sheet.getCell('A3').font = { bold: true, size: 10 };
            sheet.getCell('G3').font = { bold: true, size: 10 };
            sheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
            sheet.getCell('G3').alignment = { horizontal: 'left', vertical: 'middle' };

            // Row 4: Academic Year/Month & Monthly Total Hours (Height 24.75)
            const conductedSessions = attendanceRecords.length;
            const totalMonthlyHours = conductedSessions > 0 ? conductedSessions * hourWeight : 0;
            const monthLabel = month && String(month).trim() !== '' ? month : 'ဇန်နဝါရီ';
            const row4 = sheet.addRow([`၂၀၂၅ - ၂၀၂၆ ခုနှစ်၊ ${monthLabel} လ`, '', '', '', '', '', `ယခုလတက်ချိန် - ${toMyanmarDigits(totalMonthlyHours)} နာရီ`]);
            row4.height = 24.75;
            sheet.mergeCells('A4:F4');
            sheet.mergeCells('G4:Y4');
            sheet.getCell('A4').font = { size: 10 };
            sheet.getCell('G4').font = { bold: true, size: 10 };
            sheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };
            sheet.getCell('G4').alignment = { horizontal: 'left', vertical: 'middle' };

            // Row 5: Table Header (Height 79.5) with Period Headers and Rotated 90-degree Calculation Titles
            const periodHeaders = [];
            for (let p = 0; p < 19; p++) {
                if (p < conductedSessions) {
                    const rec = attendanceRecords[p];
                    const dayNum = rec?.date ? new Date(rec.date).getDate() : (p + 1);
                    periodHeaders.push(toMyanmarDigits(dayNum));
                } else {
                    periodHeaders.push('');
                }
            }

            const headerValues = ['စဉ်', 'ခုံအမှတ်', 'အမည်', ...periodHeaders, 'တက်ချိန်ပေါင်း', 'ပျက်ချိန်ပေါင်း', 'ရာခိုင်နှုန်း'];
            const tableHeader = sheet.addRow(headerValues);
            tableHeader.height = 79.5;

            for (let col = 1; col <= 25; col++) {
                const cell = tableHeader.getCell(col);
                cell.border = thinBorder;
                cell.font = { bold: true, size: 9 };
                if (col >= 23) {
                    cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                }
            }

            // Student Roster Rows (Rows 6 to 25) - Height 27.75
            const totalRowsToRender = Math.max(studentsList.length, 20);
            for (let i = 0; i < totalRowsToRender; i++) {
                const isRealStudent = i < studentsList.length;
                const st = isRealStudent ? studentsList[i] : null;
                const rowNum = i + 6;
                const myanmarNo = isRealStudent ? toMyanmarDigits(i + 1) : '';
                const rollStr = isRealStudent ? deriveRollNo(st, i) : '';
                const nameStr = isRealStudent ? st.name : '';

                const rowValues = [myanmarNo, rollStr, nameStr];

                // Checkmarks for 19 period columns (D to V)
                for (let p = 0; p < 19; p++) {
                    if (isRealStudent && p < conductedSessions) {
                        const rec = attendanceRecords[p];
                        if (rec && Array.isArray(rec.records)) {
                            const studentRec = rec.records.find(r =>
                                String(r.studentId) === String(st._id) ||
                                String(r.studentId) === String(st.user?._id) ||
                                String(r.studentId) === String(i + 1) ||
                                (rollStr && String(r.studentId).toUpperCase() === rollStr.toUpperCase()) ||
                                (st.rollNo && String(r.studentId).toUpperCase() === String(st.rollNo).toUpperCase())
                            );
                            rowValues.push(studentRec && studentRec.status === 'Present' ? '✓' : '');
                        } else {
                            rowValues.push('');
                        }
                    } else {
                        rowValues.push('');
                    }
                }

                // Append empty strings for formulas
                rowValues.push('', '', '');
                const row = sheet.addRow(rowValues);
                row.height = 27.75;

                for (let col = 1; col <= 25; col++) {
                    const cell = row.getCell(col);
                    cell.border = thinBorder;
                    cell.font = { size: 9.5 };

                    if (col === 1 || col === 2) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (col === 3) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    } else if (col >= 23 && isRealStudent) {
                        const endColLetter = conductedSessions > 0 ? String.fromCharCode(68 + conductedSessions - 1) : 'V';
                        // Formulas for W, X, Y
                        if (col === 23) {
                            cell.value = { formula: `=COUNTIF(D${rowNum}:${endColLetter}${rowNum}, "✓") * ${hourWeight}` };
                        } else if (col === 24) {
                            cell.value = { formula: `=(${conductedSessions} - COUNTIF(D${rowNum}:${endColLetter}${rowNum}, "✓")) * ${hourWeight}` };
                        } else if (col === 25) {
                            cell.value = { formula: `=IF((W${rowNum}+X${rowNum})>0, ROUND((W${rowNum}/(W${rowNum}+X${rowNum}))*100, 1) & "%", "0%")` };
                        }
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                }
            }

            // Row 26: Signature Line
            const sig1RowNumber = sheet.rowCount + 1;
            const sig1Row = sheet.addRow(['', '', 'လက်မှတ် -------------------------------------------']);
            sheet.mergeCells(`C${sig1RowNumber}:Y${sig1RowNumber}`);
            sig1Row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
            sig1Row.getCell(3).font = { size: 9.5 };

            // Row 27: Teacher Signature Name Line
            const sig2RowNumber = sheet.rowCount + 1;
            const sig2Row = sheet.addRow(['', '', `ဘာသာရပ်ဆရာအမည် ------------------------------------------- (${courseInfo.teacher})`]);
            sheet.mergeCells(`C${sig2RowNumber}:Y${sig2RowNumber}`);
            sig2Row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
            sig2Row.getCell(3).font = { size: 9.5, italic: true };
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Roll_Call_${courseInfo.code}_${templateType}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('exportRollCallExcel error:', error.message);
        res.status(500).json({ message: 'Failed to generate official Roll Call Excel workbook' });
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
    getAttendanceSummary,
    exportRollCallExcel,
};
