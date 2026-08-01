const Student = require('../models/Student');
const User = require('../models/User');
const Course = require('../models/Course');

const STUDENT_USER_FIELDS = 'name email role status department';

// @desc    Get all students (role-scoped)
// @route   GET /api/students
// @access  Private (Admin, Teacher, Student)
const getStudents = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;

        if (role === 'Teacher') {
            // Teacher: only students enrolled in courses taught by this teacher
            const myCourses = await Course.find({ teacher: userId }).select('students');
            const studentUserIds = new Set();
            for (const course of myCourses) {
                for (const sid of course.students) {
                    studentUserIds.add(sid.toString());
                }
            }
            const students = await Student.find({ user: { $in: Array.from(studentUserIds) } })
                .populate('user', STUDENT_USER_FIELDS);
            return res.json(students);
        } else if (role === 'Student') {
            // Student: only their own student profile
            const students = await Student.find({ user: userId }).populate('user', STUDENT_USER_FIELDS);
            return res.json(students);
        }

        // Admin / SuperAdmin / AcademicAdmin: all students
        const students = await Student.find().populate('user', STUDENT_USER_FIELDS);
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private
const getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate(
            'user',
            STUDENT_USER_FIELDS
        );
        if (student) {
            res.json(student);
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create student profile
// @route   POST /api/students
// @access  Private (Admin)
const createStudent = async (req, res) => {
    try {
        const { user, enrollmentNumber, department, semester, contactNumber, status } =
            req.body;

        const studentExists = await Student.findOne({ user });
        if (studentExists) {
            return res.status(400).json({ message: 'Student profile already exists for this user' });
        }

        const student = await Student.create({
            user,
            enrollmentNumber,
            department,
            semester,
            contactNumber,
            status: status || 'Active',
        });

        await student.populate('user', STUDENT_USER_FIELDS);
        res.status(201).json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update student profile
// @route   PUT /api/students/:id
// @access  Private (Admin)
const updateStudent = async (req, res) => {
    try {
        const { enrollmentNumber, department, semester, contactNumber, status } = req.body;

        const student = await Student.findById(req.params.id);


        if (student) {
            student.enrollmentNumber = enrollmentNumber || student.enrollmentNumber;
            student.department = department || student.department;
            student.semester = semester || student.semester;
            student.contactNumber = contactNumber || student.contactNumber;
            student.status = status || student.status;

            const updatedStudent = await student.save();
            if (status && student.user) {
                await User.findByIdAndUpdate(student.user, { status });
            }
            await updatedStudent.populate('user', STUDENT_USER_FIELDS);
            res.json(updatedStudent);
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete student profile
// @route   DELETE /api/students/:id
// @access  Private (Admin)
const deleteStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (student) {
            await student.deleteOne();
            res.json({ message: 'Student removed' });
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
};
