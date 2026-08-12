const mongoose = require('mongoose');

const customFolderSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: 'Custom collection',
        },
        iconColor: {
            type: String,
            default: '#6366f1',
        },
        year: {
            type: String,
            default: 'All',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CustomFolder', customFolderSchema);
