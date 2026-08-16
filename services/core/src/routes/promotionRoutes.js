const express = require('express');
const {
    previewPromotion,
    executePromotion,
    getPromotionAuditLogs,
    getPromotionRunStatus,
    getAcademicSettingsList,
    updateAcademicSetting,
} = require('../controllers/promotionController');
const { protect, admin, requireSystemAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin-only promotion engine endpoints
router.post('/preview', protect, admin, previewPromotion);
router.post('/execute', protect, admin, executePromotion);
router.get('/audit-logs', protect, admin, requireSystemAdmin, getPromotionAuditLogs);
router.get('/runs/:runId', protect, admin, getPromotionRunStatus);
router.get('/settings', protect, admin, getAcademicSettingsList);
router.put('/settings', protect, admin, updateAcademicSetting);

module.exports = router;
