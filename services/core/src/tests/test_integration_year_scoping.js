const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const assert = require('assert');

const ResourceFile = require('../models/ResourceFile');
const Course = require('../models/Course');
const User = require('../models/User');

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
        { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role, year: user.year },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

// Fixture Users
const mockStudent2ndYear = {
    _id: '507f1f77bcf86cd799439011',
    name: 'VIMC 2nd Year Student',
    email: 'student2nd@tuhmawbi.edu.mm',
    role: 'Student',
    year: '2nd Year',
};

const mockTeacherA = {
    _id: '507f1f77bcf86cd799439022',
    name: 'Daw Myat Thu Zar',
    email: 'myat.thu.zar@tuhmawbi.edu.mm',
    role: 'Teacher',
};

const mockTeacherOther = {
    _id: '507f1f77bcf86cd799439033',
    name: 'Dr. Aung Kyaw Soe',
    email: 'aung.kyaw.soe@tuhmawbi.edu.mm',
    role: 'Teacher',
};

const studentToken = generateToken(mockStudent2ndYear);
const teacherAToken = generateToken(mockTeacherA);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/core_db';

async function runRealIntegrationTests() {
    console.log('=======================================================');
    console.log('REAL EXPRESS ROUTE INTEGRATION TEST SUITE (WITH DB FIXTURES)');
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
        // --- SEED SEED FIXTURE DATA DIRECTLY INTO MONGO ---
        console.log('--- SEEDING MONGO FIXTURES ---');

        // Clear test documents
        await ResourceFile.deleteMany({ name: { $in: ['Circuit_Analysis_Lab.pdf', 'Industrial_Automation_Manual.pdf', 'General_University_Charter.pdf', 'Assigned_Lecture.pdf', 'Unassigned_Lecture.pdf'] } });
        await Course.deleteMany({ code: { $in: ['McE-21015', 'McE-51039'] } });

        // Insert Courses
        const courseAssigned = await Course.create({
            code: 'McE-21015',
            name: 'Circuit Analysis I',
            year: 2,
            yearLabel: '2nd Year',
            teacher: mockTeacherA._id
        });

        const courseUnassigned = await Course.create({
            code: 'McE-51039',
            name: 'Industrial Automation I',
            year: 5,
            yearLabel: '5th Year',
            teacher: mockTeacherOther._id
        });

        // Insert ResourceFiles
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

        console.log('Seeded ResourceFiles:');
        console.log('  1. 2nd Year File ID:', String(file2nd._id), `("${file2nd.name}")`);
        console.log('  2. 5th Year File ID:', String(file5th._id), `("${file5th.name}")`);
        console.log('  3. All Years File ID:', String(fileAll._id), `("${fileAll.name}")`);
        console.log('Seeded Courses:');
        console.log('  - McE-21015 (Assigned to Teacher A):', String(courseAssigned._id));
        console.log('  - McE-51039 (Assigned to Other Teacher):', String(courseUnassigned._id));
        console.log('-------------------------------\n');

        // Test 1: GET /api/files/resources as 2nd Year Student
        console.log('[INTEGRATION TEST 1] GET /api/files/resources (Role: Student, Year: 2nd Year)');
        console.log(`Request: GET ${baseUrl}/api/files/resources`);
        console.log(`Headers: Authorization: Bearer <studentToken>`);

        const res1 = await axios.get(`${baseUrl}/api/files/resources`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        console.log('Response Status:', res1.status);
        console.log('Response Payload IDs:', res1.data.map(r => ({ id: r._id, name: r.name, year: r.year })));

        const res1Ids = res1.data.map(r => String(r._id));
        assert.ok(res1Ids.includes(String(file2nd._id)), 'Payload MUST contain 2nd Year file');
        assert.ok(res1Ids.includes(String(fileAll._id)), 'Payload MUST contain All-Years file');
        assert.ok(!res1Ids.includes(String(file5th._id)), 'Payload MUST NOT contain 5th Year file');
        console.log('✓ TEST 1 PASSED: 2nd Year Student payload contains ONLY 2nd Year and All-Years files!\n');

        // Test 2: Negative Test - Student attempts to bypass year scoping via query parameter ?year=5th Year
        console.log('[INTEGRATION TEST 2 - NEGATIVE BYPASS TEST] GET /api/files/resources?year=5th%20Year');
        console.log(`Request: GET ${baseUrl}/api/files/resources?year=5th%20Year`);
        console.log(`Headers: Authorization: Bearer <studentToken>`);

        const res2 = await axios.get(`${baseUrl}/api/files/resources?year=5th%20Year`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        console.log('Response Status:', res2.status);
        console.log('Response Payload IDs:', res2.data.map(r => ({ id: r._id, name: r.name, year: r.year })));

        const res2Ids = res2.data.map(r => String(r._id));
        assert.ok(res2Ids.includes(String(file2nd._id)), 'Payload MUST contain 2nd Year file despite bypass attempt');
        assert.ok(res2Ids.includes(String(fileAll._id)), 'Payload MUST contain All-Years file despite bypass attempt');
        assert.ok(!res2Ids.includes(String(file5th._id)), 'Payload MUST NOT contain 5th Year file');
        console.log('✓ TEST 2 PASSED: Backend successfully overrode client query attempt to bypass year scoping!\n');

        // Test 3a: Negative Upload Permission Check (Teacher A uploads to unassigned course McE-51039)
        console.log('[INTEGRATION TEST 3a - NEGATIVE PERMISSION CHECK] POST /api/files/resources (Unassigned course)');
        console.log(`Request: POST ${baseUrl}/api/files/resources`);
        console.log(`Payload: { name: "Unassigned_Lecture.pdf", category: "McE-51039 - Industrial Automation I", year: "5th Year" }`);

        let test3aStatus = null;
        let test3aBody = null;
        try {
            const res3a = await axios.post(`${baseUrl}/api/files/resources`, {
                name: 'Unassigned_Lecture.pdf',
                category: 'McE-51039 - Industrial Automation I',
                year: '5th Year'
            }, {
                headers: { Authorization: `Bearer ${teacherAToken}` }
            });
            test3aStatus = res3a.status;
            test3aBody = res3a.data;
        } catch (err) {
            test3aStatus = err.response ? err.response.status : 500;
            test3aBody = err.response ? err.response.data : { message: err.message };
        }

        console.log('Response Status:', test3aStatus);
        console.log('Response Body Payload:', JSON.stringify(test3aBody, null, 2));
        assert.strictEqual(test3aStatus, 403, 'Teacher upload to unassigned course MUST be rejected with HTTP 403');
        console.log('✓ TEST 3a PASSED: Upload to unassigned course code rejected with HTTP 403!\n');

        // Test 3b: Positive Upload Permission Check (Teacher A uploads to assigned course McE-21015)
        console.log('[INTEGRATION TEST 3b - POSITIVE PERMISSION CHECK] POST /api/files/resources (Assigned course)');
        console.log(`Request: POST ${baseUrl}/api/files/resources`);
        console.log(`Payload: { name: "Assigned_Lecture.pdf", category: "McE-21015 - Circuit Analysis I", year: "2nd Year" }`);

        const res3b = await axios.post(`${baseUrl}/api/files/resources`, {
            name: 'Assigned_Lecture.pdf',
            category: 'McE-21015 - Circuit Analysis I',
            year: '2nd Year'
        }, {
            headers: { Authorization: `Bearer ${teacherAToken}` }
        });

        console.log('Response Status:', res3b.status);
        console.log('Response Body Payload:', JSON.stringify(res3b.data, null, 2));
        assert.strictEqual(res3b.status, 201, 'Teacher upload to assigned course MUST succeed with HTTP 201');
        console.log('✓ TEST 3b PASSED: Upload to assigned course code succeeded with HTTP 201!\n');

        console.log('=======================================================');
        console.log('ALL INTEGRATION & NEGATIVE TESTS PASSED WITH REAL DB EVIDENCE! 🎉');
        console.log('=======================================================\n');

        // Cleanup
        await ResourceFile.deleteMany({ name: { $in: ['Circuit_Analysis_Lab.pdf', 'Industrial_Automation_Manual.pdf', 'General_University_Charter.pdf', 'Assigned_Lecture.pdf', 'Unassigned_Lecture.pdf'] } });
        await Course.deleteMany({ code: { $in: ['McE-21015', 'McE-51039'] } });

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
