const mongoose = require('mongoose');
const dotenv = require('dotenv');
const XLSX = require('xlsx');
const path = require('path');
const bcrypt = require('bcrypt');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set in environment.');
    process.exit(1);
}

const User = require('../models/User');
const Student = require('../models/Student');

const excelPath = process.argv[2] || 'C:/Users/ASUS/Downloads/V Year Roll Call ( 2025-2026 ).xlsx';

async function importStudents() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const wb = XLSX.readFile(excelPath);
        let importedCount = 0;
        let existingCount = 0;

        const defaultPasswordHash = await bcrypt.hash('password123', 10);

        for (const sheetName of wb.SheetNames) {
            const sheet = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            for (const row of rows) {
                if (!row || row.length < 3) continue;

                const rollNoRaw = String(row[1] || '').trim();
                const name = String(row[2] || '').trim();

                if (!rollNoRaw || !rollNoRaw.startsWith('V-') || !name) continue;

                // Determine department from roll number (e.g. V-MC-1 -> Mechatronics, V-C-1 -> Civil)
                let department = 'Mechatronics Engineering';
                if (rollNoRaw.includes('MC')) department = 'Mechatronics Engineering';
                else if (rollNoRaw.includes('C-') || rollNoRaw.includes('Civil')) department = 'Civil Engineering';
                else if (rollNoRaw.includes('EC')) department = 'Electronic Engineering';
                else if (rollNoRaw.includes('EP')) department = 'Electrical Engineering';
                else if (rollNoRaw.includes('Mech')) department = 'Mechanical Engineering';
                else if (rollNoRaw.includes('IT')) department = 'Information Technology';
                else if (rollNoRaw.includes('Arch')) department = 'Architecture';

                // Format email e.g. v.mc.1@tuhmawbi.edu.mm
                const cleanRoll = rollNoRaw.toLowerCase().replace(/[^a-z0-9]/g, '.');
                const email = `${cleanRoll}@tuhmawbi.edu.mm`;

                // Check if user already exists
                let existingUser = await User.findOne({ email });

                if (existingUser) {
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
        }

        console.log(`[IMPORT COMPLETE] Successfully imported ${importedCount} new 5th Year students. (${existingCount} skipped as existing)`);
        process.exit(0);
    } catch (err) {
        console.error('Import failed:', err);
        process.exit(1);
    }
}

importStudents();
