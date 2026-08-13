require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('../models/Course');

async function cleanDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const courses = await Course.find({});
        const seenMap = new Map();

        for (const c of courses) {
            const cleanCode = (c.code || '').replace(/\s+/g, '').toUpperCase();
            if (!cleanCode) {
                console.log(`Deleting empty code course: ${c._id}`);
                await Course.deleteOne({ _id: c._id });
                continue;
            }

            if (seenMap.has(cleanCode)) {
                const existing = seenMap.get(cleanCode);
                const existingHasTeacher = !!existing.teacher;
                const newHasTeacher = !!c.teacher;

                if (newHasTeacher && !existingHasTeacher) {
                    console.log(`Deleting inferior duplicate course: ${existing._id} (${existing.code}) in favor of ${c._id} (${c.code})`);
                    await Course.deleteOne({ _id: existing._id });
                    seenMap.set(cleanCode, c);
                } else {
                    console.log(`Deleting duplicate course: ${c._id} (${c.code}) in favor of ${existing._id} (${existing.code})`);
                    await Course.deleteOne({ _id: c._id });
                }
            } else {
                seenMap.set(cleanCode, c);
            }
        }

        console.log('✅ Successfully cleaned all duplicate & corrupt courses from MongoDB!');
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning duplicate courses:', err);
        process.exit(1);
    }
}

cleanDuplicates();
