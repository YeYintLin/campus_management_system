const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { protect } = require('../middleware/authMiddleware');
const {
    getLibraryItems,
    getLibraryItemById,
    downloadLibraryItem,
    uploadLibraryItem,
    deleteLibraryItem,
    PRIVATE_STORAGE_DIR
} = require('../controllers/eLibraryController');

// Multer storage: save into private storage directory with cryptographically random UUID filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, PRIVATE_STORAGE_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeUuid = crypto.randomUUID();
        cb(null, `elib-${safeUuid}${ext}`);
    }
});

// File filter: Whitelist extensions
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = ['pdf', 'epub', 'docx', 'pptx', 'zip'];
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type .${ext}. Only ${allowed.join(', ')} are allowed.`), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB server-side limit
    fileFilter
});

// All routes require authentication
router.get('/', protect, getLibraryItems);
router.get('/:id', protect, getLibraryItemById);
router.get('/:id/download', protect, downloadLibraryItem);
router.post('/upload', protect, upload.single('file'), uploadLibraryItem);
router.delete('/:id', protect, deleteLibraryItem);

module.exports = router;
