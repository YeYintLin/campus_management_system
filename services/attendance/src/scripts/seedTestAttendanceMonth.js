require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/attendance_db';

async function seedTestAttendanceMonth() {
    try {
        console.log('Connecting to Attendance MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const courseId = 'McE-52039';

        // 1. Remove previous test records for January 2026 if any
        await Attendance.deleteMany({
            courseId,
            date: {
                $gte: new Date('2026-01-01T00:00:00Z'),
                $lte: new Date('2026-01-31T23:59:59Z')
            }
        });
        console.log('Cleared existing January test attendance records.');

        // 2. Mock 14 student IDs
        const students = [
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'
        ];

        // 3. Create 12 teaching sessions across January (e.g. every Mon, Wed, Fri)
        const sessionDates = [
            '2026-01-05', '2026-01-07', '2026-01-09',
            '2026-01-12', '2026-01-14', '2026-01-16',
            '2026-01-19', '2026-01-21', '2026-01-23',
            '2026-01-26', '2026-01-28', '2026-01-30'
        ];

        for (let sIdx = 0; sIdx < sessionDates.length; sIdx++) {
            const dateStr = sessionDates[sIdx];
            const records = students.map((stId, idx) => {
                // Realistic attendance: occasional absence for 2 students
                const isAbsent = (idx === 3 && sIdx === 4) || (idx === 7 && sIdx === 8);
                return {
                    studentId: stId,
                    status: isAbsent ? 'Absent' : 'Present'
                };
            });

            await Attendance.create({
                courseId,
                academicYear: '2025-2026',
                yearLevel: '5th Year',
                date: new Date(`${dateStr}T09:00:00Z`),
                records
            });
            console.log(`✅ Created test session #${sIdx + 1} on ${dateStr}`);
        }

        console.log('\n=============================================');
        console.log('Successfully seeded 12 attendance sessions for McE-52039 (January 2026).');
        console.log('You can now click "Download Roll Call (.xlsx)" on the website to see the complete form with checkmarks and calculated hours!');
        console.log('To clean up without trace later, run:');
        console.log('node src/scripts/cleanTestAttendanceMonth.js');
        console.log('=============================================\n');

        process.exit(0);
    } catch (err) {
        console.error('Error seeding test attendance:', err);
        process.exit(1);
    }
}

seedTestAttendanceMonth();
