const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Please add an exam title'],
            trim: true,
        },
        course: {
            type: String, // You could make this an ObjectId ref to Course if you want stricter relations, but keeping String to match existing code
            required: [true, 'Please add a course code'],
            trim: true,
        },
        duration: {
            type: String,
            required: [true, 'Please add duration'],
            trim: true,
        },
        date: {
            type: String,
            required: [true, 'Please add an exam date'],
        },
        time: {
            type: String,
            required: [true, 'Please add an exam time'],
        },
        room: {
            type: String,
            required: [true, 'Please add a room/location'],
            trim: true,
        },
        year: {
            type: String,
            required: [true, 'Please specify the academic year'],
            enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'],
        },
        status: {
            type: String,
            required: true,
            enum: ['Upcoming', 'Scheduled', 'Published', 'Completed'],
            default: 'Upcoming',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Exam', examSchema);
