const axios = require('axios');
const GW = 'http://localhost:5001/api';

const accounts = [
    { role: 'Admin',   email: 'admin@tuhmawbi.edu.mm',   pass: 'ChangeMeAdmin123!' },
    { role: 'Teacher', email: 'teacher@tuhmawbi.edu.mm', pass: 'ChangeMeTeacher123!' },
    { role: 'Student', email: 'student@tuhmawbi.edu.mm', pass: 'ChangeMeStudent123!' },
];

const sections = [
    { path: '/courses',            name: 'Courses Directory' },
    { path: '/students',           name: 'Students Directory' },
    { path: '/users',              name: 'Account Management (All Users)' },
    { path: '/users?role=Teacher', name: 'Faculty Listing' },
    { path: '/attendance',         name: 'Attendance Module' },
    { path: '/grades',             name: 'Grades & Assessment' },
    { path: '/assignments',        name: 'Assignments Module' },
    { path: '/exams',              name: 'Exam Schedules' },
    { path: '/timetable',          name: 'Timetable Module' },
    { path: '/academic-config',    name: 'Academic Config' },
    { path: '/notifications',      name: 'Notifications' },
    { path: '/search?q=test',      name: 'Search Module' },
];

let totalPass = 0;
let totalFail = 0;
const failures = [];

async function login(email, pass) {
    const { data } = await axios.post(`${GW}/auth/login`, { email, password: pass });
    return data.token;
}

