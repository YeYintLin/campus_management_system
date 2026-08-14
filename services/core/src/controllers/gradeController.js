const mongoose = require('mongoose');
const Grade = require('../models/Grade');
const Course = require('../models/Course');
const AuditLog = require('../models/AuditLog');
const AcademicConfig = require('../models/AcademicConfig');
const CourseAssignment = require('../models/CourseAssignment');

// Helper to resolve course ID or Code
const resolveCourseId = async (courseParam) => {
    if (!courseParam) return null;
    if (mongoose.Types.ObjectId.isValid(courseParam)) {
        return courseParam;
    }
    const cleanCode = String(courseParam).replace(/^tt_/, '').trim();
    const found = await Course.findOne({ code: { $regex: new RegExp(`^${cleanCode}$`, 'i') } }).select('_id');
    return found ? found._id : null;
};

// @desc    Get all grades or role-filtered grades
// @route   GET /api/grades
// @access  Private
const getGrades = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        const normalizedRole = (role || '').toLowerCase();
        const filter = {};

        if (normalizedRole === 'student') {
            filter.student = userId;
            if (req.query.course) {
                const resolvedCourseId = await resolveCourseId(req.query.course);
                if (!resolvedCourseId) return res.json([]);
                filter.course = resolvedCourseId;
            }
        } else if (normalizedRole === 'teacher') {
            const myAssignments = await CourseAssignment.find({ teacher: userId }).select('course');
            const myAssignedCourseIds = myAssignments.map(a => a.course);
            const myCourses = await Course.find({ teacher: userId }).select('_id');
            const allMyCourseIds = [...new Set([...myAssignedCourseIds, ...myCourses.map(c => c._id)])];

            if (req.query.course) {
                const resolvedCourseId = await resolveCourseId(req.query.course);
                if (!resolvedCourseId) return res.json([]);
                filter.course = resolvedCourseId;
            } else {
                filter.course = { $in: allMyCourseIds };
            }
        } else if (req.query.course) {
            const resolvedCourseId = await resolveCourseId(req.query.course);
            if (!resolvedCourseId) return res.json([]);
            filter.course = resolvedCourseId;
        }

        if (req.query.academicYear) {
            filter.academicYear = req.query.academicYear;
        }

        const grades = await Grade.find(filter)
            .populate('course', 'name code credits year semester')
            .populate('student', 'name email permanentRegNo currentRollNo rollNo');

        // If Student requesting, sanitize to NEVER expose internal numeric marks or GPA
        if (normalizedRole === 'student') {
            const sanitized = grades.map(g => ({
                _id: g._id,
                course: g.course,
                academicYear: g.academicYear,
                yearLevel: g.yearLevel,
                semester: g.semester,
                letterGrade: g.semester === 2 ? g.letterGrade : null,
                status: g.semester === 2 && g.letterGrade ? 'Finalized' : 'In Progress / Pending Final Exam',
                comments: g.comments,
                createdAt: g.createdAt,
            }));
            return res.json(sanitized);
        }

        res.json(grades);
    } catch (error) {
        console.error('getGrades error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get grades for a specific student in a specific course
// @route   GET /api/grades/student/:studentId/course/:courseId
// @access  Private
const getStudentGrades = async (req, res) => {
    try {
        const { studentId, courseId } = req.params;
        const normalizedRole = (req.user.role || '').toLowerCase();

        if (normalizedRole === 'student' && req.user._id.toString() !== studentId.toString()) {
            return res.status(403).json({ message: 'Not authorized to view these grades' });
        }

        const resolvedCourseId = await resolveCourseId(courseId);
        if (!resolvedCourseId) return res.json([]);

        const grades = await Grade.find({ student: studentId, course: resolvedCourseId })
            .populate('course', 'name code credits year semester')
            .populate('student', 'name email permanentRegNo currentRollNo');

        if (normalizedRole === 'student') {
            const sanitized = grades.map(g => ({
                _id: g._id,
                course: g.course,
                academicYear: g.academicYear,
                semester: g.semester,
                letterGrade: g.semester === 2 ? g.letterGrade : null,
                status: g.semester === 2 && g.letterGrade ? 'Finalized' : 'In Progress',
            }));
            return res.json(sanitized);
        }

        res.json(grades);
    } catch (error) {
        console.error('getStudentGrades error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all grades for a specific course (Teacher/Admin view)
// @route   GET /api/grades/course/:courseId
// @access  Private (Teacher, Admin)
const getCourseGrades = async (req, res) => {
    try {
        const { courseId } = req.params;
        const resolvedCourseId = await resolveCourseId(courseId);
        if (!resolvedCourseId) return res.json([]);

        const grades = await Grade.find({ course: resolvedCourseId })
            .populate('student', 'name email permanentRegNo currentRollNo rollNo')
            .populate('course', 'name code credits year semester');

        res.json(grades);
    } catch (error) {
        console.error('getCourseGrades error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add or update a grade
// @route   POST /api/grades
// @access  Private (Teacher, Admin)
const addOrUpdateGrade = async (req, res) => {
    try {
        const {
            course,
            student,
            academicYear: providedYear,
            yearLevel,
            semester,
            letterGrade,
            semester1Score,
            comments,
        } = req.body;

        const semNum = parseInt(semester, 10) || 1;
        if (![1, 2].includes(semNum)) {
            return res.status(400).json({ message: 'Semester must be 1 or 2' });
        }

        // Semester-2 letter grade gating: Reject letterGrade if semester !== 2
        if (semNum === 1 && letterGrade) {
            return res.status(400).json({
                message: 'Official letter grade can only be submitted for Semester 2 final exam. Semester 1 accepts internal tracking scores only.',
            });
        }

        // Validate letterGrade enum
        if (semNum === 2 && letterGrade) {
            const validLetterGrades = ['A', 'B', 'C', 'D', 'E'];
            if (!validLetterGrades.includes(letterGrade.trim().toUpperCase())) {
                return res.status(400).json({
                    message: `Invalid letter grade "${letterGrade}". Allowed: A, B, C, D, E`,
                });
            }
        }

        const courseDoc = await Course.findById(course);
        if (!courseDoc) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Enforce RBAC course authorization for teachers
        const normalizedRole = (req.user.role || '').toLowerCase();
        if (normalizedRole === 'teacher') {
            const isAssigned = courseDoc.teacher && courseDoc.teacher.toString() === req.user._id.toString();
            const hasAssignmentDoc = await CourseAssignment.findOne({
                teacher: req.user._id,
                course: courseDoc._id,
            });
            if (!isAssigned && !hasAssignmentDoc) {
                return res.status(403).json({ message: 'Not authorized: You do not teach this course' });
            }
        }

        // Resolve academicYear
        let academicYear = providedYear;
        if (!academicYear) {
            const config = await AcademicConfig.findOne();
            academicYear = config?.currentAcademicYear || '2025-2026';
        }

        let grade = await Grade.findOne({
            course: courseDoc._id,
            student,
            academicYear,
            semester: semNum,
        });

        const previousValue = grade ? {
            letterGrade: grade.letterGrade,
            semester1Score: grade.semester1Score,
            comments: grade.comments,
        } : null;

        const cleanLetterGrade = (semNum === 2 && letterGrade) ? letterGrade.trim().toUpperCase() : null;
        const cleanScore = (semNum === 1 && semester1Score !== undefined) ? Number(semester1Score) : null;

        if (grade) {
            if (semNum === 2) grade.letterGrade = cleanLetterGrade;
            if (semNum === 1) grade.semester1Score = cleanScore;
            if (yearLevel) grade.yearLevel = yearLevel;
            grade.comments = comments !== undefined ? comments : grade.comments;
            await grade.save();
        } else {
            grade = await Grade.create({
                course: courseDoc._id,
                student,
                academicYear,
                yearLevel: yearLevel || `${courseDoc.year || 5}th Year`,
                semester: semNum,
                letterGrade: cleanLetterGrade,
                semester1Score: cleanScore,
                comments: comments || '',
            });
        }

        // Write AuditLog for grade change
        await AuditLog.create({
            action: previousValue ? 'GradeUpdated' : 'GradeCreated',
            performedBy: req.user._id,
            targetStudent: student,
            academicYear,
            details: {
                courseId: courseDoc._id,
                courseCode: courseDoc.code,
                semester: semNum,
                previousValue,
                newValue: {
                    letterGrade: grade.letterGrade,
                    semester1Score: grade.semester1Score,
                    comments: grade.comments,
                },
            },
        });

        res.status(200).json(grade);
    } catch (error) {
        console.error('addOrUpdateGrade error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk add or update grades (Excel import)
// @route   POST /api/grades/bulk
// @access  Private (Teacher, Admin)
const bulkAddOrUpdateGrades = async (req, res) => {
    try {
        const User = require('../models/User');
        const AcademicEnrollment = require('../models/AcademicEnrollment');
        const { grades, academicYear: bodyYear, semester } = req.body;

        if (!Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({ message: 'No grade records provided for import' });
        }

        const semNum = parseInt(semester, 10) || 2;
        let academicYear = bodyYear;
        if (!academicYear) {
            const config = await AcademicConfig.findOne();
            academicYear = config?.currentAcademicYear || '2025-2026';
        }

        const results = [];
        for (const item of grades) {
            let { courseId, courseCode, studentId, studentEmail, rollNo, letterGrade, semester1Score, comments } = item;

            // Resolve Course
            let courseDoc = null;
            if (courseId) courseDoc = await Course.findById(courseId);
            if (!courseDoc && courseCode) {
                courseDoc = await Course.findOne({ code: { $regex: new RegExp(`^${String(courseCode).trim()}$`, 'i') } });
            }
            if (!courseDoc) continue;

            // Resolve Student User
            let userDoc = null;
            if (studentId) userDoc = await User.findById(studentId);
            if (!userDoc && rollNo) {
                const enrollment = await AcademicEnrollment.findOne({
                    academicYear,
                    rollNo: String(rollNo).trim().toUpperCase(),
                }).populate('student');
                if (enrollment && enrollment.student) userDoc = enrollment.student;
            }
            if (!userDoc && (rollNo || studentId)) {
                userDoc = await User.findOne({
                    $or: [
                        { currentRollNo: String(rollNo || studentId).trim().toUpperCase() },
                        { rollNo: String(rollNo || studentId).trim().toUpperCase() },
                    ],
                });
            }
            if (!userDoc && studentEmail) {
                userDoc = await User.findOne({ email: { $regex: new RegExp(`^${String(studentEmail).trim()}$`, 'i') } });
            }
            if (!userDoc) continue;

            // Semester-2 letterGrade gating
            let cleanLetter = null;
            if (semNum === 2 && letterGrade) {
                const uc = String(letterGrade).trim().toUpperCase();
                if (['A', 'B', 'C', 'D', 'E'].includes(uc)) cleanLetter = uc;
            }

            let cleanScore = (semNum === 1 && semester1Score !== undefined) ? Number(semester1Score) : null;

            let grade = await Grade.findOne({
                course: courseDoc._id,
                student: userDoc._id,
                academicYear,
                semester: semNum,
            });

            const previousValue = grade ? {
                letterGrade: grade.letterGrade,
                semester1Score: grade.semester1Score,
            } : null;

            if (grade) {
                if (semNum === 2 && cleanLetter) grade.letterGrade = cleanLetter;
                if (semNum === 1 && cleanScore !== null) grade.semester1Score = cleanScore;
                if (comments) grade.comments = comments;
                await grade.save();
            } else {
                grade = await Grade.create({
                    course: courseDoc._id,
                    student: userDoc._id,
                    academicYear,
                    yearLevel: `${courseDoc.year || 5}th Year`,
                    semester: semNum,
                    letterGrade: cleanLetter,
                    semester1Score: cleanScore,
                    comments: comments || '',
                });
            }

            // Write audit log
            await AuditLog.create({
                action: previousValue ? 'GradeUpdated' : 'GradeCreated',
                performedBy: req.user._id,
                targetStudent: userDoc._id,
                academicYear,
                details: {
                    courseId: courseDoc._id,
                    courseCode: courseDoc.code,
                    semester: semNum,
                    previousValue,
                    newValue: { letterGrade: grade.letterGrade, semester1Score: grade.semester1Score },
                    bulkImport: true,
                },
            });

            results.push(grade);
        }

        res.status(200).json({ message: `Successfully imported ${results.length} grade records`, updatedCount: results.length });
    } catch (error) {
        console.error('bulkAddOrUpdateGrades error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getGrades,
    getStudentGrades,
    getCourseGrades,
    addOrUpdateGrade,
    bulkAddOrUpdateGrades,
};
