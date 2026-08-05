const mongoose = require('mongoose');

const restoreLogSchema = new mongoose.Schema({
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimetableFile', required: true },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    snapshotFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimetableFile' },
    restoredAt: { type: Date, default: Date.now },
    summary: { type: String }
});

module.exports = mongoose.model('RestoreLog', restoreLogSchema);
