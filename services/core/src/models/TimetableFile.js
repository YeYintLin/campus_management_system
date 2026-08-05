const mongoose = require('mongoose');

const timetableFileSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TimetableFile', timetableFileSchema);
