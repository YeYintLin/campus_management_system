const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema({
    sourceFile: { type: mongoose.Schema.Types.ObjectId, ref: 'TimetableFile' },
    sheetName: { type: String, required: true },
    department: { type: String },
    academicYear: { type: String },
    yearLabel: { type: String },
    yearNumber: { type: Number, default: null }, // 1, 2, 3, 4, 5 (null for ME)
    semesterLabel: { type: String },
    semesterNumber: { type: Number, default: null }, // 1, 2, 3, 4...
    semesterOrder: { type: Number, default: 0 },
    majorRoom: { type: String },
    combinedRoom: { type: String },
    familyTeacher: { type: String },
    periods: { type: Array, default: [] },
    days: { type: Array, default: [] },
    legend: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Semester', semesterSchema);
