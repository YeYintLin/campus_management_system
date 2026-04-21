const express = require('express');
const {
    getAssignments,
    createAssignment,
    submitAssignment,
} = require('../controllers/assignmentController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(protect, teacher, createAssignment);
router.route('/course/:courseId').get(protect, getAssignments);
router.route('/:id/submit').post(protect, submitAssignment);

module.exports = router;
