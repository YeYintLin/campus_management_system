const express = require('express');
const {
    getGrades,
    getStudentGrades,
    getCourseGrades,
    addOrUpdateGrade,
    bulkAddOrUpdateGrades,
} = require('../controllers/gradeController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getGrades)
    .post(protect, teacher, addOrUpdateGrade);
router.route('/bulk').post(protect, teacher, bulkAddOrUpdateGrades);
router.route('/student/:studentId/course/:courseId').get(protect, getStudentGrades);
router.route('/course/:courseId').get(protect, teacher, getCourseGrades);

module.exports = router;
