const Notification = require('../models/Notification');
const ScheduledSession = require('../models/ScheduledSession');

// @desc    Get user notifications (includes global + specific + 1-week advance session reminders)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch notifications for this user OR global notifications (user: null)
        const dbNotifications = await Notification.find({
            $or: [{ user: userId }, { user: null }]
        }).sort({ createdAt: -1 }).limit(20);

        // Fetch upcoming Practical & Tutorial sessions within 7 days (1 week advance reminder)
        const now = new Date();
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const upcomingSessions = await ScheduledSession.find({
            sessionType: { $in: ['Practical', 'Tutorial', 'Exam'] },
            date: { $gte: now, $lte: next7Days }
        }).sort({ date: 1 }).limit(15);

        const reminderNotifications = upcomingSessions.map(s => {
            const icon = s.sessionType === 'Practical' ? '🔬' : s.sessionType === 'Exam' ? '📝' : '✍️';
            const dateStr = s.date ? new Date(s.date).toLocaleDateString() : '';
            const diffMs = new Date(s.date).getTime() - now.getTime();
            const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 3600 * 24)));
            return {
                _id: `reminder-${s._id}`,
                type: s.sessionType.toLowerCase(),
                message: `${icon} Upcoming ${s.sessionType} (${daysLeft} day${daysLeft > 1 ? 's' : ''} away): [${s.courseCode}] ${s.title || s.courseName || ''} on ${dateStr} (${s.startTime || '08:30 AM'}) at ${s.place || 'Lab'}.`,
                link: s.sessionType === 'Exam' ? '/exams' : '/timetable',
                read: false,
                createdAt: s.createdAt || now
            };
        });

        const combined = [...reminderNotifications, ...dbNotifications];

        res.json(combined);
    } catch (error) {
        console.error('Get Notifications Error:', error.message);
        res.status(500).json({ message: 'Server error fetching notifications' });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Global notifications marked as read technically shouldn't be mutated for everyone, 
        // but for simplicity in this prototype, we'll just allow it or rely on frontend state.
        // A robust system would use a UserNotification state tracking collection for global reads.
        notification.read = true;
        await notification.save();

        res.json(notification);
    } catch (error) {
        console.error('Mark Read Error:', error.message);
        res.status(500).json({ message: 'Server error marking read' });
    }
};

// @desc    Create a new notification
// @route   POST /api/notifications
// @access  Private (Admin/Teacher)
const createNotification = async (req, res) => {
    try {
        const { user, type, message, link } = req.body;

        const notification = await Notification.create({
            user: user || null,
            type,
            message,
            link,
        });

        res.status(201).json(notification);
    } catch (error) {
        console.error('Create Notification Error:', error.message);
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    createNotification,
};
