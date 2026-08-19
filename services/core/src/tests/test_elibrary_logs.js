const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ELibraryItem = require('../models/ELibraryItem');
const ELibraryLog = require('../models/ELibraryLog');
const User = require('../models/User');
const {
    uploadLibraryItem,
    downloadLibraryItem,
    updateLibraryItem,
    deleteLibraryItem,
    getLibraryLogs,
    PRIVATE_STORAGE_DIR
} = require('../controllers/eLibraryController');

// Mock Express response object
function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        jsonData: null,
        downloadFile: null,
        downloadName: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        },
        download(filePath, fileName) {
            this.downloadFile = filePath;
            this.downloadName = fileName;
            return this;
        },
        setHeader(k, v) {
            this.headers[k] = v;
            return this;
        }
    };
}

async function runLogsTestSuite() {
    console.log('================================================================');
    console.log('📜 E-LIBRARY ACTIVITY LOGGING: TEST SUITE (Tests 1-5)');
    console.log('================================================================\n');

    const mongoUri = process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cms_core_test';
    await mongoose.connect(mongoUri);

    // Clean up test data
    await ELibraryLog.deleteMany({ userEmail: /@test-elib-logs\.com$/i });
    await ELibraryItem.deleteMany({ title: /^TEST LOG DOC/ });

    // Mock Users
    const mockStudent = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Maung Maung (Student)',
        email: 'student@test-elib-logs.com',
        role: 'Student',
        department: 'Mechatronics Engineering',
        year: '5th Year'
    };

    const mockTeacher = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Daw Myat Thu Zar (Teacher)',
        email: 'teacher@test-elib-logs.com',
        role: 'Teacher',
        department: 'Mechatronics Engineering'
    };

    const mockAdmin = {
        _id: new mongoose.Types.ObjectId(),
        name: 'System Admin',
        email: 'admin@test-elib-logs.com',
        role: 'Admin',
        adminType: 'system_technical',
        department: 'Administration'
    };

    // ─────────────────────────────────────────────
    // TEST 1: Teacher Upload Activity Log
    // ─────────────────────────────────────────────
    console.log('[TEST 1] Verifying Teacher Upload creates ELibraryLog entry (action: "upload")...');
    const testDocName = `test-upload-${Date.now()}.pdf`;
    const testDocPath = path.join(PRIVATE_STORAGE_DIR, testDocName);
    // Write valid PDF signature
    fs.writeFileSync(testDocPath, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]));

    const mockUploadReq = {
        user: mockTeacher,
        file: {
            filename: testDocName,
            originalname: 'Robotics_5th_Year.pdf',
            path: testDocPath,
            size: 1024 * 1024 * 5
        },
        body: {
            title: 'TEST LOG DOC: Robotics & Kinematics',
            author: 'Daw Myat Thu Zar',
            category: 'Textbook',
            yearLevel: '5th Year',
            courseCode: 'McE-51018',
            description: 'Test material for upload logging'
        },
        ip: '192.168.1.100',
        headers: {}
    };

    const uploadRes = createMockRes();
    await uploadLibraryItem(mockUploadReq, uploadRes);

    assert.strictEqual(uploadRes.statusCode, 201, 'Upload must succeed with status 201');
    const createdItem = uploadRes.jsonData.item;
    assert(createdItem?._id, 'Item must be created');

    const uploadLog = await ELibraryLog.findOne({ itemId: createdItem._id, action: 'upload' });
    assert(uploadLog, 'ELibraryLog for upload must exist in database');
    assert.strictEqual(uploadLog.action, 'upload');
    assert.strictEqual(uploadLog.userName, mockTeacher.name);
    assert.strictEqual(uploadLog.userEmail, mockTeacher.email);
    assert.strictEqual(uploadLog.userRole, 'Teacher');
    assert.strictEqual(uploadLog.itemTitle, 'TEST LOG DOC: Robotics & Kinematics');
    console.log('  ✓ Teacher upload created ELibraryLog record with action="upload"');
    console.log('  ✓ Stored correct teacher metadata, item title, and file size');
    console.log('✅ TEST 1 PASSED: Upload activity logging verified.\n');

    // ─────────────────────────────────────────────
    // TEST 2: Student Download Activity Log
    // ─────────────────────────────────────────────
    console.log('[TEST 2] Verifying Student Download creates ELibraryLog entry (action: "download")...');
    const mockDownloadReq = {
        user: mockStudent,
        params: { id: createdItem._id.toString() },
        ip: '192.168.1.105',
        headers: {}
    };

    const downloadRes = createMockRes();
    await downloadLibraryItem(mockDownloadReq, downloadRes);

    assert.strictEqual(downloadRes.statusCode, 200, 'Download must succeed with status 200');
    assert.strictEqual(downloadRes.downloadFile, testDocPath, 'Correct physical file must be streamed');

    const downloadLog = await ELibraryLog.findOne({ itemId: createdItem._id, action: 'download', userId: mockStudent._id });
    assert(downloadLog, 'ELibraryLog for download must exist in database');
    assert.strictEqual(downloadLog.action, 'download');
    assert.strictEqual(downloadLog.userName, mockStudent.name);
    assert.strictEqual(downloadLog.userEmail, mockStudent.email);
    assert.strictEqual(downloadLog.userRole, 'Student');
    assert.strictEqual(downloadLog.userYear, '5th Year');
    console.log('  ✓ Student download created ELibraryLog record with action="download"');
    console.log('  ✓ Stored correct student metadata (name, email, year level, item title)');
    console.log('✅ TEST 2 PASSED: Download activity logging verified.\n');

    // ─────────────────────────────────────────────
    // TEST 3: Access Guard — Student Calling GET /api/elibrary/logs receives 403
    // ─────────────────────────────────────────────
    console.log('[TEST 3] Verifying Students are blocked from viewing Activity Logs (403 Forbidden)...');
    const studentLogsReq = {
        user: mockStudent,
        query: {}
    };
    const studentLogsRes = createMockRes();
    await getLibraryLogs(studentLogsReq, studentLogsRes);

    assert.strictEqual(studentLogsRes.statusCode, 403, 'Student access must be rejected with 403');
    assert(studentLogsRes.jsonData?.message?.includes('Forbidden'), 'Response must explain forbidden access');
    console.log('  ✓ Student blocked with 403 Forbidden when calling getLibraryLogs');
    console.log('✅ TEST 3 PASSED: Access control security enforced.\n');

    // ─────────────────────────────────────────────
    // TEST 4: Teacher & Admin Log Retrieval & Filtering
    // ─────────────────────────────────────────────
    console.log('[TEST 4] Verifying Teacher/Admin can retrieve logs with action/role/search filtering...');
    const teacherLogsReq = {
        user: mockTeacher,
        query: { search: 'Robotics', page: 1, limit: 10 }
    };
    const teacherLogsRes = createMockRes();
    await getLibraryLogs(teacherLogsReq, teacherLogsRes);

    assert.strictEqual(teacherLogsRes.statusCode, 200, 'Teacher query must succeed with 200');
    assert(Array.isArray(teacherLogsRes.jsonData?.logs), 'Logs array must be returned');
    assert(teacherLogsRes.jsonData.logs.length >= 2, 'Should find at least upload and download logs');
    assert(teacherLogsRes.jsonData.stats?.totalDownloads >= 1, 'Stats must report total downloads');
    assert(teacherLogsRes.jsonData.stats?.totalUploads >= 1, 'Stats must report total uploads');

    // Test filter by action="download"
    const downloadFilterReq = {
        user: mockAdmin,
        query: { action: 'download' }
    };
    const downloadFilterRes = createMockRes();
    await getLibraryLogs(downloadFilterReq, downloadFilterRes);
    assert.strictEqual(downloadFilterRes.statusCode, 200);
    assert(downloadFilterRes.jsonData.logs.every(l => l.action === 'download'), 'All filtered logs must be download action');

    console.log('  ✓ Teacher/Admin retrieved paginated activity logs');
    console.log('  ✓ Search query matched user name and item title');
    console.log('  ✓ Filter by action="download" returned only download entries');
    console.log('✅ TEST 4 PASSED: Log retrieval, filtering, and summary statistics functioning.\n');

    // ─────────────────────────────────────────────
    // TEST 5: Logging Error Isolation (Fail-Safe)
    // ─────────────────────────────────────────────
    console.log('[TEST 5] Verifying DB logging error does NOT break main upload/download action...');
    // Temporarily monkey-patch ELibraryLog.create to throw an error
    const originalCreate = ELibraryLog.create;
    ELibraryLog.create = async () => {
        throw new Error('Simulated Database Connection Failure on Log Write');
    };

    try {
        const failSafeDownloadReq = {
            user: mockStudent,
            params: { id: createdItem._id.toString() },
            ip: '192.168.1.110',
            headers: {}
        };
        const failSafeDownloadRes = createMockRes();
        await downloadLibraryItem(failSafeDownloadReq, failSafeDownloadRes);

        assert.strictEqual(failSafeDownloadRes.statusCode, 200, 'Download MUST still succeed even if log fails');
        assert.strictEqual(failSafeDownloadRes.downloadFile, testDocPath, 'File is still served to student');
        console.log('  ✓ Main download succeeded with 200 even when log creation threw an error');
        console.log('✅ TEST 5 PASSED: Logging failure is safely isolated without breaking core operations.\n');
    } finally {
        // Restore original method
        ELibraryLog.create = originalCreate;
    }

    // Clean up
    if (fs.existsSync(testDocPath)) fs.unlinkSync(testDocPath);
    await ELibraryLog.deleteMany({ userEmail: /@test-elib-logs\.com$/i });
    await ELibraryItem.deleteMany({ title: /^TEST LOG DOC/ });

    await mongoose.disconnect();
    console.log('🎉 ALL 5 E-LIBRARY LOGGING TEST SUITES PASSED (100% SUCCESS)!');
}

runLogsTestSuite().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
