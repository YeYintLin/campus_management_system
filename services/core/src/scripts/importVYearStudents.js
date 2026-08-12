const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set in environment.');
    process.exit(1);
}

const User = require('../models/User');
const Student = require('../models/Student');

// Load embedded student list
const studentsJsonPath = path.join(__dirname, 'v_students.json');
let studentsData = [];

if (fs.existsSync(studentsJsonPath)) {
    studentsData = JSON.parse(fs.readFileSync(studentsJsonPath, 'utf8'));
}

async function importStudents() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        let importedCount = 0;
        let existingCount = 0;

        const defaultPasswordHash = await bcrypt.hash('password', 10);

        for (const s of studentsData) {
            const rollNoRaw = s.rollNo;
            const name = s.name;
            const department = s.department;
            const email = s.email;

            // Check if user already exists
            let existingUser = await User.findOne({ email });

            if (existingUser) {
                await User.updateOne({ _id: existingUser._id }, { password: defaultPasswordHash });
                existingCount++;
                continue;
            }

            // Create User
            const newUser = await User.create({
                name,
                email,
                password: defaultPasswordHash,
                role: 'Student',
                department,
                year: 'Fifth Year (V)',
                rollNo: rollNoRaw,
                status: 'Active',
                isEmailVerified: true,
                isApproved: true,
            });

            // Create Student Profile
            await Student.create({
                user: newUser._id,
                department,
                semester: 9, // 5th Year (Sem 9 & 10)
                enrollmentNumber: rollNoRaw,
                academicYear: '2025-2026',
                status: 'Active',
            });

            importedCount++;
        }

        console.log(`[IMPORT SUCCESS] Successfully imported ${importedCount} 5th Year students. (${existingCount} skipped as existing)`);
        process.exit(0);
    } catch (err) {
        console.error('Import failed:', err);
        process.exit(1);
    }
}

importStudents();
