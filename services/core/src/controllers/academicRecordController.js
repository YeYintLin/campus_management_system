const mongoose = require('mongoose');
const AcademicEnrollment = require('../models/AcademicEnrollment');
const Grade = require('../models/Grade');
const Course = require('../models/Course');
const User = require('../models/User');
const CourseAssignment = require('../models/CourseAssignment');
const AcademicConfig = require('../models/AcademicConfig');

// ─────────────────────────────────────────────
// GET /api/records/my-history
// Student Portal: Multi-Year Academic History
// ─────────────────────────────────────────────
const getMyAcademicHistory = async (req, res) => {
    try {
        const studentId = req.user._id;

        // Fetch all enrollments for this student
        const enrollments = await AcademicEnrollment.find({ student: studentId })
            .sort({ academicYear: 1 })
            .lean();

        // Fetch all grades for this student
        const grades = await Grade.find({ student: studentId })
            .populate('course', 'name code credits year semester')
            .lean();

        // Group grades by academicYear and course
        const history = [];

        for (const enrollment of enrollments) {
            const yearGrades = grades.filter(g => g.academicYear === enrollment.academicYear);

            // Fetch curriculum courses for this year/department
            const yearNum = parseInt(String(enrollment.yearLevel).replace(/\D/g, ''), 10) || 5;
            const courses = await Course.find({
                department: new RegExp(enrollment.department.split(' ')[0], 'i'),
                year: yearNum,
            }).select('name code credits semester').lean();

            // Map course records (Semester 2 gives official letterGrade, Semester 1 is In Progress)
            const courseRecords = courses.map(course => {
                const s1Grade = yearGrades.find(g => g.course?._id?.toString() === course._id.toString() && g.semester === 1);
                const s2Grade = yearGrades.find(g => g.course?._id?.toString() === course._id.toString() && g.semester === 2);

                const hasFinalGrade = s2Grade && s2Grade.letterGrade;
                return {
                    courseId: course._id,
                    code: course.code,
                    name: course.name,
                    credits: course.credits || 3,
                    semester: course.semester || (s2Grade ? 2 : 1),
                    letterGrade: hasFinalGrade ? s2Grade.letterGrade : null,
                    status: hasFinalGrade ? 'Finalized' : 'In Progress / Pending Final Exam',
                };
            });

            history.push({
                enrollmentId: enrollment._id,
                academicYear: enrollment.academicYear,
                yearLevel: enrollment.yearLevel,
                department: enrollment.department,
                rollNo: enrollment.rollNo || null,
                attendanceRate: enrollment.attendanceRate || 0,
                status: enrollment.status,
                courses: courseRecords,
            });
        }

        res.json({
            student: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                permanentRegNo: req.user.permanentRegNo || 'STU-' + req.user._id.toString().slice(-6).toUpperCase(),
                currentYear: req.user.currentYear || req.user.year || '5th Year',
                currentRollNo: req.user.currentRollNo || req.user.rollNo || null,
            },
            history,
        });
    } catch (error) {
        console.error('getMyAcademicHistory error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/records/student/:studentId
// Admin / Teacher View: Full Student History
// ─────────────────────────────────────────────
const getStudentAcademicHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        const requestingUser = req.user;
        const normalizedRole = (requestingUser.role || '').toLowerCase();

        // RBAC: Students can only view their own history
        if (normalizedRole === 'student' && requestingUser._id.toString() !== studentId.toString()) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own records' });
        }

        const student = await User.findById(studentId).select('name email rollNo permanentRegNo currentRollNo currentYear year department accountStatus');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const enrollments = await AcademicEnrollment.find({ student: studentId })
            .sort({ academicYear: 1 })
            .lean();

        const grades = await Grade.find({ student: studentId })
            .populate('course', 'name code credits year semester')
            .lean();

        const history = [];
        for (const enrollment of enrollments) {
            const yearGrades = grades.filter(g => g.academicYear === enrollment.academicYear);
            const yearNum = parseInt(String(enrollment.yearLevel).replace(/\D/g, ''), 10) || 5;

            const courses = await Course.find({
                department: new RegExp((enrollment.department || student.department || 'Mechatronics').split(' ')[0], 'i'),
                year: yearNum,
            }).select('name code credits semester').lean();

            const courseRecords = courses.map(course => {
                const s1Grade = yearGrades.find(g => g.course?._id?.toString() === course._id.toString() && g.semester === 1);
                const s2Grade = yearGrades.find(g => g.course?._id?.toString() === course._id.toString() && g.semester === 2);

                const hasFinalGrade = s2Grade && s2Grade.letterGrade;
                return {
                    courseId: course._id,
                    code: course.code,
                    name: course.name,
                    credits: course.credits || 3,
                    semester: course.semester || (s2Grade ? 2 : 1),
                    letterGrade: hasFinalGrade ? s2Grade.letterGrade : null,
                    // Teachers & Admins can also see internal semester1Score for tracking
                    semester1Score: (normalizedRole === 'admin' || normalizedRole === 'teacher') ? s1Grade?.semester1Score : undefined,
                    status: hasFinalGrade ? 'Finalized' : 'In Progress',
                };
            });

            history.push({
                enrollmentId: enrollment._id,
                academicYear: enrollment.academicYear,
                yearLevel: enrollment.yearLevel,
                department: enrollment.department,
                rollNo: enrollment.rollNo || null,
                attendanceRate: enrollment.attendanceRate || 0,
                status: enrollment.status,
                courses: courseRecords,
            });
        }

        res.json({
            student: {
                id: student._id,
                name: student.name,
                email: student.email,
                permanentRegNo: student.permanentRegNo || 'STU-' + student._id.toString().slice(-6).toUpperCase(),
                currentYear: student.currentYear || student.year || '5th Year',
                currentRollNo: student.currentRollNo || student.rollNo || null,
                accountStatus: student.accountStatus || 'Active',
            },
            history,
        });
    } catch (error) {
        console.error('getStudentAcademicHistory error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/records/course/:courseId
// Teacher Course Scoped Record View
// ─────────────────────────────────────────────
const getCourseRecords = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { academicYear: queryYear } = req.query;
        const requestingUser = req.user;
        const normalizedRole = (requestingUser.role || '').toLowerCase();

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // RBAC: If Teacher, verify teacher is assigned to this course
        if (normalizedRole === 'teacher') {
            const isAssignedDirectly = course.teacher && course.teacher.toString() === requestingUser._id.toString();
            const hasAssignmentDoc = await CourseAssignment.findOne({
                teacher: requestingUser._id,
                course: course._id,
            });

            if (!isAssignedDirectly && !hasAssignmentDoc) {
                return res.status(403).json({ message: 'Forbidden: You are not assigned to teach this course' });
            }
        }

        let academicYear = queryYear;
        if (!academicYear) {
            const config = await AcademicConfig.findOne();
            academicYear = config?.currentAcademicYear || '2025-2026';
        }

        // Find enrolled students for this course's department & year
        const yearLabel = `${course.year || 5}${course.year === 1 ? 'st' : course.year === 2 ? 'nd' : course.year === 3 ? 'rd' : 'th'} Year`;
        const enrollments = await AcademicEnrollment.find({
            academicYear,
            yearLevel: yearLabel,
            department: new RegExp((course.department || 'Mechatronics').split(' ')[0], 'i'),
        }).populate('student', 'name email rollNo permanentRegNo currentRollNo');

        // Fetch grades entered for this course in this academic year
        const grades = await Grade.find({
            course: course._id,
            academicYear,
        }).lean();

        const roster = enrollments.map(e => {
            const s = e.student;
            const s1Grade = grades.find(g => g.student?.toString() === s?._id?.toString() && g.semester === 1);
            const s2Grade = grades.find(g => g.student?.toString() === s?._id?.toString() && g.semester === 2);

            return {
                studentId: s?._id,
                name: s?.name || 'Unknown',
                email: s?.email,
                rollNo: e.rollNo || s?.currentRollNo || null,
                permanentRegNo: s?.permanentRegNo || 'N/A',
                attendanceRate: e.attendanceRate || 0,
                semester1Score: s1Grade?.semester1Score ?? null,
                letterGrade: s2Grade?.letterGrade ?? null,
                comments: s2Grade?.comments || s1Grade?.comments || '',
            };
        });

        res.json({
            course: {
                id: course._id,
                code: course.code,
                name: course.name,
                credits: course.credits || 3,
                year: course.year,
                semester: course.semester,
                department: course.department,
            },
            academicYear,
            roster,
        });
    } catch (error) {
        console.error('getCourseRecords error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMyAcademicHistory,
    getStudentAcademicHistory,
    getCourseRecords,
};
