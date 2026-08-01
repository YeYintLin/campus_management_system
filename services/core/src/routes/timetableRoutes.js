const express = require('express');
const {
    getTimetable,
    saveTimetableSlot,
    deleteTimetableSlot,
    saveBatchTimetableSlots,
} = require('../controllers/timetableController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

// Publicly authenticated access for viewing
router.get('/', protect, getTimetable);

// Teacher/Admin only for modifying
router.put('/', protect, teacher, saveTimetableSlot);
router.post('/batch', protect, teacher, saveBatchTimetableSlots);
router.delete('/', protect, teacher, deleteTimetableSlot);

module.exports = router;
