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
            courseId: new RegExp(`^${courseId}$`, 'i')
        });

        console.log(`\n🧹 Removed ${res.deletedCount || 0} attendance records for ${courseId}.`);
        console.log('Attendance collection is completely clean with zero trace.\n');

        process.exit(0);
    } catch (err) {
        console.error('Error cleaning test attendance:', err);
        process.exit(1);
    }
}

cleanTestAttendanceMonth();
