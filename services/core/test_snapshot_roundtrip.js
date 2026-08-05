const mongoose = require('mongoose');
require('dotenv').config();

const Semester = require('./src/models/Semester');
const TimetableFile = require('./src/models/TimetableFile');
const { parseTimetableBuffer } = require('./src/utils/parseTimetable');

const runSnapshotRoundtripTest = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    // 1. Fetch live Semester documents from DB
    const liveSemesters = await Semester.find().lean();
    console.log(`Step 1: Fetched ${liveSemesters.length} live Semester documents.`);

    // 2. Fetch the current active snapshot file buffer
    let activeFile = await TimetableFile.findOne({ isActive: true, data: { $exists: true } }).sort({ createdAt: -1 });
    if (!activeFile) {
        activeFile = await TimetableFile.findOne({ data: { $exists: true } }).sort({ createdAt: -1 });
    }

    if (!activeFile || !activeFile.data) {
        console.log('No active timetable snapshot file found in DB.');
        mongoose.disconnect();
        return;
    }

    console.log(`Step 2: Captured snapshot buffer from '${activeFile.originalName}' (${activeFile.data.length} bytes).`);

    // 3. Pass snapshot buffer into parseTimetableBuffer
    const parsedSheets = await parseTimetableBuffer(activeFile.data);
    console.log(`Step 3: Parsed ${parsedSheets.length} sheets from snapshot buffer.`);

    // 4. Compare ORIGINAL live Semester documents against RE-PARSED result field-by-field
    console.log('\n--- STEP 4: FIELD-BY-FIELD DETAILED DIFF ---');
    let mismatches = [];

    liveSemesters.forEach((origSem) => {
        const parsedSheet = parsedSheets.find(p => p.sheet_name === origSem.sheetName || (p.year_number === origSem.yearNumber && p.semester_number === origSem.semesterNumber));
        if (!parsedSheet) {
            mismatches.push({
                sheet: origSem.sheetName,
                field: 'Sheet Presence',
                original: origSem.sheetName,
                reparsed: 'MISSING (Sheet not found in parsed snapshot)'
            });
            return;
        }

        // Compare sheet level fields
        if (parsedSheet.department !== origSem.department) {
            mismatches.push({ sheet: origSem.sheetName, field: 'department', original: origSem.department, reparsed: parsedSheet.department });
        }
        if (parsedSheet.major_room && origSem.majorRoom && parsedSheet.major_room !== origSem.majorRoom) {
            mismatches.push({ sheet: origSem.sheetName, field: 'majorRoom', original: origSem.majorRoom, reparsed: parsedSheet.major_room });
        }
        if (parsedSheet.family_teacher && origSem.familyTeacher && parsedSheet.family_teacher !== origSem.familyTeacher) {
            mismatches.push({ sheet: origSem.sheetName, field: 'familyTeacher', original: origSem.familyTeacher, reparsed: parsedSheet.family_teacher });
        }

        // Compare sessions inside days
        (origSem.days || []).forEach(origDay => {
            const parsedDay = (parsedSheet.days || []).find(d => d.day === origDay.day);
            if (!parsedDay) {
                mismatches.push({ sheet: origSem.sheetName, field: `Day Presence: ${origDay.day}`, original: origDay.day, reparsed: 'MISSING' });
                return;
            }

            (origDay.sessions || []).forEach(origSession => {
                const origCode = origSession.code || origSession.courseCode || origSession.course || origSession.raw;
                if (!origCode) return;

                const parsedSession = (parsedDay.sessions || []).find(s => {
                    if (Array.isArray(s.periods) && s.periods.some(sp => String(sp) === String(origSession.period || origSession.periods?.[0]))) return true;
                    return false;
                });

                if (!parsedSession) {
                    mismatches.push({
                        sheet: origSem.sheetName,
                        field: `Session Presence [${origDay.day} Period ${origSession.period || origSession.periods?.[0]}]`,
                        original: `${origCode} (${origSession.session_type || origSession.sessionType})`,
                        reparsed: 'MISSING'
                    });
                    return;
                }

                const cleanOrigCode = origCode.replace(/\s*\([LTP]\)\s*$/, '').trim();
                const cleanParsedCode = (parsedSession.code || '').trim();
                if (cleanOrigCode !== cleanParsedCode) {
                    mismatches.push({
                        sheet: origSem.sheetName,
                        field: `Course Code [${origDay.day} Period ${origSession.period || origSession.periods?.[0]}]`,
                        original: cleanOrigCode,
                        reparsed: cleanParsedCode
                    });
                }
            });
        });
    });

    if (mismatches.length > 0) {
        console.log(`\n❌ FOUND ${mismatches.length} FIELD-BY-FIELD MISMATCHES:`);
        mismatches.forEach(m => {
            console.log(`  [Sheet: ${m.sheet}] Field '${m.field}':`);
            console.log(`    - Original DB: ${JSON.stringify(m.original)}`);
            console.log(`    - Re-parsed:   ${JSON.stringify(m.reparsed)}`);
        });
    } else {
        console.log('\n🎉 ZERO MISMATCHES! Perfect 100% field-by-field round-trip match across all 7 semesters!');
    }

    mongoose.disconnect();
};

runSnapshotRoundtripTest();
