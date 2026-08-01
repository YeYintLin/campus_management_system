const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        assessmentType: {
            type: String, // e.g., 'Midterm', 'Final', 'Assignment 1', 'Quiz'
            required: true,
            trim: true,
        },
        score: {
            type: Number,
            required: true,
            min: 0,
        },
        maxScore: {
            type: Number,
            required: true,
            min: 1,
        },
        comments: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// A student normally has one grade per specific assessment in a course
gradeSchema.index({ course: 1, student: 1, assessmentType: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
