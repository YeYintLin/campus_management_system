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
            type: String, // The assignment question/tutorial prompt file
        },
        fileName: {
            type: String, // Original question file name
        },
        submissions: [
            {
                student: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                rollNo: {
                    type: String,
                },
                fileName: {
                    type: String,
                },
                fileSize: {
                    type: String,
                },
                fileUrl: {
                    type: String, // The submitted assignment file
                    required: true,
                },
                isLate: {
                    type: Boolean,
                    default: false,
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
