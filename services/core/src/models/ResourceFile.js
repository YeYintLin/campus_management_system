const mongoose = require('mongoose');

const resourceFileSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            default: 'PDF',
        },
        size: {
            type: String,
            default: '1.0 MB',
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        owner: {
            type: String,
            default: 'Faculty',
        },
        year: {
            type: String,
            default: 'All',
        },
        fileUrl: {
            type: String,
            default: '',
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ResourceFile', resourceFileSchema);
