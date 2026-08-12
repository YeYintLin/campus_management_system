const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Semester = require('../models/Semester');
const Course = require('../models/Course');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cms';

async function runSync() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const semesters = await Semester.find({}).lean().exec();
        if (!semesters || semesters.length === 0) {
            console.log('No timetable semesters found to sync.');
            process.exit(0);
        }

        const allTeachers = await User.find({ role: { $regex: /teacher/i } }).lean().exec();
        const stripHonorifics = (name = '') => name.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim().toLowerCase();

        const findTeacherByName = (tName) => {
            if (!tName) return null;
            const cleanT = stripHonorifics(tName);
            if (cleanT.length < 3) return null;
            return allTeachers.find(u => {
                const cleanU = stripHonorifics(u.name || '');
                return cleanU.includes(cleanT) || cleanT.includes(cleanU);
            }) || null;
        };

        const legendMap = new Map();
        for (const sem of semesters) {
            const yearNum = sem.yearNumber || 4;
            const yearLabel = sem.yearLabel || `${yearNum}th Year`;

            if (Array.isArray(sem.legend)) {
                for (const item of sem.legend) {
                    if (item && item.code) {
                        const codeStr = item.code.trim().toUpperCase();
                        const subjectName = item.subject ? item.subject.trim() : codeStr;
                        const teacherObj = findTeacherByName(item.teacher);

                        legendMap.set(codeStr, {
                            code: item.code.trim(),
                            name: subjectName,
                            year: yearNum,
                            yearLabel: yearLabel,
                            teacherId: teacherObj ? teacherObj._id : null,
                            teacherName: teacherObj ? teacherObj.name : item.teacher
                        });
                    }
                }
            }
        }

        console.log(`Extracted ${legendMap.size} unique timetable subjects from legends.`);

        for (const [cleanCode, info] of legendMap.entries()) {
            const existing = await Course.findOne({ code: new RegExp(`^${info.code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') });
            if (existing) {
                existing.name = info.name;
                existing.year = info.year;
                existing.yearLabel = info.yearLabel;
                existing.teacher = info.teacherId;
                await existing.save();
                console.log(`Updated Course [${info.code}] => Teacher: ${info.teacherName || 'Unassigned'}, Year: ${info.yearLabel}`);
            } else {
                await Course.create({
                    code: info.code,
                    name: info.name,
                    year: info.year,
                    yearLabel: info.yearLabel,
                    description: `Official timetable subject offering for ${info.yearLabel}`,
                    teacher: info.teacherId,
                    students: []
                });
                console.log(`Created Course [${info.code}] => Teacher: ${info.teacherName || 'Unassigned'}, Year: ${info.yearLabel}`);
            }
        }

        const allDbCourses = await Course.find({});
        for (const dbc of allDbCourses) {
            const cleanCode = (dbc.code || '').trim().toUpperCase();
            if (!legendMap.has(cleanCode)) {
                if (dbc.teacher) {
                    dbc.teacher = null;
                    await dbc.save();
                    console.log(`Unassigned teacher from non-timetable course [${dbc.code}]`);
                }
            }
        }

        console.log('Course sync completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error during course sync:', err);
        process.exit(1);
    }
}

runSync();