async function testSection(client, section, role) {
    try {
        const res = await client.get(section.path);
        const detail = Array.isArray(res.data)
            ? `${res.data.length} items`
            : typeof res.data === 'object' ? 'OK (object)' : 'OK';
        console.log(`   ✅ ${section.name.padEnd(32)} HTTP ${res.status}  (${detail})`);
        totalPass++;
    } catch (err) {
        const status = err.response?.status || 'TIMEOUT';
        const msg = err.response?.data?.message || err.message;
        console.log(`   ❌ ${section.name.padEnd(32)} HTTP ${status}  ${msg}`);
        totalFail++;
        failures.push({ role, section: section.name, status, msg });
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   SMART CMS — PRE-PRESENTATION FULL SYSTEM AUDIT   ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // ── Phase 1: Auth & Endpoint Testing ──
    for (const acc of accounts) {
        console.log(`\n🔑 Role: ${acc.role} (${acc.email})`);
        console.log('   ' + '─'.repeat(60));
        try {
            const token = await login(acc.email, acc.pass);
            console.log(`   ✅ ${'Login / Authentication'.padEnd(32)} Token issued`);
            totalPass++;

            const client = axios.create({
                baseURL: GW,
                headers: { Authorization: `Bearer ${token}` },
                timeout: 5000,
            });

            // Test profile endpoint
            try {
                const profileRes = await client.get('/auth/profile');
                console.log(`   ✅ ${'User Profile (GET /auth/profile)'.padEnd(32)} ${profileRes.data.name} — ${profileRes.data.role}`);
                totalPass++;
            } catch (e) {
                console.log(`   ❌ ${'User Profile'.padEnd(32)} ${e.response?.status || e.message}`);
                totalFail++;
                failures.push({ role: acc.role, section: 'User Profile', status: e.response?.status, msg: e.message });
            }

            for (const section of sections) {
                await testSection(client, section, acc.role);
            }
        } catch (authErr) {
            console.log(`   ❌ ${'Login FAILED'.padEnd(32)} ${authErr.response?.data?.message || authErr.message}`);
            totalFail++;
            failures.push({ role: acc.role, section: 'Authentication', status: authErr.response?.status, msg: authErr.response?.data?.message || authErr.message });
        }
    }

    // ── Phase 2: Data Integrity Checks ──
    console.log('\n\n📊 DATA INTEGRITY CHECKS');
    console.log('   ' + '─'.repeat(60));
    try {
        const token = await login(accounts[0].email, accounts[0].pass);
        const client = axios.create({
            baseURL: GW,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000,
        });

        // Check courses are exactly 3
        const coursesRes = await client.get('/courses');
        const courseCount = coursesRes.data.length;
        const expectedCodes = ['HSS 61011', 'McE 61031', 'McE 61028'];
        const actualCodes = coursesRes.data.map(c => c.code).sort();
        const codesMatch = JSON.stringify(actualCodes) === JSON.stringify(expectedCodes.sort());
        if (courseCount === 3 && codesMatch) {
            console.log(`   ✅ Courses: exactly 3 subjects — ${actualCodes.join(', ')}`);
            totalPass++;
        } else {
            console.log(`   ❌ Courses: expected 3 (${expectedCodes.join(', ')}), got ${courseCount} (${actualCodes.join(', ')})`);
            totalFail++;
            failures.push({ role: 'Data', section: 'Course Count', status: 'MISMATCH', msg: `Got ${courseCount}` });
        }

        // Check students are exactly 15
        const studentsRes = await client.get('/students');
        if (studentsRes.data.length === 15) {
            console.log(`   ✅ Students: exactly 15 VI-MC students enrolled`);
            totalPass++;
        } else {
            console.log(`   ❌ Students: expected 15, got ${studentsRes.data.length}`);
            totalFail++;
            failures.push({ role: 'Data', section: 'Student Count', status: 'MISMATCH', msg: `Got ${studentsRes.data.length}` });
        }

        // Check users are 17 (1 admin + 1 teacher + 15 students)
        const usersRes = await client.get('/users');
        if (usersRes.data.length === 17) {
            console.log(`   ✅ Users: 17 total accounts (1 Admin + 1 Teacher + 15 Students)`);
            totalPass++;
        } else {
            console.log(`   ❌ Users: expected 17, got ${usersRes.data.length}`);
            totalFail++;
        }

        // Check grades are 45 (3 courses × 15 students)
        const gradesRes = await client.get('/grades');
        if (gradesRes.data.length === 45) {
            console.log(`   ✅ Grades: 45 grade records (3 courses × 15 students)`);
            totalPass++;
        } else {
            console.log(`   ⚠️  Grades: expected 45, got ${gradesRes.data.length}`);
        }

        // Check exams are 3
        const examsRes = await client.get('/exams');
        if (examsRes.data.length === 3) {
            console.log(`   ✅ Exams: 3 final exam schedules configured`);
            totalPass++;
        } else {
            console.log(`   ⚠️  Exams: expected 3, got ${examsRes.data.length}`);
        }

        // Check timetable entries
        const ttRes = await client.get('/timetable');
        if (ttRes.data.length >= 5) {
            console.log(`   ✅ Timetable: ${ttRes.data.length} weekly schedule entries`);
            totalPass++;
        } else {
            console.log(`   ⚠️  Timetable: expected ≥5, got ${ttRes.data.length}`);
        }

        // Check assignments
        const assignRes = await client.get('/assignments');
        console.log(`   ✅ Assignments: ${assignRes.data.length} assignment(s) in database`);
        totalPass++;

    } catch (e) {
        console.log(`   ❌ Data integrity check failed: ${e.message}`);
        totalFail++;
    }

    // ── Summary ──
    console.log('\n\n╔══════════════════════════════════════════════════════╗');
    if (totalFail === 0) {
        console.log('║   ✅ ALL CHECKS PASSED — SYSTEM READY FOR DEFENSE   ║');
    } else {
        console.log('║   ⚠️  SOME CHECKS FAILED — SEE DETAILS ABOVE        ║');
    }
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`\n   Total: ${totalPass} passed, ${totalFail} failed\n`);

    if (failures.length > 0) {
        console.log('   FAILURES:');
        failures.forEach(f => console.log(`   • [${f.role}] ${f.section}: HTTP ${f.status} — ${f.msg}`));
    }

    process.exit(totalFail > 0 ? 1 : 0);
}

main();
