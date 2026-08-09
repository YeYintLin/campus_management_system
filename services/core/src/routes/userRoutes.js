const express = require('express');
const {
    getUsers,
    getUserById,
    updateUserRole,
    updateUserProfile,
    resetUserPassword,
    approveUser,
    rejectUser,
    suspendUser,
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

const checkProfileAccess = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    const isSelf = req.user._id.toString() === req.params.id.toString();
    const isTeacherOrAdmin = req.user.role === 'Admin' || req.user.role === 'Teacher';

    if (isSelf || isTeacherOrAdmin) {
        return next();
    }

    try {
        const targetUser = await require('../models/User').findById(req.params.id);
        if (targetUser && targetUser.role === 'Teacher') {
            return next();
        }
    } catch {
        // Fall through to 403
    }

    return res.status(403).json({ message: "Access denied: Cannot view another user's profile" });
};

const checkProfileWriteAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    const isSelf = req.user._id.toString() === req.params.id.toString();
    const isAdmin = req.user.role === 'Admin';

    if (isSelf || isAdmin) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Cannot modify another user\'s profile' });
    }
};

router.get('/', protect, getUsers);
router.get('/:id', protect, checkProfileAccess, getUserById);
router.put('/:id', protect, checkProfileWriteAccess, updateUserProfile);
router.put('/:id/role', protect, admin, updateUserRole);
router.put('/:id/reset-password', protect, admin, resetUserPassword);
router.put('/:id/approve', protect, admin, approveUser);
router.put('/:id/reject', protect, admin, rejectUser);
router.put('/:id/suspend', protect, admin, suspendUser);

module.exports = router;
