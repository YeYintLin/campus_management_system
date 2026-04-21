const express = require('express');
const {
    registerUser,
    loginUser,
    getUserProfile,
    adminRegisterUser,
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/admin-register', protect, admin, adminRegisterUser);

module.exports = router;
