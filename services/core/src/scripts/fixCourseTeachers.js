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
    // 2nd Year: McE-4049 (Programmable Logic Controller)
    // 3rd Year: McE-32032 (Electrical Machine and Control II), McE-32022 (Programmable Logic Controller II)
    // 4th Year: McE-42026 (Power Electronics II)
    // 5th Year: McE-51039 (Industrial Automation I), McE-52039 (Industrial Automation II)
    // Note: Being Family Teacher for 4th/5th year does NOT make her the instructor for McE-52018 or McE-51001.
    const myatThuZarCourses = [
        'McE-4049',
        'McE-32032',
        'McE-32022',
        'McE-42026',
        'McE-51039',
        'McE-52039'
    ];

    // 1. Assign Daw Myat Thu Zar to her exact 6 courses
    for (const code of myatThuZarCourses) {
        const course = await Course.findOne({ code: new RegExp(`^${code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') });
        if (course) {
            course.teacher = teacherId;
            await course.save();
            console.log(`✅ Assigned ${teacher.name} to ${course.code} - ${course.name}`);
        } else {
            console.log(`⚠️ Course ${code} not found in DB.`);
        }
    }

    // 2. Unassign Daw Myat Thu Zar from all unrelated courses (including McE-52018 and McE-51001)
    const unrelatedCourses = await Course.find({
        teacher: teacherId,
        code: { $nin: myatThuZarCourses }
    });

    for (const course of unrelatedCourses) {
        course.teacher = null;
        await course.save();
        console.log(`🗑️ Unassigned ${teacher.name} from unrelated course: ${course.code} - ${course.name}`);
    }

    // 3. Delete corrupt course "McE-" or "McE"
    const corruptCourses = await Course.find({ code: { $in: ['McE-', 'McE', 'MCE-', 'MCE', /^McE-$/i] } });
    for (const corrupt of corruptCourses) {
        console.log(`🗑️ Deleting corrupt course: ${corrupt.code} (${corrupt._id})`);
        await Course.deleteOne({ _id: corrupt._id });
    }

    console.log('\n======================================================');
    console.log(`✅ Course Teacher Assignments Fixed!`);
    console.log(`   Daw Myat Thu Zar now ONLY teaches her exact 6 subjects across 2nd to 5th Year.`);
    console.log('======================================================\n');

    await mongoose.disconnect();
}

fix().catch(err => {
    console.error('Fix failed:', err);
    process.exit(1);
});
