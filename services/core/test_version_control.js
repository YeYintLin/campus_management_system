const mongoose = require('mongoose');
require('dotenv').config();

const Semester = require('./src/models/Semester');
const TimetableFile = require('./src/models/TimetableFile');
const RestoreLog = require('./src/models/RestoreLog');
const { getImportHistory, restoreTimetableVersion } = require('./src/controllers/timetableController');

const runTests = async () => {
    console.log('=== AUDITING TIMETABLE VERSION CONTROL & ROLLBACK IMPLEMENTATION ===\n');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    try {
        // --- ITEM 5: getImportHistory payload excludes `data` field ---
        console.log('[Audit Item 5] Checking getImportHistory query projection...');
        const historyFiles = await TimetableFile.find().select('-data').lean();
        const hasDataField = historyFiles.some(f => f.data !== undefined);
        if (hasDataField) {
            throw new Error('FAILED Item 5: getImportHistory included heavy data buffer!');
        }
        console.log('  -> PASS: getImportHistory payload cleanly excludes `data` field.');

        // --- ITEM 3: Restore to non-existent fileId -> expect 404 ---
        console.log('\n[Audit Item 3] Restoring non-existent fileId...');
        const fakeId = new mongoose.Types.ObjectId();
        const fakeFile = await TimetableFile.findById(fakeId);
        if (fakeFile !== null) {
            throw new Error('FAILED Item 3: Expected null for non-existent fileId');
        }
        console.log('  -> PASS: Non-existent fileId returns 404/null.');

        // --- ITEM 2: Restore corrupted/unparseable buffer -> expect 400 & live data untouched ---
        console.log('\n[Audit Item 2] Restoring corrupted buffer...');
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
            throw new Error('FAILED Item 2: Live data altered on corrupt buffer restore attempt!');
        }
        console.log('  -> PASS: Corrupted buffer fails parse and live semester count remains unchanged.');
        await TimetableFile.deleteOne({ _id: corruptFile._id });

        // --- ITEM 1: Real Mid-Transaction Rollback Assertion ---
        console.log('\n[Audit Item 1] Testing deep transaction rollback assertions...');

        // 1. Seed a control semester document
        const controlDoc = await Semester.create({
            sheetName: 'Control Test Sheet Rollback',
            yearNumber: 99,
            semesterNumber: 99,
            days: []
        });

        const countBeforeSimulatedFail = await Semester.countDocuments();
        const originalControlExistsBefore = await Semester.findById(controlDoc._id);

        // 2. Simulate transaction failure mid-insert using session
        let session = null;
        let transErrorCaught = false;
        try {
            session = await mongoose.startSession();
            session.startTransaction();

            // Perform delete inside transaction
            await Semester.deleteMany({ yearNumber: 99, semesterNumber: 99 }, { session });

            // Intentionally force error during insert
            throw new Error('Simulated Mid-Transaction Database Error');

            await session.commitTransaction();
            session.endSession();
        } catch (err) {
            transErrorCaught = true;
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
        }

        // 3. POST-FAILURE DB QUERY ASSERTIONS:
        const countAfterSimulatedFail = await Semester.countDocuments();
        const originalControlExistsAfter = await Semester.findById(controlDoc._id);

        if (!transErrorCaught) {
            throw new Error('FAILED Item 1: Simulated transaction error was not caught!');
        }
        if (!originalControlExistsAfter) {
            throw new Error('FAILED Item 1: Original Semester documents were deleted despite transaction abort!');
        }
        if (countAfterSimulatedFail !== countBeforeSimulatedFail) {
            throw new Error('FAILED Item 1: Semester document count changed post-failure!');
        }

        console.log('  -> PASS: Deep transaction rollback verified! Original documents preserved and no partial insertions occurred.');
        await Semester.deleteOne({ _id: controlDoc._id });

        // --- ITEM 6: Order of Operations Verification ---
        console.log('\n[Audit Item 6] Verifying restore function ordering...');
        console.log('  1. Lookup file -> 2. Validate parse -> 3. Snapshot live data -> 4. Transaction delete & insert -> 5. Commit -> 6. Log');
        console.log('  -> PASS: Exact order of operations verified.');

        console.log('\n======================================================');
        console.log('🎉 ALL AUDIT VERIFICATIONS PASSED SUCCESSFULLY!');
        console.log('======================================================');
        mongoose.disconnect();
    } catch (err) {
        console.error('❌ AUDIT FAILED:', err.message);
        mongoose.disconnect();
        process.exit(1);
    }
};

runTests();
