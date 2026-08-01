const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema(
    {
        courseId: {
            type: String,
            required: [true, 'Course code is required'],
            trim: true,
        },
        courseName: {
            type: String,
            trim: true,
            default: '',
        },
        code: {
            type: String,
            required: true,
            length: 4,
        },
        generatedAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'completed'],
            default: 'active',
        },
        createdBy: {
            type: String,
            default: 'auto-cron',
        },
    },
    { timestamps: true }
);

// Auto-expire index using MongoDB TTL index or query check
attendanceSessionSchema.index({ courseId: 1, status: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
