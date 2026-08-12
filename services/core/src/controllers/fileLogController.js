const FileLog = require('../models/FileLog');

// POST /api/files/log-download
// Records a file download event for audit tracking
const logDownload = async (req, res) => {
    try {
        const { fileName, fileCategory, fileSize, year } = req.body;

        if (!fileName) {
            return res.status(400).json({ message: 'fileName is required' });
        }

        const log = await FileLog.create({
            userId: req.user._id,
            userName: req.body.userName || 'Unknown',
            userEmail: req.user.email || '',
            userRole: req.user.role || 'Student',
            fileName,
            fileCategory: fileCategory || 'Uncategorized',
            fileSize: fileSize || '',
            year: year || 'All',
        });

        res.status(201).json(log);
    } catch (error) {
        console.error('Error logging file download:', error.message);
        res.status(500).json({ message: 'Failed to log download' });
    }
};

// GET /api/files/download-logs
// Returns paginated download audit logs (Admin/Teacher/HOD only)
const getDownloadLogs = async (req, res) => {
    try {
        const role = req.user.role;
        if (role !== 'Admin' && role !== 'SuperAdmin' && role !== 'AcademicAdmin' && role !== 'Teacher') {
            return res.status(403).json({ message: 'Access denied. Only Admin/Teacher/HOD can view download logs.' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Build filter query
        const filter = {};

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            filter.$or = [
                { userName: searchRegex },
                { fileName: searchRegex },
                { userEmail: searchRegex },
            ];
        }

        if (req.query.year && req.query.year !== 'All') {
            filter.year = req.query.year;
        }

        if (req.query.category) {
            filter.fileCategory = req.query.category;
        }

        if (req.query.role) {
            filter.userRole = req.query.role;
        }

        const [logs, total] = await Promise.all([
            FileLog.find(filter)
                .sort({ downloadedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FileLog.countDocuments(filter),
        ]);

        res.json({
            logs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Error fetching download logs:', error.message);
        res.status(500).json({ message: 'Failed to fetch download logs' });
    }
};

// GET /api/files/download-stats
// Returns aggregate download statistics (Admin/Teacher/HOD only)
const getDownloadStats = async (req, res) => {
    try {
        const role = req.user.role;
        if (role !== 'Admin' && role !== 'SuperAdmin' && role !== 'AcademicAdmin' && role !== 'Teacher') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const [totalDownloads, topFiles, activeStudents, recentActivity] = await Promise.all([
            // Total download count
            FileLog.countDocuments(),

            // Top 5 most downloaded files
            FileLog.aggregate([
                { $group: { _id: '$fileName', count: { $sum: 1 }, category: { $first: '$fileCategory' } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),

            // Top 5 most active downloading students
            FileLog.aggregate([
                { $match: { userRole: 'Student' } },
                { $group: { _id: '$userId', name: { $first: '$userName' }, email: { $first: '$userEmail' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),

            // Downloads in the last 7 days (daily breakdown)
            FileLog.aggregate([
                { $match: { downloadedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$downloadedAt' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        res.json({
            totalDownloads,
            topFiles,
            activeStudents,
            recentActivity,
        });
    } catch (error) {
        console.error('Error fetching download stats:', error.message);
        res.status(500).json({ message: 'Failed to fetch download stats' });
    }
};

// GET /api/files/folders
// Fetch all custom folders created by users
const CustomFolder = require('../models/CustomFolder');
const ResourceFile = require('../models/ResourceFile');

const getCustomFolders = async (req, res) => {
    try {
        const folders = await CustomFolder.find().sort({ createdAt: -1 });
        res.json(folders);
    } catch (error) {
        console.error('Error fetching custom folders:', error);
        res.status(500).json({ message: 'Failed to fetch folders' });
    }
};

// POST /api/files/folders
// Create a new custom folder
const createCustomFolder = async (req, res) => {
    try {
        const { name, description, iconColor, year, parentFolder } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Folder name is required' });
        }

        const folder = await CustomFolder.create({
            name: name.trim(),
            description: description || 'Custom collection',
            iconColor: iconColor || '#6366f1',
            year: year || 'All',
            parentFolder: parentFolder || null,
            createdBy: req.user._id,
        });

        res.status(201).json(folder);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ message: 'Failed to create folder' });
    }
};

// DELETE /api/files/folders/:id
const deleteCustomFolder = async (req, res) => {
    try {
        const { id } = req.params;
        await CustomFolder.findByIdAndDelete(id);
        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ message: 'Failed to delete folder' });
    }
};

// GET /api/files/resources
const getResourceFiles = async (req, res) => {
    try {
        const files = await ResourceFile.find().sort({ createdAt: -1 });
        res.json(files);
    } catch (error) {
        console.error('Error fetching resource files:', error);
        res.status(500).json({ message: 'Failed to fetch resource files' });
    }
};

// POST /api/files/resources
const createResourceFile = async (req, res) => {
    try {
        const { name, type, size, category, year, fileUrl } = req.body;
        if (!name || !category) {
            return res.status(400).json({ message: 'Name and category are required' });
        }

        const file = await ResourceFile.create({
            name: name.trim(),
            type: type || 'PDF',
            size: size || '1.0 MB',
            category: category.trim(),
            owner: req.user.name || 'Faculty',
            year: year || 'All',
            fileUrl: fileUrl || '',
            uploadedBy: req.user._id,
        });

        res.status(201).json(file);
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Failed to save file record' });
    }
};

// DELETE /api/files/resources/:id
const deleteResourceFile = async (req, res) => {
    try {
        const { id } = req.params;
        await ResourceFile.findByIdAndDelete(id);
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'Failed to delete file' });
    }
};

module.exports = {
    logDownload,
    getDownloadLogs,
    getDownloadStats,
    getCustomFolders,
    createCustomFolder,
    deleteCustomFolder,
    getResourceFiles,
    createResourceFile,
    deleteResourceFile,
};
