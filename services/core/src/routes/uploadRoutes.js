const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Ensure upload destination folder exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        const cleanName = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(
            null,
            `${cleanName}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`
        );
    },
});

function checkFileType(file, cb) {
    const filetypes = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpeg|jpg|png|webp|zip|rar/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only Documents, Images, and Archives are supported!'));
    }
}

const upload = multer({
    storage,
    // Basic DoS protection: prevent very large uploads from filling disk/memory.
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

router.post('/', protect, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('File upload error:', err.message);
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        return res.send(`/${req.file.path.replace(/\\/g, '/')}`);
    });
});

module.exports = router;
