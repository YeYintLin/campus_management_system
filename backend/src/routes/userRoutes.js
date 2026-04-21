const express = require('express');
const { getUsers, updateUserRole } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, admin, getUsers);
router.put('/:id/role', protect, admin, updateUserRole);

module.exports = router;
