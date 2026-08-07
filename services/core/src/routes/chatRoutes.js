const express = require('express');
const {
    sendMessage,
    getConversations,
    getHistory,
    markAsRead,
    getUsers,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/send', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/history/:partnerId', protect, getHistory);
router.put('/read/:partnerId', protect, markAsRead);
router.get('/users', protect, getUsers);

module.exports = router;
