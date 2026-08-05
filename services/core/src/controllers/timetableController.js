const Timetable = require('../models/Timetable');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Get all timetable slots (role-scoped)
// @route   GET /api/timetable
// @access  Private
const getTimetable = async (req, res) => {
    try {
        const { year, semester, category, major } = req.query;

        const parseNum = (val) => {
            if (val === undefined || val === null || val === '') return null;
            if (typeof val === 'number') return val;
            const match = String(val).match(/\d+/);
            return match ? parseInt(match[0], 10) : null;
        };

        let yNum = parseNum(year);
        let sNum = parseNum(semester);

        let targetYearString = year || '4th Year';
        let targetSemesterString = semester || 'Semester 2';

        if (yNum) {
            targetYearString = `${yNum}${yNum === 1 ? 'st' : yNum === 2 ? 'nd' : yNum === 3 ? 'rd' : 'th'} Year`;
        }

        const Semester = require('../models/Semester');
        const ClassSection = require('../models/ClassSection');

        const yStr = String(year || targetYearString || '');
        const sStr = String(semester || targetSemesterString || '');
        const isSecondSemTab = sNum === 2 || sStr.toLowerCase().includes('2');
        const isFirstSemTab = sNum === 1 || sStr.toLowerCase().includes('1');

        const allSemDocs = await Semester.find().lean().exec();
        const semesterDoc = allSemDocs.find(d => {
            const dY = d.yearNumber || parseNum(d.yearLabel) || parseNum(d.sheetName);
            const sName = d.sheetName.toLowerCase();

            if (yNum === 1 || yStr.includes('1')) {
                if (dY !== 1 && !sName.includes('first')) return false;
                if (isFirstSemTab) return d.semesterNumber === 1 || (sName.includes('sem i') && !sName.includes('sem ii'));
                if (isSecondSemTab) return d.semesterNumber === 2 || sName.includes('sem ii') || sName.includes('second');
            }
            if (yNum === 2 || yStr.includes('2')) {
                if (dY !== 2 && !sName.includes('second year')) return false;
                if (isFirstSemTab) return d.semesterNumber === 1 || d.semesterNumber === 3 || sName.includes('sem iii');
                if (isSecondSemTab) return d.semesterNumber === 2 || d.semesterNumber === 4 || sName.includes('sem iv') || sName.includes('second');
            }
            if (yNum === 3 || yStr.includes('3')) {
                if (dY !== 3 && !sName.includes('third')) return false;
                if (isFirstSemTab) return d.semesterNumber === 1 || d.semesterNumber === 5 || sName.includes('first sem');
                if (isSecondSemTab) return d.semesterNumber === 2 || d.semesterNumber === 6 || sName.includes('second sem');
            }
            if (yNum === 4 || yStr.includes('4')) {
                if (dY !== 4 && !sName.includes('fourth')) return false;
                if (isFirstSemTab) return d.semesterNumber === 1 || d.semesterNumber === 7 || sName.includes('first');
                if (isSecondSemTab) return d.semesterNumber === 2 || d.semesterNumber === 8 || sName.includes('second');
            }
            if (yNum === 5 || yStr.includes('5')) {
                if (dY !== 5 && !sName.includes('fifth')) return false;
                if (isFirstSemTab) return d.sheetName.includes('S1') || (dY === 5 && d.semesterNumber === 1);
                if (isSecondSemTab) return d.sheetName.includes('S2') || (dY === 5 && d.semesterNumber === 2);
            }
            if (yStr.includes('ME')) {
                if (!d.sheetName.includes('ME') && d.yearLabel !== 'ME') return false;
                if (isFirstSemTab) return d.semesterNumber === 1 || sName.includes('s1') || sName.includes('first');
                if (isSecondSemTab) return d.semesterNumber === 2 || sName.includes('s2') || sName.includes('second') || !sName.includes('s1');
            }
            return false;
        }) || null;

        // Build query for Timetable slots model
        let timetableQuery = {
            $and: [
                {
                    $or: [
                        { year: targetYearString },
                        { year: year },
                        yNum ? { yearNumber: yNum } : null
                    ].filter(Boolean)
                },
                {
                    $or: [
                        { semester: targetSemesterString },
                        { semester: semester },
                        sNum ? { semesterNumber: sNum } : null
                    ].filter(Boolean)
                }
            ]
        };

        if (category) timetableQuery.category = category;
        if (major) timetableQuery.major = major;

        const [classSection, directSlots] = await Promise.all([
            ClassSection.findOne({ year: targetYearString, semester: targetSemesterString }).lean().exec(),
            Timetable.find(timetableQuery).lean().exec()
        ]);

        let slots = directSlots || [];

        // If direct Timetable slots are empty, populate ONLY if semesterDoc matches!
        if (slots.length === 0 && semesterDoc) {
            const legendMap = new Map();
            (semesterDoc.legend || []).forEach(l => {
                if (l && l.code) legendMap.set(l.code.trim().replace(/\s+/g, ''), l);
            });

            const PERIOD_TIMES = {
                1: { start: '09:00 AM', end: '09:50 AM' },
                2: { start: '10:00 AM', end: '10:50 AM' },
                3: { start: '11:00 AM', end: '11:50 AM' },
                4: { start: '01:00 PM', end: '01:50 PM' },
                5: { start: '02:00 PM', end: '02:50 PM' },
                6: { start: '03:00 PM', end: '03:50 PM' }
            };

            (semesterDoc.days || []).forEach(dayObj => {
                (dayObj.sessions || []).forEach(sess => {
                    (sess.periods || []).forEach((pStr, idx) => {
                        const pNum = parseInt(String(pStr).replace(/\D/g, ''), 10) || (idx + 1);
                        const stdTime = PERIOD_TIMES[pNum] || { start: '09:00 AM', end: '09:50 AM' };
                        const cleanCode = sess.code || sess.raw || '';
                        const leg = legendMap.get(cleanCode.replace(/\s+/g, '')) || {};

                        slots.push({
                            _id: `${semesterDoc._id}_${dayObj.day}_${pNum}`,
                            year: targetYearString,
                            yearNumber: yNum || semesterDoc.yearNumber,
                            semester: targetSemesterString,
                            semesterNumber: sNum || semesterDoc.semesterNumber,
                            day: dayObj.day,
                            periodNumber: pNum,
                            startTime: stdTime.start,
                            endTime: stdTime.end,
                            time: stdTime.start,
                            courseCode: cleanCode,
                            courseName: leg.subject || cleanCode,
                            teacher: leg.teacher || semesterDoc.familyTeacher || 'Faculty Member',
                            room: semesterDoc.majorRoom || '3/212-A',
                            type: sess.session_type || 'Lecture',
                            sessionLabel: sess.session_type || 'Lecture'
                        });
                    });
                });
            });
        }

        res.json({
            semesterDoc: semesterDoc || null,
            slots: slots,
            classSection: {
                familyTeacher: semesterDoc?.familyTeacher || classSection?.familyTeacher || 'Faculty Member',
                majorRoom: semesterDoc?.majorRoom || classSection?.majorRoom || '3/212-A'
            }
        });
    } catch (error) {
        console.error('Get Timetable Error:', error.message);
        res.status(500).json({ message: 'Server error fetching timetable', slots: [] });
    }
};

