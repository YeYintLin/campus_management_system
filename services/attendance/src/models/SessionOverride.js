const mongoose = require('mongoose');

const sessionOverrideSchema = new mongoose.Schema(
    {
        courseCode: {
            type: String,
            required: [true, 'Course code is required'],
            trim: true,
        },
        originalDate: {
            type: Date,
            required: true,
        },
        originalTime: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['cancelled', 'rescheduled', 'makeup'],
            required: true,
        },
        newDate: {
            type: Date,
            default: null,
        },
        newStartTime: {
            type: String,
            default: null,
        },
        newEndTime: {
            type: String,
            default: null,
        },
        newRoom: {
            type: String,
            default: null,
        },
        reason: {
            type: String,
            required: [true, 'Reason for override is required'],
            trim: true,
        },
        reasonCategory: {
            type: String,
            enum: ['Emergency', 'Medical', 'Official', 'Weather', 'Other'],
            default: 'Other',
        },
        createdBy: {
            type: String,
            required: true,
        },
        notifyStudents: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ['Active', 'PendingApproval', 'Rejected'],
            default: 'Active',
        },
    },
    { timestamps: true }
);

sessionOverrideSchema.index({ courseCode: 1, originalDate: 1, originalTime: 1 });

module.exports = mongoose.model('SessionOverride', sessionOverrideSchema);
