const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Course = require('../models/Course');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://mongo:27017/core_db';

async function cleanup() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const allCourses = await Course.find({}).lean().exec();
        console.log(`Found ${allCourses.length} total courses in database.\n`);

        // Group by normalized code (strip all whitespace, case-insensitive)
        const groups = new Map();
        allCourses.forEach(c => {
            const key = (c.code || '').replace(/[\s]+/g, '').toUpperCase();
            if (!key) return;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(c);
        });

        let deletedCount = 0;

        for (const [key, courses] of groups.entries()) {
            if (courses.length <= 1) continue;

            console.log(`\n=== DUPLICATE: "${key}" (${courses.length} copies) ===`);
            courses.forEach((c, i) => {
                const isGeneric = (c.description || '').includes('Official timetable subject offering');
                console.log(`  [${i + 1}] _id: ${c._id} | code: "${c.code}" | desc: "${(c.description || '').substring(0, 60)}..." | ${isGeneric ? 'AUTO-GENERATED' : 'CUSTOM'}`);
            });

            // Keep the one with custom description, delete the auto-generated ones
            const custom = courses.find(c => !(c.description || '').includes('Official timetable subject offering'));
            const toKeep = custom || courses[0]; // If all are generic, keep the first one

            for (const c of courses) {
                if (String(c._id) !== String(toKeep._id)) {
                    await Course.deleteOne({ _id: c._id });
                    console.log(`  ✗ DELETED: ${c._id} (code: "${c.code}")`);
                    deletedCount++;
                } else {
                    console.log(`  ✓ KEPT:    ${c._id} (code: "${c.code}")`);
                }
            }
        }

        console.log(`\n--- Cleanup complete. Deleted ${deletedCount} duplicate course(s). ---`);
        process.exit(0);
    } catch (err) {
        console.error('Cleanup error:', err);
        process.exit(1);
    }
}

cleanup();
