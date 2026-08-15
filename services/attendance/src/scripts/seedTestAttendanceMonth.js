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

        // 1. Remove any previous test records for McE-52039 (purges old January + July records)
        await Attendance.deleteMany({ courseId });
        console.log('Cleared all existing test attendance records for McE-52039.');

        // 2. 14 5th Year Mechatronics students
        const studentRolls = [
            'V-MC-1', 'V-MC-2', 'V-MC-3', 'V-MC-4', 'V-MC-5',
            'V-MC-6', 'V-MC-7', 'V-MC-8', 'V-MC-9', 'V-MC-10',
            'V-MC-11', 'V-MC-12', 'V-MC-13', 'V-MC-14'
        ];

        // 3. Create 5 teaching sessions across July (strictly Wednesdays)
        const sessionDates = [
            '2026-07-01', // Wed
            '2026-07-08', // Wed
            '2026-07-15', // Wed
            '2026-07-22', // Wed
            '2026-07-29'  // Wed
        ];

        for (let sIdx = 0; sIdx < sessionDates.length; sIdx++) {
            const dateStr = sessionDates[sIdx];
            const records = [];

            studentRolls.forEach((roll, idx) => {
                const isAbsent = (idx === 3 && sIdx === 2) || (idx === 7 && sIdx === 4);
                const status = isAbsent ? 'Absent' : 'Present';
                // Add roll number entry
                records.push({ studentId: roll, status });
                // Also add index entry
                records.push({ studentId: String(idx + 1), status });
            });

            await Attendance.create({
                courseId,
                academicYear: '2025-2026',
                yearLevel: '5th Year',
                date: new Date(`${dateStr}T09:00:00Z`),
                records
            });
            console.log(`✅ Created test session #${sIdx + 1} on ${dateStr} (Wednesday)`);
        }

        console.log('\n=============================================');
        console.log('Successfully seeded 5 Wednesday attendance sessions for McE-52039 (July 2026).');
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
