const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Semester = require('./src/models/Semester');
const User = require('./src/models/User');
const Course = require('./src/models/Course');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cms_core';

const createSlugEmail = (name) => {
    const cleanName = name
        .toLowerCase()
        .replace(/^(dr\.|daw|u|mg)\s+/i, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '.');
    return `${cleanName}@tuhmawbi.edu.mm`;
};

const seedExcelTeachers = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding real Excel teachers...');

        const sems = await Semester.find().lean();
        const teacherMap = new Map();

        // Extract subjects per teacher from Semester collection legend
        sems.forEach(s => {
            (s.legend || []).forEach(leg => {
                if (leg && leg.teacher) {
                    const rawNames = leg.teacher.split(/,|\s+&\s+/).map(t => t.trim()).filter(Boolean);
                    rawNames.forEach(tName => {
                        if (!teacherMap.has(tName)) teacherMap.set(tName, []);
                        if (leg.code && leg.subject) {
                            teacherMap.get(tName).push({
                                code: leg.code.trim(),
                                name: leg.subject.trim(),
                                year: s.yearLabel,
                                semester: s.semesterLabel
                            });
                        }
                    });
                }
            });
        });

        console.log(`Extracted ${teacherMap.size} unique teachers from Excel timetables.`);

        for (const [teacherName, subjects] of teacherMap.entries()) {
            const email = createSlugEmail(teacherName);

            // Deduplicate subjects by code
            const uniqueSubjects = [];
            const seenCodes = new Set();
            subjects.forEach(sub => {
                if (!seenCodes.has(sub.code)) {
                    seenCodes.add(sub.code);
                    uniqueSubjects.push(sub);
                }
            });

            let user = await User.findOne({
                $or: [
                    { email: email },
                    { name: teacherName }
                ]
            });

            if (!user) {
                user = await User.create({
                    name: teacherName,
                    email: email,
                    password: 'password',
                    role: 'Teacher',
                    department: teacherName.includes('Dr.') ? 'Mechatronics Engineering' : 'Academic Faculty',
                    title: teacherName.startsWith('Dr.') ? 'Associate Professor' : 'Lecturer',
                    status: 'Active',
                    specialization: uniqueSubjects.map(s => s.name).join(', ')
                });
                console.log(`Created Teacher User: ${teacherName} (${email}) with password 'password'`);
            } else {
                user.email = email;
                user.role = 'Teacher';
                user.password = 'password';
                user.specialization = uniqueSubjects.map(s => s.name).join(', ');
                await user.save();
                console.log(`Updated Teacher User: ${teacherName} (${email}) with password 'password'`);
            }

            // Upsert Course documents and associate with teacher user
            for (const sub of uniqueSubjects) {
                let course = await Course.findOne({ code: sub.code });
                if (!course) {
                    course = await Course.create({
                        code: sub.code,
                        name: sub.name,
                        description: `${sub.name} course taught at Technological University (Hmawbi).`,
                        teacher: user._id,
                        students: []
                    });
                    console.log(`  + Created Course: ${sub.code} - ${sub.name} (Assigned to ${teacherName})`);
                } else {
                    course.teacher = user._id;
                    if (!course.name) course.name = sub.name;
                    await course.save();
                    console.log(`  + Updated Course: ${sub.code} - ${sub.name} (Assigned to ${teacherName})`);
                }
            }
        }

        console.log('Seeding completed successfully!');
        mongoose.disconnect();
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedExcelTeachers();
