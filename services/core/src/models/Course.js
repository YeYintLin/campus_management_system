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
        semester: {
            type: Number,
            min: 1,
            max: 4,
            default: null,
        },
        yearLabel: {
            type: String,
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
        gradingScheme: {
            finalExam: { type: Number, default: 40 },
            midterm: { type: Number, default: 25 },
            lab: { type: Number, default: 20 },
            quizzes: { type: Number, default: 15 },
        },
        curriculumModules: [
            {
                week: { type: String },
                title: { type: String },
                description: { type: String },
            },
        ],
        references: [{ type: String }],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
