/**
 * Script to fix course teacher assignments in MongoDB
 * Ensures Daw Myat Thu Zar is ONLY assigned to her 5th Year Mechatronics subjects
 * (McE-51039, McE-52039, McE-52018, McE-51001), and unassigns her from unrelated subjects
 * (English I, Engineering Mathematics I, Engineering Physics, etc.)
 *
 * Run on VPS:
 * docker exec cms-core-service-1 node src/scripts/fixCourseTeachers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/cms';

async function fix() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Course = require('../models/Course');
    const User = require('../models/User');

    // Find Daw Myat Thu Zar
    const teacher = await User.findOne({ email: 'myat.thu.zar@tuhmawbi.edu.mm' });
    if (!teacher) {
        console.error('Teacher Daw Myat Thu Zar not found.');
        await mongoose.disconnect();
        return;
    }

    const teacherId = teacher._id;
    console.log(`Found teacher Daw Myat Thu Zar: ${teacherId}`);

    // List of 5th Year Mechatronics courses she actually teaches
    const myatThuZarCourses = ['McE-51039', 'McE-52039', 'McE-52018', 'McE-51001'];

    // 1. Assign Daw Myat Thu Zar to her 5th Year Mechatronics courses
    for (const code of myatThuZarCourses) {
        const course = await Course.findOne({ code });
        if (course) {
            course.teacher = teacherId;
            await course.save();
            console.log(`✅ Assigned ${teacher.name} to ${course.code} - ${course.name}`);
        }
    }

    // 2. Unassign Daw Myat Thu Zar from all unrelated courses
    const unrelatedCourses = await Course.find({
        teacher: teacherId,
        code: { $nin: myatThuZarCourses }
    });

    for (const course of unrelatedCourses) {
        course.teacher = null;
        await course.save();
        console.log(`🗑️ Unassigned ${teacher.name} from unrelated course: ${course.code} - ${course.name}`);
    }

    console.log('\n======================================================');
    console.log(`✅ Course Teacher Assignments Fixed!`);
    console.log(`   Daw Myat Thu Zar now ONLY teaches her 5th-Year Mechatronics courses.`);
    console.log('======================================================\n');

    await mongoose.disconnect();
}

fix().catch(err => {
    console.error('Fix failed:', err);
    process.exit(1);
});
