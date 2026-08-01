const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true },
        active: { type: Boolean, default: true },
    },
    { _id: false }
);

const academicConfigSchema = new mongoose.Schema(
    {
        maxYear: { type: Number, required: true, default: 6, min: 1, max: 12 },
        departments: { type: [departmentSchema], default: [] },
        atRiskAttendanceThreshold: { type: Number, default: 75, min: 0, max: 100 },
        atRiskFailingThreshold: { type: Number, default: 2, min: 1, max: 10 },
        passMarkPercent: { type: Number, default: 40, min: 0, max: 100 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('AcademicConfig', academicConfigSchema);
