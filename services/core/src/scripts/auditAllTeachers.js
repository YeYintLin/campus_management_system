require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Semester = require('../models/Semester');
const parseYearNumber = (yr) => {
    if (!yr) return 1;
    if (typeof yr === 'number') return yr;
    const str = String(yr).trim().toLowerCase();
    if (str === 'all') return 0;
    if (str === 'i' || str.includes('1st') || str.includes('first')) return 1;
    if (str === 'ii' || str.includes('2nd') || str.includes('second')) return 2;
    if (str === 'iii' || str.includes('3rd') || str.includes('third')) return 3;
    if (str === 'iv' || str.includes('4th') || str.includes('fourth')) return 4;
    if (str === 'v' || str.includes('5th') || str.includes('fifth')) return 5;
    if (str === 'vi' || str.includes('6th') || str.includes('sixth') || str.includes('final')) return 6;
    if (str.includes('me') || str.includes('master') || str.includes('7')) return 7;
    return 1;
};

const YEAR_LABELS = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year',
    5: '5th Year',
    6: '6th Year',
    7: 'ME Program'
};

const stripHonorifics = (name = '') => name.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim().toLowerCase();

async function auditAllTeachers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const teachers = await User.find({ role: { $regex: /teacher/i } });
        const semesters = await Semester.find({});
        const allCourses = await Course.find({});

        // 1. Build map of course codes to their exact timetable sheet info
        const timetableMap = new Map();
        semesters.forEach(sheet => {
            const sheetYrNum = sheet.yearNumber || (sheet.yearLabel ? parseYearNumber(sheet.yearLabel) : 1);
            const sheetYrLabel = YEAR_LABELS[sheetYrNum] || sheet.yearLabel || '1st Year';

            (sheet.legend || []).forEach(item => {
                if (item.code) {
                    const cleanCode = item.code.replace(/\s+/g, '').toUpperCase();
                    timetableMap.set(cleanCode, {
                        code: item.code.replace(/\s+/g, ''),
                        name: item.subject || item.code,
                        year: sheetYrNum,
                        yearLabel: sheetYrLabel,
                        teacherName: item.teacher ? item.teacher.trim() : ''
                    });
                }
            });
        });

        // 2. Synchronize all courses in Course model
        for (const c of allCourses) {
            const cleanCode = (c.code || '').replace(/\s+/g, '').toUpperCase();
            const ttInfo = timetableMap.get(cleanCode);

            // Fix space formatting in course code if needed
            const standardCode = (c.code || '').replace(/\s+/g, '');
            if (c.code !== standardCode && standardCode.length > 0) {
                c.code = standardCode;
            }

            if (ttInfo) {
                c.year = ttInfo.year;
                c.yearLabel = ttInfo.yearLabel;
                if (!c.name) c.name = ttInfo.name;

                // Match teacher by name if c.teacher is unassigned
                if (!c.teacher && ttInfo.teacherName) {
                    const cleanTTTeacher = stripHonorifics(ttInfo.teacherName);
                    const matchedUser = teachers.find(t => {
                        const cleanU = stripHonorifics(t.name);
                        return cleanU.length >= 3 && (cleanU.includes(cleanTTTeacher) || cleanTTTeacher.includes(cleanU));
                    });
                    if (matchedUser) {
                        c.teacher = matchedUser._id;
                    }
                }
            } else {
                c.yearLabel = YEAR_LABELS[c.year] || '1st Year';
            }

            await c.save();
        }

        // 3. Re-query populated courses
        const populatedCourses = await Course.find({}).populate('teacher');

        console.log('\n======================================================');
        console.log('       TEACHER SUBJECT ASSIGNMENT AUDIT REPORT        ');
        console.log('======================================================\n');

        for (const teacher of teachers) {
            const teacherId = String(teacher._id);
            const teacherName = (teacher.name || '').toLowerCase().trim();
            const cleanTeacherName = stripHonorifics(teacherName);

            const assigned = populatedCourses.filter(c => {
                if (!c.teacher) return false;
                const cId = String(c.teacher._id || c.teacher);
                const cName = stripHonorifics(c.teacher.name || '');
                return (cId === teacherId) || (cleanTeacherName.length >= 3 && cName.includes(cleanTeacherName));
            });

            console.log(`👨‍🏫 Teacher: ${teacher.name} (${teacher.email})`);
            if (assigned.length === 0) {
                console.log(`   ⚠️ No assigned subjects found in DB.`);
            } else {
                const grouped = {};
                assigned.forEach(c => {
                    const yr = c.yearLabel || YEAR_LABELS[c.year] || '1st Year';
                    if (!grouped[yr]) grouped[yr] = [];
                    grouped[yr].push(`${c.code} - ${c.name}`);
                });

                Object.keys(grouped).forEach(yr => {
                    console.log(`   📌 [${yr}]: ${grouped[yr].join(' | ')}`);
                });
            }
            console.log('------------------------------------------------------');
        }

        process.exit(0);
    } catch (err) {
        console.error('Audit Error:', err);
        process.exit(1);
    }
}

auditAllTeachers();
