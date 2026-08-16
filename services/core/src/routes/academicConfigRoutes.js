const express = require('express');
const { getAcademicConfig, updateAcademicConfig } = require('../controllers/academicConfigController');
const { protect, admin, teacher, requireSystemAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getAcademicConfig)
    .put(protect, admin, requireSystemAdmin, updateAcademicConfig);

module.exports = router;

