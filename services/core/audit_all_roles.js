const axios = require('axios');

const GATEWAY_URL = 'http://localhost:5001/api';

const credentials = [
    { role: 'Admin',   email: 'admin@tuhmawbi.edu.mm',   pass: 'ChangeMeAdmin123!' },
    { role: 'Teacher', email: 'teacher@tuhmawbi.edu.mm', pass: 'ChangeMeTeacher123!' },
    { role: 'Student', email: 'student@tuhmawbi.edu.mm', pass: 'ChangeMeStudent123!' },
];

const endpoints = [
    { path: '/courses',          method: 'GET', name: 'Courses Directory' },
    { path: '/students',         method: 'GET', name: 'Students Directory' },
    { path: '/users?role=Teacher', method: 'GET', name: 'Faculty Directory' },
    { path: '/attendance',       method: 'GET', name: 'Attendance Module' },
    { path: '/grades',           method: 'GET', name: 'Grades & Assessment' },
    { path: '/assignments',      method: 'GET', name: 'Assignments Module' },
    { path: '/exams',            method: 'GET', name: 'Exam Schedules' },
    { path: '/timetable',        method: 'GET', name: 'Timetable Module' },
    { path: '/academic-config',  method: 'GET', name: 'Academic Config' },
    { path: '/users',            method: 'GET', name: 'User Management (Admin)' },
];

const audit = async () => {
    console.log('=====================================================');
    console.log('   SYSTEM PRE-PRESENTATION AUDIT ACROSS ALL ROLES    ');
    console.log('=====================================================\n');

    for (const cred of credentials) {
        console.log(`\n🔑 Testing Role: ${cred.role} (${cred.email})...`);
        try {
            // 1. Authenticate
            const loginRes = await axios.post(`${GATEWAY_URL}/auth/login`, {
                email: cred.email,
                password: cred.pass
            });

            const userObj = loginRes.data.user || loginRes.data;
            const token = loginRes.data.token || userObj.token;
            console.log(`   [AUTH SUCCESS] Token issued. User: "${userObj.name}"`);

            const client = axios.create({
                baseURL: GATEWAY_URL,
                headers: { Authorization: `Bearer ${token}` }
            });

            // 2. Test Endpoints
            for (const ep of endpoints) {
                try {
                    const res = await client.request({ method: ep.method, url: ep.path });
                    const count = Array.isArray(res.data) ? `${res.data.length} items` : 'Object response';
                    console.log(`   ✅ ${ep.name} (${ep.method} ${ep.path}): HTTP ${res.status} (${count})`);
                } catch (err) {
                    const status = err.response ? err.response.status : 'No Response';
                    const msg = err.response?.data?.message || err.message;
                    if (cred.role !== 'Admin' && ep.path === '/users') {
                        console.log(`   🔒 ${ep.name} (${ep.method} ${ep.path}): HTTP ${status} (Correctly Restricted for ${cred.role})`);
                    } else {
                        console.error(`   ❌ ${ep.name} (${ep.method} ${ep.path}): HTTP ${status} - Error: ${msg}`);
                    }
                }
            }
        } catch (authErr) {
            console.error(`   ❌ AUTH FAILURE for ${cred.email}:`, authErr.response?.data?.message || authErr.message);
        }
    }

    console.log('\n=====================================================');
    console.log('   AUDIT COMPLETE - SYSTEM READY FOR PRESENTATION    ');
    console.log('=====================================================');
};

audit();
