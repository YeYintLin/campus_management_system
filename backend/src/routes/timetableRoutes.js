const express = require('express');
const {
    getTimetable,
    saveTimetableSlot,
    deleteTimetableSlot,
} = require('../controllers/timetableController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

// Publicly authenticated access for viewing
router.get('/', protect, getTimetable);

// Teacher/Admin only for modifying
router.put('/', protect, teacher, saveTimetableSlot);
router.delete('/', protect, teacher, deleteTimetableSlot);

module.exports = router;
