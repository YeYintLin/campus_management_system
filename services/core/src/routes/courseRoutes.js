const express = require('express');
const {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse,
} = require('../controllers/courseController');
const { protect, admin, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router
    .route('/')
    .get(protect, getCourses)
    .post(protect, admin, createCourse);

router
    .route('/:id')
    .get(protect, getCourseById)
    .put(protect, teacher, updateCourse) // `teacher` middleware allows Admins too
    .delete(protect, admin, deleteCourse);

module.exports = router;
