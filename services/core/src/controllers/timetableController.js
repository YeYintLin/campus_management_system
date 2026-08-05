const Timetable = require('../models/Timetable');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Get all timetable slots (role-scoped)
// @route   GET /api/timetable
// @access  Private
const getTimetable = async (req, res) => {
    try {
        const { year, semester, category, major } = req.query;
        const { role, _id: userId } = req.user || {};

        let yNum = null;
        let sNum = null;
        let targetYearString = year || '4th Year';
        let targetSemesterString = semester || 'Semester 2';

        if (year !== undefined && year !== null && year !== '') {
            if (typeof year === 'number' || !isNaN(Number(year))) {
                yNum = Number(year);
                targetYearString = `${yNum}${yNum === 1 ? 'st' : yNum === 2 ? 'nd' : yNum === 3 ? 'rd' : 'th'} Year`;
            } else {
                targetYearString = year;
                const match = String(year).match(/\d+/);
                if (match) yNum = parseInt(match[0], 10);
            }
        }

        if (semester !== undefined && semester !== null && semester !== '') {
            if (typeof semester === 'number' || !isNaN(Number(semester))) {
                sNum = Number(semester);
                targetSemesterString = `Semester ${sNum}`;
            } else {
                targetSemesterString = semester;
                const match = String(semester).match(/\d+/);
                if (match) sNum = parseInt(match[0], 10);
            }
        }

        const Semester = require('../models/Semester');
        const ClassSection = require('../models/ClassSection');

        // 1. Build query for Semester doc
        const semConditions = [];
        if (yNum) semConditions.push({ yearNumber: yNum });
        if (targetYearString) semConditions.push({ yearLabel: targetYearString });
        if (year) semConditions.push({ yearLabel: year });

        let semQuery = semConditions.length > 0 ? { $or: semConditions } : {};
        if (sNum) {
            const semNumOr = [{ semesterNumber: sNum }, { semesterLabel: targetSemesterString }, { semesterLabel: semester }];
            if (semConditions.length > 0) {
                semQuery = { $and: [{ $or: semConditions }, { $or: semNumOr }] };
            } else {
                semQuery = { $or: semNumOr };
            }
        }

        // 2. Query MongoDB
        const [semesterDoc, classSection, directSlots] = await Promise.all([
            Semester.findOne(semQuery).lean().exec(),
            ClassSection.findOne({ year: targetYearString, semester: targetSemesterString }).lean().exec(),
            Timetable.find({
                $or: [
                    { year: targetYearString },
                    { year: year },
                    { yearNumber: yNum }
                ].filter(c => Object.values(c)[0] !== undefined)
            }).lean().exec()
        ]);

        let slots = directSlots || [];

        // If direct Timetable slots are empty, automatically populate from semesterDoc!
        if (slots.length === 0 && semesterDoc) {
            const legendMap = new Map();
            (semesterDoc.legend || []).forEach(l => {
                if (l && l.code) legendMap.set(l.code.trim().replace(/\s+/g, ''), l);
            });

            (semesterDoc.days || []).forEach(dayObj => {
                (dayObj.sessions || []).forEach(sess => {
                    (sess.periods || []).forEach((pStr, idx) => {
                        const pNum = parseInt(pStr.replace(/\D/g, ''), 10) || (idx + 1);
                        const timeStr = sess.time && sess.time[idx] ? sess.time[idx] : (sess.time && sess.time[0] ? sess.time[0] : '09:00 AM - 09:50 AM');
                        const timeParts = timeStr.split('-').map(t => t.trim());
                        const startTime = timeParts[0] || '09:00 AM';
                        const endTime = timeParts[1] || '09:50 AM';
                        const cleanCode = sess.code || sess.raw || '';
                        const leg = legendMap.get(cleanCode.replace(/\s+/g, '')) || {};

                        slots.push({
                            _id: `${semesterDoc._id}_${dayObj.day}_${pNum}`,
                            year: targetYearString,
                            yearNumber: yNum,
                            semester: targetSemesterString,
                            semesterNumber: sNum,
                            day: dayObj.day,
                            periodNumber: pNum,
                            startTime: startTime,
                            endTime: endTime,
                            time: startTime,
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
        const filter = {};
        if (req.query.yearLabel || req.query.year) filter.yearLabel = req.query.yearLabel || req.query.year;
        if (req.query.semesterLabel || req.query.semester) filter.semesterLabel = req.query.semesterLabel || req.query.semester;
        const semesters = await Semester.find(filter).sort({ yearLabel: 1, semesterOrder: 1 }).lean();
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
