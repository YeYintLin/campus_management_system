const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        targetStudent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        academicYear: {
            type: String,
            default: null,
            trim: true,
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: false }
);

auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
