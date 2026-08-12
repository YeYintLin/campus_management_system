const XLSX = require('xlsx');
const { parseTUHmawbiExcel } = require('../utils/excelParser');

function runRegressionTest() {
    console.log('--- Starting Excel Parser Hardening Regression Test ---');

    // 1. Build test workbook with title rows + header row + data rows with duplicate course codes
    const testData = [
        ['Technological University (Hmawbi)'],
        ['Department of Mechatronics Engineering'],
        ['Practical Timetable (2024-2025)'],
        ['Sr No', 'Date', 'Time', 'Subject Code', 'Lab Experiment Title', 'Group', 'Lab Room', 'Instructor'],
        ['1', '12/08/2026', '08:30 AM to 11:30 AM', 'McE-31022', 'Control Systems Lab #1', 'Group A', 'Mechatronics Lab 1', 'Daw Myat Thu Zar'],
        ['2', '13/08/2026', '08:30 AM to 11:30 AM', 'McE-31022', 'Control Systems Lab #2', 'Group B', 'Mechatronics Lab 1', 'Daw Myat Thu Zar'],
        ['3', '14/08/2026', '08:30 AM to 11:30 AM', 'McE-31029', 'PLC Robotics Lab #1', 'Group A', 'Workshop I', 'U Thaung Nyunt']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(testData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Practical Timetable');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 2. Run parseTUHmawbiExcel on the buffer
    const { parsedMatrix, parsedSessions, headerError } = parseTUHmawbiExcel(buffer, 'Practical');

    if (headerError) {
        console.error('❌ Test Failed: Structural header detection failed with error:', headerError);
        process.exit(1);
    }

    console.log(`✓ Header row correctly detected (Title rows 0-2 excluded).`);
    console.log(`✓ Total parsed sessions: ${parsedSessions.length}`);

    // 3. Assertions
    if (parsedSessions.length !== 3) {
        console.error(`❌ Test Failed: Expected 3 session records, got ${parsedSessions.length}`);
        process.exit(1);
    }

    const titles = parsedSessions.map(s => s.courseCode);
    if (!titles.includes('MCE-31022') || !titles.includes('MCE-31029')) {
        console.error('❌ Test Failed: Course codes not extracted properly:', titles);
        process.exit(1);
    }

    // Verify title text was not parsed as a course code
    const invalidCodes = parsedSessions.filter(s => ['TECHNOLOGICAL', 'UNIVERSITY', 'DEPARTMENT', 'PRACTICAL'].includes(s.courseCode));
    if (invalidCodes.length > 0) {
        console.error('❌ Test Failed: Title text parsed as course code:', invalidCodes);
        process.exit(1);
    }

    console.log('✓ Title rows excluded successfully.');
    console.log('✓ Legitimate duplicate course code (McE-31022 x2) parsed cleanly into 2 session records.');
    console.log('✅ ALL REGRESSION TESTS PASSED SUCCESSFULLY!');
}

runRegressionTest();
