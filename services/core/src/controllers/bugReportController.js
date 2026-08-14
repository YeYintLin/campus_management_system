const BugReport = require('../models/BugReport');
const Notification = require('../models/Notification');
const { sendBugReportEmail, sendBugStatusUpdateEmail } = require('../utils/emailService');

// In-memory sliding window rate limiter: max 5 reports per 15 minutes per user
const submissionRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 5;

const checkRateLimit = (userId) => {
    const now = Date.now();
    const history = submissionRateMap.get(String(userId)) || [];
    const recent = history.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= MAX_REPORTS_PER_WINDOW) {
        return false;
    }
    recent.push(now);
    submissionRateMap.set(String(userId), recent);
    return true;
};

// Allowed attachment file extensions
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.mp4', '.doc', '.docx'];
const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
};

const VALID_CATEGORIES = [
    'Assignment & Tutorial',
    'Attendance',
    'Timetable',
    'Grades & Exams',
    'Account & Login',
    'UI/Performance',
    'Other',
];

const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const VALID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Duplicate', "Won't Fix"];

// @desc    Submit a new Bug Report
// @route   POST /api/bug-reports
// @access  Private (Student, Teacher, Admin)
const createBugReport = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Rate Limiting Check
        if (!checkRateLimit(userId)) {
            return res.status(429).json({
                message: 'Submission rate limit exceeded. You can submit at most 5 reports per 15 minutes. Please try again later.'
            });
        }

        const {
            title,
            description,
            category,
            priority,
            reporterEmail,
            reporterCohort,
            pageUrl,
            attachments,
            deviceInfo
        } = req.body;

        // 2. Validate Required Fields
        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Bug report title is required' });
        }
        if (!description || !description.trim()) {
            return res.status(400).json({ message: 'Detailed description is required' });
        }
        if (!category || !VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
        }

        const chosenPriority = priority && VALID_PRIORITIES.includes(priority) ? priority : 'Medium';

        // 3. Validate Contact Email
        const contactEmail = (reporterEmail || req.user.email || '').trim();
        if (!isValidEmail(contactEmail)) {
            return res.status(400).json({ message: 'A valid contact email / Gmail is required' });
        }

        // 4. Validate Attachments
        let sanitizedAttachments = [];
        if (Array.isArray(attachments)) {
            if (attachments.length > 5) {
                return res.status(400).json({ message: 'At most 5 attachments are allowed per report.' });
            }

            for (const att of attachments) {
                if (!att.fileUrl || typeof att.fileUrl !== 'string') continue;

                // Validate extension
                const urlLower = att.fileUrl.toLowerCase().split('?')[0];
                const hasValidExt = ALLOWED_EXTENSIONS.some(ext => urlLower.endsWith(ext));
                if (!hasValidExt) {
                    return res.status(400).json({
                        message: `Invalid attachment format. Only PNG, JPG, PDF, DOCX, and MP4 files are allowed.`
                    });
                }

                sanitizedAttachments.push({
                    fileUrl: att.fileUrl.trim(),
                    fileName: (att.fileName || 'Attachment').trim().slice(0, 150),
                    fileSize: (att.fileSize || '').trim().slice(0, 30),
                    fileType: (att.fileType || '').trim().slice(0, 50),
                });
            }
        }

        // 5. Build Cohort Details
        let cohortStr = reporterCohort || '';
        if (!cohortStr) {
            if (req.user.role === 'Student') {
                cohortStr = `${req.user.year || ''} ${req.user.department || 'Mechatronics'}`.trim();
            } else if (req.user.role === 'Teacher') {
                cohortStr = `${req.user.department || 'Mechatronics'} Faculty`.trim();
            } else {
                cohortStr = 'Administration';
            }
        }

        // 6. Create MongoDB Record
        const bugReport = await BugReport.create({
            reporter: userId,
            reporterName: req.user.name || 'User',
            reporterEmail: contactEmail,
            reporterRole: req.user.role || 'Student',
            reporterCohort: cohortStr,
            category,
            priority: chosenPriority,
            title: title.trim().slice(0, 200),
            description: description.trim(),
            pageUrl: (pageUrl || '').trim().slice(0, 300),
            attachments: sanitizedAttachments,
            deviceInfo: {
                browser: (deviceInfo?.browser || '').slice(0, 100),
                os: (deviceInfo?.os || '').slice(0, 100),
                screenResolution: (deviceInfo?.screenResolution || '').slice(0, 50),
                userAgent: (deviceInfo?.userAgent || '').slice(0, 300),
            },
            status: 'Open',
        });

        // 7. Dispatch Email Notification (fire & catch errors without failing response)
        sendBugReportEmail(bugReport).catch(err => {
            console.error('[createBugReport] Background email dispatch failed:', err.message);
        });

        res.status(201).json({
            message: 'Bug report submitted successfully! Email alert dispatched to administrator.',
            bugReport,
        });
    } catch (error) {
        console.error('[createBugReport] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get bug reports submitted by logged-in user
// @route   GET /api/bug-reports/my
// @access  Private (Student, Teacher, Admin)
const getMyBugReports = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const total = await BugReport.countDocuments({ reporter: req.user._id });
        const reports = await BugReport.find({ reporter: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            reports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all bug reports (Admin only)
// @route   GET /api/bug-reports
// @access  Private (Admin)
const getAllBugReports = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.status && req.query.status !== 'All') {
            query.status = req.query.status;
        }
        if (req.query.category && req.query.category !== 'All') {
            query.category = req.query.category;
        }
        if (req.query.priority && req.query.priority !== 'All') {
            query.priority = req.query.priority;
        }
        if (req.query.role && req.query.role !== 'All') {
            query.reporterRole = req.query.role;
        }
        if (req.query.search) {
            const s = req.query.search.trim();
            query.$or = [
                { title: { $regex: s, $options: 'i' } },
                { reporterName: { $regex: s, $options: 'i' } },
                { reporterEmail: { $regex: s, $options: 'i' } },
            ];
        }

        const total = await BugReport.countDocuments(query);
        const reports = await BugReport.find(query)
            .populate('reporter', 'name email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Compute metrics
        const [openCount, inProgressCount, resolvedCount, urgentCount] = await Promise.all([
            BugReport.countDocuments({ status: 'Open' }),
            BugReport.countDocuments({ status: 'In Progress' }),
            BugReport.countDocuments({ status: 'Resolved' }),
            BugReport.countDocuments({ priority: 'Urgent', status: { $in: ['Open', 'In Progress'] } }),
        ]);

        res.json({
            reports,
            stats: {
                total,
                openCount,
                inProgressCount,
                resolvedCount,
                urgentCount,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update bug report status and admin notes (Admin only)
// @route   PATCH /api/bug-reports/:id/status
// @access  Private (Admin)
const updateBugReportStatus = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const report = await BugReport.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ message: 'Bug report not found' });
        }

        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        }

        const oldStatus = report.status;
        if (status) report.status = status;
        if (adminNotes !== undefined) report.adminNotes = adminNotes;

        if (status === 'Resolved' || status === 'Closed') {
            report.resolvedAt = new Date();
        }

        await report.save();

        // If status changed, notify the reporter
        if (status && status !== oldStatus) {
            // 1. In-App Notification
            try {
                await Notification.create({
                    user: report.reporter,
                    type: 'bug-report',
                    message: `Your bug report "${report.title}" has been updated to "${status}".`,
                    link: '/bug-report',
                });
            } catch (notifErr) {
                console.warn('[updateBugReportStatus] Could not create in-app notification:', notifErr.message);
            }

            // 2. Email Update
            sendBugStatusUpdateEmail(report, status, adminNotes).catch(err => {
                console.warn('[updateBugReportStatus] Status update email failed:', err.message);
            });
        }

        res.json({ message: 'Bug report updated successfully', report });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBugReport,
    getMyBugReports,
    getAllBugReports,
    updateBugReportStatus,
};