// @desc    Create or Update a timetable slot
// @route   PUT /api/timetable
// @access  Private (Admin/Teacher)
const saveTimetableSlot = async (req, res) => {
    try {
        const { year, semester, day, time, course, room, type, category = 'Academic' } = req.body;

        // Upsert logic: if a slot exists for this year/semester/day/time, update it. Otherwise create.
        const slot = await Timetable.findOneAndUpdate(
            { year, semester, day, time },
            { course, room, type, category },
            { new: true, upsert: true, runValidators: true }
        );

        res.json(slot);
    } catch (error) {
        console.error('Save Timetable Slot Error:', error.message);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a timetable slot
// @route   DELETE /api/timetable
// @access  Private (Admin/Teacher)
const deleteTimetableSlot = async (req, res) => {
    try {
        const { year, semester, day, time } = req.query;

        if (!year || !semester || !day || !time) {
            return res.status(400).json({ message: 'Please provide year, semester, day, and time to delete a slot' });
        }

        const slot = await Timetable.findOneAndDelete({ year, semester, day, time });

        if (!slot) {
            return res.status(404).json({ message: 'Timetable slot not found' });
        }

        res.json({ message: 'Timetable slot removed' });
    } catch (error) {
        console.error('Delete Timetable Slot Error:', error.message);
        res.status(500).json({ message: 'Server error deleting timetable slot' });
    }
};

// @desc    Bulk save/upsert timetable slots (Excel import)
// @route   POST /api/timetable/batch
// @access  Private (Admin/Teacher)
const saveBatchTimetableSlots = async (req, res) => {
    try {
        const { slots } = req.body;
        if (!Array.isArray(slots) || slots.length === 0) {
            return res.status(400).json({ message: 'No slots provided for import' });
        }

        const bulkOps = slots.map(slot => ({
            updateOne: {
                filter: {
                    year: slot.year,
                    semester: slot.semester,
                    day: slot.day,
                    time: slot.time
                },
                update: {
                    $set: {
                        course: slot.course,
                        room: slot.room || 'Room 101',
                        type: slot.type || 'Lecture',
                        category: slot.category || (slot.type === 'Lab' ? 'Practical' : slot.type === 'Tutorial' ? 'Tutorial' : 'Academic')
                    }
                },
                upsert: true
            }
        }));

        await Timetable.bulkWrite(bulkOps);
        res.json({ message: `Successfully imported ${slots.length} timetable slots` });
    } catch (error) {
        console.error('Batch Save Timetable Error:', error.message);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Import Excel workbook, store original bytes, and insert flexible Semester docs
// @route   POST /api/timetable/import
// @access  Private (Admin/Teacher)
const importTimetableFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded (field name must be "file" or "excel").' });
        }

        const Semester = require('../models/Semester');
        const TimetableFile = require('../models/TimetableFile');
        const { parseTimetableBuffer } = require('../utils/parseTimetable');

        // 1. Store the original bytes untouched — export returns these exact bytes later
        const fileDoc = await TimetableFile.create({
            originalName: req.file.originalname || 'TimeTable.xlsx',
            mimeType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data: req.file.buffer
        });

        // 2. Parse into structured data
        const parsedSheets = await parseTimetableBuffer(req.file.buffer);

        await Semester.deleteMany({ sheetName: { $in: parsedSheets.map((s) => s.sheet_name) } });

        const created = await Semester.insertMany(
            parsedSheets.map((s, i) => ({
                sourceFile: fileDoc._id,
                sheetName: s.sheet_name,
                department: s.department,
                academicYear: s.academic_year,
                yearLabel: s.year_label,
                yearNumber: s.year_number,
                semesterLabel: s.semester_label,
                semesterNumber: s.semester_number,
                semesterOrder: i,
                majorRoom: s.major_room,
                combinedRoom: s.combined_room,
                familyTeacher: s.family_teacher,
                periods: s.periods,
                days: s.days,
                legend: s.legend
            }))
        );

        res.json({
            message: `Imported ${created.length} semester timetable(s) from ${req.file.originalname}.`,
            fileId: fileDoc._id,
            semesters: created.map((c) => ({ id: c._id, yearLabel: c.yearLabel, semesterLabel: c.semesterLabel }))
        });
    } catch (err) {
        console.error('Import failed:', err);
        res.status(500).json({ error: 'Failed to import timetable.' });
    }
};

// @desc    Get all semesters flexible list
// @route   GET /api/timetable/semesters
// @access  Private
const getSemesters = async (req, res) => {
    try {
        const Semester = require('../models/Semester');
        const parseNum = (val) => {
            if (val === undefined || val === null || val === '') return null;
            if (typeof val === 'number') return val;
            const match = String(val).match(/\d+/);
            return match ? parseInt(match[0], 10) : null;
        };

        const yearParam = req.query.yearLabel || req.query.year;
        const semParam = req.query.semesterLabel || req.query.semester;

        const filter = {};

        if (yearParam) {
            const yNum = parseNum(yearParam);
            const yearConditions = [
                { yearLabel: yearParam },
                yNum ? { yearNumber: yNum } : null,
                yNum ? { yearLabel: `${yNum}${yNum === 1 ? 'st' : yNum === 2 ? 'nd' : yNum === 3 ? 'rd' : 'th'} Year` } : null
            ].filter(Boolean);
            filter.$or = yearConditions;
        }

        if (semParam) {
            const sNum = parseNum(semParam);
            const semConditions = [
                { semesterLabel: semParam },
                sNum ? { semesterNumber: sNum } : null,
                sNum ? { semesterLabel: `Semester ${sNum}` } : null
            ].filter(Boolean);
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: semConditions }];
                delete filter.$or;
            } else {
                filter.$or = semConditions;
            }
        }

        const semesters = await Semester.find(filter).sort({ yearNumber: 1, semesterNumber: 1, semesterOrder: 1 }).lean();
        res.json(semesters);
    } catch (err) {
        console.error('Get Semesters Error:', err);
        res.status(500).json({ error: 'Failed to fetch semesters.' });
    }
};

