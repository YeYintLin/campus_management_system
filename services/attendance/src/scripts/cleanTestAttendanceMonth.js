require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/attendance_db';

async function cleanTestAttendanceMonth() {
    try {
        console.log('Connecting to Attendance MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const courseId = 'McE-52039';

        const res = await Attendance.deleteMany({
            courseId,
            date: {
                $gte: new Date('2026-01-01T00:00:00Z'),
                $lte: new Date('2026-01-31T23:59:59Z')
            }
        });

        console.log(`\n🧹 Removed ${res.deletedCount || 0} test attendance sessions for ${courseId} in January.`);
        console.log('Database is completely clean with zero trace.\n');

        process.exit(0);
    } catch (err) {
        console.error('Error cleaning test attendance:', err);
        process.exit(1);
    }
}

cleanTestAttendanceMonth();
