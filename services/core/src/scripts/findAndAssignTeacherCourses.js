/**
 * Automatically link teachers to all their subjects from the Timetable Excel sheets
 * Run on VPS:
 * docker exec cms-core-service-1 node src/scripts/findAndAssignTeacherCourses.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/cms';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const Course = require('../models/Course');
    const Semester = require('../models/Semester');

    const teachers = await User.find({ role: 'Teacher' });
    console.log(`Found ${teachers.length} teachers in system.`);

    const semesters = await Semester.find({});
    console.log(`Found ${semesters.length} timetable semester sheets in DB.`);

    const stripHonorifics = (name = '') => name.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim().toLowerCase();

    for (const teacher of teachers) {
        const cleanTeacherName = stripHonorifics(teacher.name);
        if (cleanTeacherName.length < 3) continue;

        console.log(`\n🔍 Finding timetable subjects for: ${teacher.name} (${cleanTeacherName})...`);
        const assignedCodes = new Set();

        // 1. Scan Semester legends and sessions for teacher's name
        semesters.forEach(s => {
            if (Array.isArray(s.legend)) {
                s.legend.forEach(item => {
                    if (item.teacher && item.code) {
                        const cleanLegTeacher = stripHonorifics(item.teacher);
                        if (cleanLegTeacher.includes(cleanTeacherName) || cleanTeacherName.includes(cleanLegTeacher)) {
                            assignedCodes.add(item.code.trim().toUpperCase());
                            console.log(`   Found in legend [${s.yearLabel || 'Year'}]: ${item.code} - ${item.subject || item.code} (Teacher: ${item.teacher})`);
                        }
                    }
                });
            }

            if (Array.isArray(s.days)) {
                s.days.forEach(day => {
                    if (Array.isArray(day.sessions)) {
                        day.sessions.forEach(sess => {
                            if (sess.teacher && sess.code) {
                                const cleanSessTeacher = stripHonorifics(sess.teacher);
                                if (cleanSessTeacher.includes(cleanTeacherName) || cleanTeacherName.includes(cleanSessTeacher)) {
                                    assignedCodes.add(sess.code.trim().toUpperCase());
                                }
                            }
                        });
                    }
                });
            }
        });

        // Add exact subjects for Daw Myat Thu Zar (excluding McE-52018 & McE-51001 where she is only Family Teacher)
        if (cleanTeacherName.includes('myat thu zar')) {
            ['McE-4049', 'McE-32032', 'McE-32022', 'McE-42026', 'McE-51039', 'McE-52039'].forEach(c => assignedCodes.add(c.toUpperCase()));
        }

        console.log(`   Total distinct course codes assigned to ${teacher.name}: ${assignedCodes.size}`);

        // Update Course documents
        for (const code of assignedCodes) {
            let course = await Course.findOne({ code: new RegExp(`^${code}$`, 'i') });
            if (course) {
                course.teacher = teacher._id;
                await course.save();
                console.log(`   ✅ Linked ${course.code} - ${course.name} to ${teacher.name}`);
            } else {
                // Create course doc if not present
                const yearNum = parseInt(code.replace(/[^0-9]/g, '').charAt(0)) || 1;
                course = await Course.create({
                    code: code,
                    name: code,
                    year: yearNum,
                    description: `Timetable course offering for ${code}`,
                    teacher: teacher._id,
                    students: [],
                });
                console.log(`   ✨ Created & Linked new course ${code} to ${teacher.name}`);
            }
        }
    }

    console.log('\n======================================================');
    console.log(`✅ Teacher Course Assignment Complete!`);
    console.log('======================================================\n');

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
