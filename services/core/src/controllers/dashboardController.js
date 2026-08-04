const Student = require('../models/Student');
const User = require('../models/User');
const Course = require('../models/Course');
const Grade = require('../models/Grade');
const Timetable = require('../models/Timetable');
const Notification = require('../models/Notification');
const ScheduledSession = require('../models/ScheduledSession');
const axios = require('axios');

const AcademicConfig = require('../models/AcademicConfig');

const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:5003';

// Fallback thresholds if not yet configured in DB
const DEFAULT_ATTENDANCE_THRESHOLD = 75;  // below this % = at-risk
const DEFAULT_FAILING_THRESHOLD = 2;      // failing this many subjects = at-risk
const DEFAULT_PASS_MARK_PERCENT = 40;     // below this % in a subject = failing

// Helper to get active academic thresholds from DB or defaults
const getThresholds = async () => {
    try {
        const config = await AcademicConfig.findOne();
        return {
            attendanceThreshold: config?.atRiskAttendanceThreshold ?? DEFAULT_ATTENDANCE_THRESHOLD,
            failingThreshold: config?.atRiskFailingThreshold ?? DEFAULT_FAILING_THRESHOLD,
            passMarkPercent: config?.passMarkPercent ?? DEFAULT_PASS_MARK_PERCENT,
        };
    } catch {
        return {
            attendanceThreshold: DEFAULT_ATTENDANCE_THRESHOLD,
            failingThreshold: DEFAULT_FAILING_THRESHOLD,
            passMarkPercent: DEFAULT_PASS_MARK_PERCENT,
        };
    }
};

// ─────────────────────────────────────────────
// Helper: Get attendance percentage for a student
// ─────────────────────────────────────────────
const getStudentAttendancePercent = async (studentId, token) => {
    try {
        const res = await axios.get(`${ATTENDANCE_SERVICE_URL}/api/attendance`, {
            params: { student: studentId },
            headers: { Authorization: token },
            timeout: 5000,
        });

        const records = res.data;
        if (!Array.isArray(records) || records.length === 0) return null;

        let totalSessions = 0;
        let presentCount = 0;

        for (const record of records) {
            if (record.records && Array.isArray(record.records)) {
                for (const r of record.records) {
                    totalSessions++;
                    if (r.status === 'Present' || r.status === 'Late') {
                        presentCount++;
                    }
                }
            }
        }

        return totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;
    } catch (err) {
        console.error(`Failed to fetch attendance for student ${studentId}:`, err.message);
        return null;
    }
};

