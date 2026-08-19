const ELibraryItem = require('../models/ELibraryItem');
const ELibraryLog = require('../models/ELibraryLog');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Private storage directory outside public web root
const PRIVATE_STORAGE_DIR = path.join(__dirname, '../../storage/private_elibrary');
if (!fs.existsSync(PRIVATE_STORAGE_DIR)) {
    fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
}

/**
 * Validates whether user is an authorized Mechatronics Engineering member or System Admin.
 * Resolves department strictly from server-side req.user object.
 */
function isMechatronicsMember(user) {
    if (!user) return false;
    const role = (user.role || '').toLowerCase().trim();
    // System admins have administrative oversight across faculties
    if (['admin', 'superadmin', 'academicadmin'].includes(role)) return true;

    // Check user.department strictly from server-side user session
    const dept = (user.department || '').toLowerCase().trim();
    if (dept.includes('mechatronic') || dept === 'mc' || dept === 'mce') return true;

    // Email prefix check for TU Hmawbi domain format
    const email = (user.email || '').toLowerCase().trim();
    if (email.includes('.mc.') || email.includes('.mce.') || email.startsWith('vimc') || email.startsWith('vmc') || email.startsWith('mc')) {
        return true;
    }

    // For teachers at TU Hmawbi: allow faculty unless explicitly registered under a different faculty (Civil, Architecture, etc.)
    if (role === 'teacher') {
        const isOtherDept = dept.includes('civil') || dept.includes('arch') || dept.includes('ep') || dept.includes('ec') || dept.includes('it') || (dept.includes('mechanical') && !dept.includes('mechatronic'));
        if (!isOtherDept) {
            return true;
        }
    }

    return false;
}

/**
 * Validates whether user is a Mechatronics Teacher or System Admin.
 */
function isMechatronicsTeacherOrAdmin(user) {
    if (!user) return false;
    const role = (user.role || '').toLowerCase().trim();
    const isAdmin = ['admin', 'superadmin', 'academicadmin'].includes(role);
    if (isAdmin) return true;

    if (role === 'teacher' && isMechatronicsMember(user)) {
        return true;
    }
    return false;
}

/**
 * Validates file magic bytes (file signature) to prevent spoofed Content-Type uploads
 */
function validateFileMagicBytes(filePath, extension) {
    try {
        const ext = extension.toLowerCase().replace('.', '');
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        if (bytesRead < 4) return false;

        // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
        if (ext === 'pdf') {
            const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
            return isPdf;
        }

        // EPUB, DOCX, PPTX, ZIP magic bytes: PK (0x50 0x4B)
        if (['epub', 'docx', 'pptx', 'zip'].includes(ext)) {
            const isZipBased = buffer[0] === 0x50 && buffer[1] === 0x4B;
            return isZipBased;
        }

        return false;
    } catch (err) {
        console.error('validateFileMagicBytes error:', err.message);
        return false;
    }
}

