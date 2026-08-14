require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongo:27017/core_db';

async function cleanJunkCourses() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const Course = require('../models/Course');
        const User = require('../models/User');
        const Semester = require('../models/Semester');

        // 1. Clean Semester legend arrays from non-subject activities
        const semesters = await Semester.find({});
        for (const s of semesters) {
            if (Array.isArray(s.legend)) {
                const originalLen = s.legend.length;
                s.legend = s.legend.filter(item => {
                    const c = (item.code || '').toUpperCase();
                    const sub = (item.subject || '').toUpperCase();
                    return !['TUTORIAL', 'PRACTICAL', 'LIBRARY', 'LIB', 'ASSEMBLY', 'INTRODUCTION', 'TESTING'].some(k => c.includes(k) || sub.includes(k));
                });
                if (s.legend.length !== originalLen) {
                    await s.save();
                    console.log(`Cleaned legend in Semester sheet: ${s.sheet_name || s.yearLabel}`);
                }
            }
        }

        // 2. Delete junk / fake courses with tutorial / practical / test names
        const deletedJunk = await Course.deleteMany({
            $or: [
                { name: { $regex: /(Tutorial|Practical|Introduction|Testing Job|Exam for all|Library|Lib|Assembly)/i } },
                { code: { $regex: /(TUTORIAL|PRACTICAL|LIBRARY|LIB|ASSEMBLY)/i } },
                { code: { $regex: '^[0-9]{1,2}[./-][0-9]{1,2}' } },
                { code: { $regex: '^GROUP', $options: 'i' } }
            ]
        });
        console.log(`🧹 Deleted ${deletedJunk.deletedCount} junk/fake courses (e.g. Tutorial I, Practical).`);

        // 2. Fix McE-3027 if it exists
        const mce3027 = await Course.findOne({ code: 'McE-3027' });
        if (mce3027) {
            mce3027.name = 'Fluid Power Control';
            mce3027.year = 3;
            mce3027.yearLabel = '3rd Year';
            mce3027.semester = 1;
            await mce3027.save();
            console.log('✅ Corrected McE-3027 to Fluid Power Control (3rd Year, Sem 1)');
        }

        // 3. Remove Daw Myat Thu Zar from any 1st Year courses
        const teacher = await User.findOne({ name: { $regex: /Daw Myat Thu Zar/i } });
        if (teacher) {
            const unassigned = await Course.updateMany(
                { teacher: teacher._id, $or: [{ year: 1 }, { yearLabel: '1st Year' }] },
                { $unset: { teacher: "" } }
            );
            console.log(`✅ Removed Daw Myat Thu Zar from ${unassigned.modifiedCount} unrelated 1st Year course(s).`);
        }

        console.log('\n=============================================');
        console.log('Subjects list is now completely clean!');
        console.log('=============================================\n');

        process.exit(0);
    } catch (err) {
        console.error('Error cleaning courses:', err);
        process.exit(1);
    }
}

cleanJunkCourses();
