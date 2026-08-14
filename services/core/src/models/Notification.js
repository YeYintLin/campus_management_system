const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false, // If null, it's a global notification broadcast to all
        },
        type: {
            type: String,
            required: true,
            enum: ['file', 'exam', 'system', 'assignment', 'grade', 'practical', 'tutorial', 'timetable', 'message', 'bug-report'],
            default: 'system',
        },
        message: {
            type: String,
            required: [true, 'Please add a notification message'],
            trim: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
        link: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Notification', notificationSchema);
