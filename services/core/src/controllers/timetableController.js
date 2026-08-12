const Timetable = require('../models/Timetable');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Get all timetable slots (role-scoped)
// @route   GET /api/timetable
// @access  Private
const getTimetable = async (req, res) => {
    try {
        const { year, semester, category, major } = req.query;

        // If called without specific year/semester parameters, return all semester sheets for client-side scanning
        if (!year && !semester) {
            const Semester = require('../models/Semester');
            const allSemDocs = await Semester.find().lean().exec();
            return res.json(allSemDocs);
        }

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

        let semesterDoc = allSemDocs.find(d => {
            const dY = d.yearNumber || parseNum(d.yearLabel) || parseNum(d.sheetName);
            if (yNum && dY && dY !== yNum) return false;

            const sNumDoc = d.semesterNumber;
            const sName = (String(d.sheetName || '') + ' ' + String(d.semesterLabel || '')).toLowerCase();

            if (isFirstSemTab) {
                if (sNumDoc === 1 || sName.includes('sem 1') || sName.includes('first') || sName.includes('s1') || sName.includes('15') || sName.includes('13')) return true;
            }
            if (isSecondSemTab) {
                if (sNumDoc === 2 || sName.includes('sem 2') || sName.includes('second') || sName.includes('s2') || sName.includes('2')) return true;
            }
            return false;
        });

        // Fallback 1: Match any sheet for that specific year only
        if (!semesterDoc && yNum) {
            semesterDoc = allSemDocs.find(d => {
                const dY = d.yearNumber || parseNum(d.yearLabel) || parseNum(d.sheetName);
                return dY === yNum;
            }) || null;
        }

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
        await TimetableFile.updateMany({}, { isActive: false });
        const fileDoc = await TimetableFile.create({
            originalName: req.file.originalname || 'TimeTable.xlsx',
            mimeType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data: req.file.buffer,
            size: req.file.buffer ? req.file.buffer.length : 0,
            isActive: true,
            uploadedBy: req.user ? req.user._id : null
        });

        // 2. Parse into structured data
        const parsedSheets = await parseTimetableBuffer(req.file.buffer);

        const warnings = [];
        const overwriteFilters = [];

        parsedSheets.forEach((s) => {
            if (!s.year_number || !s.semester_number) {
                warnings.push(`Could not determine year or semester number for sheet '${s.sheet_name}' — please confirm manually.`);
            }
            if (s.year_number && s.semester_number) {
                overwriteFilters.push({ yearNumber: s.year_number, semesterNumber: s.semester_number });
            } else {
                overwriteFilters.push({ sheetName: s.sheet_name });
            }
        });

        // Overwrite matching by (yearNumber + semesterNumber) or sheetName
        if (overwriteFilters.length > 0) {
            await Semester.deleteMany({ $or: overwriteFilters });
        }

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
            warnings,
            semesters: created.map((c) => ({ id: c._id, yearLabel: c.yearLabel, semesterLabel: c.semesterLabel }))
        });
    } catch (err) {
        console.error('Import failed:', err);
        res.status(500).json({ error: 'Failed to import timetable.' });
    }
};

// @desc    Get upload history list without heavy file binary buffers
// @route   GET /api/timetable/history
// @access  Private (Admin, Teacher)
const getImportHistory = async (req, res) => {
    try {
        const TimetableFile = require('../models/TimetableFile');
        const files = await TimetableFile.find()
            .select('-data')
            .sort({ createdAt: -1 })
            .lean();

        const history = files.map((f, idx) => ({
            _id: f._id,
            originalName: f.originalName,
            createdAt: f.createdAt,
            size: f.size || 0,
            isActive: f.isActive || idx === 0,
            uploadedBy: f.uploadedBy || null
        }));

        res.json(history);
    } catch (err) {
        console.error('getImportHistory error:', err);
        res.status(500).json({ error: 'Failed to fetch timetable import history.' });
    }
};

// @desc    Download stored original timetable file by fileId
// @route   GET /api/timetable/files/:fileId/download
// @access  Private (Admin, Teacher)
const downloadTimetableFile = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const TimetableFile = require('../models/TimetableFile');
        const { fileId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            return res.status(404).json({ error: 'Invalid file ID.' });
        }

        const fileDoc = await TimetableFile.findById(fileId);
        if (!fileDoc || !fileDoc.data) {
            return res.status(404).json({ error: 'Timetable file not found.' });
        }

        res.setHeader('Content-Type', fileDoc.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileDoc.originalName || 'TimeTable.xlsx'}"`);
        res.send(fileDoc.data);
    } catch (err) {
        console.error('downloadTimetableFile error:', err);
        res.status(500).json({ error: 'Failed to download timetable file.' });
    }
};

