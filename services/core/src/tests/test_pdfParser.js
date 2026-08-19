const path = require('path');
const assert = require('assert');
const { parseTUHmawbiExamPdf } = require('../utils/pdfParser');

const pdf5Path = "D:\\cms\\6BE thesis\\(2025-2026 )V, Mid-Term(2-2-25)_23ffcec3-bf12-456a-ad42-43bc95bd0eda.pdf";
const pdf6Path = "D:\\cms\\6BE thesis\\(2025-2026 )VI Mid-Term(2-2-25)_d7c4b0e9-1be4-4217-afb1-457a87f5c022.pdf";

async function runTests() {
    console.log('====================================================');
    console.log('🧪 RUNNING UNIT TESTS FOR pdfParser.js (Tasks 3 & 4)');
    console.log('====================================================');

    // ─────────────────────────────────────────────
    // TEST 1: 5th Year Mid-Term PDF Verification (Task 4)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 1] Parsing 5th Year Mid-Term PDF...');
    const res5 = await parseTUHmawbiExamPdf(pdf5Path);

    assert.strictEqual(res5.success, true, 'Result should be successful');
    assert.strictEqual(res5.metadata.year, '5th Year', 'Year should normalize to 5th Year');
    assert.strictEqual(res5.metadata.examType, 'Mid-Term', 'Exam type should be Mid-Term');
    assert.strictEqual(res5.metadata.major, 'MC', 'Major should be MC');
    assert.strictEqual(res5.totalRows, 7, '5th Year should have exactly 7 total rows');
    assert.strictEqual(res5.scheduledCount, 7, 'All 7 sessions should be scheduled');
    assert.strictEqual(res5.unscheduledCount, 0, 'No unscheduled sessions in 5th year');

    const expected5thSessions = [
        { dateStr: '17.3.2026', dayOfWeek: 'Tuesday', code: 'McE 51018', name: 'Industrial Management I' },
        { dateStr: '18.3.2026', dayOfWeek: 'Wednesday', code: 'McE 51017', name: 'Modern Control System I' },
        { dateStr: '19.3.2026', dayOfWeek: 'Thursday', code: 'McE 51021', name: 'Robotic Analysis I' },
        { dateStr: '20.3.2026', dayOfWeek: 'Friday', code: 'McE 51051', name: 'Machine Vision I' },
        { dateStr: '23.3.2026', dayOfWeek: 'Monday', code: 'McE 51027', name: 'Fuzzy Logic I' },
        { dateStr: '24.3.2026', dayOfWeek: 'Tuesday', code: 'McE 51039', name: 'Industrial Automation I' },
        { dateStr: '25.3.2026', dayOfWeek: 'Wednesday', code: 'McE 51029', name: 'Microprocessor and Microcontorller I' },
    ];

    res5.sessions.forEach((s, idx) => {
        const exp = expected5thSessions[idx];
        console.log(`  ✓ Row ${idx + 1}: ${s.dateString} (${s.dayOfWeek}) — [${s.courseCode}] ${s.courseName} | ${s.startTime} To ${s.endTime}`);
        assert.strictEqual(s.dateString, exp.dateStr, `Row ${idx + 1} date mismatch`);
        assert.strictEqual(s.dayOfWeek, exp.dayOfWeek, `Row ${idx + 1} day mismatch`);
        assert.strictEqual(s.courseCode, exp.code, `Row ${idx + 1} course code mismatch`);
        assert.strictEqual(s.courseName, exp.name, `Row ${idx + 1} course name mismatch`);
        assert.strictEqual(s.startTime, '08:30', `Row ${idx + 1} start time mismatch`);
        assert.strictEqual(s.endTime, '11:30', `Row ${idx + 1} end time mismatch`);
        assert.strictEqual(s.status, 'Scheduled', `Row ${idx + 1} status should be Scheduled`);
    });

    console.log('✅ TEST 1 PASSED: All 7 5th-Year sessions verified with 100% precision!');

    // ─────────────────────────────────────────────
    // TEST 2: 6th Year Mid-Term PDF Verification (Tasks 3 & 4)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 2] Parsing 6th Year Mid-Term PDF with Incomplete/Unscheduled Rows...');
    const res6 = await parseTUHmawbiExamPdf(pdf6Path);

    assert.strictEqual(res6.success, true, 'Result should be successful');
    assert.strictEqual(res6.metadata.year, '6th Year', 'Year should normalize to 6th Year');
    assert.strictEqual(res6.metadata.examType, 'Mid-Term', 'Exam type should be Mid-Term');
    assert.strictEqual(res6.totalRows, 6, '6th Year should extract exactly 6 total rows matching visual count');
    assert.strictEqual(res6.scheduledCount, 3, 'Exactly 3 sessions should be complete/scheduled');
    assert.strictEqual(res6.unscheduledCount, 3, 'Exactly 3 sessions should be flagged as unscheduled');

    // Complete sessions (Rows 1-3)
    const expected6thComplete = [
        { dateStr: '17.3.2026', dayOfWeek: 'Tuesday', code: 'HSS 61011', name: 'Humanities and Social Science' },
        { dateStr: '18.3.2026', dayOfWeek: 'Wednesday', code: 'McE 61031', name: 'System Design' },
        { dateStr: '19.3.2026', dayOfWeek: 'Thursday', code: 'McE 61028', name: 'Quality Control' },
    ];

    for (let i = 0; i < 3; i++) {
        const s = res6.sessions[i];
        const exp = expected6thComplete[i];
        console.log(`  ✓ Complete Row ${i + 1}: ${s.dateString} (${s.dayOfWeek}) — [${s.courseCode}] ${s.courseName}`);
        assert.strictEqual(s.dateString, exp.dateStr);
        assert.strictEqual(s.dayOfWeek, exp.dayOfWeek);
        assert.strictEqual(s.courseCode, exp.code);
        assert.strictEqual(s.courseName, exp.name);
        assert.strictEqual(s.status, 'Scheduled');
        assert.strictEqual(s.isComplete, true);
    }

    // Incomplete / Unscheduled sessions (Rows 4-6)
    const expected6thUnscheduledDates = ['20.3.2026', '23.3.2026', '24.3.2026'];
    for (let i = 3; i < 6; i++) {
        const s = res6.sessions[i];
        const expDate = expected6thUnscheduledDates[i - 3];
        console.log(`  ✓ Unscheduled Row ${i + 1}: ${s.dateString} (${s.dayOfWeek}) — courseCode: ${s.courseCode}, title: ${s.title}, status: ${s.status}`);
        assert.strictEqual(s.dateString, expDate);
        assert.strictEqual(s.courseCode, null, 'Unscheduled courseCode must be null');
        assert.strictEqual(s.courseName, null, 'Unscheduled courseName must be null');
        assert.strictEqual(s.title, null, 'Unscheduled title must be null');
        assert.strictEqual(s.status, 'Unscheduled', 'Status must be Unscheduled');
        assert.strictEqual(s.isComplete, false, 'isComplete must be false');
    }

    console.log('✅ TEST 2 PASSED: 3 complete + 3 unscheduled rows handled flawlessly without crashing!');
    console.log('\n🎉 ALL UNIT TESTS PASSED (100% SUCCESS)!');
}

runTests().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
