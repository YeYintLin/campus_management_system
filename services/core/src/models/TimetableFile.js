const mongoose = require('mongoose');

const timetableFileSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TimetableFile', timetableFileSchema);
