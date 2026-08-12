const Course = require('../models/Course');

const syncCourseCollectionWithTimetable = async () => {
    try {
        const Semester = require('../models/Semester');
        const User = require('../models/User');

        const semesters = await Semester.find({}).lean().exec();
        if (!semesters || semesters.length === 0) return;

        const allTeachers = await User.find({ role: { $regex: /teacher/i } }).lean().exec();
        const stripHonorifics = (name = '') => name.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim().toLowerCase();

        const findTeacherByName = (tName) => {
            if (!tName) return null;
            const cleanT = stripHonorifics(tName);
            if (cleanT.length < 3) return null;
            return allTeachers.find(u => {
                const cleanU = stripHonorifics(u.name || '');
                return cleanU.includes(cleanT) || cleanT.includes(cleanU);
            }) || null;
        };

        // Build a map of code -> { name, yearNum, yearLabel, teacherId } from uploaded timetable legends
        const legendMap = new Map();
        for (const sem of semesters) {
            const yearNum = sem.yearNumber || 4;
            const yearLabel = sem.yearLabel || `${yearNum}th Year`;

            if (Array.isArray(sem.legend)) {
                for (const item of sem.legend) {
                    if (item && item.code) {
                        const codeStr = item.code.trim().toUpperCase();
                        const subjectName = item.subject ? item.subject.trim() : codeStr;
                        const teacherObj = findTeacherByName(item.teacher);

                        legendMap.set(codeStr, {
                            code: item.code.trim(),
                            name: subjectName,
                            year: yearNum,
                            yearLabel: yearLabel,
                            teacherId: teacherObj ? teacherObj._id : null
                        });
                    }
                }
            }
        }

        // Apply legendMap to Course collection: update year, name, AND teacher strictly
        for (const [cleanCode, info] of legendMap.entries()) {
            // Normalize code by stripping all whitespace for matching
            const codeNoSpaces = info.code.replace(/\s+/g, '');
            // Try exact match first, then match ignoring spaces
            let existing = await Course.findOne({ code: new RegExp(`^${info.code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') });
            if (!existing) {
                // Try matching with spaces stripped (e.g., "McE- 51039" matches "McE-51039")
                existing = await Course.findOne({ code: new RegExp(`^${codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}$`, 'i') });
            }
            if (!existing) {
                // Try matching by inserting optional whitespace after dashes
                const flexPattern = codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&').replace(/-/g, '-\\s*');
                existing = await Course.findOne({ code: new RegExp(`^${flexPattern}$`, 'i') });
            }

            if (existing) {
                existing.name = info.name;
                existing.year = info.year;
                existing.yearLabel = info.yearLabel;
                existing.teacher = info.teacherId;
                await existing.save();
            } else {
                try {
                    await Course.create({
                        code: codeNoSpaces.charAt(0).toUpperCase() === codeNoSpaces.charAt(0) ? info.code.replace(/\s+/g, '') : info.code.trim(),
                        name: info.name,
                        year: info.year,
                        yearLabel: info.yearLabel,
                        description: `Official timetable subject offering for ${info.yearLabel}`,
                        teacher: info.teacherId,
                        students: []
                    });
                } catch (createErr) {
                    if (createErr.code === 11000) {
                        // Duplicate key - try updating instead
                        const dup = await Course.findOne({ code: new RegExp(codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'), 'i') });
                        if (dup) {
                            dup.name = info.name;
                            dup.year = info.year;
                            dup.yearLabel = info.yearLabel;
                            dup.teacher = info.teacherId;
                            await dup.save();
                        }
                    }
                }
            }
        }

    } catch (err) {
        console.error('Course sync notice:', err.message);
    }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
const getCourses = async (req, res) => {
    try {
        await syncCourseCollectionWithTimetable();

        let query = {};
        const role = (req.user.role || '').toLowerCase().trim();

        // Teachers only see courses assigned to them
        if (role === 'teacher') {
            query = {
                $or: [
                    { teacher: req.user._id },
                    { teacher: req.user.id }
                ]
            };
        }
        // Admin sees all, Student sees all (frontend filters by year)

        const courses = await Course.find(query)
            .populate('teacher', 'name email')
            .populate('students', 'name email');

        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get course by ID
// @route   GET /api/courses/:id
// @access  Private
const getCourseById = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('teacher', 'name email')
            .populate('students', 'name email');

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Role-based authorization check
        if (req.user.role === 'Teacher' && course.teacher._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this course' });
        }

        if (req.user.role === 'Student') {
            const isEnrolled = course.students.some(s => s._id.toString() === req.user._id.toString());
            if (!isEnrolled) {
                return res.status(403).json({ message: 'Not authorized to view this course' });
            }
        }

        res.json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Private (Admin)
const createCourse = async (req, res) => {
    try {
        const { name, code, description, teacher, students } = req.body;

        const courseExists = await Course.findOne({ code });
        if (courseExists) {
            return res.status(400).json({ message: 'Course with this code already exists' });
        }

        const course = await Course.create({
            name,
            code,
            description,
            teacher,
            students: students || [],
        });

        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Admin, Teacher if their course)
const updateCourse = async (req, res) => {
    try {
        const { name, description, teacher, students } = req.body;
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Authorization: only Admin or assigned Teacher can update
        if (req.user.role === 'Teacher' && course.teacher.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this course' });
        }

        course.name = name || course.name;
        course.description = description || course.description;
        course.teacher = req.user.role === 'Admin' ? (teacher || course.teacher) : course.teacher;
        course.students = students || course.students;

        const updatedCourse = await course.save();
        res.json(updatedCourse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (course) {
            await course.deleteOne();
            res.json({ message: 'Course removed' });
        } else {
            res.status(404).json({ message: 'Course not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse,
};
