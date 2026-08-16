const express = require('express');
const { chatWithAI, getAIConfig, updateAIConfig } = require('../controllers/aiController');
const { protect, admin, requireSystemAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/chat', protect, chatWithAI);
router.get('/config', protect, admin, requireSystemAdmin, getAIConfig);
router.put('/config', protect, admin, requireSystemAdmin, updateAIConfig);

module.exports = router;
