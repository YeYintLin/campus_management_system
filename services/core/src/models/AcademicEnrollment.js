const mongoose = require('mongoose');

const academicEnrollmentSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        academicYear: {
            type: String, // e.g. "2025-2026"
            required: true,
            index: true,
            trim: true,
        },
        yearLevel: {
            type: String, // e.g. "5th Year"
            required: true,
            trim: true,
        },
        department: {
            type: String,
            required: true,
            trim: true,
        },
        rollNo: {
            type: String,
            default: null,
            trim: true,
        },
        rollNoAssignedAt: {
            type: Date,
            default: null,
        },
        rollNoAssignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        attendanceRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        status: {
            type: String,
            enum: ['Active', 'Completed', 'Held Back', 'Withdrawn', 'On Leave'],
            default: 'Active',
        },
    },
    { timestamps: true }
);

// One enrollment record per student per academic year
academicEnrollmentSchema.index({ student: 1, academicYear: 1 }, { unique: true });

// Sparse unique index: once assigned, rollNo within an academicYear & department must be unique
academicEnrollmentSchema.index(
    { academicYear: 1, department: 1, rollNo: 1 },
    { unique: true, sparse: true }
);

module.exports = mongoose.model('AcademicEnrollment', academicEnrollmentSchema);
