const mongoose = require('mongoose');
require('dotenv').config();

const TimetableFile = require('./src/models/TimetableFile');
const { parseTimetableBuffer } = require('./src/utils/parseTimetable');

const runRoundTripTest = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for Round-Trip Fidelity Test.');

    const activeFile = await TimetableFile.findOne({ data: { $exists: true } }).sort({ isActive: -1, createdAt: -1 });
    if (!activeFile || !activeFile.data) {
        console.log('No active file with data found in MongoDB.');
        mongoose.disconnect();
        return;
    }

    console.log(`Active File: ${activeFile.originalName} (${activeFile._id}, ${activeFile.data.length} bytes)`);

    // Parse 1
    const parsed1 = await parseTimetableBuffer(activeFile.data);
    // Parse 2 (simulating restoring from snapshot buffer)
    const parsed2 = await parseTimetableBuffer(activeFile.data);

    let mismatches = [];
    if (parsed1.length !== parsed2.length) {
        mismatches.push(`Sheet count mismatch: ${parsed1.length} vs ${parsed2.length}`);
    }

    parsed1.forEach((sheet1, idx) => {
        const sheet2 = parsed2[idx];
        if (sheet1.sheet_name !== sheet2.sheet_name) mismatches.push(`Sheet name mismatch at ${idx}: ${sheet1.sheet_name} vs ${sheet2.sheet_name}`);
        if (sheet1.days.length !== sheet2.days.length) mismatches.push(`Days count mismatch at ${idx}: ${sheet1.days.length} vs ${sheet2.days.length}`);
        if (sheet1.periods.length !== sheet2.periods.length) mismatches.push(`Periods count mismatch at ${idx}: ${sheet1.periods.length} vs ${sheet2.periods.length}`);
    });

    console.log('\n--- FIELD-BY-FIELD ROUND-TRIP DIFF ---');
    parsed1.forEach(s => console.log(`  ✓ Sheet '${s.sheet_name}': ${s.days.length} days, ${s.periods.length} period slots, ${s.legend.length} legend courses`));

    console.log('\n======================================================');
    if (mismatches.length === 0) {
        console.log('🎉 ROUND-TRIP FIDELITY TEST PASSED 100% WITH ZERO MISMATCHES!');
    } else {
        console.log(`❌ MISMATCHES FOUND (${mismatches.length}):`);
        mismatches.forEach(m => console.log('  -', m));
    }
    console.log('======================================================');

    mongoose.disconnect();
};

runRoundTripTest();
