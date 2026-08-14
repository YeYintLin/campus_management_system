const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        courseId: {
            type: String,
            required: true,
        },
        academicYear: {
            type: String, // e.g. "2025-2026"
            trim: true,
        },
        yearLevel: {
            type: String, // e.g. "5th Year"
            trim: true,
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
        },
        records: [
            {
                studentId: {
                    type: String,
                    required: true,
                },
                status: {
                    type: String,
                    enum: ['Present', 'Absent', 'Late', 'Excused'],
                    required: true,
                    default: 'Present',
                },
            },
        ],
    },
    { timestamps: true }
);

// Ensure only one attendance record per course per day
attendanceSchema.index({ courseId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
