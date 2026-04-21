const Attendance = require('../models/Attendance');

// @desc    Get attendance for a course (can filter by date)
// @route   GET /api/attendance/course/:courseId
// @access  Private
const getAttendance = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { date } = req.query; // Optional specific date

        let query = { course: courseId };

        // If a specific date is requested, filter just for that day
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const attendanceRecords = await Attendance.find(query)
            .populate('records.student', 'name email')
            .sort({ date: -1 });

        res.json(attendanceRecords);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark attendance for a course on a specific date
// @route   POST /api/attendance
// @access  Private (Teacher, Admin)
const markAttendance = async (req, res) => {
    try {
        const { course, date, records } = req.body;

        const parsedDate = new Date(date);
        parsedDate.setHours(0, 0, 0, 0);

        const start = new Date(parsedDate);
        const end = new Date(parsedDate);
        end.setHours(23, 59, 59, 999);

        let attendance = await Attendance.findOne({
            course,
            date: { $gte: start, $lte: end },
        });

        if (attendance) {
            // Update existing attendance
            attendance.records = records;
            await attendance.save();
        } else {
            // Create new attendance record
            attendance = await Attendance.create({
                course,
                date: parsedDate,
                records,
            });
        }

        res.status(200).json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAttendance,
    markAttendance,
};
