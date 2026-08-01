const express = require('express');
const router = express.Router();
const { protect, teacher } = require('../middleware/authMiddleware');
const {
    getAtRiskStudents,
    getDashboardStats,
    getPassRates,
} = require('../controllers/dashboardController');

// @route   GET /api/dashboard/stats
// @desc    Get role-aware aggregated dashboard statistics
// @access  Private (All roles)
router.get('/stats', protect, getDashboardStats);

// @route   GET /api/dashboard/at-risk
// @desc    Get computed at-risk students (attendance + failing subjects)
// @query   scope=all|own, attendance_threshold, failing_threshold
// @access  Private (Teacher, Admin)
router.get('/at-risk', protect, teacher, getAtRiskStudents);

// @route   GET /api/dashboard/pass-rates
// @desc    Get pass rate per course
// @access  Private (Teacher, Admin)
router.get('/pass-rates', protect, teacher, getPassRates);

module.exports = router;
