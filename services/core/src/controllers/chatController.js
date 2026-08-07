const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Staff/Admin roles constant for student restriction check
const ADMIN_TEACHER_ROLES = ['Admin', 'Teacher', 'Academicadmin', 'Superadmin'];

// @desc    Send a new chat message
// @route   POST /api/chat/send
// @access  Private
const sendMessage = async (req, res) => {
    try {
        const { recipient, content } = req.body;
        const senderId = req.user._id;

        if (!recipient || !content || !content.trim()) {
            return res.status(400).json({ message: 'Recipient and content are required' });
        }

        if (senderId.toString() === recipient.toString()) {
            return res.status(400).json({ message: 'Cannot send a message to yourself' });
        }

        const recipientUser = await User.findById(recipient);
        if (!recipientUser) {
            return res.status(404).json({ message: 'Recipient user not found' });
        }

        // Role restriction: Students cannot message other Students
        if (req.user.role === 'Student' && recipientUser.role === 'Student') {
            return res.status(403).json({ message: 'Students can only message Teachers and Administrators' });
        }

        const message = await Message.create({
            sender: senderId,
            recipient,
            content: content.trim(),
        });

        // Auto-create notification for recipient
        try {
            const senderUser = await User.findById(senderId).select('name');
            await Notification.create({
                user: recipient,
                type: 'message',
                message: `New message from ${senderUser ? senderUser.name : 'a user'}`,
                link: `/chat/${senderId}`,
            });
        } catch (notifErr) {
            console.error('Auto-create chat notification warning:', notifErr.message);
        }

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name email role')
            .populate('recipient', 'name email role');

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error('Send Message Error:', error.message);
        res.status(500).json({ message: 'Server error sending message' });
    }
};

// @desc    Get user's active conversations list with latest message & unread count
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
    try {
        const currentUserId = new mongoose.Types.ObjectId(req.user._id);

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: currentUserId }, { recipient: currentUserId }]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', currentUserId] },
                            '$recipient',
                            '$sender'
                        ]
                    },
                    lastMessage: { $first: '$content' },
                    lastMessageAt: { $first: '$createdAt' },
                    lastMessageSender: { $first: '$sender' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$recipient', currentUserId] },
                                        { $eq: ['$read', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'Users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'partnerInfo'
                }
            },
            {
                $unwind: '$partnerInfo'
            },
            {
                $project: {
                    partner: {
                        _id: '$partnerInfo._id',
                        name: '$partnerInfo.name',
                        email: '$partnerInfo.email',
                        role: '$partnerInfo.role',
                        department: '$partnerInfo.department'
                    },
                    lastMessage: 1,
                    lastMessageAt: 1,
                    lastMessageSender: 1,
                    unreadCount: 1
                }
            },
            {
                $sort: { lastMessageAt: -1 }
            }
        ]);

        res.json(conversations);
    } catch (error) {
        console.error('Get Conversations Error:', error.message);
        res.status(500).json({ message: 'Server error fetching conversations' });
    }
};

// @desc    Get cursor-paginated chat history with a specific partner
// @route   GET /api/chat/history/:partnerId
// @access  Private
const getHistory = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { before, limit } = req.query;
        const currentUserId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({ message: 'Invalid partner ID' });
        }

        const filter = {
            $or: [
                { sender: currentUserId, recipient: partnerId },
                { sender: partnerId, recipient: currentUserId }
            ]
        };

        if (before && mongoose.Types.ObjectId.isValid(before)) {
            filter._id = { $lt: new mongoose.Types.ObjectId(before) };
        }

        const queryLimit = parseInt(limit, 10) || 30;

        const messages = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(queryLimit + 1)
            .populate('sender', 'name role')
            .populate('recipient', 'name role');

        let hasMore = false;
        if (messages.length > queryLimit) {
            hasMore = true;
            messages.pop();
        }

        res.json({
            messages,
            hasMore
        });
    } catch (error) {
        console.error('Get Chat History Error:', error.message);
        res.status(500).json({ message: 'Server error fetching chat history' });
    }
};

// @desc    Mark all unread messages from a specific partner as read
// @route   PUT /api/chat/read/:partnerId
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const currentUserId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({ message: 'Invalid partner ID' });
        }

        const result = await Message.updateMany(
            { recipient: currentUserId, sender: partnerId, read: false },
            { $set: { read: true } }
        );

        res.json({ modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Mark Chat Read Error:', error.message);
        res.status(500).json({ message: 'Server error marking messages as read' });
    }
};

// @desc    Search/list eligible users to start a new chat conversation
// @route   GET /api/chat/users
// @access  Private
const getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const currentUserId = req.user._id;
        const filter = { _id: { $ne: currentUserId } };

        // Students can only see Teachers & Admins in the user picker
        if (req.user.role === 'Student') {
            filter.role = { $in: ADMIN_TEACHER_ROLES };
        }

        if (search && search.trim()) {
            filter.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { email: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('_id name email role department')
            .sort({ name: 1 })
            .limit(20);

        res.json(users);
    } catch (error) {
        console.error('Get Chat Users Error:', error.message);
        res.status(500).json({ message: 'Server error fetching chat users' });
    }
};

module.exports = {
    sendMessage,
    getConversations,
    getHistory,
    markAsRead,
    getUsers,
};
