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

module.exports = { logDownload, getDownloadLogs, getDownloadStats };
