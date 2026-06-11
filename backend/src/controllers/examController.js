const Exam = require('../models/Exam');

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
const getExams = async (req, res) => {
    try {
        const { year, status } = req.query;
        let query = {};

        if (year && year !== 'All') {
            query.year = year;
        }
        if (status) {
            query.status = status;
        }

        const exams = await Exam.find(query).sort({ date: 1, time: 1 });
        res.json(exams);
    } catch (error) {
        console.error('Get Exams Error:', error.message);
        res.status(500).json({ message: 'Server error fetching exams' });
    }
};

// @desc    Get single exam
// @route   GET /api/exams/:id
// @access  Private
const getExamById = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);

        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        res.json(exam);
    } catch (error) {
        console.error('Get Exam Error:', error.message);
        res.status(500).json({ message: 'Server error fetching exam' });
    }
};

// @desc    Create new exam
// @route   POST /api/exams
// @access  Private (Admin/Teacher)
const createExam = async (req, res) => {
    try {
        const { title, course, duration, date, time, room, year, status } = req.body;

        const exam = await Exam.create({
            title,
            course,
            duration,
            date,
            time,
            room,
            year,
            status,
        });

        res.status(201).json(exam);
    } catch (error) {
        console.error('Create Exam Error:', error.message);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update exam
// @route   PUT /api/exams/:id
// @access  Private (Admin/Teacher)
const updateExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);

        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        const updatedExam = await Exam.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json(updatedExam);
    } catch (error) {
        console.error('Update Exam Error:', error.message);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private (Admin/Teacher)
const deleteExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);

        if (!exam) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        await exam.deleteOne();

        res.json({ message: 'Exam removed successfully' });
    } catch (error) {
        console.error('Delete Exam Error:', error.message);
        res.status(500).json({ message: 'Server error deleting exam' });
    }
};

module.exports = {
    getExams,
    getExamById,
    createExam,
    updateExam,
    deleteExam,
};
