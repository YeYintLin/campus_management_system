const express = require('express');
const {
    recalculateAttendance,
    getEnrollments,
    assignRollNumbers,
    reassignRollNumber,
} = require('../controllers/enrollmentController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// Cross-service recalculate attendance (handles internal token or admin JWT)
router.post('/recalculate-attendance', recalculateAttendance);

// Admin-protected enrollment routes
router.get('/', protect, admin, getEnrollments);
router.post('/assign-roll-numbers', protect, admin, assignRollNumbers);
router.post('/:id/reassign-roll-number', protect, admin, reassignRollNumber);

module.exports = router;
