const express = require('express');
const { chatWithAI, getAIConfig, updateAIConfig } = require('../controllers/aiController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/chat', protect, chatWithAI);
router.get('/config', protect, admin, getAIConfig);
router.put('/config', protect, admin, updateAIConfig);

module.exports = router;
