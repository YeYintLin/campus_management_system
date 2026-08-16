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

        const sessionFilter = {
            sessionType: { $in: ['Practical', 'Tutorial', 'Exam'] },
            date: { $gte: now, $lte: next7Days }
        };

        // Scope to student's specific year and department / major
        if (req.user && req.user.role === 'Student') {
            const userYear = req.user.year || '';
            const userDept = req.user.department || '';

            const yrUpper = String(userYear).toUpperCase();
            if (yrUpper.includes('6') || yrUpper.includes('VI') || yrUpper.includes('FINAL')) {
                sessionFilter.year = /^(6|VI|6th|Final)/i;
            } else if (yrUpper.includes('5') || yrUpper.includes('V')) {
                sessionFilter.year = /^(5|V|5th)/i;
            } else if (yrUpper.includes('4') || yrUpper.includes('IV')) {
                sessionFilter.year = /^(4|IV|4th)/i;
            } else if (yrUpper.includes('3') || yrUpper.includes('III')) {
                sessionFilter.year = /^(3|III|3rd)/i;
            } else if (yrUpper.includes('2') || yrUpper.includes('II')) {
                sessionFilter.year = /^(2|II|2nd)/i;
            } else if (yrUpper.includes('1') || yrUpper.includes('I')) {
                sessionFilter.year = /^(1|I|1st)/i;
            }

            const deptUpper = String(userDept).toUpperCase();
            if (deptUpper.includes('MECHA') || deptUpper.includes('MC')) {
                sessionFilter.major = { $in: ['MC', 'Mechatronics', 'Mechatronics Engineering', 'MCE'] };
            } else if (deptUpper.includes('CIVIL') || deptUpper.includes('CE')) {
                sessionFilter.major = { $in: ['CE', 'Civil', 'Civil Engineering'] };
            } else if (deptUpper.includes('EP') || deptUpper.includes('ELECTRICAL POWER')) {
                sessionFilter.major = { $in: ['EP', 'Electrical Power', 'Electrical Power Engineering'] };
            } else if (deptUpper.includes('EC') || deptUpper.includes('ELECTRONIC')) {
                sessionFilter.major = { $in: ['EC', 'Electronic', 'Electronic Engineering'] };
            } else if (deptUpper.includes('MP') || deptUpper.includes('MECHANICAL')) {
                sessionFilter.major = { $in: ['MP', 'Mechanical', 'Mechanical Engineering'] };
            } else if (deptUpper.includes('IT') || deptUpper.includes('INFORMATION')) {
                sessionFilter.major = { $in: ['IT', 'Information Technology'] };
            } else if (deptUpper.includes('CHE') || deptUpper.includes('CHEMICAL')) {
                sessionFilter.major = { $in: ['ChE', 'Chemical', 'Chemical Engineering'] };
            }
        } else if (req.user && req.user.role === 'Teacher') {
            const userDept = (req.user.department || '').toUpperCase();
            if (userDept.includes('MECHA') || userDept.includes('MC')) {
                sessionFilter.major = { $in: ['MC', 'Mechatronics', 'Mechatronics Engineering', 'MCE'] };
            }
        }

        const upcomingSessions = await ScheduledSession.find(sessionFilter)
            .sort({ date: 1 })
            .limit(15);

        const reminderNotifications = upcomingSessions.map(s => {
            const icon = s.sessionType === 'Practical' ? '🔬' : s.sessionType === 'Exam' ? '📝' : '✍️';
            const dateStr = s.date ? new Date(s.date).toLocaleDateString() : '';
            const diffMs = new Date(s.date).getTime() - now.getTime();
            const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 3600 * 24)));
            return {
                _id: `reminder-${s._id}`,
                type: s.sessionType.toLowerCase(),
                message: `${icon} Upcoming ${s.sessionType} (${daysLeft} day${daysLeft > 1 ? 's' : ''} away): [${s.courseCode}] ${s.title || s.courseName || ''} on ${dateStr} (${s.startTime || '08:30 AM'}) at ${s.place || 'Lab'}.`,
                link: s.sessionType === 'Exam' ? '/exams' : '/time-table',
                read: false,
                date: s.date,
                createdAt: s.createdAt || now
            };
        });

        // Priority Rank: 1. Exam -> 2. Practical -> 3. Tutorial -> 4. Other stuff
        const getPriorityRank = (type) => {
            const t = String(type || '').toLowerCase();
            if (t === 'exam' || t.includes('exam')) return 1;
            if (t === 'practical' || t.includes('practical') || t.includes('lab')) return 2;
            if (t === 'tutorial' || t.includes('tutorial')) return 3;
            if (t === 'assignment' || t.includes('assignment') || t === 'grade' || t.includes('grade')) return 4;
            return 5;
        };

        const combined = [...reminderNotifications, ...dbNotifications].sort((a, b) => {
            // 1. Unread first
            if (Boolean(a.read) !== Boolean(b.read)) {
                return a.read ? 1 : -1;
            }
            // 2. Priority: Exam (1) > Practical (2) > Tutorial (3) > Other (4/5)
            const rankA = getPriorityRank(a.type);
            const rankB = getPriorityRank(b.type);
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            // 3. Newest / most recent
            const timeA = new Date(a.date || a.createdAt || 0).getTime();
            const timeB = new Date(b.date || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

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