// ─────────────────────────────────────────────
// Helper: Count failing subjects for a student
// ─────────────────────────────────────────────
const getStudentFailingCount = async (studentId, passMarkPercent = DEFAULT_PASS_MARK_PERCENT) => {
    try {
        const grades = await Grade.find({ student: studentId });
        if (grades.length === 0) return 0;

        // Group grades by course, compute average score per course
        const courseScores = {};
        for (const g of grades) {
            const courseId = g.course.toString();
            if (!courseScores[courseId]) {
                courseScores[courseId] = { totalScore: 0, totalMax: 0 };
            }
            courseScores[courseId].totalScore += (g.score || 0);
            courseScores[courseId].totalMax += (g.maxScore || 100);
        }

        let failingCount = 0;
        for (const courseId of Object.keys(courseScores)) {
            const { totalScore, totalMax } = courseScores[courseId];
            const percent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            if (percent < passMarkPercent) {
                failingCount++;
            }
        }

        return failingCount;
    } catch (err) {
        console.error(`Failed to compute failing count for student ${studentId}:`, err.message);
        return 0;
    }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/at-risk
// Query: scope=all|own, attendance_threshold, failing_threshold
// ─────────────────────────────────────────────
const getAtRiskStudents = async (req, res) => {
    try {
        const dbThresholds = await getThresholds();

        const scope = req.query.scope || 'all';
        const attThreshold = req.query.attendance_threshold
            ? Number(req.query.attendance_threshold)
            : dbThresholds.attendanceThreshold;
        const failThreshold = req.query.failing_threshold
            ? Number(req.query.failing_threshold)
            : dbThresholds.failingThreshold;
        const passMarkPercent = dbThresholds.passMarkPercent;

        const token = req.headers.authorization;

        // Determine which students to check
        let studentUserIds = [];

        if (scope === 'own' && req.user.role === 'Teacher') {
            // Teacher: only students enrolled in their courses
            const myCourses = await Course.find({ teacher: req.user._id });
            const idSet = new Set();
            for (const course of myCourses) {
                for (const sid of course.students) {
                    idSet.add(sid.toString());
                }
            }
            studentUserIds = Array.from(idSet);
        } else {
            // Admin: all active students
            const students = await Student.find({ status: 'Active' }).populate('user', 'name email status');
            studentUserIds = students
                .filter(s => s.user)
                .map(s => s.user._id.toString());
        }

        // Compute at-risk for each student (limit to avoid timeout)
        const maxCheck = Math.min(studentUserIds.length, 50);
        const atRiskList = [];

        for (let i = 0; i < maxCheck; i++) {
            const userId = studentUserIds[i];

            // Fetch student details
            const user = await User.findById(userId).select('name email year department');
            if (!user) continue;

            const student = await Student.findOne({ user: userId }).select('enrollmentNumber department status');

            // Compute risk factors
            const [attendancePercent, failingSubjects] = await Promise.all([
                getStudentAttendancePercent(userId, token),
                getStudentFailingCount(userId, passMarkPercent),
            ]);

            const riskReasons = [];
            if (attendancePercent !== null && attendancePercent < attThreshold) {
                riskReasons.push(`Attendance: ${attendancePercent}%`);
            }
            if (failingSubjects >= failThreshold) {
                riskReasons.push(`Failing ${failingSubjects} subject${failingSubjects > 1 ? 's' : ''}`);
            }

            // Also flag manually set statuses
            const manualStatus = student?.status;
            if (manualStatus === 'Probation' || manualStatus === 'Suspended') {
                riskReasons.push(`Status: ${manualStatus}`);
            }

            if (riskReasons.length > 0) {
                atRiskList.push({
                    _id: userId,
                    name: user.name,
                    email: user.email,
                    year: user.year,
                    department: student?.department || user.department,
                    enrollmentNumber: student?.enrollmentNumber || 'N/A',
                    status: manualStatus || 'Active',
                    attendancePercent,
                    failingSubjects,
                    riskReasons,
                });
            }
        }

        // Sort by number of risk reasons (most critical first)
        atRiskList.sort((a, b) => b.riskReasons.length - a.riskReasons.length);

        res.json(atRiskList);
    } catch (error) {
        console.error('getAtRiskStudents error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/stats
// Returns role-aware aggregated dashboard stats
// ─────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        const roleNorm = (role || '').toLowerCase().trim();

        const stats = {};

        if (roleNorm === 'admin' || roleNorm === 'superadmin' || roleNorm === 'academicadmin') {
            // ── Admin stats ──
            const [allStudents, allStudentUsers, courseCount, notifications] = await Promise.all([
                Student.find().populate('user', 'name status year role email'),
                User.find({ role: { $regex: /^student$/i } }).select('name status year role email'),
                Course.countDocuments(),
                Notification.find().sort({ createdAt: -1 }).limit(5),
            ]);

            // Map users & students into a consolidated student map by user ID
            const studentMap = new Map();

            for (const u of allStudentUsers) {
                studentMap.set(u._id.toString(), {
                    userId: u._id.toString(),
                    name: u.name,
                    email: u.email,
                    status: u.status || 'Active',
                    year: u.year || 1,
                });
            }

            for (const s of allStudents) {
                const uid = s.user?._id?.toString() || s.user?.toString();
                const existing = uid ? studentMap.get(uid) : null;
                const statusVal = s.user?.status || s.status || existing?.status || 'Active';
                if (uid) {
                    studentMap.set(uid, {
                        ...existing,
                        status: statusVal,
                        year: s.semester ? Math.ceil(s.semester / 2) : existing?.year || 1,
                    });
                } else {
                    studentMap.set(s._id.toString(), {
                        status: statusVal,
                        year: s.semester ? Math.ceil(s.semester / 2) : 1,
                    });
                }
            }

            const consolidatedStudents = Array.from(studentMap.values());

            // Students by year
            const yearCounts = {};
            for (const s of consolidatedStudents) {
                const year = Number(s.year) || 1;
                yearCounts[year] = (yearCounts[year] || 0) + 1;
            }
            const studentsByYear = Object.entries(yearCounts)
                .map(([year, count]) => ({ year: Number(year), count }))
                .filter(item => item.year > 0)
                .sort((a, b) => a.year - b.year);

            // Students by status (case-insensitive normalization)
            const statusCounts = { Active: 0, Probation: 0, Suspended: 0 };
            for (const s of consolidatedStudents) {
                const st = (s.status || '').toLowerCase().trim();
                if (st === 'suspended') {
                    statusCounts.Suspended += 1;
                } else if (st === 'probation') {
                    statusCounts.Probation += 1;
                } else {
                    statusCounts.Active += 1;
                }
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const notificationsSentToday = await Notification.countDocuments({
                createdAt: { $gte: todayStart },
            });

            stats.totalStudents = consolidatedStudents.length;
            stats.activeCourses = courseCount;
            stats.studentsByYear = studentsByYear;
            stats.studentsByStatus = statusCounts;
            stats.notificationsSentToday = notificationsSentToday;
            stats.recentNotifications = notifications;

            // Upcoming exams count
            const upcomingExamCount = await ScheduledSession.countDocuments({
                sessionType: 'Exam',
                date: { $gte: new Date() }
            });
            stats.upcomingExams = upcomingExamCount;

        } else if (roleNorm === 'teacher') {
            // ── Teacher stats ──
            const myCourses = await Course.find({ teacher: userId });

            // Deduplicate enrolled students
            const myStudentIds = new Set();
            for (const course of myCourses) {
                if (Array.isArray(course.students)) {
                    for (const sid of course.students) {
                        if (sid) myStudentIds.add(sid.toString());
                    }
                }
            }

            // Today's schedule
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = dayNames[new Date().getDay()];
            const myCoursesCodes = myCourses.map(c => c.code);

            const todaySlots = await Timetable.find({
                course: { $in: myCoursesCodes },
                day: today,
            }).sort({ time: 1 });

            // Enrich schedule with course name
            const scheduleWithNames = todaySlots.map(slot => {
                const courseObj = myCourses.find(c => c.code === slot.course);
                return {
                    _id: slot._id,
                    time: slot.time,
                    courseCode: slot.course,
                    courseName: courseObj ? courseObj.name : slot.course,
                    room: slot.room,
                    type: slot.type,
                    day: slot.day,
                };
            });

            // Count courses with ungraded students (simplified: courses with 0 grades)
            let pendingGrading = 0;
            for (const course of myCourses) {
                const gradeCount = await Grade.countDocuments({ course: course._id });
                if (gradeCount === 0 && Array.isArray(course.students) && course.students.length > 0) {
                    pendingGrading++;
                }
            }

            stats.activeCourses = myCourses.length;
            stats.myStudentCount = myStudentIds.size;
            stats.pendingGrading = pendingGrading;
            stats.todaySchedule = scheduleWithNames;

            // Upcoming exams count
            const upcomingExamCount = await ScheduledSession.countDocuments({
                sessionType: 'Exam',
                date: { $gte: new Date() }
            });
            stats.upcomingExams = upcomingExamCount;

        } else {
            // ── Student stats ──
            const [courses, grades, notifications] = await Promise.all([
                Course.find({ students: userId }),
                Grade.find({ student: userId }).populate('course', 'name code'),
                Notification.find({
                    $or: [{ user: userId }, { user: null }]
                }).sort({ createdAt: -1 }).limit(5),
            ]);

            // Calculate GPA
            const validGrades = Array.isArray(grades) ? grades : [];
            const totalPoints = validGrades.reduce((acc, g) => acc + (((g?.score || 0) / (g?.maxScore || 100)) * 4), 0);
            const gpa = validGrades.length > 0 ? (totalPoints / validGrades.length).toFixed(2) : null;

            // Count assignments due
            const gradedCourseIds = new Set(
                validGrades
                    .map(g => (g.course?._id ? g.course._id.toString() : g.course ? g.course.toString() : null))
                    .filter(Boolean)
            );
            const validCourses = Array.isArray(courses) ? courses : [];
            const assignmentsDue = validCourses.filter(c => c && c._id && !gradedCourseIds.has(c._id.toString())).length;

            stats.activeCourses = validCourses.length;
            stats.gpa = gpa;
            stats.assignmentsDue = assignmentsDue;
            stats.latestGrades = validGrades.slice(0, 5).map(g => ({
                courseCode: g.course?.code || 'N/A',
                courseName: g.course?.name || 'Subject',
                assessmentType: g.assessmentType || 'Assessment',
                score: g.score || 0,
                maxScore: g.maxScore || 100,
                percent: (g.maxScore || 100) > 0 ? Math.round(((g.score || 0) / (g.maxScore || 100)) * 100) : 0,
            }));
            stats.recentNotifications = Array.isArray(notifications) ? notifications : [];

            // Upcoming exams count
            const upcomingExamCount = await ScheduledSession.countDocuments({
                sessionType: 'Exam',
                date: { $gte: new Date() }
            });
            stats.upcomingExams = upcomingExamCount;
        }

        stats.role = role;
        res.json(stats);
    } catch (error) {
        console.error('getDashboardStats error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/pass-rates
// Returns pass rate per course
// ─────────────────────────────────────────────
const getPassRates = async (req, res) => {
    try {
        const dbThresholds = await getThresholds();
        const passMarkPercent = dbThresholds.passMarkPercent;
        const courses = await Course.find().select('name code students');
        const passRates = [];

        for (const course of courses) {
            const grades = await Grade.find({ course: course._id });
            if (grades.length === 0) continue;

            // Group by student, compute average per student
            const studentScores = {};
            for (const g of grades) {
                const sid = g.student.toString();
                if (!studentScores[sid]) {
                    studentScores[sid] = { totalScore: 0, totalMax: 0 };
                }
                studentScores[sid].totalScore += (g.score || 0);
                studentScores[sid].totalMax += (g.maxScore || 100);
            }

            let passed = 0;
            let total = 0;
            for (const sid of Object.keys(studentScores)) {
                total++;
                const { totalScore, totalMax } = studentScores[sid];
                const percent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                if (percent >= passMarkPercent) {
                    passed++;
                }
            }

            passRates.push({
                courseCode: course.code,
                courseName: course.name,
                totalStudents: total,
                passed,
                failed: total - passed,
                passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
            });
        }

        // Sort by pass rate ascending (worst first — most actionable)
        passRates.sort((a, b) => a.passRate - b.passRate);

        res.json(passRates);
    } catch (error) {
        console.error('getPassRates error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAtRiskStudents,
    getDashboardStats,
    getPassRates,
};
