const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const Student = require('../models/Student');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Helper: check if teacher is authorized to manage a given course
const isTeacherAuthorizedForCourse = (course, user) => {
    if (!user) return false;
    const uRole = (user.role || '').toLowerCase();
    if (uRole === 'admin' || uRole === 'academicadmin' || uRole === 'superadmin') return true;
    if (uRole !== 'teacher') return false;

    const teacherId = user._id ? String(user._id) : '';
    const teacherName = (user.name || '').toLowerCase().trim();
    const teacherEmail = (user.email || '').toLowerCase().trim();

    if (!course || !course.teacher) return false;

    let cId = '';
    let cName = '';
    let cEmail = '';

    if (typeof course.teacher === 'object') {
        cId = course.teacher._id ? String(course.teacher._id) : '';
        cName = (course.teacher.name || '').toLowerCase().trim();
        cEmail = (course.teacher.email || '').toLowerCase().trim();
    } else if (typeof course.teacher === 'string') {
        cName = course.teacher.toLowerCase().trim();
        if (course.teacher.includes('@')) cEmail = course.teacher.toLowerCase().trim();
        else if (course.teacher.length > 15) cId = course.teacher;
    }

    if (teacherId && cId && teacherId === cId) return true;
    if (teacherEmail && cEmail && teacherEmail === cEmail) return true;

    const cleanUser = teacherName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();
    const cleanCourse = cName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();
    if (cleanUser.length >= 3 && cleanCourse.length >= 3) {
        if (cleanCourse.includes(cleanUser) || cleanUser.includes(cleanCourse)) return true;
    }

    return false;
};

const deriveDeptFromCode = (code = '') => {
    const clean = String(code || '').toUpperCase();
    if (clean.includes('MCE') || clean.startsWith('MC-') || clean.includes('-MC-')) return 'Mechatronics Engineering';
    if (clean.includes('CIVIL') || clean.startsWith('C-') || clean.includes('-C-')) return 'Civil Engineering';
    if (clean.includes('EP')) return 'Electrical Power Engineering';
    if (clean.includes('EC')) return 'Electronic Engineering';
    if (clean.includes('IT')) return 'Information Technology';
    if (clean.includes('MECH') || clean.startsWith('ME-')) return 'Mechanical Engineering';
    return 'Mechatronics Engineering';
};

const parseYearNumber = (yearInput) => {
    if (!yearInput) return 1;
    if (typeof yearInput === 'number') return Math.max(1, Math.min(6, yearInput));
    const match = String(yearInput).match(/\d+/);
    return match ? Math.max(1, Math.min(6, parseInt(match[0], 10))) : 1;
};

const deriveSemFromCourse = (course) => {
    if (course.semester && (course.semester === 1 || course.semester === 2)) {
        return course.semester;
    }
    const digits = String(course.code || course.name || '').replace(/[^0-9]/g, '');
    if (digits.length >= 5) {
        const s = parseInt(digits[1], 10);
        if (s === 1 || s === 2) return s;
    }
    return 1;
};

const deriveRollNo = (student, index) => {
    if (student.rollNo && String(student.rollNo).trim()) {
        return String(student.rollNo).trim().toUpperCase();
    }
    if (student.email) {
        const prefix = student.email.split('@')[0];
        const parts = prefix.split('.');
        if (parts.length >= 3) {
            const yr = parts[0].toUpperCase();
            const dept = parts[1].toUpperCase();
            const num = parts[2] || '';
            if (num) return `${yr}-${dept}-${num}`;
        } else if (parts.length === 2) {
            return `${parts[0].toUpperCase()}-${parts[1].toUpperCase()}`;
        }
    }
    return `ROLL-${index + 1}`;
};

