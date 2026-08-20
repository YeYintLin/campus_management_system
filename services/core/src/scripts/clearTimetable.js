/**
 * Clear all timetable data from MongoDB (Reset to default clean state)
 * Removes:
 * - Academic Timetable (Semester sheets & legends)
 * - Timetable Slots & Class Sections
 * - Practical Timetable, Tutorial Timetable & Exam Schedule (ScheduledSession)
 *
 * Run on VPS:
 * docker exec cms-core-service-1 node src/scripts/clearTimetable.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://mongo:27017/core_db';

async function clearTimetable() {
    try {
        await mongoose.connect(MONGODB_URI);
    } catch (e) {
        // Fallback for local connection
        await mongoose.connect('mongodb://127.0.0.1:27017/core_db');
    }
    console.log('Connected to MongoDB');

    const Semester = require('../models/Semester');
    const Timetable = require('../models/Timetable');
    const ClassSection = require('../models/ClassSection');
    const ScheduledSession = require('../models/ScheduledSession');

    const semRes = await Semester.deleteMany({});
    const slotRes = await Timetable.deleteMany({});
    const secRes = await ClassSection.deleteMany({});
    const sessRes = await ScheduledSession.deleteMany({});

    console.log('\n======================================================');
    console.log(`✅ Timetable & Schedule Data Cleared Successfully!`);
    console.log(`   Academic Timetable Sheets: ${semRes.deletedCount}`);
    console.log(`   Timetable Slots Deleted  : ${slotRes.deletedCount}`);
    console.log(`   Class Sections Deleted   : ${secRes.deletedCount}`);
    console.log(`   Practical/Tutorial/Exams : ${sessRes.deletedCount}`);
    console.log('   The system is now completely clean and ready for Excel import testing.');
    console.log('======================================================\n');

    await mongoose.disconnect();
}

clearTimetable().catch(err => {
    console.error('Clear timetable failed:', err);
    process.exit(1);
});
