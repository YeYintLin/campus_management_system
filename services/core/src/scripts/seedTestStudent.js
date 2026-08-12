/**
 * Seed a test 5th-year student account
 * Run: node src/scripts/seedTestStudent.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/cms';

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const Student = require('../models/Student');

    const email = 'test.student5@tuhmawbi.edu.mm';
    const existing = await User.findOne({ email });
    if (existing) {
        console.log(`User "${email}" already exists (ID: ${existing._id}). Skipping.`);
        await mongoose.disconnect();
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Test@12345', salt);

    const user = await User.create({
        name: 'Test Student (5th Year)',
        email,
        password: hashedPassword,
        role: 'Student',
        department: 'Mechatronics Engineering',
        year: 'Fifth Year (V)',
        isEmailVerified: true,
        isApproved: true,
        status: 'Active',
    });

    // Create matching Student record
    const count = await Student.countDocuments();
    const rollNum = `V-MC-${(count + 1).toString().padStart(2, '0')}`;
    await Student.create({
        user: user._id,
        enrollmentNumber: rollNum,
        department: 'Mechatronics Engineering',
        semester: 'First Semester',
        status: 'Active',
    });

    console.log('✅ Test 5th-year student created:');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: Test@12345`);
    console.log(`   Year:     Fifth Year (V)`);
    console.log(`   Roll No:  ${rollNum}`);
    console.log(`   User ID:  ${user._id}`);

    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
