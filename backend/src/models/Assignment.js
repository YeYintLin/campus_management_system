const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        fileUrl: {
            type: String, // The assignment prompt file
        },
        submissions: [
            {
                student: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                fileUrl: {
                    type: String, // The submitted assignment file
                    required: true,
                },
                submittedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Assignment', assignmentSchema);
