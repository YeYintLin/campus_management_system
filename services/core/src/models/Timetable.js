const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
    {
        year: {
            type: String,
            required: [true, 'Academic year is required'],
            enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'],
        },
        semester: {
            type: String,
            required: [true, 'Semester is required'],
            enum: ['Semester 1', 'Semester 2'],
        },
        major: {
            type: String,
            required: [true, 'Major code is required (e.g. MC, EIE, CS)'],
            trim: true,
            uppercase: true,
        },
        day: {
            type: String,
            required: [true, 'Day of week is required'],
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
        periodNumber: {
            type: Number,
            required: [true, 'TU Hmawbi period number (1-6) is required'],
            min: 1,
            max: 6,
        },
        startTime: {
            type: String,
            required: [true, 'Start time string is required (e.g. 09:00 AM)'],
            trim: true,
        },
        endTime: {
            type: String,
            required: [true, 'End time string is required (e.g. 09:50 AM)'],
            trim: true,
        },
        time: {
            type: String, // Compatibility field for legacy indexes
        },
        startTimeMinutes: {
            type: Number,
            required: [true, 'Start time in minutes from midnight is required (e.g. 540)'],
        },
        endTimeMinutes: {
            type: Number,
            required: [true, 'End time in minutes from midnight is required (e.g. 590)'],
        },
        courseCode: {
            type: String,
            required: [true, 'Course code is required'],
            trim: true,
            uppercase: true,
        },
        courseName: {
            type: String,
            required: [true, 'Course name is required'],
            trim: true,
        },
        room: {
            type: String,
            required: [true, 'Classroom/Laboratory location is required'],
            trim: true,
        },
        type: {
            type: String,
            enum: ['Lecture', 'Lab', 'Seminar', 'Tutorial', 'Project'],
            default: 'Lecture',
        },
        sessionLabel: {
            type: String,
            default: 'Lecture',
            trim: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: false,
        },
        classSection: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ClassSection',
            required: false,
        },
    },
    { timestamps: true }
);

// Active compound unique index
timetableSchema.index(
    { year: 1, semester: 1, major: 1, day: 1, startTimeMinutes: 1 },
    { unique: true }
);

const Timetable = mongoose.model('Timetable', timetableSchema);

// Auto-drop legacy index if present in DB
setTimeout(async () => {
    try {
        await Timetable.collection.dropIndex('year_1_semester_1_day_1_time_1');
        console.log('Dropped legacy index year_1_semester_1_day_1_time_1');
    } catch (err) {
        // Index already dropped or non-existent
    }
}, 2000);

module.exports = Timetable;
