const express = require('express');
const {
    createBugReport,
    getMyBugReports,
    getAllBugReports,
    updateBugReportStatus,
} = require('../controllers/bugReportController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .post(protect, createBugReport)
    .get(protect, admin, getAllBugReports);

router.route('/my')
    .get(protect, getMyBugReports);

router.route('/:id/status')
    .patch(protect, admin, updateBugReportStatus);

module.exports = router;
