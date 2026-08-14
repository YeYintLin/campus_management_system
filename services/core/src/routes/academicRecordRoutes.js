const express = require('express');
const {
    getMyAcademicHistory,
    getStudentAcademicHistory,
    getCourseRecords,
} = require('../controllers/academicRecordController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

// Student self view
router.get('/my-history', protect, getMyAcademicHistory);

// Admin / Teacher viewing specific student history
router.get('/student/:studentId', protect, getStudentAcademicHistory);

// Teacher / Admin viewing assigned course records
router.get('/course/:courseId', protect, teacher, getCourseRecords);

module.exports = router;