// @desc    Get single semester detail by ID
// @route   GET /api/timetable/semester/:id or /:id
// @access  Private
const getSemesterById = async (req, res) => {
    try {
        const Semester = require('../models/Semester');
        const semester = await Semester.findById(req.params.id).lean();
        if (!semester) return res.status(404).json({ error: 'Semester timetable not found.' });
        res.json(semester);
    } catch (err) {
        console.error('Get Semester Detail Error:', err);
        res.status(500).json({ error: 'Failed to fetch semester detail.' });
    }
};

// @desc    Export original uploaded Excel file byte-for-byte
// @route   GET /api/timetable/:id/export or /export
// @access  Private
const exportOriginalFile = async (req, res) => {
    try {
        const Semester = require('../models/Semester');
        const TimetableFile = require('../models/TimetableFile');

        let file = null;

        if (req.params.id && req.params.id !== 'latest' && req.params.id.length === 24) {
            const semester = await Semester.findById(req.params.id).populate('sourceFile');
            if (semester && semester.sourceFile) {
                file = semester.sourceFile;
            } else {
                file = await TimetableFile.findById(req.params.id);
            }
        }

        if (!file) {
            file = await TimetableFile.findOne().sort({ createdAt: -1 });
        }

        if (!file || !file.data) {
            return res.status(404).json({ error: 'Original uploaded timetable file not found.' });
        }

        res.setHeader('Content-Type', file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${file.originalName || 'TimeTable.xlsx'}"`);
        res.send(file.data);
    } catch (err) {
        console.error('Export Original File Error:', err);
        res.status(500).json({ error: 'Failed to export original timetable file.' });
    }
};

module.exports = {
    getTimetable,
    saveTimetableSlot,
    deleteTimetableSlot,
    saveBatchTimetableSlots,
    importTimetableFile,
    getSemesters,
    getSemesterById,
    exportOriginalFile
};
