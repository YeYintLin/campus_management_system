const Grade = require('../models/Grade');
const Course = require('../models/Course');

// @desc    Get all grades or role-filtered grades
// @route   GET /api/grades
// @access  Private
const getGrades = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        const filter = {};

        if (role === 'Student') {
            // Student: strictly limit to their own student ID
            filter.student = userId;
            if (req.query.course) {
                filter.course = req.query.course;
            }
        } else if (role === 'Teacher') {
            // Teacher: strictly limit to courses they teach
            const myCourses = await Course.find({ teacher: userId }).select('_id');
            const myCourseIds = myCourses.map(c => c._id);
            if (req.query.course) {
                filter.course = req.query.course;
            } else {
                filter.course = { $in: myCourseIds };
            }
        } else if (req.query.course) {
            filter.course = req.query.course;
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

        // Optional: Allow self, or teachers/admin
        if (
            req.user.role === 'Student' &&
            req.user._id.toString() !== studentId.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized to view these grades' });
        }

        const grades = await Grade.find({ student: studentId, course: courseId })
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

        const grades = await Grade.find({ course: courseId })
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

module.exports = {
    getGrades,
    getStudentGrades,
    getCourseGrades,
    addOrUpdateGrade,
};
