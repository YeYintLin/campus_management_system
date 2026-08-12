const Student = require('../models/Student');
const User = require('../models/User');
const Course = require('../models/Course');

const STUDENT_USER_FIELDS = 'name email role status department';

// @desc    Get all students (role-scoped)
// @route   GET /api/students
// @access  Private (Admin, Teacher, Student)
const getStudents = async (req, res) => {
    try {
        const { role, department, email, _id: userId } = req.user;
        const normalizedRole = (role || '').toLowerCase();
        const isAdmin = ['admin', 'superadmin', 'academicadmin'].includes(normalizedRole);

        if (!isAdmin) {
            // Teacher / Student: restrict to their own department
            let userDept = department || '';
            if (!userDept && email) {
                const parts = email.split('@')[0].toLowerCase().split('.');
                if (parts.length >= 2) {
                    const d = parts[1];
                    if (d === 'mc' || d === 'mce') userDept = 'Mechatronics Engineering';
                    else if (d === 'arch' || d === 'ar') userDept = 'Architecture';
                    else if (d === 'c' || d === 'ce') userDept = 'Civil Engineering';
                    else if (d === 'ep') userDept = 'Electrical Power Engineering';
                    else if (d === 'ec' || d === 'ece') userDept = 'Electronic Engineering';
                    else if (d === 'it') userDept = 'Information Technology';
                    else if (d === 'me') userDept = 'Mechanical Engineering';
                }
            }
            if (!userDept) userDept = 'Mechatronics Engineering'; // Default fallback for TU Hmawbi

            // Find all users in the same department
            const deptKeyword = userDept.split(' ')[0].toLowerCase(); // e.g. "mechatronics"
            const deptUsers = await User.find({
                role: 'Student',
                $or: [
                    { department: new RegExp(deptKeyword, 'i') },
                    { email: new RegExp(`\\.${deptKeyword.substring(0, 2)}\\.`, 'i') },
                    { email: new RegExp(`\\.${deptKeyword}\\.`, 'i') }
                ]
            }).select('_id');

            const deptUserIds = deptUsers.map(u => u._id);

            // Also include students in teacher's enrolled courses
            if (role === 'Teacher') {
                const myCourses = await Course.find({ teacher: userId }).select('students');
                for (const course of myCourses) {
                    for (const sid of course.students) {
                        deptUserIds.push(sid);
                    }
                }
            }

            const students = await Student.find({
                $or: [
                    { user: { $in: deptUserIds } },
                    { department: new RegExp(deptKeyword, 'i') }
                ]
            }).populate('user', STUDENT_USER_FIELDS);

            return res.json(students);
        }

        // Admin / SuperAdmin / AcademicAdmin: all students across all departments
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
