const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const assert = require('assert');
const ExcelJS = require('exceljs');

const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const attendanceRoutes = require('../routes/attendanceRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'test_attendance_secret_123';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRoutes);

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role, year: user.year, department: user.department },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

const mockTeacher = {
    _id: '507f1f77bcf86cd799439099',
    name: 'Daw Khaing Thida Aung',
    email: 'khaing.thida.aung@tuhmawbi.edu.mm',
    role: 'Teacher',
    year: '5th Year',
    department: 'Mechatronics Engineering'
};

const mockStudent = {
    _id: '507f1f77bcf86cd799439088',
    name: 'V-MC-1 မဟန်နီစိုး',
    email: 'honey.soe@tuhmawbi.edu.mm',
    role: 'Student',
    year: '5th Year',
    department: 'Mechatronics Engineering'
};

const teacherToken = generateToken(mockTeacher);
const studentToken = generateToken(mockStudent);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/attendance_db';

async function runAttendanceTests() {
    console.log('=======================================================');
    console.log('ATTENDANCE SERVICE SUMMARY & EXCEL EXPORT INTEGRATION TEST');
    console.log('=======================================================\n');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for attendance test.\n');
    } catch (e) {
        console.log('MongoDB Notice:', e.message);
    }

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        // --- SEED SEED ATTENDANCE RECORDS ---
        console.log('--- SEEDING ATTENDANCE FIXTURES ---');
        await Attendance.deleteMany({ courseId: 'McE-52039' });
        await AttendanceSession.deleteMany({ courseId: 'McE-52039' });

        const date1 = new Date();
        date1.setDate(date1.getDate() - 2);

        const date2 = new Date();
        date2.setDate(date2.getDate() - 5);

        const rec1 = await Attendance.create({
            courseId: 'McE-52039',
            date: date1,
            records: [{ studentId: mockStudent._id, status: 'Present' }]
        });

        const rec2 = await Attendance.create({
            courseId: 'McE-52039',
            date: date2,
            records: [{ studentId: mockStudent._id, status: 'Present' }]
        });

        console.log('Seeded Attendance Records for McE-52039 (2 Sessions).\n');

        // Test 1: 30-Second Live Attendance Session Creation Timer
        console.log('[TEST 1] POST /api/attendance/create-session (30s Timer Check)');
        const resSession = await axios.post(`${baseUrl}/api/attendance/create-session`, {
            courseId: 'McE-52039',
            courseName: 'Industrial Automation II',
            durationSeconds: 30
        }, { headers: { Authorization: `Bearer ${teacherToken}` } });

        console.log('Response Status:', resSession.status);
        console.log('Session Code:', resSession.data.code);
        console.log('Expires At:', resSession.data.expiresAt);

        const durationCalc = Math.round((new Date(resSession.data.expiresAt).getTime() - new Date().getTime()) / 1000);
        assert.ok(durationCalc >= 28 && durationCalc <= 31, 'Session expiration duration MUST be ~30 seconds');
        console.log('✓ TEST 1 PASSED: Live attendance session duration set to 30 seconds!\n');

        // Test 2: GET /api/attendance/summary (5th Year multiplier = 3 hrs)
        console.log('[TEST 2] GET /api/attendance/summary (5th Year 3-Hour Multiplier Check)');
        const resSummary = await axios.get(`${baseUrl}/api/attendance/summary?courseId=McE-52039&year=5th%20Year`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        console.log('Summary Response:', resSummary.data);
        assert.strictEqual(resSummary.data.hourWeight, 3, '5th Year hour weight MUST be 3');
        assert.strictEqual(resSummary.data.isExempt, false);
        console.log('✓ TEST 2 PASSED: 5th Year 3-hour period multiplier applied correctly!\n');

        // Test 3: 6th Year Semester 2 Exemption Check
        console.log('[TEST 3] GET /api/attendance/summary?year=6th%20Year&semester=2 (6th Year Sem 2 Exemption)');
        const resExempt = await axios.get(`${baseUrl}/api/attendance/summary?year=6th%20Year&semester=2`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        console.log('Exempt Summary Response:', resExempt.data);
        assert.strictEqual(resExempt.data.isExempt, true);
        assert.ok(resExempt.data.message.includes('exempt for 6th Year Semester 2'));
        console.log('✓ TEST 3 PASSED: 6th Year Semester 2 exemption handled correctly!\n');

        // Test 4: GET /api/attendance/export-excel (Daily Roll Call Grid Export)
        console.log('[TEST 4] GET /api/attendance/export-excel?courseId=McE-52039&year=5th%20Year (Excel Roll Call Generation)');
        const resExcel = await axios.get(`${baseUrl}/api/attendance/export-excel?courseId=McE-52039&year=5th%20Year&month=ဇန်နဝါရီ&templateType=daily`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
            responseType: 'arraybuffer'
        });

        console.log('Excel Export Response Status:', resExcel.status);
        console.log('Content-Type Header:', resExcel.headers['content-type']);
        console.log('Downloaded Buffer Byte Size:', resExcel.data.byteLength);

        assert.strictEqual(resExcel.status, 200);
        assert.ok(resExcel.headers['content-type'].includes('spreadsheetml'));
        assert.ok(resExcel.data.byteLength > 1000, 'Excel buffer MUST be non-empty valid XLSX binary');

        // Parse downloaded Excel buffer with ExcelJS to verify header text and live formulas
        const wbParsed = new ExcelJS.Workbook();
        await wbParsed.xlsx.load(resExcel.data);
        const sheetV = wbParsed.getWorksheet('V');

        assert.ok(sheetV, 'Exported workbook MUST contain Sheet "V"');
        const headerCellA1 = sheetV.getCell('A1').value;
        console.log('A1 Header Value in Excel:', headerCellA1);
        assert.strictEqual(headerCellA1, 'Technological University ( Hmawbi )');

        const formulaW6 = sheetV.getCell('W6').value;
        console.log('W6 Formula Cell Value:', formulaW6);
        assert.ok(typeof formulaW6 === 'object' && formulaW6.formula.includes('COUNTIF'), 'W6 cell MUST contain live COUNTIF formula');
        console.log('✓ TEST 4 PASSED: Exported official Roll Call Excel containing university headers, tick marks, and live formulas!\n');

        // Test 5: Negative 6th Year Sem 2 Excel Export Rejection
        console.log('[TEST 5 - NEGATIVE] GET /api/attendance/export-excel?year=6th%20Year&semester=2 (Rejection Check)');
        let test5Status = null;
        let test5Body = null;
        try {
            const res5 = await axios.get(`${baseUrl}/api/attendance/export-excel?courseId=McE-62001&year=6th%20Year&semester=2`, {
                headers: { Authorization: `Bearer ${teacherToken}` }
            });
            test5Status = res5.status;
            test5Body = res5.data;
        } catch (err) {
            test5Status = err.response ? err.response.status : 500;
            test5Body = err.response ? err.response.data : { message: err.message };
        }

        console.log('Response Status:', test5Status);
        console.log('Response Body Payload:', test5Body);
        assert.strictEqual(test5Status, 400, '6th Year Sem 2 Excel export request MUST be rejected with HTTP 400');
        console.log('✓ TEST 5 PASSED: 6th Year Semester 2 export request rejected with HTTP 400 Bad Request!\n');

        console.log('=======================================================');
        console.log('ALL ATTENDANCE SUMMARY & EXCEL EXPORT TESTS PASSED! 🎉');
        console.log('=======================================================\n');

        // Cleanup
        await Attendance.deleteMany({ courseId: 'McE-52039' });
        await AttendanceSession.deleteMany({ courseId: 'McE-52039' });

    } catch (err) {
        console.error('\nATTENDANCE TEST FAILURE:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        server.close();
        process.exit(0);
    }
}

runAttendanceTests();
