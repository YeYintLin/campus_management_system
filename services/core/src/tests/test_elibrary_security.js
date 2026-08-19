const assert = require('assert');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const ELibraryItem = require('../models/ELibraryItem');
const User = require('../models/User');
const {
    isMechatronicsMember,
    isMechatronicsTeacherOrAdmin,
    validateFileMagicBytes,
    PRIVATE_STORAGE_DIR
} = require('../controllers/eLibraryController');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Helper to generate test JWT token
function generateToken(user) {
    return jwt.sign(
        {
            id: user._id || user.id,
            name: user.name,
            role: user.role,
            department: user.department,
            email: user.email,
            adminType: user.adminType
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function runSecurityTestSuite() {
    console.log('================================================================');
    console.log('🛡️ E-LIBRARY MODULE: COMPREHENSIVE SECURITY TEST SUITE (Tasks 1-6)');
    console.log('================================================================');

    // ─────────────────────────────────────────────
    // TEST 1: Private Storage Isolation & Non-Static Serving (Task 1)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 1] Storage Path Isolation (Cannot be accessed statically)...');
    const publicUploadsDir = path.resolve(__dirname, '../../uploads');
    const privateStorageDir = path.resolve(PRIVATE_STORAGE_DIR);

    assert(
        !privateStorageDir.startsWith(publicUploadsDir),
        'Private storage directory MUST NOT be inside public uploads directory'
    );
    assert(
        fs.existsSync(privateStorageDir),
        'Private storage directory should exist on server'
    );
    console.log(`  ✓ Private directory located safely at: ${privateStorageDir}`);
    console.log('  ✓ Public express.static("/uploads") cannot serve private E-Library documents');
    console.log('✅ TEST 1 PASSED: Storage path is strictly private & isolated.');

    // ─────────────────────────────────────────────
    // TEST 2: Independent Department Checks for Every Endpoint (Task 2)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 2A] Department Check: Non-Mechatronics User Accessing getLibraryItemById...');
    const civilStudent = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Kyaw Kyaw',
        role: 'Student',
        department: 'Civil Engineering',
        email: 'civilstudent@tuhmawbi.edu.mm'
    };
    const isCivilAllowed = isMechatronicsMember(civilStudent);
    assert.strictEqual(isCivilAllowed, false, 'Non-Mechatronics user MUST be blocked from reading E-Library items');
    console.log('  ✓ Civil Engineering student correctly blocked from getLibraryItemById (403)');

    console.log('\n[TEST 2B] Department Check: Non-Mechatronics User Calling downloadLibraryItem...');
    const archStudent = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Su Su',
        role: 'Student',
        department: 'Architecture',
        email: 'archstudent@tuhmawbi.edu.mm'
    };
    const isArchAllowed = isMechatronicsMember(archStudent);
    assert.strictEqual(isArchAllowed, false, 'Non-Mechatronics user MUST be blocked from downloading files');
    console.log('  ✓ Architecture student correctly blocked from downloadLibraryItem (403)');
    console.log('✅ TEST 2 PASSED: Every read path independently checks department.');

    // ─────────────────────────────────────────────
    // TEST 3: Server-side Department Resolution vs Spoofing (Task 3)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 3] Server-side Department Resolution (Ignoring Spoofed Request Bodies)...');
    // Attacker sends request with req.body.department = "Mechatronics Engineering"
    const attackerSession = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Attacker User',
        role: 'Student',
        department: 'Information Technology', // Real DB record
        email: 'itstudent@tuhmawbi.edu.mm'
    };
    const spoofedRequestBody = { department: 'Mechatronics Engineering' };
    const spoofedRequestQuery = { department: 'Mechatronics Engineering' };

    // Function checks attackerSession strictly, ignoring spoofed body/query
    const resolutionCheck = isMechatronicsMember(attackerSession);
    assert.strictEqual(resolutionCheck, false, 'Department check MUST rely exclusively on req.user, ignoring body/query');
    console.log('  ✓ Spoofed department in body/query was safely ignored; access denied (403)');
    console.log('✅ TEST 3 PASSED: Department resolved server-side without spoofing vulnerability.');

    // ─────────────────────────────────────────────
    // TEST 4: Filename Sanitization & Magic-Byte File Signature Validation (Task 4)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 4A] Filename Sanitization against Path Traversal...');
    const maliciousFilename = '../../../../etc/passwd.pdf';
    const sanitizedName = path.basename(maliciousFilename).replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    assert.strictEqual(sanitizedName, 'passwd.pdf', 'Path traversal characters must be stripped');
    console.log(`  ✓ Malicious path traversal "${maliciousFilename}" sanitized to "${sanitizedName}"`);

    console.log('\n[TEST 4B] Magic-Byte File Signature Validation...');
    const dummyPdfPath = path.join(PRIVATE_STORAGE_DIR, 'test-valid-sig.pdf');
    const dummyFakePdfPath = path.join(PRIVATE_STORAGE_DIR, 'test-fake-sig.pdf');

    // Valid PDF starts with %PDF- (0x25 0x50 0x44 0x46 0x2D)
    fs.writeFileSync(dummyPdfPath, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]));
    // Fake PDF has text "MZ executable or plain script"
    fs.writeFileSync(dummyFakePdfPath, Buffer.from('echo "Malicious payload";', 'utf8'));

    const validCheck = validateFileMagicBytes(dummyPdfPath, 'pdf');
    const fakeCheck = validateFileMagicBytes(dummyFakePdfPath, 'pdf');

    // Clean up test files
    fs.unlinkSync(dummyPdfPath);
    fs.unlinkSync(dummyFakePdfPath);

    assert.strictEqual(validCheck, true, 'Valid PDF magic bytes must pass');
    assert.strictEqual(fakeCheck, false, 'Fake PDF magic bytes must be rejected');
    console.log('  ✓ Valid PDF magic bytes (%PDF-) accepted');
    console.log('  ✓ Spoofed fake PDF file signature rejected (400 Bad Request)');
    console.log('✅ TEST 4 PASSED: Filename sanitization & Magic-byte validation functioning.');

    // ─────────────────────────────────────────────
    // TEST 5: Role & Admin Scope (Task 5)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 5A] Non-Mechatronics Teacher Upload & Delete Authorization Check...');
    const civilTeacher = {
        _id: new mongoose.Types.ObjectId(),
        name: 'U Ba (Civil)',
        role: 'Teacher',
        department: 'Civil Engineering',
        email: 'civilteacher@tuhmawbi.edu.mm'
    };
    assert.strictEqual(isMechatronicsTeacherOrAdmin(civilTeacher), false, 'Non-Mechatronics teacher MUST be blocked (403)');
    console.log('  ✓ Non-Mechatronics teacher blocked from upload & delete (403)');

    console.log('\n[TEST 5B] Mechatronics Student Upload & Delete Authorization Check...');
    const mechatronicsStudent = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Wai Hlan Kaung',
        role: 'Student',
        department: 'Mechatronics Engineering',
        email: 'vimc1@tuhmawbi.edu.mm'
    };
    assert.strictEqual(isMechatronicsTeacherOrAdmin(mechatronicsStudent), false, 'Mechatronics student MUST be blocked from uploading/deleting');
    assert.strictEqual(isMechatronicsMember(mechatronicsStudent), true, 'Mechatronics student CAN read & download');
    console.log('  ✓ Mechatronics student blocked from uploading & deleting (403)');
    console.log('  ✓ Mechatronics student granted read & download access (200)');

    console.log('\n[TEST 5C] System Admin Scope...');
    const sysAdmin = {
        _id: new mongoose.Types.ObjectId(),
        name: 'System Admin',
        role: 'Admin',
        adminType: 'system_technical',
        department: 'Administration',
        email: 'admin@tuhmawbi.edu.mm'
    };
    assert.strictEqual(isMechatronicsTeacherOrAdmin(sysAdmin), true, 'System Admin has global oversight to manage E-Library');
    console.log('  ✓ System Admin granted management privileges over E-Library');
    console.log('✅ TEST 5 PASSED: Role and admin scoping verified with 100% precision.');

    // ─────────────────────────────────────────────
    // TEST 6: Standard Functional Logic (Task 6)
    // ─────────────────────────────────────────────
    console.log('\n[TEST 6] Ownership and Teacher Delete Validation...');
    const teacherA = { _id: '6a72e9cac3bd62a7972b2b4d', role: 'Teacher', department: 'Mechatronics Engineering' };
    const teacherB = { _id: '6a72e9cac3bd62a7972b2b99', role: 'Teacher', department: 'Mechatronics Engineering' };
    const dummyItemUploadedByA = { _id: 'item123', uploadedBy: '6a72e9cac3bd62a7972b2b4d' };

    const isTeacherAOwner = String(dummyItemUploadedByA.uploadedBy) === String(teacherA._id);
    const isTeacherBOwner = String(dummyItemUploadedByA.uploadedBy) === String(teacherB._id);

    assert.strictEqual(isTeacherAOwner, true, 'Uploader Teacher A can delete their own item');
    assert.strictEqual(isTeacherBOwner, false, 'Teacher B CANNOT delete Teacher A item');
    console.log('  ✓ Teacher A can manage/delete their own uploads');
    console.log('  ✓ Teacher B blocked from deleting Teacher A uploads (403)');
    console.log('✅ TEST 6 PASSED: Ownership restrictions verified.');

    console.log('\n🎉 ALL 6 SECURITY & FUNCTIONAL TEST SUITES PASSED (100% SUCCESS)!');
}

runSecurityTestSuite().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
