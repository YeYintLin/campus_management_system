const Notification = require('../models/Notification');

// @desc    Get user notifications (includes global + specific)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch notifications for this user OR global notifications (user: null)
        const notifications = await Notification.find({
            $or: [{ user: userId }, { user: null }]
        }).sort({ createdAt: -1 }).limit(20);

        res.json(notifications);
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
