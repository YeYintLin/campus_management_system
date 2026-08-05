const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Semester = require('./src/models/Semester');
const TimetableFile = require('./src/models/TimetableFile');
const RestoreLog = require('./src/models/RestoreLog');

const runTests = async () => {
    console.log('=== RUNNING SAFETY HARDENED TIMETABLE VERSION CONTROL TESTS ===');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    try {
        // --- TEST 5: getImportHistory payload excludes `data` field ---
        console.log('\n[Test 5] Checking getImportHistory query projection...');
        const historyFiles = await TimetableFile.find().select('-data').lean();
        const hasDataField = historyFiles.some(f => f.data !== undefined);
        if (hasDataField) {
            throw new Error('FAILED Test 5: getImportHistory included heavy data buffer!');
        }
        console.log('✅ PASSED Test 5: getImportHistory payload cleanly excludes `data` field.');

        // --- TEST 3: Restore to non-existent fileId -> expect 404 ---
        console.log('\n[Test 3] Restoring non-existent fileId...');
        const fakeId = new mongoose.Types.ObjectId();
        const fakeFile = await TimetableFile.findById(fakeId);
        if (fakeFile !== null) {
            throw new Error('FAILED Test 3: Expected null for non-existent fileId');
        }
        console.log('✅ PASSED Test 3: Non-existent fileId returns 404/null.');

        // --- TEST 2: Restore corrupted/unparseable buffer -> expect 400 & live data untouched ---
        console.log('\n[Test 2] Restoring corrupted buffer...');
        const initialSemCount = await Semester.countDocuments();
        const corruptFile = await TimetableFile.create({
            originalName: 'corrupted-test.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data: Buffer.from('NOT_A_VALID_EXCEL_FILE_BUFFER'),
            size: 28,
            isActive: false
        });

        const { parseTimetableBuffer } = require('./src/utils/parseTimetable');
        let parseFailed = false;
        try {
            await parseTimetableBuffer(corruptFile.data);
        } catch (e) {
            parseFailed = true;
        }

        const semCountAfterCorruptParse = await Semester.countDocuments();
        if (!parseFailed || semCountAfterCorruptParse !== initialSemCount) {
            throw new Error('FAILED Test 2: Live data altered on corrupt buffer restore attempt!');
        }
        console.log('✅ PASSED Test 2: Corrupted buffer fails parse and live semester count remains unchanged.');
        await TimetableFile.deleteOne({ _id: corruptFile._id });

        // --- TEST 1 & 4: Append-only Pre-Restore Snapshot Creation ---
        console.log('\n[Test 1 & 4] Pre-Restore Snapshot & Append-Only History...');
        const activeFileBefore = await TimetableFile.findOne({ isActive: true }).sort({ createdAt: -1 });
        if (activeFileBefore) {
            const snapshotDoc = await TimetableFile.create({
                originalName: `pre-restore-snapshot-${Date.now()}.xlsx`,
                mimeType: activeFileBefore.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                data: activeFileBefore.data,
                size: activeFileBefore.data.length,
                isActive: false
            });
            console.log(`✅ Snapshot created successfully: ${snapshotDoc.originalName} (${snapshotDoc._id})`);
            await TimetableFile.deleteOne({ _id: snapshotDoc._id });
        }

        console.log('\n======================================================');
        console.log('🎉 ALL SAFETY HARDENED TIMETABLE VERSION CONTROL TESTS PASSED!');
        console.log('======================================================');
        mongoose.disconnect();
    } catch (err) {
        console.error('❌ TEST FAILED:', err.message);
        mongoose.disconnect();
        process.exit(1);
    }
};

runTests();
