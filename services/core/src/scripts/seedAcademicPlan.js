const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const AcademicPlan = require('../models/AcademicPlan');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://yeyint2702:1234567890@cluster0.yczoc.mongodb.net/core_db?retryWrites=true&w=majority';

const academicPlanSeedData = [
    // ─────────────────────────────────────────────
    // Table A: Rows 1–8 (All Existing Years 2025-2026 Closing Cycle)
    // ─────────────────────────────────────────────
    {
        tableId: 'table-a',
        appliesTo: 'all-years-2025-2026-closing',
        departmentHeadingMy: 'အဆင့်မြင့်သိပ္ပံနှင့်နည်းပညာဦးစီးဌာန',
        titleMy: '၂၀၂၅-၂၀၂၆ ပညာသင်နှစ်နှင့် ၂၀၂၆-၂၀၂၇ ပညာသင်နှစ် ဘွဲ့ကြို၊ ဘွဲ့လွန်သင်တန်းများ၏ သင်တန်းကာလအစီအစဉ် (ပထမနှစ်ဝက်)',
        titleEn: 'Academic Year 2025-2026 Closing Cycle (All Existing Years - First Semester)',
        academicYear: '2025-2026',
        semester: 'Semester 1',
        isActive: true,
        milestones: [
            {
                sr: 1,
                titleMy: 'သင်တန်းနှစ်များအားလုံး ကျောင်းအပ်(စတင်)လက်ခံရက်',
                titleEn: 'All Years Student Registration Open',
                startDate: '17-11-2025',
                endDate: null,
                duration: '၁၇-၁၁-၂၀၂၅ (တနင်္လာနေ့)',
                category: 'Registration',
                isCompleted: true
            },
            {
                sr: 2,
                titleMy: 'ကျောင်းဖွင့်လှစ်မည့်ရက်',
                titleEn: 'University Classes Open',
                startDate: '24-11-2025',
                endDate: null,
                duration: '၂၄-၁၁-၂၀၂၅ (တနင်္လာနေ့)',
                category: 'Opening',
                isCompleted: true
            },
            {
                sr: 3,
                titleMy: 'စာသင်ကြားကာလ',
                titleEn: 'Academic Teaching Period',
                startDate: '24-11-2025',
                endDate: '13-3-2026',
                duration: '(၁၆) ပတ် / 16 Weeks',
                category: 'Teaching',
                isCompleted: true
            },
            {
                sr: 4,
                titleMy: 'ကိုယ်ပိုင်စာကြည့်ချိန်',
                titleEn: 'Study & Preparation Week',
                startDate: '14-3-2026',
                endDate: '16-3-2026',
                duration: '(၁) ပတ် / 1 Week',
                category: 'Study',
                isCompleted: true
            },
            {
                sr: 5,
                titleMy: 'နှစ်ဝက်စာမေးပွဲ',
                titleEn: 'Semester Examinations',
                startDate: '17-3-2026',
                endDate: '27-3-2026',
                duration: '(၂) ပတ် / 2 Weeks',
                category: 'Exam',
                isCompleted: true
            },
            {
                sr: 6,
                titleMy: 'အဖြေလွှာစစ်ဆေးခြင်းနှင့် အောင်စာရင်းကိစ္စဆောင်ရွက်ခြင်း',
                titleEn: 'Exam Paper Checking & Result Processing',
                startDate: '30-3-2026',
                endDate: '1-5-2026',
                duration: '(၅) ပတ် / 5 Weeks',
                category: 'Grading',
                isCompleted: true
            },
            {
                sr: 7,
                titleMy: 'နွေရာသီကျောင်းပိတ်ရက်နှင့် Project, Industrial Training, Excursion',
                titleEn: 'Summer Vacation, Project, Industrial Training & Excursion',
                startDate: '30-3-2026',
                endDate: '8-5-2026',
                duration: '(၆) ပတ် / 6 Weeks',
                category: 'Vacation',
                isCompleted: true
            },
            {
                sr: 8,
                titleMy: 'Grade ထုတ်ပြန်ခြင်း နှင့် အောင်စာရင်းထုတ်ပြန်ခြင်း',
                titleEn: 'Grade & Final Examination Results Announcement',
                startDate: '17-5-2026',
                endDate: null,
                duration: '၁၇-၅-၂၀၂၆',
                category: 'Results',
                isCompleted: true
            }
        ]
    },

    // ─────────────────────────────────────────────
    // Table B: Rows 9–16 (2nd-Year Sem 2 & Incoming 1st-Year Sem 1)
    // ─────────────────────────────────────────────
    {
        tableId: 'table-b',
        appliesTo: '2nd-year-sem2-and-incoming-1st-year-sem1-2026-2027',
        departmentHeadingMy: 'အဆင့်မြင့်သိပ္ပံနှင့်နည်းပညာဦးစီးဌာန',
        titleMy: '၂၀၂၅-၂၀၂၆ ပညာသင်နှစ် ဒုတိယနှစ်ဝက်သင်တန်း၊ ၂၀၂၆-၂၀၂၇ ပညာသင်နှစ် ပထမနှစ်ဝက် သင်တန်းများ၏ သင်တန်းကာလအစီအစဉ်',
        titleEn: 'Academic Year 2025-2026 Sem 2 & 2026-2027 Sem 1 Cycle (2nd Year Sem 2 & Incoming 1st Year Sem 1)',
        academicYear: '2025-2026 / 2026-2027',
        semester: 'Semester 2',
        isActive: true,
        milestones: [
            {
                sr: 9,
                titleMy: 'ကျောင်းအပ်(စတင်) လက်ခံရက်',
                titleEn: 'Student Registration Open',
                startDate: '25-5-2026',
                endDate: null,
                duration: '၂၅-၅-၂၀၂၆ (တနင်္လာနေ့)',
                category: 'Registration',
                isCompleted: true
            },
            {
                sr: 10,
                titleMy: 'ကျောင်းဖွင့်လှစ်မည့်ရက်',
                titleEn: 'Classes Open',
                startDate: '1-6-2026',
                endDate: null,
                duration: '၁-၆-၂၀၂၆ (တနင်္လာနေ့)',
                category: 'Opening',
                isCompleted: true
            },
            {
                sr: 11,
                titleMy: 'စာသင်ကြားချိန် (Practical, Practical Exam, Class Work, Assignment များအပါအဝင်)',
                titleEn: 'Teaching Period (including Practical, Practical Exam, Class Work & Assignments)',
                startDate: '1-6-2026',
                endDate: '18-9-2026',
                duration: '(၁၆) ပတ် / 16 Weeks',
                category: 'Teaching',
                isCurrent: true,
                isCompleted: false
            },
            {
                sr: 12,
                titleMy: 'ကိုယ်ပိုင်စာကြည့်ချိန်',
                titleEn: 'Study & Preparation Week',
                startDate: '19-9-2026',
                endDate: '23-9-2026',
                duration: '(၁) ပတ် / 1 Week',
                category: 'Study',
                isCurrent: false,
                isCompleted: false
            },
            {
                sr: 13,
                titleMy: 'နှစ်ဝက်စာမေးပွဲ',
                titleEn: 'Semester Examinations',
                startDate: '24-9-2026',
                endDate: '7-10-2026',
                duration: '(၂) ပတ် / 2 Weeks',
                category: 'Exam',
                isCurrent: false,
                isCompleted: false
            },
            {
                sr: 14,
                titleMy: 'အဖြေလွှာစစ်ဆေးခြင်းနှင့် အောင်စာရင်းကိစ္စဆောင်ရွက်ခြင်း',
                titleEn: 'Exam Paper Checking & Result Processing',
                startDate: '8-10-2026',
                endDate: '6-11-2026',
                duration: '(၄) ပတ် / 4 Weeks',
                category: 'Grading',
                isCurrent: false,
                isCompleted: false
            },
            {
                sr: 15,
                titleMy: 'Project, Industrial Training, Excursion',
                titleEn: 'Project, Industrial Training & Excursion',
                startDate: '12-10-2026',
                endDate: '6-11-2026',
                duration: '(၄) ပတ် / 4 Weeks',
                category: 'Vacation',
                isCurrent: false,
                isCompleted: false
            },
            {
                sr: 16,
                titleMy: 'အောင်စာရင်းထုတ်ပြန်ခြင်း',
                titleEn: 'Final Examination Results Announcement',
                startDate: '17-11-2026',
                endDate: null,
                duration: '၁၇-၁၁-၂၀၂၆',
                category: 'Results',
                isCurrent: false,
                isCompleted: false
            }
        ]
    }
];

async function seedAcademicPlan() {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        for (const item of academicPlanSeedData) {
            await AcademicPlan.findOneAndUpdate(
                { tableId: item.tableId },
                { $set: item },
                { upsert: true, new: true }
            );
            console.log(`✓ Seeded Academic Plan table: ${item.tableId} (${item.appliesTo})`);
        }

        console.log('🎉 Academic Plan seeding completed successfully!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding error:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    seedAcademicPlan();
}

module.exports = { seedAcademicPlan, academicPlanSeedData };
