const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // One user profile per student details
        },
        enrollmentNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        department: {
            type: String,
            required: true,
            trim: true,
        },
        semester: {
            type: Number,
            required: true,
        },
        contactNumber: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['Active', 'Probation', 'Suspended'],
            default: 'Active',
        },
        documents: [
            {
                name: String,
                url: String, // Path to the uploaded document
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
