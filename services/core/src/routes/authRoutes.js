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

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendVerificationCode);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/admin-register', protect, admin, adminRegisterUser);

module.exports = router;
