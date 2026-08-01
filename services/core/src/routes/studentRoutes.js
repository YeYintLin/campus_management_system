const express = require('express');
const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
} = require('../controllers/studentController');
const { protect, admin, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

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
