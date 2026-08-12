const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ResourceFile = require('../models/ResourceFile');
const CustomFolder = require('../models/CustomFolder');
const Course = require('../models/Course');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://mongo:27017/core_db';

const isCommit = process.argv.includes('--commit');
const isDryRun = !isCommit;

const normalizeYear = (yr) => {
    if (!yr) return null;
    const str = String(yr).trim().toLowerCase();
    if (str === 'all') return 'All';
    if (str.includes('1') || str.includes('first')) return '1st Year';
    if (str.includes('2') || str.includes('second')) return '2nd Year';
    if (str.includes('3') || str.includes('third')) return '3rd Year';
    if (str.includes('4') || str.includes('fourth')) return '4th Year';
    if (str.includes('5') || str.includes('fifth')) return '5th Year';
    if (str.includes('6') || str.includes('sixth') || str.includes('final')) return '6th Year';
    return null;
};

const extractCodeFromText = (text = '') => {
    const clean = String(text).trim();
    const match = clean.match(/^[A-Za-z]{1,5}-?\s*\d{3,6}/);
    if (match) {
        return match[0].replace(/\s+/g, '').toUpperCase();
    }
    return null;
};

async function runBackfill() {
    try {
        console.log(`\n=======================================================`);
        console.log(`Resource & Folder Year Backfill Script (${isDryRun ? 'DRY-RUN MODE' : 'COMMIT MODE'})`);
        console.log(`=======================================================\n`);

        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.\n');

        // Fetch all courses to build a lookup index by normalized code
        const courses = await Course.find({}).lean().exec();
        const courseMap = new Map();
        courses.forEach(c => {
            if (c.code) {
                const normCode = c.code.replace(/[\s-]+/g, '').toUpperCase();
                const yearLabel = c.yearLabel || (c.year ? `${c.year}${c.year === 1 ? 'st' : c.year === 2 ? 'nd' : c.year === 3 ? 'rd' : 'th'} Year` : null);
                if (normCode && yearLabel) {
                    courseMap.set(normCode, yearLabel);
                }
            }
        });

        const allFiles = await ResourceFile.find({}).lean().exec();
        const allFolders = await CustomFolder.find({}).lean().exec();

        let scannedCount = 0;
        let courseLookupMatches = 0;
        let fallbackMatches = 0;

        const auditLogs = [];

        // Process Resource Files
        for (const f of allFiles) {
            scannedCount++;
            const currentNormYear = normalizeYear(f.year);

            // Check if untagged, missing, or needs backfill
            const isUntagged = !f.year || f.year === '' || !currentNormYear;

            if (isUntagged) {
                let proposedYear = null;
                let matchedVia = 'no_match_fallback';

                // Look up matching course by category or file name code
                const codeInCategory = extractCodeFromText(f.category);
                const codeInName = extractCodeFromText(f.name);
                const targetCode = codeInCategory || codeInName;

                if (targetCode && courseMap.has(targetCode)) {
                    proposedYear = courseMap.get(targetCode);
                    matchedVia = 'course_lookup';
                    courseLookupMatches++;
                } else {
                    proposedYear = 'All';
                    matchedVia = 'no_match_fallback';
                    fallbackMatches++;
                }

                const logEntry = {
                    id: String(f._id),
                    collection: 'ResourceFile',
                    name: f.name,
                    category: f.category,
                    currentYear: f.year || 'MISSING',
                    proposedYear,
                    matchedVia,
                };
                auditLogs.push(logEntry);

                if (isCommit) {
                    await ResourceFile.updateOne({ _id: f._id }, { $set: { year: proposedYear } });
                }
            }
        }

        // Process Custom Folders
        for (const folder of allFolders) {
            scannedCount++;
            const currentNormYear = normalizeYear(folder.year);

            const isUntagged = !folder.year || folder.year === '' || !currentNormYear;

            if (isUntagged) {
                let proposedYear = null;
                let matchedVia = 'no_match_fallback';

                const targetCode = extractCodeFromText(folder.name);

                if (targetCode && courseMap.has(targetCode)) {
                    proposedYear = courseMap.get(targetCode);
                    matchedVia = 'course_lookup';
                    courseLookupMatches++;
                } else {
                    proposedYear = 'All';
                    matchedVia = 'no_match_fallback';
                    fallbackMatches++;
                }

                const logEntry = {
                    id: String(folder._id),
                    collection: 'CustomFolder',
                    name: folder.name,
                    category: folder.name,
                    currentYear: folder.year || 'MISSING',
                    proposedYear,
                    matchedVia,
                };
                auditLogs.push(logEntry);

                if (isCommit) {
                    await CustomFolder.updateOne({ _id: folder._id }, { $set: { year: proposedYear } });
                }
            }
        }

        console.log('--- AFFECTED DOCUMENTS LOG ---');
        if (auditLogs.length === 0) {
            console.log('No untagged or missing year records found. All files & folders are properly tagged!');
        } else {
            auditLogs.forEach((log, idx) => {
                console.log(`[${idx + 1}] ID: ${log.id} | Coll: ${log.collection} | Name: "${log.name}" | Current: "${log.currentYear}" -> Proposed: "${log.proposedYear}" | Via: ${log.matchedVia}`);
            });
        }

        console.log(`\n--- SUMMARY REPORT ---`);
        console.log(`Mode                   : ${isDryRun ? 'DRY-RUN (No writes performed)' : 'COMMIT (Updated DB)'}`);
        console.log(`Total Documents Scanned : ${scannedCount}`);
        console.log(`Untagged/Affected      : ${auditLogs.length}`);
        console.log(`Matched via Course     : ${courseLookupMatches}`);
        console.log(`Fell back to 'All'     : ${fallbackMatches}`);
        console.log(`=======================================================\n`);

        process.exit(0);
    } catch (err) {
        console.error('Backfill error:', err);
        process.exit(1);
    }
}

runBackfill();
