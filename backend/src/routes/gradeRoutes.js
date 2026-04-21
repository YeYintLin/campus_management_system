const express = require('express');
const {
    getStudentGrades,
    getCourseGrades,
    addOrUpdateGrade,
} = require('../controllers/gradeController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(protect, teacher, addOrUpdateGrade);
router.route('/student/:studentId/course/:courseId').get(protect, getStudentGrades);
router.route('/course/:courseId').get(protect, teacher, getCourseGrades);

module.exports = router;
