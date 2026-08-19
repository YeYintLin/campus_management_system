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
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Invalid file type .${ext}. Only ${allowed.join(', ')} are allowed.`));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB server-side limit
    fileFilter
});

// Multer error-handling wrapper
const handleUpload = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Maximum allowed size is 100MB.' });
            }
            return res.status(400).json({ message: err.message || `Upload error: ${err.code}` });
        } else if (err) {
            return res.status(400).json({ message: err.message || 'File upload failed.' });
        }
        next();
    });
};

// All routes require authentication
router.get('/', protect, getLibraryItems);
router.get('/:id', protect, getLibraryItemById);
router.get('/:id/download', protect, downloadLibraryItem);
router.post('/upload', protect, handleUpload, uploadLibraryItem);
router.delete('/:id', protect, deleteLibraryItem);

module.exports = router;
