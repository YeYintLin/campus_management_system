const Assignment = require('../models/Assignment');

// @desc    Get assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Private
const getAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find({ course: req.params.courseId })
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
    getAssignments,
    createAssignment,
    submitAssignment,
};
