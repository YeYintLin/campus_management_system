const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const XLSX = require('xlsx');
const { parseTUHmawbiExcel } = require('../utils/excelParser');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set.');
    process.exit(1);
}

const Course = require('../models/Course');
const User = require('../models/User');

const deriveYearFromCourseCode = (code = '', fallbackYear = 4) => {
    const clean = String(code).trim().toUpperCase();
    const match = clean.match(/[-_\s]?(\d{1,5})/);
    if (match) {
        const digitNum = parseInt(match[1][0], 10);
        if (digitNum >= 1 && digitNum <= 6) return digitNum;
    }
    return typeof fallbackYear === 'number' ? fallbackYear : 4;
};

async function seedMasterTimetable() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const filePath = 'C:\\Users\\ASUS\\Downloads\\Time Table 2025-2026 (1.6.25).xlsx';
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            process.exit(1);
        }

        const fileBuffer = fs.readFileSync(filePath);
        const { parsedMatrix } = parseTUHmawbiExcel(fileBuffer, 'Academic');

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

        // 1. Purge corrupt blank course codes like 'McE-'
        console.log('Purging corrupt course entries...');
        const allDbCourses = await Course.find({});
        for (const dbc of allDbCourses) {
            const clean = (dbc.code || '').toUpperCase().replace(/\s+/g, '');
            if (!clean || clean === 'MCE-' || clean === 'MCE' || clean.length < 3) {
                console.log(`[Purge] Deleting corrupt course record: '${dbc.code}' (${dbc._id})`);
                await Course.deleteOne({ _id: dbc._id });
            }
        }

        // 2. Build course map from master timetable matrix
        const courseMap = new Map();
        for (const slot of parsedMatrix) {
            let rawCode = slot.courseCode ? slot.courseCode.trim() : '';
            if (!rawCode) continue;

            const cleanCode = rawCode.toUpperCase().replace(/\s+/g, '');
            if (cleanCode.length > 20 || cleanCode === 'MCE-' || cleanCode === 'MCE') continue;

            const teacherObj = findTeacherByName(slot.teacher || slot.familyTeacher);
            const yearNum = deriveYearFromCourseCode(rawCode, slot.year ? parseInt(slot.year) : 4);
            const yearLabel = `${yearNum}th Year`.replace('1th', '1st').replace('2th', '2nd').replace('3th', '3rd');

            if (!courseMap.has(cleanCode)) {
                courseMap.set(cleanCode, {
                    code: rawCode,
                    name: slot.courseName || rawCode,
                    year: yearNum,
                    yearLabel: yearLabel,
                    teacherId: teacherObj ? teacherObj._id : null
                });
            } else {
                if (teacherObj && !courseMap.get(cleanCode).teacherId) {
                    courseMap.get(cleanCode).teacherId = teacherObj._id;
                }
            }
        }

        console.log(`Processing ${courseMap.size} unique courses from master timetable...`);
        let created = 0;
        let updated = 0;

        for (const [cleanCode, info] of courseMap.entries()) {
            let existing = await Course.findOne({ code: new RegExp(`^${info.code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') });

            if (existing) {
                existing.name = info.name || existing.name;
                existing.year = info.year;
                existing.yearLabel = info.yearLabel;
                if (info.teacherId) existing.teacher = info.teacherId;
                await existing.save();
                updated++;
            } else {
                try {
                    await Course.create({
                        code: info.code,
                        name: info.name,
                        year: info.year,
                        yearLabel: info.yearLabel,
                        description: `Official subject offering for ${info.yearLabel}`,
                        teacher: info.teacherId,
                        students: []
                    });
                    created++;
                } catch (cErr) {
                    console.error(`Skipped course ${info.code}:`, cErr.message);
                }
            }
        }

        console.log(`✅ Master timetable seed complete! Created: ${created}, Updated: ${updated}.`);
        process.exit(0);
    } catch (err) {
        console.error('Fatal Seed Error:', err);
        process.exit(1);
    }
}

seedMasterTimetable();
