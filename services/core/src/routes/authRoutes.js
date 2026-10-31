const express = require('express');
const {
    registerUser,
    verifyEmail,
    resendVerificationCode,
    loginUser,
    getUserProfile,
    adminRegisterUser,
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', loginRateLimiter, registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', loginRateLimiter, resendVerificationCode);
router.post('/login', loginRateLimiter, loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/admin-register', protect, admin, adminRegisterUser);

module.exports = router;
