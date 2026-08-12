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

    // Find all student users (case-insensitive role check)
    const allStudentUsers = await User.find({ role: { $regex: /student/i } });
    console.log(`Total student users found in User collection: ${allStudentUsers.length}`);

    // Also check Student collection directly
    const allStudentDocs = await Student.find().populate('user');
    console.log(`Total records in Student collection: ${allStudentDocs.length}`);

    const isMechatronics = (user, studentDoc) => {
        const dept = (user?.department || studentDoc?.department || '').toLowerCase().trim();
        const roll = (user?.rollNo || studentDoc?.enrollmentNumber || '').toUpperCase().trim();

        // If explicitly Civil / V-C, it is NOT Mechatronics
        if (dept.includes('civil') || roll.includes('V-C') || roll.includes('-C-')) {
            return false;
        }

        // Check if explicitly Mechatronics or MC
        if (dept.includes('mechatronics') || dept.includes('mc') || dept === 'mce') return true;
        if (roll.includes('MC') || roll.includes('-MC-')) return true;

        // Keep test student accounts
        if (user?.email && user.email.includes('test.student')) return true;

        return false;
    };

    let keptCount = 0;
    let removedCount = 0;
    const processedUserIds = new Set();

    // 1. Process Student collection docs
    for (const sDoc of allStudentDocs) {
        const uDoc = sDoc.user;
        if (uDoc && uDoc._id) processedUserIds.add(uDoc._id.toString());

        if (!isMechatronics(uDoc, sDoc)) {
            console.log(`🗑️ Removing non-MC Student doc: ${sDoc.enrollmentNumber || uDoc?.name} | Dept: ${sDoc.department || uDoc?.department}`);
            if (uDoc && uDoc._id) {
                await User.findByIdAndDelete(uDoc._id);
            }
            await Student.findByIdAndDelete(sDoc._id);
            removedCount++;
        } else {
            keptCount++;
        }
    }

    // 2. Process remaining User collection docs with student role
    for (const uDoc of allStudentUsers) {
        if (processedUserIds.has(uDoc._id.toString())) continue;
        const sDoc = await Student.findOne({ user: uDoc._id });

        if (!isMechatronics(uDoc, sDoc)) {
            console.log(`🗑️ Removing non-MC User: ${uDoc.name} (${uDoc.email}) | Dept: ${uDoc.department} | Roll: ${uDoc.rollNo}`);
            await User.findByIdAndDelete(uDoc._id);
            if (sDoc) await Student.findByIdAndDelete(sDoc._id);
            removedCount++;
        } else {
            keptCount++;
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
