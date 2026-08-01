const express = require('express');
const {
    getAllAssignments,
    getAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
} = require('../controllers/assignmentController');
const { protect, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getAllAssignments)
    .post(protect, teacher, createAssignment);

router.route('/:id')
    .put(protect, teacher, updateAssignment)
    .delete(protect, teacher, deleteAssignment);

router.route('/course/:courseId').get(protect, getAssignments);
router.route('/:id/submit').post(protect, submitAssignment);

module.exports = router;
