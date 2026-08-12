const mongoose = require('mongoose');

const scheduledSessionSchema = new mongoose.Schema(
    {
        year: {
            type: String,
            required: [true, 'Academic year is required'],
            enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'],
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
        sessionType: {
            type: String,
            required: [true, 'Session type is required'],
            enum: ['Practical', 'Tutorial', 'Exam', 'Academic', 'Lecture'],
        },
        examType: {
            type: String,
            enum: ['Mid-Term', 'Final', 'N/A'],
            default: 'N/A',
        },
        // course is optional (required: false) so imports can succeed before Course documents are formally indexed in DB.
        // Any feature calling populate('course') MUST handle a null case by falling back to courseCode / courseName.
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: false,
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
        title: {
            type: String,
            trim: true, // e.g. 'Testing Job-1', 'Tutorial I', 'Humanities and Social Science'
        },
        teacher: {
            type: String,
            trim: true,
        },
        // groupTag is a display-only field; not used in compound unique index as parallel-group slots do not occur in TU Hmawbi schedules.
        groupTag: {
            type: String,
            default: 'All', // e.g. 'Group 1 & 2', 'All'
            trim: true,
        },
        date: {
            type: Date,
            required: [true, 'Session date is required'],
        },
        startTime: {
            type: String,
            required: [true, 'Start time display string is required (e.g. 08:30 AM)'],
            trim: true,
        },
        endTime: {
            type: String,
            required: [true, 'End time display string is required (e.g. 11:30 AM)'],
            trim: true,
        },
        startTimeMinutes: {
            type: Number,
            required: [true, 'Start time in minutes from midnight is required for index sorting & overlap detection'],
        },
        endTimeMinutes: {
            type: Number,
            required: [true, 'End time in minutes from midnight is required for duration calculations & overlap detection'],
        },
        place: {
            type: String,
            required: [true, 'Place/Room location is required'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['Draft', 'Published'],
            default: 'Draft',
        },
        classSection: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ClassSection',
            required: false,
        },
        seatingPhoto: {
            type: String,
            trim: true,
        },
        seatingPairs: [{
            deskId: Number,
            left: String,
            right: String
        }],
        seatingSummary: [{
            major: String,
            range: String,
            count: Number
        }],
    },
    { timestamps: true }
);

// Compound unique index ensuring idempotent re-import upserts without creating duplicates.
// Note: groupTag is excluded from uniqueness key because TU Hmawbi schedules assign a single cohort/group per course-date-time slot.
scheduledSessionSchema.index(
    { year: 1, semester: 1, major: 1, sessionType: 1, courseCode: 1, date: 1, startTimeMinutes: 1 },
    { unique: true }
);

module.exports = mongoose.model('ScheduledSession', scheduledSessionSchema);
