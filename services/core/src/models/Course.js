const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        year: {
            type: Number,
            min: 1,
            max: 10,
            default: 1,
        },
        description: {
            type: String,
        },
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        students: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User', // Refers directly to the student User account
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
