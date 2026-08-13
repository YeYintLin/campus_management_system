const mongoose = require('mongoose');
const Grade = require('../models/Grade');
const Course = require('../models/Course');

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
        const filter = {};

        if (role === 'Student') {
            filter.student = userId;
            if (req.query.course) {
                const resolvedCourseId = await resolveCourseId(req.query.course);
                if (!resolvedCourseId) return res.json([]);
                filter.course = resolvedCourseId;
            }
        } else if (role === 'Teacher') {
            const myCourses = await Course.find({ teacher: userId }).select('_id');
            const myCourseIds = myCourses.map(c => c._id);
            if (req.query.course) {
                const resolvedCourseId = await resolveCourseId(req.query.course);
                if (!resolvedCourseId) return res.json([]);
                filter.course = resolvedCourseId;
            } else {
                filter.course = { $in: myCourseIds };
            }
        } else if (req.query.course) {
            const resolvedCourseId = await resolveCourseId(req.query.course);
            if (!resolvedCourseId) return res.json([]);
            filter.course = resolvedCourseId;
        }

        const grades = await Grade.find(filter)
            .populate('course', 'name code')
            .populate('student', 'name email');
        res.json(grades);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get grades for a specific student in a specific course
// @route   GET /api/grades/student/:studentId/course/:courseId
// @access  Private
const getStudentGrades = async (req, res) => {
    try {
        const { studentId, courseId } = req.params;

        if (
            req.user.role === 'Student' &&
            req.user._id.toString() !== studentId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized to view these grades' });
        }

        const resolvedCourseId = await resolveCourseId(courseId);
        if (!resolvedCourseId) return res.json([]);

        const grades = await Grade.find({ student: studentId, course: resolvedCourseId })
            .populate('course', 'name code')
            .populate('student', 'name email');

        res.json(grades);
    } catch (error) {
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
            .populate('student', 'name email')
            .populate('course', 'name code');

        res.json(grades);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add or update a grade
// @route   POST /api/grades
// @access  Private (Teacher, Admin)
const addOrUpdateGrade = async (req, res) => {
    try {
        const { course, student, assessmentType, score, maxScore, comments } = req.body;

        const courseDoc = await Course.findById(course);
        if (!courseDoc) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Enforce course ownership (Admins bypass)
        if (
            req.user.role === 'Teacher' &&
            courseDoc.teacher.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized: You do not teach this course' });
        }

        let grade = await Grade.findOne({ course, student, assessmentType });

        if (grade) {
            grade.score = score;
            grade.maxScore = maxScore;
            grade.comments = comments || grade.comments;
            await grade.save();
        } else {
            grade = await Grade.create({
                course,
                student,
                assessmentType,
                score,
                maxScore,
                comments,
            });
        }

        res.status(200).json(grade);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk add or update grades (Excel import)
// @route   POST /api/grades/bulk
// @access  Private (Teacher, Admin)
const bulkAddOrUpdateGrades = async (req, res) => {
    try {
        const User = require('../models/User');
        const StudentModel = require('../models/Student');
        const { grades } = req.body;

        if (!Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({ message: 'No grade records provided for import' });
        }

        const results = [];
        for (const item of grades) {
            let { courseId, courseCode, studentId, studentEmail, rollNo, assessmentType, score, maxScore, comments } = item;
            
            // Resolve Course
            let courseDoc = null;
            if (courseId) {
                courseDoc = await Course.findById(courseId);
            }
            if (!courseDoc && courseCode) {
                courseDoc = await Course.findOne({ code: { $regex: new RegExp(`^${String(courseCode).trim()}$`, 'i') } });
            }
            
            if (!courseDoc) continue;

            // Resolve Student User
            let userDoc = null;
            if (studentId) {
                userDoc = await User.findById(studentId);
            }
            if (!userDoc && (rollNo || studentId)) {
                const sObj = await StudentModel.findOne({ rollNo: String(rollNo || studentId).trim() }).populate('user');
                if (sObj && sObj.user) userDoc = sObj.user;
            }
            if (!userDoc && studentEmail) {
                userDoc = await User.findOne({ email: { $regex: new RegExp(`^${String(studentEmail).trim()}$`, 'i') } });
            }

            if (!userDoc) continue;

            let type = assessmentType || 'Final Exam';
            let numericScore = Number(score);
            if (isNaN(numericScore)) continue;

            let grade = await Grade.findOne({ course: courseDoc._id, student: userDoc._id, assessmentType: type });
            if (grade) {
                grade.score = numericScore;
                if (maxScore) grade.maxScore = Number(maxScore);
                if (comments) grade.comments = comments;
                await grade.save();
            } else {
                grade = await Grade.create({
                    course: courseDoc._id,
                    student: userDoc._id,
                    assessmentType: type,
                    score: numericScore,
                    maxScore: maxScore || 100,
                    comments: comments || '',
                });
            }
            results.push(grade);
        }

        res.status(200).json({ message: `Successfully imported ${results.length} grades`, updatedCount: results.length });
    } catch (error) {
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
