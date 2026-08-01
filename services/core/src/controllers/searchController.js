const User = require('../models/User');
const Course = require('../models/Course');
const Exam = require('../models/Exam');
const Assignment = require('../models/Assignment');

// @desc    Global search across multiple entities
// @route   GET /api/search
// @access  Private
const globalSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === '') {
            return res.json({ users: [], courses: [], exams: [], assignments: [] });
        }

        // Escape special regex characters to prevent crashes
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');

        const [users, courses, exams, assignments] = await Promise.all([
            User.find({ name: regex }).select('name email role').limit(5),
            Course.find({ $or: [{ name: regex }, { code: regex }] }).limit(5),
            Exam.find({ $or: [{ title: regex }, { course: regex }] }).limit(5),
            // Assignment.course is an ObjectId ref, so only search by title/description
            Assignment.find({ $or: [{ title: regex }, { description: regex }] }).populate('course', 'name code').limit(5)
        ]);

        res.json({
            users,
            courses,
            exams,
            assignments
        });
    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ message: 'Server error during search' });
    }
};

module.exports = {
    globalSearch
};
