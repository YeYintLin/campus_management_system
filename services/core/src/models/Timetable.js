const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
    {
        year: {
            type: String,
            required: [true, 'Please specify the academic year'],
            enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'],
        },
        semester: {
            type: String,
            required: [true, 'Please specify the semester'],
            enum: ['Semester 1', 'Semester 2'],
        },
        day: {
            type: String,
            required: [true, 'Please specify the day'],
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
        time: {
            type: String,
            required: [true, 'Please specify the time slot'],
        },
        course: {
            type: String,
            required: [true, 'Please add a course code'],
            trim: true,
        },
        room: {
            type: String,
            required: [true, 'Please add a room/location'],
            trim: true,
        },
        type: {
            type: String,
            required: [true, 'Please specify class type'],
            enum: ['Lecture', 'Lab', 'Seminar', 'Tutorial', 'Project'],
            default: 'Lecture',
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index to prevent overlapping slots for the same year/semester
timetableSchema.index({ year: 1, semester: 1, day: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
