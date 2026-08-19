const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, teacher } = require('../middleware/authMiddleware');
const { getAcademicPlans, updateAcademicPlanPhoto } = require('../controllers/academicPlanController');

// Multer storage for academic plan documents / photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `academic-plan-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

router.get('/', protect, getAcademicPlans);
router.post('/photo', protect, teacher, upload.single('file'), updateAcademicPlanPhoto);

module.exports = router;
