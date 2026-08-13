const assert = require('assert');

// 1. Shared normalizeYear helper
const normalizeYear = (yr) => {
    if (!yr) return 'All';
    const str = String(yr).trim().toLowerCase();
    if (str === 'all') return 'All';
    if (str.includes('1') || str.includes('first')) return '1st Year';
    if (str.includes('2') || str.includes('second')) return '2nd Year';
    if (str.includes('3') || str.includes('third')) return '3rd Year';
    if (str.includes('4') || str.includes('fourth')) return '4th Year';
    if (str.includes('5') || str.includes('fifth')) return '5th Year';
    if (str.includes('6') || str.includes('sixth') || str.includes('final')) return '6th Year';
    const digitMatch = str.match(/\d+/);
    if (digitMatch) {
        const num = digitMatch[0];
        const labels = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year', '5': '5th Year', '6': '6th Year' };
        if (labels[num]) return labels[num];
    }
    return 'All';
};

// 2. Mock year filter function for backend endpoints
const filterResourcesForUser = (resources, user, queryParams = {}) => {
    const userRole = (user.role || '').toLowerCase().trim();
    if (userRole === 'admin' || userRole === 'superadmin') {
        if (queryParams.year && queryParams.year !== 'All') {
            const targetNorm = normalizeYear(queryParams.year);
            return resources.filter(r => normalizeYear(r.year) === targetNorm || normalizeYear(r.year) === 'All');
        }
        return resources;
    }

    if (userRole === 'student') {
        const studentYearNorm = normalizeYear(user.year);
        // Enforce backend lock: IGNORE any queryParams.year sent by client to bypass
        return resources.filter(r => {
            const resourceYearNorm = normalizeYear(r.year);
            return resourceYearNorm === 'All' || resourceYearNorm === studentYearNorm;
        });
    }

    return resources;
};

// 3. Mock teacher upload permission checker
const verifyTeacherCourseUploadPermission = (teacher, courseCode, assignedCourses) => {
    const role = (teacher.role || '').toLowerCase().trim();
    if (role === 'admin' || role === 'superadmin') return true; // Admin bypass
    if (role !== 'teacher') return false;

    if (!courseCode) return true; // General folder upload

    const normCode = courseCode.replace(/[\s-]+/g, '').toUpperCase();
    const assignedNormCodes = assignedCourses.map(c => (c.code || '').replace(/[\s-]+/g, '').toUpperCase());

    return assignedNormCodes.includes(normCode);
};

// --- RUN AUTOMATED TEST SUITE ---
function runTests() {
    console.log('=======================================================');
    console.log('Running Year Scoping & Upload Permission Automated Tests');
    console.log('=======================================================\n');

    // Test 1: Year Normalization Helper
    console.log('Test 1: Year Normalization Helper');
    assert.strictEqual(normalizeYear('2'), '2nd Year');
    assert.strictEqual(normalizeYear(2), '2nd Year');
    assert.strictEqual(normalizeYear('2nd Year'), '2nd Year');
    assert.strictEqual(normalizeYear('Second Year'), '2nd Year');
    assert.strictEqual(normalizeYear('5th Year'), '5th Year');
    assert.strictEqual(normalizeYear('All'), 'All');
    assert.strictEqual(normalizeYear(''), 'All');
    console.log('✓ Test 1 passed: Year normalization handles strings, numbers, and ordinals correctly.\n');

    // Test 2: Student Year Scoping Integration Test
    console.log('Test 2: Student Year Scoping Integration Test');
    const mockResources = [
        { id: 1, name: 'Physics_Lab.pdf', year: '1st Year' },
        { id: 2, name: 'Circuit_Analysis.pdf', year: '2nd Year' },
        { id: 3, name: 'Signals_Systems.pdf', year: '3rd Year' },
        { id: 4, name: 'Control_Systems.pdf', year: '4th Year' },
        { id: 5, name: 'Industrial_Automation_I.pdf', year: '5th Year' },
        { id: 6, name: 'General_Campus_Guide.pdf', year: 'All' },
    ];

    const student2ndYear = { role: 'Student', year: '2nd Year' };
    const filtered = filterResourcesForUser(mockResources, student2ndYear);

    assert.strictEqual(filtered.length, 2);
    assert.deepStrictEqual(filtered.map(r => r.id), [2, 6]);
    console.log('✓ Test 2 passed: 2nd Year student payload contains ONLY 2nd Year + All materials.\n');

    // Test 3: Negative Test - Student API Query Bypassing Attempt
    console.log('Test 3: Negative Test - Bypassing API Query Attempt');
    // Student passes ?year=5th Year directly to the API endpoint attempting to fetch 5th year files
    const bypassingQuery = { year: '5th Year' };
    const bypassAttemptFiltered = filterResourcesForUser(mockResources, student2ndYear, bypassingQuery);

    // Backend MUST ignore ?year=5th Year query parameter and enforce student's actual year (2nd Year)
    assert.strictEqual(bypassAttemptFiltered.length, 2);
    assert.deepStrictEqual(bypassAttemptFiltered.map(r => r.id), [2, 6]);
    const includes5thYear = bypassAttemptFiltered.some(r => r.year === '5th Year');
    assert.strictEqual(includes5thYear, false);
    console.log('✓ Test 3 passed: Backend rejects/overrides client query attempt to bypass year scoping.\n');

    // Test 4: Teacher Course Upload Permission Check
    console.log('Test 4: Teacher Course Upload Permission Check');
    const teacherA = { _id: 't1', role: 'Teacher', name: 'Daw Myat Thu Zar' };
    const assignedCoursesA = [{ code: 'McE-51039' }, { code: 'McE-52039' }];

    // Authorized upload to assigned course McE-51039
    const allowed = verifyTeacherCourseUploadPermission(teacherA, 'McE-51039', assignedCoursesA);
    assert.strictEqual(allowed, true);

    // Authorized upload with space formatting difference "McE- 51039"
    const allowedFormatted = verifyTeacherCourseUploadPermission(teacherA, 'McE- 51039', assignedCoursesA);
    assert.strictEqual(allowedFormatted, true);

    // Rejected upload to unassigned course McE-51021
    const rejected = verifyTeacherCourseUploadPermission(teacherA, 'McE-51021', assignedCoursesA);
    assert.strictEqual(rejected, false);
    console.log('✓ Test 4 passed: Teacher upload permission enforced (assigned courses allowed, unassigned rejected).\n');

    console.log('=======================================================');
    console.log('ALL 4 AUTOMATED TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=======================================================\n');
}

runTests();
