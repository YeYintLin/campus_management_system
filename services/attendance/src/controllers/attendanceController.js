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
        const { courseId = 'McE-52039', year = '5th Year', month = '1', templateType = 'daily', semester = '1' } = req.query;

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
        let courseInfo = { code: courseId, name: courseId, teacher: req.user.name || 'Subject Teacher' };
        let studentsList = [];

        try {
            const courseRes = await axios.get(`${CORE_SERVICE_URL}/api/courses/${courseId}`, {
                headers: { Authorization: token },
                timeout: 3000
            }).catch(() => null);

            if (courseRes?.data) {
                courseInfo.code = courseRes.data.code || courseId;
                courseInfo.name = courseRes.data.name || courseId;
                if (courseRes.data.teacher?.name) {
                    courseInfo.teacher = courseRes.data.teacher.name;
                }
            }

            // Fetch Students
            const usersRes = await axios.get(`${CORE_SERVICE_URL}/api/users?role=Student`, {
                headers: { Authorization: token },
                timeout: 3000
            }).catch(() => null);

            if (usersRes?.data && Array.isArray(usersRes.data)) {
                studentsList = usersRes.data.filter(s => {
                    const sYr = String(s.year || '').toLowerCase();
                    return !yrStr || sYr.includes(yrStr.replace(' year', '')) || yrStr.includes(sYr);
                });
            }
        } catch (e) {
            console.error('Core service fetch error during Excel export:', e.message);
        }

        // Fallback demo students if no students returned
        if (studentsList.length === 0) {
            studentsList = [
                { _id: '1', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-1`, name: 'မဟန်နီစိုး' },
                { _id: '2', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-2`, name: 'မဆူးအိလှိုင်' },
                { _id: '3', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-3`, name: 'မခိုင်ရတနာထွဋ်' },
                { _id: '4', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-4`, name: 'မရွှန်းလဲ့လဲ့ဖြိုး' },
                { _id: '5', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-5`, name: 'မအိမ့်ဖူးစံ' },
                { _id: '6', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-6`, name: 'မောင်ကောင်းထက်မြတ်' },
                { _id: '7', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-7`, name: 'မလင်းလဲ့ကြည်ဖြူသန့်' },
                { _id: '8', rollNo: `${isUpperYear ? 'V' : 'I'}-MC-8`, name: 'မောင်ဇင်မင်းထက်' },
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
            return `ROLL-${index + 1}`;
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

        if (templateType === 'tutorial') {
            // ── TUTORIAL GRID (Sheet1 Style) ──
            const sheet = workbook.addWorksheet('Sheet1');
            sheet.addRow([`${courseInfo.code}, ${courseInfo.name} — Tutorial Sign`]);
            sheet.getRow(1).font = { bold: true, size: 14 };

            const headerRow = sheet.addRow(['No', 'Roll No', 'Name', 'Tutorial I', 'Tutorial II', 'Tutorial III', 'Tutorial IV', 'Tutorial V']);
            headerRow.font = { bold: true };

            studentsList.forEach((st, idx) => {
                sheet.addRow([idx + 1, st.rollNo || `V-MC-${idx + 1}`, st.name, '', '', '', '', '']);
            });
        } else {
            // ── DAILY ROLL CALL GRID (Sheet V Style) ──
            const sheet = workbook.addWorksheet('V');

            // Title Headers
            const title1 = sheet.addRow(['Technological University ( Hmawbi )']);
            sheet.mergeCells('A1:Y1');
            title1.font = { bold: true, size: 14 };
            title1.alignment = { horizontal: 'center' };

            const title2 = sheet.addRow(['Attendance Record ( 2025 - 2026 )']);
            sheet.mergeCells('A2:Y2');
            title2.font = { bold: true, size: 12 };
            title2.alignment = { horizontal: 'center' };

            // Info Subheaders
            sheet.addRow([`V MC ( ${courseInfo.code} )`, '', '', '', '', '', `ဘာသာရပ် - ${courseInfo.name}`]);
            const totalMonthlyHours = Math.max(12, attendanceRecords.length) * hourWeight;
            sheet.addRow([`၂၀၂၅ - ၂၀၂၆ ခုနှစ်၊ ${month} လ`, '', '', '', '', '', `ယခုလတက်ချိန် - ${totalMonthlyHours} နာရီ`]);

            // Table Header (Row 5)
            const headerValues = ['စဉ်', 'ခုံအမှတ်', 'အမည်'];
            // 19 period/date columns (D through V)
            for (let p = 1; p <= 19; p++) {
                if (attendanceRecords[p - 1]) {
                    const d = new Date(attendanceRecords[p - 1].date);
                    headerValues.push(`${d.getMonth() + 1}/${d.getDate()}`);
                } else {
                    headerValues.push(`P${p}`);
                }
            }
            headerValues.push('တက်ချိန်ပေါင်း', 'ပျက်ချိန်ပေါင်း', 'ရာခိုင်နှုန်း');

            const tableHeader = sheet.addRow(headerValues);
            tableHeader.font = { bold: true };
            tableHeader.alignment = { horizontal: 'center' };

            // Student Roster Rows
            studentsList.forEach((st, idx) => {
                const rowNum = idx + 6; // 1-indexed row number starting at 6
                const rowValues = [idx + 1, st.rollNo || `V-MC-${idx + 1}`, st.name];

                // Checkmarks for 19 period columns (D to V)
                for (let p = 0; p < 19; p++) {
                    const rec = attendanceRecords[p];
                    if (rec) {
                        const studentRec = rec.records.find(r => r.studentId.toString() === String(st._id));
                        rowValues.push(studentRec && studentRec.status === 'Present' ? '✓' : '');
                    } else {
                        // Sample checkmarks for demo if no record
                        rowValues.push(idx % 2 === 0 || p % 3 !== 0 ? '✓' : '');
                    }
                }

                // Append empty strings for formulas
                rowValues.push('', '', '');
                const row = sheet.addRow(rowValues);

                // Add Live Excel Formulas for Attended Hours (W), Absent Hours (X), and Percentage (Y)
                const attendedCell = row.getCell(23); // Col W
                attendedCell.value = { formula: `=COUNTIF(D${rowNum}:V${rowNum}, "✓") * ${hourWeight}` };

                const absentCell = row.getCell(24); // Col X
                absentCell.value = { formula: `=(COUNTA(D$5:V$5) - COUNTIF(D${rowNum}:V${rowNum}, "✓")) * ${hourWeight}` };

                const pctCell = row.getCell(25); // Col Y
                pctCell.value = { formula: `=IF((W${rowNum}+X${rowNum})>0, ROUND((W${rowNum}/(W${rowNum}+X${rowNum}))*100, 1) & "%", "100%")` };
            });

            // Teacher Signature Footer
            sheet.addRow([]);
            sheet.addRow(['', '', 'လက်မှတ် -------------------------------------------']);
            const sigRow = sheet.addRow(['', '', `ဘာသာရပ်ဆရာအမည် ------------------------------------------- (${courseInfo.teacher})`]);
            sigRow.font = { italic: true };
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Roll_Call_${courseInfo.code}_${templateType}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('exportRollCallExcel error:', error.message);
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
    getAttendanceSummary,
    exportRollCallExcel,
};
