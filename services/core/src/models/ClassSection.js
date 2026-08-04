const mongoose = require('mongoose');

const classSectionSchema = new mongoose.Schema(
    {
        year: {
            type: String,
            required: [true, 'Academic year is required (e.g. 6th Year)'],
            enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'],
        },
        semester: {
            type: String,
            required: [true, 'Semester is required'],
            enum: ['Semester 1', 'Semester 2'],
        },
        major: {
            type: String,
            required: [true, 'Major / Department code is required (e.g. MC, EIE, CS)'],
            trim: true,
            uppercase: true,
        },
        familyTeacher: {
            type: String,
            required: [true, 'Family teacher name is required'],
            trim: true,
        },
        majorRoom: {
            type: String,
            required: [true, 'Major classroom location is required (e.g. 3/212-A)'],
            trim: true,
        },
    },
    { timestamps: true }
);

// Compound unique index ensuring only 1 ClassSection exists per year, semester, and major cohort
classSectionSchema.index({ year: 1, semester: 1, major: 1 }, { unique: true });

module.exports = mongoose.model('ClassSection', classSectionSchema);
