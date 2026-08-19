const mongoose = require('mongoose');

const eLibraryLogSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ELibraryItem',
        required: false
    },
    itemTitle: {
        type: String,
        required: true,
        trim: true
    },
    fileName: {
        type: String,
        default: ''
    },
    fileSize: {
        type: Number,
        default: 0
    },
    action: {
        type: String,
        enum: ['upload', 'download', 'edit', 'delete'],
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true,
        trim: true
    },
    userEmail: {
        type: String,
        default: '',
        trim: true
    },
    userRole: {
        type: String,
        enum: ['Student', 'Teacher', 'Admin', 'Superadmin', 'student', 'teacher', 'admin', 'superadmin', 'Academicadmin', 'academicadmin'],
        required: true
    },
    userDepartment: {
        type: String,
        default: 'Mechatronics Engineering'
    },
    userYear: {
        type: String,
        default: ''
    },
    ipAddress: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Indexes for fast lookup and time-series ordering
eLibraryLogSchema.index({ timestamp: -1 });
eLibraryLogSchema.index({ userId: 1, timestamp: -1 });
eLibraryLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('ELibraryLog', eLibraryLogSchema);
