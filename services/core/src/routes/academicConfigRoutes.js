const express = require('express');
const { getAcademicConfig, updateAcademicConfig } = require('../controllers/academicConfigController');
const { protect, admin, teacher } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getAcademicConfig)
    .put(protect, admin, updateAcademicConfig);

module.exports = router;

