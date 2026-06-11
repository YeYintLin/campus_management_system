const express = require('express');
const { getUsers, getUserById, updateUserRole, updateUserProfile } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, admin, getUsers);
router.get('/:id', protect, admin, getUserById);
router.put('/:id', protect, admin, updateUserProfile);
router.put('/:id/role', protect, admin, updateUserRole);

module.exports = router;
