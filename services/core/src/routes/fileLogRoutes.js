const express = require('express');
const router = express.Router();
const { protect, teacher } = require('../middleware/authMiddleware');
const { logDownload, getDownloadLogs, getDownloadStats } = require('../controllers/fileLogController');

// Any authenticated user can log a download (the act of downloading)
router.post('/log-download', protect, logDownload);

// Only Admin/Teacher/HOD can view audit logs and stats
router.get('/download-logs', protect, teacher, getDownloadLogs);
router.get('/download-stats', protect, teacher, getDownloadStats);

module.exports = router;
