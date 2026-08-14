const mongoose = require('mongoose');

const promotionJobSchema = new mongoose.Schema(
    {
        runId: {
            type: String,
            required: true,
            index: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        fromEnrollmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AcademicEnrollment',
            default: null,
        },
        toEnrollmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AcademicEnrollment',
            default: null,
        },
        action: {
            type: String,
            enum: ['Promote', 'HoldBack', 'Graduate', 'Withdraw'],
            required: true,
        },
        status: {
            type: String,
            enum: ['Pending', 'Done', 'Failed'],
            default: 'Pending',
        },
        error: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

promotionJobSchema.index({ runId: 1, status: 1 });

module.exports = mongoose.model('PromotionJob', promotionJobSchema);
