const mongoose = require('mongoose');

const courseAssignmentSchema = new mongoose.Schema(
    {
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
            index: true,
        },
        academicYear: {
            type: String, // e.g. "2025-2026"
            required: true,
            trim: true,
        },
        semester: {
            type: Number,
            enum: [1, 2],
            required: true,
        },
    },
    { timestamps: true }
);

courseAssignmentSchema.index(
    { teacher: 1, course: 1, academicYear: 1, semester: 1 },
    { unique: true }
);

module.exports = mongoose.model('CourseAssignment', courseAssignmentSchema);
