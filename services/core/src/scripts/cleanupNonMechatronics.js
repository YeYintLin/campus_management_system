/**
 * Clean up non-Mechatronics student accounts from MongoDB
 * Keeps:
 * - All Admins, Superadmins, Academicadmins, Teachers
 * - All Students in Mechatronics Engineering (or with MC in roll number/department)
 * Removes:
 * - Student accounts from other departments (Civil, EP, EC, IT, etc.)
 *
 * Run on VPS:
 * docker exec cms-core-service-1 node src/scripts/cleanupNonMechatronics.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/cms';

async function cleanup() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const Student = require('../models/Student');

    // Find all student users
    const allStudentUsers = await User.find({ role: 'Student' });
    console.log(`Total student users found: ${allStudentUsers.length}`);

    const isMechatronics = (user, studentDoc) => {
        const dept = (user.department || studentDoc?.department || '').toLowerCase().trim();
        const roll = (user.rollNo || studentDoc?.enrollmentNumber || '').toUpperCase().trim();
        const name = (user.name || '').toLowerCase();

        // Check if explicitly Mechatronics or MC
        if (dept.includes('mechatronics') || dept.includes('mc') || dept === 'mce') return true;
        if (roll.includes('MC') || roll.includes('-MC-')) return true;

        // Keep test student accounts
        if (user.email && user.email.includes('test.student')) return true;

        return false;
    };

    let keptCount = 0;
    let removedCount = 0;

    for (const uDoc of allStudentUsers) {
        const sDoc = await Student.findOne({ user: uDoc._id });
        if (isMechatronics(uDoc, sDoc)) {
            keptCount++;
        } else {
            console.log(`🗑️ Removing non-MC student: ${uDoc.name} (${uDoc.email}) | Dept: ${uDoc.department} | Roll: ${sDoc?.enrollmentNumber || uDoc.rollNo}`);
            await User.findByIdAndDelete(uDoc._id);
            if (sDoc) {
                await Student.findByIdAndDelete(sDoc._id);
            }
            removedCount++;
        }
    }

    console.log('\n======================================================');
    console.log(`✅ Cleanup Complete!`);
    console.log(`   Mechatronics Students Kept: ${keptCount}`);
    console.log(`   Other Department Students Removed: ${removedCount}`);
    console.log('======================================================\n');

    await mongoose.disconnect();
}

cleanup().catch(err => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
