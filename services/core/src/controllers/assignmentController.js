const Assignment = require('../models/Assignment');
const Course = require('../models/Course');

// @desc    Get all assignments (role-scoped)
// @route   GET /api/assignments
// @access  Private
const getAllAssignments = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        let filter = {};

        if (role === 'Teacher') {
            const myCourses = await Course.find({ teacher: userId }).select('_id');
            const myCourseIds = myCourses.map(c => c._id);
            filter.course = req.query.course || { $in: myCourseIds };
        } else if (role === 'Student') {
            const studentYearNorm = req.user.year || '';
            const flexPattern = studentYearNorm.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
            const yearNum = parseInt(studentYearNorm.replace(/[^0-9]/g, ''), 10) || null;

            const enrolledCourses = await Course.find({
                $or: [
                    { students: userId },
                    ...(flexPattern ? [{ yearLabel: new RegExp(`^${flexPattern}$`, 'i') }] : []),
                    ...(yearNum ? [{ year: yearNum }] : [])
                ]
            }).select('_id');
            const enrolledCourseIds = enrolledCourses.map(c => c._id);

            // If student passes ?course=..., verify the requested course is in their enrolled/year courses
            if (req.query.course) {
                const requestedIdStr = String(req.query.course);
                const isAllowed = enrolledCourseIds.some(id => String(id) === requestedIdStr);
                filter.course = isAllowed ? req.query.course : { $in: enrolledCourseIds };
            } else {
                filter.course = { $in: enrolledCourseIds };
            }
        } else if (req.query.course) {
            filter.course = req.query.course;
        }

        const assignments = await Assignment.find(filter)
            .populate('course', 'name code')
            .populate('submissions.student', 'name email')
            .sort({ createdAt: -1 });
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Private
const getAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find({ course: req.params.courseId })
            .populate('course', 'name code')
            .populate('submissions.student', 'name email');
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Teacher, Admin)
const createAssignment = async (req, res) => {
    try {
        const { course, title, description, dueDate, fileUrl } = req.body;

        const assignment = await Assignment.create({
            course,
            title,
            description,
            dueDate,
            fileUrl,
        });

        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private (Teacher, Admin)
const updateAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }
        const { title, course, description, dueDate, fileUrl } = req.body;
        if (title !== undefined) assignment.title = title;
        if (course !== undefined) assignment.course = course;
        if (description !== undefined) assignment.description = description;
        if (dueDate !== undefined) assignment.dueDate = dueDate;
        if (fileUrl !== undefined) assignment.fileUrl = fileUrl;

        await assignment.save();
        res.json(assignment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Teacher, Admin)
const deleteAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }
        await assignment.deleteOne();
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit an assignment
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
const submitAssignment = async (req, res) => {
    try {
        const { fileUrl } = req.body;
        const assignment = await Assignment.findById(req.params.id);

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Check if student already submitted
        const existingSubmission = assignment.submissions.find(
            (sub) => sub.student.toString() === req.user._id.toString()
        );

        if (existingSubmission) {
            existingSubmission.fileUrl = fileUrl;
            existingSubmission.submittedAt = Date.now();
        } else {
            assignment.submissions.push({
                student: req.user._id,
                fileUrl,
            });
        }

        await assignment.save();
        res.json({ message: 'Assignment submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllAssignments,
    getAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
};
