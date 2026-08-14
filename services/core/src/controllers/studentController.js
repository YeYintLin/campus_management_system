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

// @desc    Preview bulk semester advance for students
// @route   POST /api/students/bulk-update-semester/preview
// @access  Private (Admin)
const previewBulkUpdateSemester = async (req, res) => {
    try {
        const { year, fromSemester, targetSemester, department } = req.body;
        const yearNum = parseInt(year, 10);
        const targetSemNum = parseInt(targetSemester, 10);

        if (!yearNum || isNaN(yearNum) || !targetSemNum || isNaN(targetSemNum)) {
            return res.status(400).json({ message: 'Year and Target Semester must be valid numbers' });
        }

        // Fetch all students with populated users
        const allStudents = await Student.find().populate('user', 'name email role status department year rollNo');
        const allUsers = await User.find({ role: 'Student' });

        const eligibleStudents = [];
        const flaggedStudents = [];

        // Build a set of user IDs that have Student profiles
        const studentUserIds = new Set();

        for (const s of allStudents) {
            const u = s.user;
            if (!u) {
                flaggedStudents.push({
                    studentId: s._id,
                    name: 'Orphaned Student Profile',
                    enrollmentNumber: s.enrollmentNumber || 'N/A',
                    reason: 'Missing linked user account'
                });
                continue;
            }

            studentUserIds.add(u._id.toString());

            // Check department if specified
            if (department && department !== 'All') {
                const sDept = (s.department || u.department || '').toLowerCase();
                if (!sDept.includes(department.toLowerCase())) continue;
            }

            // Derive student's current year number from profile semester or user year string
            let sYearNum = null;
            if (typeof s.semester === 'number' && s.semester > 0) {
                sYearNum = Math.ceil(s.semester / 2);
            } else if (u.year) {
                const m = String(u.year).match(/\d+/);
                if (m) sYearNum = parseInt(m[0], 10);
            }

            // If fromSemester is specified, match exactly
            if (fromSemester) {
                const fromSemNum = parseInt(fromSemester, 10);
                if (s.semester !== fromSemNum) continue;
            } else {
                // Otherwise match year
                if (sYearNum !== yearNum) continue;
            }

            // Check for valid data
            if (!s.enrollmentNumber && !u.rollNo) {
                flaggedStudents.push({
                    studentId: s._id,
                    userId: u._id,
                    name: u.name || 'Unknown',
                    email: u.email || '',
                    reason: 'Missing Roll Number / Enrollment Number'
                });
            }

            eligibleStudents.push({
                studentId: s._id,
                userId: u._id,
                name: u.name,
                email: u.email,
                rollNo: u.rollNo || s.enrollmentNumber || 'N/A',
                department: s.department || u.department || 'Mechatronics Engineering',
                currentSemester: s.semester || 1,
                targetSemester: targetSemNum,
                currentYear: u.year || `${sYearNum || yearNum}th Year`
            });
        }

        // Check for student users with NO student profile
        for (const u of allUsers) {
            if (!studentUserIds.has(u._id.toString())) {
                const m = String(u.year || '').match(/\d+/);
                const uYear = m ? parseInt(m[0], 10) : null;
                if (uYear === yearNum) {
                    flaggedStudents.push({
                        userId: u._id,
                        name: u.name,
                        email: u.email,
                        rollNo: u.rollNo || 'N/A',
                        reason: 'User account has no Student profile document'
                    });
                }
            }
        }

        res.json({
            year: yearNum,
            targetSemester: targetSemNum,
            eligibleCount: eligibleStudents.length,
            eligibleStudents,
            flaggedCount: flaggedStudents.length,
            flaggedStudents
        });
    } catch (error) {
        console.error('previewBulkUpdateSemester error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Execute bulk semester advance for students
// @route   POST /api/students/bulk-update-semester
// @access  Private (Admin)
const bulkUpdateSemester = async (req, res) => {
    try {
        const { year, fromSemester, targetSemester, department, studentIds } = req.body;
        const yearNum = parseInt(year, 10);
        const targetSemNum = parseInt(targetSemester, 10);

        if (!targetSemNum || isNaN(targetSemNum) || targetSemNum < 1 || targetSemNum > 12) {
            return res.status(400).json({ message: 'Target Semester must be a valid number between 1 and 12' });
        }

        const newYearNum = Math.ceil(targetSemNum / 2);
        const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year', 7: 'ME Program' };
        const newYearLabel = labels[newYearNum] || `${newYearNum}th Year`;

        let targetStudentDocs = [];

        if (Array.isArray(studentIds) && studentIds.length > 0) {
            targetStudentDocs = await Student.find({ _id: { $in: studentIds } });
        } else {
            // Find all matching students
            const allStudents = await Student.find().populate('user');
            for (const s of allStudents) {
                const u = s.user;
                if (!u) continue;

                if (department && department !== 'All') {
                    const sDept = (s.department || u.department || '').toLowerCase();
                    if (!sDept.includes(department.toLowerCase())) continue;
                }

                let sYearNum = null;
                if (typeof s.semester === 'number' && s.semester > 0) {
                    sYearNum = Math.ceil(s.semester / 2);
                } else if (u.year) {
                    const m = String(u.year).match(/\d+/);
                    if (m) sYearNum = parseInt(m[0], 10);
                }

                if (fromSemester) {
                    if (s.semester === parseInt(fromSemester, 10)) {
                        targetStudentDocs.push(s);
                    }
                } else if (sYearNum === yearNum) {
                    targetStudentDocs.push(s);
                }
            }
        }

        let updatedCount = 0;
        const updatedList = [];

        for (const s of targetStudentDocs) {
            s.semester = targetSemNum;
            await s.save();

            if (s.user) {
                const userId = s.user._id || s.user;
                await User.findByIdAndUpdate(userId, { year: newYearLabel });
            }

            updatedCount++;
            updatedList.push({
                studentId: s._id,
                newSemester: targetSemNum,
                newYear: newYearLabel
            });
        }

        res.json({
            success: true,
            message: `Successfully advanced ${updatedCount} student(s) to Semester ${targetSemNum} (${newYearLabel})`,
            updatedCount,
            targetSemester: targetSemNum,
            yearLabel: newYearLabel
        });
    } catch (error) {
        console.error('bulkUpdateSemester error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    previewBulkUpdateSemester,
    bulkUpdateSemester,
};
