const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
            index: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        academicYear: {
            type: String, // e.g. "2025-2026"
            required: true,
            index: true,
            trim: true,
        },
        yearLevel: {
            type: String, // e.g. "5th Year"
            trim: true,
        },
        semester: {
            type: Number,
            enum: [1, 2],
            required: true,
        },
        letterGrade: {
            type: String,
            enum: ['A', 'B', 'C', 'D', 'E', null],
            default: null,
            trim: true,
        },
        semester1Score: {
            type: Number, // Internal teacher-facing tracking score for Semester 1 (not shown to students)
            default: null,
            min: 0,
        },
        assessmentType: {
            type: String,
            trim: true,
            default: 'Semester Exam',
        },
        score: {
            type: Number,
            default: null,
            min: 0,
        },
        maxScore: {
            type: Number,
            default: 100,
            min: 1,
        },
        comments: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// One grade entry per student per course per academic year per semester
gradeSchema.index({ student: 1, course: 1, academicYear: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
