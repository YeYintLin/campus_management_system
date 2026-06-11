const express = require('express');
const {
    getExams,
    getExamById,
    createExam,
    updateExam,
    deleteExam,
} = require('../controllers/examController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

// Publicly authenticated access for viewing
router.get('/', protect, getExams);
router.get('/:id', protect, getExamById);

// Teacher/Admin only for modifying
router.post('/', protect, teacher, createExam);
router.put('/:id', protect, teacher, updateExam);
router.delete('/:id', protect, teacher, deleteExam);

module.exports = router;
