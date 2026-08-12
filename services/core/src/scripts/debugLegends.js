const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Semester = require('../models/Semester');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://mongo:27017/core_db';

async function debugLegends() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const semesters = await Semester.find({}).sort({ yearNumber: 1 }).lean().exec();
        console.log(`Found ${semesters.length} semesters.\n`);

        for (const sem of semesters) {
            console.log(`=== ${sem.yearLabel} (${sem.semesterLabel}) ===`);
            if (!sem.legend || sem.legend.length === 0) {
                console.log('  No legend found!');
                continue;
            }
            sem.legend.forEach((leg, i) => {
                console.log(`  [${i + 1}] Code: "${leg.code}" | Subject: "${leg.subject}" | Teacher: "${leg.teacher}"`);
            });
            console.log('');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugLegends();
