const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        reporterName: {
            type: String,
            required: true,
            trim: true,
        },
        reporterEmail: {
            type: String,
            required: true,
            trim: true,
        },
        reporterRole: {
            type: String,
            enum: ['Student', 'Teacher', 'Admin'],
            required: true,
            index: true,
        },
        reporterCohort: {
            type: String,
            trim: true,
            default: '',
        },
        category: {
            type: String,
            enum: [
                'Assignment & Tutorial',
                'Attendance',
                'Timetable',
                'Grades & Exams',
                'Account & Login',
                'UI/Performance',
                'Other',
            ],
            required: true,
            index: true,
        },
        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Urgent'],
            default: 'Medium',
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        pageUrl: {
            type: String,
            trim: true,
            default: '',
        },
        attachments: [
            {
                fileUrl: { type: String, required: true },
                fileName: { type: String, default: 'Attachment' },
                fileSize: { type: String, default: '' },
                fileType: { type: String, default: '' },
            },
        ],
        deviceInfo: {
            browser: { type: String, default: '' },
            os: { type: String, default: '' },
            screenResolution: { type: String, default: '' },
            userAgent: { type: String, default: '' },
        },
        status: {
            type: String,
            enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Duplicate', "Won't Fix"],
            default: 'Open',
            index: true,
        },
        adminNotes: {
            type: String,
            default: '',
        },
        resolvedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Compound index for fast queries
bugReportSchema.index({ status: 1, createdAt: -1 });
bugReportSchema.index({ reporter: 1, createdAt: -1 });

module.exports = mongoose.model('BugReport', bugReportSchema);
