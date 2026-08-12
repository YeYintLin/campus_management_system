const express = require('express');
const router = express.Router();
const { protect, teacher } = require('../middleware/authMiddleware');
const {
    logDownload,
    getDownloadLogs,
    getDownloadStats,
    getCustomFolders,
    createCustomFolder,
    deleteCustomFolder,
    getResourceFiles,
    createResourceFile,
    deleteResourceFile,
} = require('../controllers/fileLogController');

// Any authenticated user can view folders and resource files
router.get('/folders', protect, getCustomFolders);
router.post('/folders', protect, teacher, createCustomFolder);
router.delete('/folders/:id', protect, teacher, deleteCustomFolder);

router.get('/resources', protect, getResourceFiles);
router.post('/resources', protect, teacher, createResourceFile);
router.delete('/resources/:id', protect, teacher, deleteResourceFile);

// Any authenticated user can log a download
router.post('/log-download', protect, logDownload);

// Only Admin/Teacher/HOD can view audit logs and stats
router.get('/download-logs', protect, teacher, getDownloadLogs);
router.get('/download-stats', protect, teacher, getDownloadStats);

module.exports = router;
