const mongoose = require('mongoose');

const fileLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
        default: '',
    },
    userRole: {
        type: String,
        default: 'Student',
    },
    fileName: {
        type: String,
        required: true,
    },
    fileCategory: {
        type: String,
        default: 'Uncategorized',
    },
    fileSize: {
        type: String,
        default: '',
    },
    year: {
        type: String,
        default: 'All',
    },
    downloadedAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for fast querying by date and user
fileLogSchema.index({ downloadedAt: -1 });
fileLogSchema.index({ userId: 1, downloadedAt: -1 });

module.exports = mongoose.model('FileLog', fileLogSchema);
