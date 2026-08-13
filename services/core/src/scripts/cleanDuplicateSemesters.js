require('dotenv').config();
const mongoose = require('mongoose');
const Semester = require('../models/Semester');

async function cleanDuplicateSemesters() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const sems = await Semester.find({});
        const map = new Map();

        for (const s of sems) {
            const yr = s.yearNumber || (s.yearLabel === 'I' ? 1 : s.yearLabel === 'II' ? 2 : s.yearLabel === 'III' ? 3 : s.yearLabel === 'IV' ? 4 : s.yearLabel === 'V' ? 5 : 1);
            const sem = s.semesterNumber || (s.semesterLabel && s.semesterLabel.toLowerCase().includes('second') ? 2 : 1);

            const key = `${yr}_${sem}`;

            if (map.has(key)) {
                const existing = map.get(key);
                // Keep the newer/standardized doc with yearNumber & semesterNumber populated
                if (s.semesterNumber && !existing.semesterNumber) {
                    console.log(`Deleting old semester doc ${existing._id} (${existing.sheetName}) in favor of ${s._id}`);
                    await Semester.deleteOne({ _id: existing._id });
                    map.set(key, s);
                } else {
                    console.log(`Deleting duplicate semester doc ${s._id} (${s.sheetName}) in favor of ${existing._id}`);
                    await Semester.deleteOne({ _id: s._id });
                }
            } else {
                map.set(key, s);
            }
        }

        console.log('✅ Successfully cleaned duplicate semester documents from MongoDB!');
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning duplicate semesters:', err);
        process.exit(1);
    }
}

cleanDuplicateSemesters();
