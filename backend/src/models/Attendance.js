const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
        },
        records: [
            {
                student: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
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
attendanceSchema.index({ course: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