// @desc    Get all assignments (role-scoped)
// @route   GET /api/assignments
// @access  Private
const getAllAssignments = async (req, res) => {
    try {
        const uRole = (req.user?.role || '').toLowerCase();
        const userId = req.user?._id;
        let filter = {};

        if (uRole === 'teacher') {
            const allCourses = await Course.find({}).lean();
            const myCourseIds = allCourses
                .filter(c => isTeacherAuthorizedForCourse(c, req.user))
                .map(c => c._id);
            if (req.query.course) {
                filter.course = req.query.course;
            } else {
                filter.course = { $in: myCourseIds };
            }
        } else if (uRole === 'student') {
            const studentYearNorm = req.user?.year || req.user?.currentYear || '';
            const yearNum = parseInt(studentYearNorm.replace(/[^0-9]/g, ''), 10) || null;
            const studentDept = (req.user?.department || '').toLowerCase().trim();

            const allCourses = await Course.find({}).lean();
            const enrolledCourses = allCourses.filter(c => {
                if (Array.isArray(c.students) && c.students.some(s => String(s) === String(userId))) return true;
                const cYearNum = c.year || parseYearNumber(c.yearLabel);
                const isYearMatch = yearNum ? cYearNum === yearNum : true;
                if (!isYearMatch) return false;
                if (studentDept) {
                    const cDept = (c.department || deriveDeptFromCode(c.code)).toLowerCase();
                    if (cDept && !studentDept.includes(cDept) && !cDept.includes(studentDept)) {
                        return false;
                    }
                }
                return true;
            });
            const enrolledCourseIds = enrolledCourses.map(c => c._id);

            if (req.query.course) {
                filter.course = req.query.course;
            } else {
                filter.course = { $in: enrolledCourseIds };
            }
        } else if (req.query.course) {
            filter.course = req.query.course;
        }

        const assignments = await Assignment.find(filter)
            .populate('course', 'name code year semester yearLabel teacher department')
            .populate('submissions.student', 'name email rollNo year department')
            .sort({ createdAt: -1 });

        res.json(assignments);
    } catch (error) {
        console.error('Error in getAllAssignments:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Private
const getAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find({ course: req.params.courseId })
            .populate('course', 'name code year semester yearLabel teacher department')
            .populate('submissions.student', 'name email rollNo year department')
            .sort({ createdAt: -1 });
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get full student roster review for an assignment (Teacher / Admin)
// @route   GET /api/assignments/:id/roster-review
// @access  Private (Teacher, Admin)
const getAssignmentRosterReview = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('course')
            .populate('submissions.student', 'name email rollNo year department');

        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Authorization check: Teacher must be assigned to course, or Admin
        if (!isTeacherAuthorizedForCourse(assignment.course, req.user)) {
            return res.status(403).json({ message: 'Not authorized to view student roster for this course' });
        }

        const course = assignment.course;
        const now = Date.now();
        const isPastDue = now > new Date(assignment.dueDate).getTime();

        // 1. Determine student cohort
        let studentUsers = [];

        // PRECEDENCE RULE: If course.students has explicit entries, use them
        if (Array.isArray(course.students) && course.students.length > 0) {
            studentUsers = await User.find({ _id: { $in: course.students }, role: 'Student' })
                .select('name email rollNo year department');
        } else {
            // COMPUTED COHORT MATCHING: Match canonical Student.semester
            const courseYearNum = course.year || parseYearNumber(course.yearLabel);
            const courseSemInYear = deriveSemFromCourse(course);
            const targetAbsSemester = (courseYearNum - 1) * 2 + courseSemInYear;
            const targetDept = (course.department || deriveDeptFromCode(course.code || course.name)).toLowerCase();

            // Find students by absolute canonical semester
            const studentProfiles = await Student.find({ semester: targetAbsSemester })
                .populate('user', 'name email rollNo year department');

            studentUsers = studentProfiles
                .map(sp => {
                    if (!sp.user) return null;
                    const u = sp.user.toObject ? sp.user.toObject() : sp.user;
                    u.enrollmentNumber = sp.enrollmentNumber;
                    u.department = sp.department || u.department;
                    return u;
                })
                .filter(Boolean)
                .filter(u => {
                    const d = (u.department || '').toLowerCase();
                    return d.includes('mechatronics') || targetDept.includes(d) || d.includes(targetDept);
                });

            // If no profiles found with that semester yet (fresh db fallback), match by user.year
            if (studentUsers.length === 0) {
                const yearLabel = `${courseYearNum}${courseYearNum === 1 ? 'st' : courseYearNum === 2 ? 'nd' : courseYearNum === 3 ? 'rd' : 'th'} Year`;
                studentUsers = await User.find({
                    role: 'Student',
                    $or: [
                        { year: new RegExp(`^${courseYearNum}`, 'i') },
                        { year: new RegExp(yearLabel, 'i') }
                    ]
                }).select('name email rollNo year department');
            }
        }

        // Map existing submissions by student ID
        const submissionMap = new Map();
        (assignment.submissions || []).forEach(sub => {
            const sId = sub.student?._id ? String(sub.student._id) : String(sub.student);
            if (sId) {
                submissionMap.set(sId, sub);
            }
        });

        // 2. Build combined Roster
        const roster = studentUsers.map((st, index) => {
            const sId = String(st._id);
            const sub = submissionMap.get(sId);
            const displayRoll = deriveRollNo(st, index);

            if (sub) {
                const isLate = sub.isLate || (new Date(sub.submittedAt).getTime() > new Date(assignment.dueDate).getTime());
                return {
                    studentId: st._id,
                    name: st.name,
                    email: st.email,
                    rollNo: displayRoll,
                    department: st.department || 'Mechatronics Engineering',
                    status: isLate ? 'Late' : 'Submitted',
                    submittedAt: sub.submittedAt,
                    submissionId: sub._id,
                    fileUrl: sub.fileUrl,
                    fileName: sub.fileName || sub.fileUrl?.split('/').pop() || 'Solution.pdf',
                    fileSize: sub.fileSize || 'Attachment',
                    isLate,
                };
            }

            return {
                studentId: st._id,
                name: st.name,
                email: st.email,
                rollNo: displayRoll,
                department: st.department || 'Mechatronics Engineering',
                status: isPastDue ? 'Missing' : 'Pending',
                submittedAt: null,
                submissionId: null,
                fileUrl: null,
                fileName: null,
                fileSize: null,
                isLate: false,
            };
        });

        // Sort roster by roll number
        roster.sort((a, b) => {
            const numA = (a.rollNo.match(/\d+$/) || [999999])[0];
            const numB = (b.rollNo.match(/\d+$/) || [999999])[0];
            return parseInt(numA, 10) - parseInt(numB, 10);
        });

        // 3. Compute Metrics
        const totalEnrolled = roster.length;
        const submittedList = roster.filter(r => r.status === 'Submitted' || r.status === 'Late');
        const onTimeCount = roster.filter(r => r.status === 'Submitted').length;
        const lateCount = roster.filter(r => r.status === 'Late').length;
        const missingCount = roster.filter(r => r.status === 'Missing').length;
        const pendingCount = roster.filter(r => r.status === 'Pending').length;
        const submissionRate = totalEnrolled > 0 ? Math.round((submittedList.length / totalEnrolled) * 100) : 0;

        res.json({
            assignment: {
                _id: assignment._id,
                title: assignment.title,
                description: assignment.description,
                dueDate: assignment.dueDate,
                fileUrl: assignment.fileUrl,
                fileName: assignment.fileName,
                course: {
                    _id: course._id,
                    name: course.name,
                    code: course.code,
                    year: course.year,
                    semester: course.semester,
                    yearLabel: course.yearLabel,
                }
            },
            stats: {
                totalEnrolled,
                submittedCount: submittedList.length,
                onTimeCount,
                lateCount,
                missingCount,
                pendingCount,
                submissionRate,
            },
            roster,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Teacher, Admin)
const createAssignment = async (req, res) => {
    try {
        const { course, title, description, dueDate, fileUrl, fileName } = req.body;

        const targetCourse = await Course.findById(course);
        if (!targetCourse) {
            return res.status(404).json({ message: 'Target course not found' });
        }

        if (!isTeacherAuthorizedForCourse(targetCourse, req.user)) {
            return res.status(403).json({ message: 'Not authorized to create assignments for this course' });
        }

        const assignment = await Assignment.create({
            course,
            title,
            description,
            dueDate,
            fileUrl,
            fileName,
        });

        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private (Teacher, Admin)
const updateAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id).populate('course');
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        if (!isTeacherAuthorizedForCourse(assignment.course, req.user)) {
            return res.status(403).json({ message: 'Not authorized to update this assignment' });
        }

        const { title, course, description, dueDate, fileUrl, fileName } = req.body;
        if (title !== undefined) assignment.title = title;
        if (course !== undefined) assignment.course = course;
        if (description !== undefined) assignment.description = description;
        if (dueDate !== undefined) assignment.dueDate = dueDate;
        if (fileUrl !== undefined) assignment.fileUrl = fileUrl;
        if (fileName !== undefined) assignment.fileName = fileName;

        await assignment.save();
        res.json(assignment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Teacher, Admin)
const deleteAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id).populate('course');
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        if (!isTeacherAuthorizedForCourse(assignment.course, req.user)) {
            return res.status(403).json({ message: 'Not authorized to delete this assignment' });
        }

        await assignment.deleteOne();
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit an assignment (Student)
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
const submitAssignment = async (req, res) => {
    try {
        const { fileUrl, fileName, fileSize } = req.body;
        if (!fileUrl) {
            return res.status(400).json({ message: 'Submission file URL is required' });
        }

        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        const now = Date.now();
        const isLate = now > new Date(assignment.dueDate).getTime();
        const studentIdStr = String(req.user._id);

        // Check if student already submitted
        const existingSubmission = assignment.submissions.find(
            (sub) => String(sub.student) === studentIdStr
        );

        if (existingSubmission) {
            // Clean up old physical file if it was a local upload in uploads/
            const oldUrl = existingSubmission.fileUrl;
            if (oldUrl && oldUrl !== fileUrl && (oldUrl.startsWith('/uploads/') || oldUrl.startsWith('uploads/'))) {
                const relativePath = oldUrl.startsWith('/') ? oldUrl.slice(1) : oldUrl;
                const fullDiskPath = path.join(process.cwd(), relativePath);
                try {
                    if (fs.existsSync(fullDiskPath)) {
                        fs.unlinkSync(fullDiskPath);
                    }
                } catch (cleanErr) {
                    console.warn('Could not remove previous submission file:', cleanErr.message);
                }
            }

            existingSubmission.fileUrl = fileUrl;
            if (fileName) existingSubmission.fileName = fileName;
            if (fileSize) existingSubmission.fileSize = fileSize;
            existingSubmission.rollNo = req.user.rollNo || existingSubmission.rollNo;
            existingSubmission.isLate = isLate;
            existingSubmission.submittedAt = new Date();
        } else {
            assignment.submissions.push({
                student: req.user._id,
                rollNo: req.user.rollNo,
                fileName: fileName || fileUrl.split('/').pop() || 'Solution.pdf',
                fileSize: fileSize || 'Attachment',
                fileUrl,
                isLate,
                submittedAt: new Date(),
            });
        }

        await assignment.save();
        res.json({
            message: isLate ? 'Assignment submitted (Late)' : 'Assignment submitted successfully',
            isLate,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllAssignments,
    getAssignments,
    getAssignmentRosterReview,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
};
