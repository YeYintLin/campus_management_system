const express = require('express');
const {
    getAttendance,
    markAttendance,
} = require('../controllers/attendanceController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(protect, teacher, markAttendance);
router.route('/course/:courseId').get(protect, getAttendance);

module.exports = router;