// @desc    Get Mechatronics E-Library items (Search & Filter)
// @route   GET /api/elibrary
// @access  Private (Mechatronics Student, Teacher, Admin)
const getLibraryItems = async (req, res) => {
    try {
        if (!isMechatronicsMember(req.user)) {
            return res.status(403).json({
                message: 'Access Restricted: E-Library is available exclusively to Department of Mechatronics Engineering members.'
            });
        }

        const { search, category, yearLevel, courseCode, sort = 'latest' } = req.query;

        const query = { department: 'Mechatronics Engineering' };

        if (category && category !== 'All') {
            query.category = category;
        }

        if (yearLevel && yearLevel !== 'All' && yearLevel !== 'All Years') {
            query.$or = [{ yearLevel: yearLevel }, { yearLevel: 'All Years' }];
        }

        if (courseCode) {
            query.courseCode = new RegExp(courseCode.trim(), 'i');
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { title: regex },
                { author: regex },
                { courseCode: regex },
                { description: regex },
                { tags: regex }
            ];
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'popular' || sort === 'downloads') {
            sortOption = { downloadsCount: -1, createdAt: -1 };
        } else if (sort === 'views') {
            sortOption = { viewsCount: -1, createdAt: -1 };
        } else if (sort === 'title') {
            sortOption = { title: 1 };
        }

        const items = await ELibraryItem.find(query).sort(sortOption);

        res.json({
            count: items.length,
            department: 'Mechatronics Engineering',
            items
        });
    } catch (error) {
        console.error('getLibraryItems error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single E-Library item details + increment viewsCount
// @route   GET /api/elibrary/:id
// @access  Private (Mechatronics Student, Teacher, Admin)
const getLibraryItemById = async (req, res) => {
    try {
        if (!isMechatronicsMember(req.user)) {
            return res.status(403).json({
                message: 'Access Restricted: E-Library is available exclusively to Department of Mechatronics Engineering members.'
            });
        }

        const item = await ELibraryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'E-Library item not found' });
        }

        // Increment views count atomically
        await ELibraryItem.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });

        res.json(item);
    } catch (error) {
        console.error('getLibraryItemById error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Securely download E-Library item file + increment downloadsCount
// @route   GET /api/elibrary/:id/download
// @access  Private (Mechatronics Student, Teacher, Admin)
const downloadLibraryItem = async (req, res) => {
    try {
        if (!isMechatronicsMember(req.user)) {
            return res.status(403).json({
                message: 'Access Restricted: E-Library file downloads are available exclusively to Department of Mechatronics Engineering members.'
            });
        }

        const item = await ELibraryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'E-Library item not found' });
        }

        const filePath = path.join(PRIVATE_STORAGE_DIR, item.storedFileName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found on storage server' });
        }

        // Increment download count atomically
        await ELibraryItem.findByIdAndUpdate(req.params.id, { $inc: { downloadsCount: 1 } });

        // Record immutable download audit log asynchronously
        try {
            await ELibraryLog.create({
                itemId: item._id,
                itemTitle: item.title,
                fileName: item.originalFileName || item.storedFileName,
                fileSize: item.fileSize || 0,
                action: 'download',
                userId: req.user._id,
                userName: req.user.name || 'Student / Faculty User',
                userEmail: req.user.email || '',
                userRole: req.user.role || 'Student',
                userDepartment: req.user.department || 'Mechatronics Engineering',
                userYear: req.user.year || '',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
            });
        } catch (logErr) {
            console.error('Failed to create ELibrary download log:', logErr.message);
        }

        // Stream file securely with sanitized filename
        res.download(filePath, item.originalFileName);
    } catch (error) {
        console.error('downloadLibraryItem error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload new E-Library material
// @route   POST /api/elibrary/upload
// @access  Private (Mechatronics Teacher, Admin)
const uploadLibraryItem = async (req, res) => {
    try {
        if (!isMechatronicsTeacherOrAdmin(req.user)) {
            return res.status(403).json({
                message: 'Forbidden: Only Mechatronics Teachers and Administrators can upload E-Library resources.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a valid document file (.pdf, .epub, .docx, .pptx, .zip).' });
        }

        const { title, author, category = 'Textbook', yearLevel = 'All Years', courseCode, courseName, description, tags } = req.body;

        if (!title || !title.trim()) {
            // Remove uploaded file if validation fails
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Book/Material title is required.' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
        const allowedExts = ['pdf', 'epub', 'docx', 'pptx', 'zip'];

        if (!allowedExts.includes(ext)) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: `Unsupported file format .${ext}. Allowed formats: ${allowedExts.join(', ')}` });
        }

        // Content / Magic Byte Validation
        const isValidSignature = validateFileMagicBytes(req.file.path, ext);
        if (!isValidSignature) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'File signature mismatch: file content does not match declared file extension.' });
        }

        // Generate sanitized original filename (strip path traversal characters)
        const safeOriginalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._\-\s()]/g, '_');

        let parsedTags = [];
        if (tags) {
            if (Array.isArray(tags)) parsedTags = tags;
            else if (typeof tags === 'string') parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        const newItem = await ELibraryItem.create({
            title: title.trim(),
            author: author ? author.trim() : 'Department Faculty',
            category,
            yearLevel,
            courseCode: courseCode ? courseCode.trim().toUpperCase() : '',
            courseName: courseName ? courseName.trim() : '',
            department: 'Mechatronics Engineering',
            description: description ? description.trim() : '',
            originalFileName: safeOriginalName,
            storedFileName: req.file.filename,
            storagePath: req.file.path,
            fileSize: req.file.size,
            fileType: ext,
            coverImage: req.body.coverImage || '',
            uploadedBy: req.user._id,
            uploadedByName: req.user.name || 'Faculty Member',
            uploadedByRole: req.user.role || 'Teacher',
            tags: parsedTags
        });

        // Record immutable upload audit log asynchronously
        try {
            await ELibraryLog.create({
                itemId: newItem._id,
                itemTitle: newItem.title,
                fileName: safeOriginalName,
                fileSize: req.file.size,
                action: 'upload',
                userId: req.user._id,
                userName: req.user.name || 'Faculty Member',
                userEmail: req.user.email || '',
                userRole: req.user.role || 'Teacher',
                userDepartment: req.user.department || 'Mechatronics Engineering',
                userYear: req.user.year || '',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
            });
        } catch (logErr) {
            console.error('Failed to create ELibrary upload log:', logErr.message);
        }

        res.status(201).json({
            message: 'E-Library material uploaded successfully!',
            item: newItem
        });
    } catch (error) {
        console.error('uploadLibraryItem error:', error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        res.status(500).json({ message: error.message });
    }
};

