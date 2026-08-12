const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const assert = require('assert');

const ResourceFile = require('../models/ResourceFile');
const Course = require('../models/Course');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Assignment = require('../models/Assignment');

const fileLogRoutes = require('../routes/fileLogRoutes');
const examRoutes = require('../routes/examRoutes');
const assignmentRoutes = require('../routes/assignmentRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_123';
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());

app.use('/api/files', fileLogRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role, year: user.year, department: user.department },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

// Fixture Users
const mockStudent2ndYear = {
    _id: '507f1f77bcf86cd799439011',
    name: 'VIMC 2nd Year Student',
    email: 'student2nd@tuhmawbi.edu.mm',
    password: 'password123',
    role: 'Student',
    year: '2nd Year',
    department: 'Mechatronics Engineering'
};

const mockTeacherA = {
    _id: '507f1f77bcf86cd799439022',
    name: 'Daw Myat Thu Zar',
    email: 'myat.thu.zar@tuhmawbi.edu.mm',
    password: 'password123',
    role: 'Teacher',
};

const mockTeacherOther = {
    _id: '507f1f77bcf86cd799439033',
    name: 'Dr. Aung Kyaw Soe',
    email: 'aung.kyaw.soe@tuhmawbi.edu.mm',
    password: 'password123',
    role: 'Teacher',
};

const studentToken = generateToken(mockStudent2ndYear);
const teacherAToken = generateToken(mockTeacherA);