// @desc    Restore a previous timetable version with pre-restore snapshot & transaction safety
// @route   POST /api/timetable/restore/:fileId
// @access  Private (Admin only)
const restoreTimetableVersion = async (req, res) => {
    const mongoose = require('mongoose');
    const Semester = require('../models/Semester');
    const TimetableFile = require('../models/TimetableFile');
    const RestoreLog = require('../models/RestoreLog');
    const { parseTimetableBuffer } = require('../utils/parseTimetable');

    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return res.status(404).json({ error: 'Invalid file ID format.' });
    }

    try {
        // a. Look up target file
        const targetFile = await TimetableFile.findById(fileId);
        if (!targetFile || !targetFile.data) {
            return res.status(404).json({ error: 'Target timetable version file not found.' });
        }

        // b. Parse buffer BEFORE mutating live data. 400 if parsing fails!
        let parsedSheets;
        try {
            parsedSheets = await parseTimetableBuffer(targetFile.data);
            if (!Array.isArray(parsedSheets) || parsedSheets.length === 0) {
                return res.status(400).json({ error: 'Target file contains no valid timetable sheets.' });
            }
        } catch (parseErr) {
            return res.status(400).json({ error: `Failed to parse stored timetable file: ${parseErr.message}` });
        }

        // c. Snapshot current live semester state BEFORE mutating
        let currentActiveFile = await TimetableFile.findOne({ isActive: true, data: { $exists: true } }).sort({ createdAt: -1 });
        if (!currentActiveFile) {
            currentActiveFile = await TimetableFile.findOne({ data: { $exists: true } }).sort({ createdAt: -1 });
        }

        let snapshotDoc;
        if (currentActiveFile && currentActiveFile.data) {
            const uniqueSuffix = `${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6)}`;
            snapshotDoc = await TimetableFile.create({
                originalName: `pre-restore-snapshot-${uniqueSuffix}.xlsx`,
                mimeType: currentActiveFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                data: currentActiveFile.data,
                size: currentActiveFile.data.length,
                isActive: false,
                uploadedBy: req.user ? req.user._id : null
            });
        }

        const overwriteFilters = [];
        const warnings = [];
        parsedSheets.forEach((s) => {
            if (!s.year_number || !s.semester_number) {
                warnings.push(`Could not determine year/semester number for sheet '${s.sheet_name}'.`);
            }
            if (s.year_number && s.semester_number) {
                overwriteFilters.push({ yearNumber: s.year_number, semesterNumber: s.semester_number });
            } else {
                overwriteFilters.push({ sheetName: s.sheet_name });
            }
        });

        // d. Execute DB mutation using mongoose session/transaction if available, with fallback
        let session = null;
        let created;
        try {
            session = await mongoose.startSession();
            session.startTransaction();

            if (overwriteFilters.length > 0) {
                await Semester.deleteMany({ $or: overwriteFilters }, { session });
            }

            created = await Semester.insertMany(
                parsedSheets.map((s, i) => ({
                    sourceFile: targetFile._id,
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
                })),
                { session }
            );

            await session.commitTransaction();
            session.endSession();
        } catch (transErr) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            // Fallback for standalone Mongo instances without replica set transactions
            if (transErr.message && transErr.message.includes('Transaction numbers are only allowed')) {
                if (overwriteFilters.length > 0) {
                    await Semester.deleteMany({ $or: overwriteFilters });
                }
                created = await Semester.insertMany(
                    parsedSheets.map((s, i) => ({
                        sourceFile: targetFile._id,
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
            } else {
                throw transErr;
            }
        }

        // e. Update active flags & record RestoreLog
        await TimetableFile.updateMany({}, { isActive: false });
        targetFile.isActive = true;
        await targetFile.save();

        await RestoreLog.create({
            fileId: targetFile._id,
            restoredBy: req.user ? req.user._id : null,
            snapshotFileId: snapshotDoc ? snapshotDoc._id : null,
            summary: `Restored ${created.length} semesters from ${targetFile.originalName}`
        });

        // f. Return summary response
        res.json({
            message: `Successfully restored version: ${targetFile.originalName}`,
            restoredSemestersCount: created.length,
            snapshotFileId: snapshotDoc ? snapshotDoc._id : null,
            warnings
        });
    } catch (err) {
        console.error('restoreTimetableVersion error:', err);
        res.status(500).json({ error: err.message || 'Failed to restore timetable version.' });
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
    exportOriginalFile,
    getImportHistory,
    downloadTimetableFile,
    restoreTimetableVersion,
};
