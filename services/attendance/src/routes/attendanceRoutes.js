const express = require('express');
const {
    getAttendance,
    markAttendance,
    getUserAttendance,
    getActiveSession,
    submitAttendanceCode,
    createSessionOverride,
    getSessionOverrides,
} = require('../controllers/attendanceController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

// Active session & Code submission (Zero-Tap)
router.get('/active-session', protect, getActiveSession);
router.post('/submit-code', protect, submitAttendanceCode);

// Overrides (Cancel / Reschedule)
router.post('/override', protect, teacher, createSessionOverride);
router.get('/overrides', protect, getSessionOverrides);

// Standard Attendance CRUD
router.route('/')
    .get(protect, getUserAttendance)
    .post(protect, teacher, markAttendance);

router.route('/course/:courseId').get(protect, getAttendance);

module.exports = router;
