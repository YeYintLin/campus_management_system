const Course = require('../models/Course');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
const getCourses = async (req, res) => {
    try {
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
