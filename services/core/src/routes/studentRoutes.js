const express = require('express');
const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    previewBulkUpdateSemester,
    bulkUpdateSemester,
} = require('../controllers/studentController');
const { protect, admin, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/bulk-update-semester/preview', protect, admin, previewBulkUpdateSemester);
router.post('/bulk-update-semester', protect, admin, bulkUpdateSemester);

router
    .route('/')
    .get(protect, getStudents)
    .post(protect, admin, createStudent);

router
    .route('/:id')
    .get(protect, getStudentById)
    .put(protect, admin, updateStudent)
    .delete(protect, admin, deleteStudent);

module.exports = router;

