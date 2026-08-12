/**
 * Clear all timetable data from MongoDB (Reset to default clean state)
 * Removes:
 * - All Semester timetable sheets & legends
 * - All Timetable slot records
 * - All ClassSection records
 *
 * Run on VPS:
 * docker exec cms-core-service-1 node src/scripts/clearTimetable.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/cms';

async function clearTimetable() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Semester = require('../models/Semester');
    const Timetable = require('../models/Timetable');
    const ClassSection = require('../models/ClassSection');

    const semRes = await Semester.deleteMany({});
    const slotRes = await Timetable.deleteMany({});
    const secRes = await ClassSection.deleteMany({});

    console.log('\n======================================================');
    console.log(`✅ Timetable Data Cleared Successfully!`);
    console.log(`   Semester Sheets Deleted: ${semRes.deletedCount}`);
    console.log(`   Timetable Slots Deleted: ${slotRes.deletedCount}`);
    console.log(`   Class Sections Deleted : ${secRes.deletedCount}`);
    console.log('   The timetable is now in a clean, default state.');
    console.log('======================================================\n');

    await mongoose.disconnect();
}

clearTimetable().catch(err => {
    console.error('Clear timetable failed:', err);
    process.exit(1);
});
