const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/authMiddleware');
const { batchImportSessions, getSessions } = require('../controllers/sessionController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', protect, getSessions);
router.post('/batch-import', protect, authorize('Admin', 'Teacher', 'Superadmin', 'Academicadmin'), upload.single('file'), batchImportSessions);

module.exports = router;
