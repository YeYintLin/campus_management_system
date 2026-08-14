const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, teacher } = require('../middleware/authMiddleware');
const { batchImportSessions, previewImportSessions, cleanupCorruptedSessions, getSessions } = require('../controllers/sessionController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', protect, getSessions);
router.post('/preview-import', protect, teacher, upload.single('file'), previewImportSessions);
router.post('/batch-import', protect, teacher, upload.single('file'), batchImportSessions);
router.post('/cleanup-corrupted', protect, teacher, cleanupCorruptedSessions);

module.exports = router;
