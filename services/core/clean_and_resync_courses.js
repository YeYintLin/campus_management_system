const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Semester = require('./src/models/Semester');
const Course = require('./src/models/Course');
const User = require('./src/models/User');

async function cleanAndResync() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/cms_core';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Remove non-academic Semester documents created by legacy practical/tutorial uploads
        // Real academic semester sheets start with "First", "Second", "Third", "Fourth", "Fifth", "Final", "1st", "2nd", "3rd", "4th", "5th", "6th", "Year", "Sem", "Semester"
        const allSemesters = await Semester.find({});
        console.log(`Total Semester documents before cleanup: ${allSemesters.length}`);

        const nonAcademicSheetIds = [];
        allSemesters.forEach(s => {
            const name = (s.sheetName || '').trim();
            // If the sheet name is just numbers/codes like "32032", "31032", "PE", "4049", "3027", "51039", etc.
            const isAcademic = /first|second|third|fourth|fifth|final|year|sem|major|1st|2nd|3rd|4th|5th|6th/i.test(name) && !/^[0-9]{4,6}$/.test(name);
            if (!isAcademic || /^[0-9]{4,6}$/.test(name) || name === 'PE' || name === '3027' || name === '4049') {
                nonAcademicSheetIds.push(s._id);
                console.log(`  Deleting non-academic sheet doc: [${name}] (ID: ${s._id})`);
            }
        });

        if (nonAcademicSheetIds.length > 0) {
            await Semester.deleteMany({ _id: { $in: nonAcademicSheetIds } });
            console.log(`Deleted ${nonAcademicSheetIds.length} legacy practical/tutorial sheet documents from Semester.`);
        }

        // 2. Remove fake/corrupted courses with names like "Introduction", "Tutorial I", "Testing Job"
        const deleteCoursesRes = await Course.deleteMany({
            $or: [
                { name: { $regex: /^(Introduction|Tutorial I|Tutorial II|Testing Job|Exam for all)/i } },
                { code: { $regex: '^[0-9]{1,2}[./-][0-9]{1,2}' } },
                { code: { $regex: '^GROUP', $options: 'i' } }
            ]
        });
        console.log(`Deleted ${deleteCoursesRes.deletedCount} invalid/junk courses.`);

        // 3. Re-sync clean courses from active Academic Semesters
        const academicSemesters = await Semester.find({});
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
        for (const sem of academicSemesters) {
            const yearNum = sem.yearNumber || 4;
            const yearLabel = sem.yearLabel || `${yearNum}th Year`;

            if (Array.isArray(sem.legend)) {
                for (const item of sem.legend) {
                    if (item && item.code) {
                        let rawCode = item.code.trim();
                        const codeMatch = rawCode.match(/^[A-Za-z]{1,5}-?\s*\d{3,6}/);
                        if (codeMatch) {
                            rawCode = codeMatch[0].replace(/\s+/g, '');
                        }
                        if (rawCode.length > 20) continue;

                        const codeStr = rawCode.toUpperCase();
                        let subjectName = item.subject ? item.subject.trim() : rawCode;
                        if (subjectName.toLowerCase().startsWith('introduction') || subjectName.toLowerCase().startsWith('tutorial i')) continue;

                        const teacherInSubject = subjectName.match(/\s{2,}(Daw |U |Dr\.|Dr |Prof\.?|Sayar ).+$/i);
                        if (teacherInSubject) {
                            subjectName = subjectName.substring(0, teacherInSubject.index).trim();
                        }

                        let teacherName = item.teacher ? item.teacher.trim() : '';
                        const teacherMatch = teacherName.match(/(Daw |U |Dr\.|Dr |Prof\.?|Sayar )(.+)$/i);
                        if (teacherMatch) {
                            teacherName = teacherMatch[0].trim();
                        }

                        const teacherObj = findTeacherByName(teacherName || item.teacher);

                        legendMap.set(codeStr, {
                            code: rawCode,
                            name: subjectName || rawCode,
                            year: yearNum,
                            yearLabel: yearLabel,
                            teacherId: teacherObj ? teacherObj._id : null
                        });
                    }
                }
            }
        }

        console.log(`Found ${legendMap.size} unique valid academic subjects in Academic Timetable.`);

        for (const [cleanCode, info] of legendMap.entries()) {
            let existing = await Course.findOne({
                $or: [
                    { code: new RegExp(`^${info.code}$`, 'i') },
                    { code: new RegExp(`^${info.code.replace(/\s+/g, '')}$`, 'i') }
                ]
            });

            if (existing) {
                existing.name = info.name;
                existing.year = info.year;
                existing.yearLabel = info.yearLabel;
                if (info.teacherId) existing.teacher = info.teacherId;
                await existing.save();
                console.log(`  Updated Course: [${existing.code}] ${existing.name} (Year: ${existing.year}, Teacher: ${existing.teacher})`);
            } else {
                const newCourse = await Course.create({
                    code: info.code,
                    name: info.name,
                    year: info.year,
                    yearLabel: info.yearLabel,
                    teacher: info.teacherId || null,
                    department: 'Mechatronics Engineering',
                    status: 'active'
                });
                console.log(`  Created Course: [${newCourse.code}] ${newCourse.name} (Year: ${newCourse.year}, Teacher: ${newCourse.teacher})`);
            }
        }

        // Verify Daw Myat Thu Zar's courses
        const teacher = await User.findOne({ name: { $regex: /Daw Myat Thu Zar/i } });
        if (teacher) {
            const myatCourses = await Course.find({ teacher: teacher._id });
            console.log(`\n✅ Daw Myat Thu Zar now has EXACTLY ${myatCourses.length} classes:`);
            myatCourses.forEach((c, i) => console.log(`   ${i + 1}. [${c.code}] ${c.name} (Year: ${c.year})`));
        }

        process.exit(0);
    } catch (err) {
        console.error('Error during cleanup and resync:', err);
        process.exit(1);
    }
}

cleanAndResync();
