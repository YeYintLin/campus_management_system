const express = require('express');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const {
    getTimetable,
    saveTimetableSlot,
    deleteTimetableSlot,
    saveBatchTimetableSlots,
    importTimetableFile,
    getSemesters,
    getSemesterById,
    exportOriginalFile,
    getImportHistory,
    downloadTimetableFile,
    restoreTimetableVersion
} = require('../controllers/timetableController');
const { protect, teacher, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// Publicly authenticated access for viewing
router.get('/', protect, getTimetable);
router.get('/semesters', protect, getSemesters);
router.get('/export', protect, exportOriginalFile);
router.get('/:id/export', protect, exportOriginalFile);
router.get('/semester/:id', protect, getSemesterById);

// History & Version Control routes
router.get('/history', protect, teacher, getImportHistory);
router.get('/files/:fileId/download', protect, teacher, downloadTimetableFile);
router.post('/restore/:fileId', protect, admin, restoreTimetableVersion);

// Import endpoint (accepts field name 'file' or 'excel')
router.post('/import', protect, teacher, upload.single('file'), importTimetableFile);

// Teacher/Admin only for modifying
router.put('/', protect, teacher, saveTimetableSlot);
router.post('/batch', protect, teacher, saveBatchTimetableSlots);
router.delete('/', protect, teacher, deleteTimetableSlot);

module.exports = router;
