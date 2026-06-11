const Timetable = require('../models/Timetable');

// @desc    Get all timetable slots for a year and semester
// @route   GET /api/timetable
// @access  Private
const getTimetable = async (req, res) => {
    try {
        const { year, semester } = req.query;
        let query = {};

        if (year) query.year = year;
        if (semester) query.semester = semester;

        const slots = await Timetable.find(query);
        res.json(slots);
    } catch (error) {
        console.error('Get Timetable Error:', error.message);
        res.status(500).json({ message: 'Server error fetching timetable' });
    }
};

// @desc    Create or Update a timetable slot
// @route   PUT /api/timetable
// @access  Private (Admin/Teacher)
const saveTimetableSlot = async (req, res) => {
    try {
        const { year, semester, day, time, course, room, type } = req.body;

        // Upsert logic: if a slot exists for this year/semester/day/time, update it. Otherwise create.
        const slot = await Timetable.findOneAndUpdate(
            { year, semester, day, time },
            { course, room, type },
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

module.exports = {
    getTimetable,
    saveTimetableSlot,
    deleteTimetableSlot,
};
