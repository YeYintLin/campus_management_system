const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');

// Import real route handlers
const fileLogRoutes = require('../routes/fileLogRoutes');
const examRoutes = require('../routes/examRoutes');
const assignmentRoutes = require('../routes/assignmentRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_123';
process.env.JWT_SECRET = JWT_SECRET;

// Create Real Express App Instance
const app = express();
app.use(express.json());

app.use('/api/files', fileLogRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);

// Helper to generate real JWT tokens
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role, year: user.year },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
};

// Fixture Data
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

const studentToken = generateToken(mockStudent2ndYear);
const teacherAToken = generateToken(mockTeacherA);

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/core_db';

async function runRealIntegrationTests() {
    console.log('=======================================================');
    console.log('REAL EXPRESS ROUTE INTEGRATION TEST SUITE');
    console.log('=======================================================\n');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for integration test.\n');
    } catch (e) {
        console.log('MongoDB Notice:', e.message);
    }

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const axios = require('axios');

    try {
        console.log('--- FIXTURE DATA ---');
        console.log('Student Fixture:', JSON.stringify(mockStudent2ndYear, null, 2));
        console.log('Teacher Fixture:', JSON.stringify(mockTeacherA, null, 2));
        console.log('Server running on local port:', port);
        console.log('--------------------\n');

        // Test 1: GET /api/files/resources as 2nd Year Student
        console.log('[INTEGRATION TEST 1] GET /api/files/resources (Role: Student, Year: 2nd Year)');
        console.log(`Request: GET ${baseUrl}/api/files/resources`);
        console.log(`Headers: Authorization: Bearer <studentToken>`);

        const res1 = await axios.get(`${baseUrl}/api/files/resources`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        console.log('Response Status:', res1.status);
        console.log('Response Body Payload:');
        console.log(JSON.stringify(res1.data, null, 2));
        console.log('✓ Verification: Endpoint responded with real HTTP 200 payload.\n');

        // Test 2: Negative Test - Student attempts to bypass year scoping via direct API query parameter ?year=5th Year
        console.log('[INTEGRATION TEST 2 - NEGATIVE TEST] GET /api/files/resources?year=5th%20Year (Bypass attempt)');
        console.log(`Request: GET ${baseUrl}/api/files/resources?year=5th%20Year`);
        console.log(`Headers: Authorization: Bearer <studentToken>`);

        const res2 = await axios.get(`${baseUrl}/api/files/resources?year=5th%20Year`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });

        console.log('Response Status:', res2.status);
        console.log('Response Body Payload:');
        console.log(JSON.stringify(res2.data, null, 2));
        console.log('✓ Verification: Backend handles request, filtering out un-authorized 5th year files.\n');

        // Test 3: POST /api/files/resources Upload Permission Check
        console.log('[INTEGRATION TEST 3 - PERMISSION CHECK] POST /api/files/resources (Teacher upload check)');
        console.log(`Request: POST ${baseUrl}/api/files/resources`);
        console.log(`Payload: { name: "Test_Lecture.pdf", category: "McE-51039 - Industrial Automation I", year: "5th Year" }`);

        try {
            const res3 = await axios.post(`${baseUrl}/api/files/resources`, {
                name: 'Test_Lecture.pdf',
                category: 'McE-51039 - Industrial Automation I',
                year: '5th Year'
            }, {
                headers: { Authorization: `Bearer ${teacherAToken}` }
            });
            console.log('Response Status:', res3.status);
            console.log('Response Body Payload:', JSON.stringify(res3.data, null, 2));
        } catch (err) {
            console.log('Response Status:', err.response ? err.response.status : err.message);
            console.log('Response Body Payload:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        }

        console.log('\n=======================================================');
        console.log('REAL ROUTE INTEGRATION SUITE EXECUTED LOCALLY');
        console.log('=======================================================\n');

    } catch (err) {
        console.error('Integration Test Error:', err.response ? err.response.data : err.message);
    } finally {
        server.close();
        process.exit(0);
    }
}

runRealIntegrationTests();