/**
 * Validates whether user is a Technical/System Admin (excludes user_management / academicadmin).
 */
function isTechnicalAdmin(user) {
    if (!user) return false;
    const role = (user.role || '').toLowerCase().trim();
    const adminType = (user.adminType || '').toLowerCase().trim();
    if (role === 'academicadmin' || adminType === 'user_management') {
        return false;
    }
    if (['admin', 'superadmin'].includes(role) || adminType === 'system_technical') {
        return true;
    }
    return false;
}

// @desc    Update E-Library material metadata (Technical Admin Only)
// @route   PUT /api/elibrary/:id
// @access  Private (Technical Admin Only)
const updateLibraryItem = async (req, res) => {
    try {
        if (!isTechnicalAdmin(req.user)) {
            return res.status(403).json({
                message: 'Forbidden: Only Technical System Administrators can edit E-Library resources.'
            });
        }

        const item = await ELibraryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'E-Library item not found' });
        }

        const {
            title,
            author,
            category,
            yearLevel,
            courseCode,
            courseName,
            description,
            tags,
            coverImage
        } = req.body;

        if (title !== undefined) item.title = title.trim();
        if (author !== undefined) item.author = author.trim();
        if (category !== undefined) item.category = category;
        if (yearLevel !== undefined) item.yearLevel = yearLevel;
        if (courseCode !== undefined) item.courseCode = courseCode.trim().toUpperCase();
        if (courseName !== undefined) item.courseName = courseName.trim();
        if (description !== undefined) item.description = description.trim();
        if (coverImage !== undefined) item.coverImage = coverImage;
        if (tags !== undefined) {
            if (Array.isArray(tags)) item.tags = tags;
            else if (typeof tags === 'string') item.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        // Ensure department remains strictly Mechatronics Engineering
        item.department = 'Mechatronics Engineering';

        await item.save();

        // Record immutable edit audit log asynchronously
        try {
            await ELibraryLog.create({
                itemId: item._id,
                itemTitle: item.title,
                fileName: item.originalFileName || item.storedFileName,
                fileSize: item.fileSize || 0,
                action: 'edit',
                userId: req.user._id,
                userName: req.user.name || 'Technical Administrator',
                userEmail: req.user.email || '',
                userRole: req.user.role || 'Admin',
                userDepartment: req.user.department || 'Mechatronics Engineering',
                userYear: '',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
            });
        } catch (logErr) {
            console.error('Failed to create ELibrary edit log:', logErr.message);
        }

        res.json({
            message: 'E-Library resource updated successfully!',
            item
        });
    } catch (error) {
        console.error('updateLibraryItem error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete E-Library item (Technical Admin Only)
// @route   DELETE /api/elibrary/:id
// @access  Private (Technical Admin Only)
const deleteLibraryItem = async (req, res) => {
    try {
        if (!isTechnicalAdmin(req.user)) {
            return res.status(403).json({
                message: 'Forbidden: Only Technical System Administrators can delete E-Library resources.'
            });
        }

        const item = await ELibraryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'E-Library item not found' });
        }

        // Delete physical file from storage
        const filePath = path.join(PRIVATE_STORAGE_DIR, item.storedFileName);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { console.warn('File unlink warning:', e.message); }
        }

        await ELibraryItem.findByIdAndDelete(req.params.id);

        // Record immutable delete audit log asynchronously
        try {
            await ELibraryLog.create({
                itemId: item._id,
                itemTitle: item.title,
                fileName: item.originalFileName || item.storedFileName,
                fileSize: item.fileSize || 0,
                action: 'delete',
                userId: req.user._id,
                userName: req.user.name || 'Technical Administrator',
                userEmail: req.user.email || '',
                userRole: req.user.role || 'Admin',
                userDepartment: req.user.department || 'Mechatronics Engineering',
                userYear: '',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
            });
        } catch (logErr) {
            console.error('Failed to create ELibrary delete log:', logErr.message);
        }

        res.json({ message: 'E-Library resource removed successfully by Technical Administrator.' });
    } catch (error) {
        console.error('deleteLibraryItem error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get E-Library audit activity logs (Teachers & Admins Only)
// @route   GET /api/elibrary/logs
// @access  Private (Teacher, Admin, Superadmin Only)
const getLibraryLogs = async (req, res) => {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        const isAllowed = ['teacher', 'admin', 'superadmin', 'academicadmin'].includes(userRole);
        if (!isAllowed) {
            return res.status(403).json({
                message: 'Forbidden: E-Library activity logs are restricted to Teachers and Administrators only.'
            });
        }

        const { action, role, search } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const filter = {};

        if (action && action !== 'all') {
            filter.action = action.toLowerCase();
        }

        if (role && role !== 'all') {
            filter.userRole = new RegExp(`^${role.trim()}$`, 'i');
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { userName: regex },
                { userEmail: regex },
                { itemTitle: regex },
                { fileName: regex },
                { userYear: regex }
            ];
        }

        const [logs, total, totalDownloads, totalUploads, totalEdits, totalDeletes] = await Promise.all([
            ELibraryLog.find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .populate('itemId', 'title category courseCode yearLevel')
                .lean(),
            ELibraryLog.countDocuments(filter),
            ELibraryLog.countDocuments({ action: 'download' }),
            ELibraryLog.countDocuments({ action: 'upload' }),
            ELibraryLog.countDocuments({ action: 'edit' }),
            ELibraryLog.countDocuments({ action: 'delete' })
        ]);

        res.json({
            success: true,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            stats: {
                totalDownloads,
                totalUploads,
                totalEdits,
                totalDeletes,
                totalActivities: totalDownloads + totalUploads + totalEdits + totalDeletes
            },
            logs
        });
    } catch (error) {
        console.error('getLibraryLogs error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getLibraryItems,
    getLibraryItemById,
    downloadLibraryItem,
    uploadLibraryItem,
    updateLibraryItem,
    deleteLibraryItem,
    getLibraryLogs,
    isMechatronicsMember,
    isMechatronicsTeacherOrAdmin,
    isTechnicalAdmin,
    validateFileMagicBytes,
    PRIVATE_STORAGE_DIR
};