// Stale token (issued before year claim was added to JWT payload)
const staleStudentToken = jwt.sign(
    { id: mockStudent2ndYear._id, role: 'Student', email: mockStudent2ndYear.email },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/core_db';

async function runRealIntegrationTests() {
    console.log('=======================================================');
    console.log('EXPRESS ROUTE INTEGRATION TEST SUITE (SEEDED FIXTURES)');
    console.log('=======================================================\n');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for integration test.\n');
    } catch (e) {
        console.error('MongoDB Connection Error:', e.message);
        process.exit(1);
    }

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        // Clear & Seed DB Fixtures
        console.log('--- SEEDING MONGO FIXTURES ---');
        await User.deleteMany({ email: { $in: [mockStudent2ndYear.email, mockTeacherA.email] } });
        await ResourceFile.deleteMany({ name: { $in: ['Circuit_Analysis_Lab.pdf', 'Industrial_Automation_Manual.pdf', 'General_University_Charter.pdf', 'Assigned_Lecture.pdf'] } });
        await Course.deleteMany({ code: { $in: ['McE-21015', 'McE-51039'] } });
        await Exam.deleteMany({ title: { $in: ['Midterm Exam - 2nd Year Circuit Analysis', 'Final Exam - 5th Year Industrial Automation'] } });
        await Assignment.deleteMany({ title: { $in: ['2nd Year Circuit Homework 1', '5th Year Automation Project'] } });

        // Create Users in DB for fallback lookups
        await User.create(mockStudent2ndYear);
        await User.create(mockTeacherA);

        // Courses
        const course2nd = await Course.create({
            code: 'McE-21015',
            name: 'Circuit Analysis I',
            year: 2,
            yearLabel: '2nd Year',
            teacher: mockTeacherA._id
        });

        const course5th = await Course.create({
            code: 'McE-51039',
            name: 'Industrial Automation I',
            year: 5,
            yearLabel: '5th Year',
            teacher: mockTeacherOther._id
        });

        // ResourceFiles
        const file2nd = await ResourceFile.create({
            name: 'Circuit_Analysis_Lab.pdf',
            type: 'PDF',
            size: '2.5 MB',
            category: 'McE-21015 - Circuit Analysis I',
            owner: 'Daw Myat Thu Zar',
            year: '2nd Year'
        });

        const file5th = await ResourceFile.create({
            name: 'Industrial_Automation_Manual.pdf',
            type: 'PDF',
            size: '4.1 MB',
            category: 'McE-51039 - Industrial Automation I',
            owner: 'Dr. Aung Kyaw Soe',
            year: '5th Year'
        });

        const fileAll = await ResourceFile.create({
            name: 'General_University_Charter.pdf',
            type: 'PDF',
            size: '1.0 MB',
            category: 'Reference Books',
            owner: 'Admin',
            year: 'All'
        });

        // Exams
        const exam2nd = await Exam.create({
            title: 'Midterm Exam - 2nd Year Circuit Analysis',
            course: 'McE-21015',
            date: new Date(),
            time: '09:00 AM',
            duration: '2 Hours',
            room: 'Room 201',
            year: '2nd Year',
            status: 'Scheduled'
        });

        const exam5th = await Exam.create({
            title: 'Final Exam - 5th Year Industrial Automation',
            course: 'McE-51039',
            date: new Date(),
            time: '01:00 PM',
            duration: '2 Hours',
            room: 'Room 501',
            year: '5th Year',
            status: 'Scheduled'
        });

        // Assignments
        const assign2nd = await Assignment.create({
            title: '2nd Year Circuit Homework 1',
            course: course2nd._id,
            description: 'Solve Kirchhoff voltage law problems',
            dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000)
        });

        const assign5th = await Assignment.create({
            title: '5th Year Automation Project',
            course: course5th._id,
            description: 'PLC Programming Assignment',
            dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000)
        });

        console.log('Seeded ResourceFiles:');
        console.log('  - 2nd Year File ID:', String(file2nd._id));
        console.log('  - 5th Year File ID:', String(file5th._id));
        console.log('  - All Years File ID:', String(fileAll._id));
        console.log('Seeded Exams:');
        console.log('  - 2nd Year Exam ID:', String(exam2nd._id));
        console.log('  - 5th Year Exam ID:', String(exam5th._id));
        console.log('Seeded Assignments:');
        console.log('  - 2nd Year Assign ID:', String(assign2nd._id));
        console.log('  - 5th Year Assign ID:', String(assign5th._id));
        console.log('-------------------------------\n');

        // ── 1. RESOURCE FILES INTEGRATION TESTS ──
        console.log('[TEST 1a] GET /api/files/resources (Role: Student, Year: 2nd Year)');
        const resFiles = await axios.get(`${baseUrl}/api/files/resources`, { headers: { Authorization: `Bearer ${studentToken}` } });
        const resFileIds = resFiles.data.map(r => String(r._id));
        assert.ok(resFileIds.includes(String(file2nd._id)), 'Payload MUST contain 2nd Year file');
        assert.ok(resFileIds.includes(String(fileAll._id)), 'Payload MUST contain All-Years file');
        assert.ok(!resFileIds.includes(String(file5th._id)), 'Payload MUST NOT contain 5th Year file');
        console.log('✓ TEST 1a PASSED: Files payload contains ONLY 2nd Year and All-Years files!\n');

        console.log('[TEST 1b - BYPASS] GET /api/files/resources?year=5th%20Year');
        const resFilesBypass = await axios.get(`${baseUrl}/api/files/resources?year=5th%20Year`, { headers: { Authorization: `Bearer ${studentToken}` } });
        const resFileBypassIds = resFilesBypass.data.map(r => String(r._id));
        assert.ok(resFileBypassIds.includes(String(file2nd._id)), 'Payload MUST contain 2nd Year file');
        assert.ok(!resFileBypassIds.includes(String(file5th._id)), 'Payload MUST NOT contain 5th Year file');
        console.log('✓ TEST 1b PASSED: Resource query bypass overridden!\n');

        // ── 2. EXAMS INTEGRATION TESTS ──
        console.log('[TEST 2a] GET /api/exams (Role: Student, Year: 2nd Year)');
        const resExams = await axios.get(`${baseUrl}/api/exams`, { headers: { Authorization: `Bearer ${studentToken}` } });
        const examIds = resExams.data.map(e => String(e._id));
        assert.ok(examIds.includes(String(exam2nd._id)), 'Exams payload MUST contain 2nd Year exam');
        assert.ok(!examIds.includes(String(exam5th._id)), 'Exams payload MUST NOT contain 5th Year exam');
        console.log('✓ TEST 2a PASSED: Exams payload contains ONLY 2nd Year exams!\n');

        console.log('[TEST 2b - BYPASS] GET /api/exams?year=5th%20Year (Bypass attempt)');
        const resExamsBypass = await axios.get(`${baseUrl}/api/exams?year=5th%20Year`, { headers: { Authorization: `Bearer ${studentToken}` } });
        const examBypassIds = resExamsBypass.data.map(e => String(e._id));
        assert.ok(examBypassIds.includes(String(exam2nd._id)), 'Exams payload MUST contain 2nd Year exam');
        assert.ok(!examBypassIds.includes(String(exam5th._id)), 'Exams payload MUST NOT contain 5th Year exam');
        console.log('✓ TEST 2b PASSED: Exams query bypass overridden by backend!\n');

        // ── 3. ASSIGNMENTS INTEGRATION TESTS ──
        console.log('[TEST 3a] GET /api/assignments (Role: Student, Year: 2nd Year)');
        const resAssign = await axios.get(`${baseUrl}/api/assignments`, { headers: { Authorization: `Bearer ${studentToken}` } });
        const assignIds = resAssign.data.map(a => String(a._id));
        assert.ok(assignIds.includes(String(assign2nd._id)), 'Assignments payload MUST contain 2nd Year assignment');
        assert.ok(!assignIds.includes(String(assign5th._id)), 'Assignments payload MUST NOT contain 5th Year assignment');
        console.log('✓ TEST 3a PASSED: Assignments payload contains ONLY 2nd Year assignments!\n');

        console.log('[TEST 3b - BYPASS] GET /api/assignments?course=' + course5th._id);
        const resAssignBypass = await axios.get(`${baseUrl}/api/assignments?course=${course5th._id}`, { headers: { Authorization: `Bearer ${studentToken}` } });
        const assignBypassIds = resAssignBypass.data.map(a => String(a._id));
        assert.ok(assignBypassIds.includes(String(assign2nd._id)), 'Assignments payload MUST contain 2nd Year assignment');
        assert.ok(!assignBypassIds.includes(String(assign5th._id)), 'Assignments payload MUST NOT contain 5th Year assignment');
        console.log('✓ TEST 3b PASSED: Assignment query bypass overridden by backend!\n');

        // ── 4. STALE SESSION & FALLBACK TEST ──
        console.log('[TEST 4 - STALE SESSION & DB FALLBACK] GET /api/files/resources (Using stale token without year claim)');
        const resStale = await axios.get(`${baseUrl}/api/files/resources`, { headers: { Authorization: `Bearer ${staleStudentToken}` } });
        const staleFileIds = resStale.data.map(r => String(r._id));
        assert.ok(staleFileIds.includes(String(file2nd._id)), 'Stale session fallback MUST fetch student year from DB and return 2nd Year files');
        assert.ok(!staleFileIds.includes(String(file5th._id)), 'Stale session MUST NOT leak 5th Year files');
        console.log('✓ TEST 4 PASSED: Stale session seamlessly upgraded via DB fallback and safely scoped!\n');

        // ── 5. TEACHER UPLOAD PERMISSION TESTS ──
        console.log('[TEST 5a - UPLOAD REJECTED] POST /api/files/resources (Teacher A uploads to unassigned McE-51039)');
        let test5aStatus = null;
        let test5aBody = null;
        try {
            const res5a = await axios.post(`${baseUrl}/api/files/resources`, {
                name: 'Unassigned_Lecture.pdf',
                category: 'McE-51039 - Industrial Automation I',
                year: '5th Year'
            }, { headers: { Authorization: `Bearer ${teacherAToken}` } });
            test5aStatus = res5a.status;
            test5aBody = res5a.data;
        } catch (err) {
            test5aStatus = err.response ? err.response.status : 500;
            test5aBody = err.response ? err.response.data : { message: err.message };
        }
        assert.strictEqual(test5aStatus, 403, 'Upload to unassigned course MUST return 403');
        console.log('✓ TEST 5a PASSED: Teacher upload to unassigned course rejected with 403!\n');

        console.log('[TEST 5b - UPLOAD ALLOWED] POST /api/files/resources (Teacher A uploads to assigned McE-21015)');
        const res5b = await axios.post(`${baseUrl}/api/files/resources`, {
            name: 'Assigned_Lecture.pdf',
            category: 'McE-21015 - Circuit Analysis I',
            year: '2nd Year'
        }, { headers: { Authorization: `Bearer ${teacherAToken}` } });
        assert.strictEqual(res5b.status, 201, 'Upload to assigned course MUST return 201');
        console.log('✓ TEST 5b PASSED: Teacher upload to assigned course allowed with 201!\n');

        console.log('=======================================================');
        console.log('ALL EXAMS, ASSIGNMENTS, FILES & STALE SESSION TESTS PASSED! 🎉');
        console.log('=======================================================\n');

        // Cleanup
        await User.deleteMany({ email: { $in: [mockStudent2ndYear.email, mockTeacherA.email] } });
        await ResourceFile.deleteMany({ name: { $in: ['Circuit_Analysis_Lab.pdf', 'Industrial_Automation_Manual.pdf', 'General_University_Charter.pdf', 'Assigned_Lecture.pdf', 'Unassigned_Lecture.pdf'] } });
        await Course.deleteMany({ code: { $in: ['McE-21015', 'McE-51039'] } });
        await Exam.deleteMany({ title: { $in: ['Midterm Exam - 2nd Year Circuit Analysis', 'Final Exam - 5th Year Industrial Automation'] } });
        await Assignment.deleteMany({ title: { $in: ['2nd Year Circuit Homework 1', '5th Year Automation Project'] } });

    } catch (err) {
        console.error('\nINTEGRATION TEST FAILURE:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        server.close();
        process.exit(0);
    }
}

runRealIntegrationTests();
