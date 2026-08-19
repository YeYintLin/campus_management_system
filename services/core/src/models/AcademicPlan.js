const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
    {
        sr: { type: Number, required: true },
        titleMy: { type: String, required: true, trim: true },
        titleEn: { type: String, required: true, trim: true },
        startDate: { type: String, required: true, trim: true },
        endDate: { type: String, default: null, trim: true },
        duration: { type: String, default: '', trim: true },
        category: {
            type: String,
            enum: ['Registration', 'Opening', 'Teaching', 'Study', 'Exam', 'Grading', 'Vacation', 'Results', 'Other'],
            default: 'Other'
        },
        isCurrent: { type: Boolean, default: false },
        isCompleted: { type: Boolean, default: false }
    },
    { _id: true }
);

const academicPlanSchema = new mongoose.Schema(
    {
        tableId: { type: String, required: true, unique: true, trim: true },
        appliesTo: {
            type: String,
            required: true,
            trim: true,
            enum: [
                'all-years-2025-2026-closing',
                '2nd-year-sem2-and-incoming-1st-year-sem1-2026-2027',
                'general'
            ]
        },
        departmentHeadingMy: {
            type: String,
            default: 'အဆင့်မြင့်သိပ္ပံနှင့်နည်းပညာဦးစီးဌာန',
            trim: true
        },
        titleMy: { type: String, required: true, trim: true },
        titleEn: { type: String, required: true, trim: true },
        academicYear: { type: String, required: true, trim: true },
        semester: { type: String, default: '', trim: true },
        documentUrl: { type: String, default: '', trim: true },
        milestones: [milestoneSchema],
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AcademicPlan', academicPlanSchema);
