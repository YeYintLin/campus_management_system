const Timetable = require('../models/Timetable');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Get all timetable slots (role-scoped)
// @route   GET /api/timetable
// @access  Private
const getTimetable = async (req, res) => {
    try {
        const { year, semester, category, major } = req.query;
        const { role, _id: userId } = req.user;
        let query = {};

        if (year) query.year = year;
        if (semester) query.semester = semester;
        if (category) query.category = category;
        if (major) query.major = major;

        if (role === 'Teacher') {
            const userDoc = await User.findById(userId).select('department');
            const dept = (userDoc?.department || '').toUpperCase().trim();
            const isMinorTeacher = ['MATH', 'MTH', 'ENGLISH', 'ENG', 'MYANMAR', 'MM', 'CHEM', 'CHM', 'PHYS', 'PHY'].some(m => dept.includes(m));

            if (!isMinorTeacher) {
                // Major department teacher (e.g. Mechatronics / MC): restricted to their own major department
                const teacherMajor = (dept.includes('MC') || dept.includes('MECHA')) ? 'MC' : (major || 'MC');
                query.major = teacherMajor;
            }
        } else if (role === 'Student') {
            // Student: filter by student's year if not explicitly provided
            if (!year) {
                const userDoc = await User.findById(userId).select('year');
                if (userDoc && userDoc.year) {
                    const yearString = `${userDoc.year}${userDoc.year === 1 ? 'st' : userDoc.year === 2 ? 'nd' : userDoc.year === 3 ? 'rd' : 'th'} Year`;
                    query.year = yearString;
                }
            }
        }

        const ClassSection = require('../models/ClassSection');
        const targetYear = query.year || year || '4th Year';
        const targetSemester = query.semester || semester || 'Semester 2';
        const targetMajor = query.major || major || 'MC';

        const [classSection, slots] = await Promise.all([
            ClassSection.findOne({ year: targetYear, semester: targetSemester, major: targetMajor }).lean().exec(),
            Timetable.find(query).lean().exec()
        ]);

        res.json({
            slots: slots || [],
            classSection: classSection ? {
                familyTeacher: classSection.familyTeacher,
                majorRoom: classSection.majorRoom
            } : null
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

module.exports = {
    getTimetable,
    saveTimetableSlot,
    deleteTimetableSlot,
    saveBatchTimetableSlots,
};
