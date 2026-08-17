const Course = require('../models/Course');

const deriveYearFromCourseCode = (code = '', fallbackYear = 4) => {
    const clean = String(code).trim().toUpperCase();
    const match = clean.match(/[-_\s]?(\d{1,5})/);
    if (match) {
        const digitNum = parseInt(match[1][0], 10);
        if (digitNum >= 1 && digitNum <= 6) return digitNum;
    }
    return typeof fallbackYear === 'number' ? fallbackYear : 4;
};

const deriveSemesterFromCourseCode = (code = '', fallbackSem = null) => {
    const clean = String(code).trim().toUpperCase();
    const digits = clean.replace(/[^0-9]/g, '');
    // In 5-digit code format YSXXX (e.g. 51039 -> Year 5, Sem 1; 52039 -> Year 5, Sem 2; 32032 -> Year 3, Sem 2)
    if (digits.length >= 5) {
        const semDigit = parseInt(digits[1], 10);
        if (semDigit === 1 || semDigit === 2) return semDigit;
    }
    if (typeof fallbackSem === 'number' && (fallbackSem === 1 || fallbackSem === 2)) return fallbackSem;
    return fallbackSem || null;
};

const syncCourseCollectionWithTimetable = async () => {
    try {
        const Semester = require('../models/Semester');
        const User = require('../models/User');
        const Course = require('../models/Course');

        const semesters = await Semester.find({}).lean().exec();
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

        // Build a map of code -> { name, yearNum, yearLabel, semester, teacherId } from uploaded timetable legends
        const legendMap = new Map();
        if (semesters && semesters.length > 0) {
            for (const sem of semesters) {
                const yearNum = sem.yearNumber || 4;
                const yearLabel = sem.yearLabel || `${yearNum}th Year`;
                let semNumber = sem.semesterNumber;
                if (!semNumber && sem.semesterLabel) {
                    semNumber = sem.semesterLabel.includes('2') ? 2 : 1;
                } else if (!semNumber && sem.sheetName) {
                    semNumber = sem.sheetName.includes('2') ? 2 : 1;
                }

                if (Array.isArray(sem.legend)) {
                    for (const item of sem.legend) {
                        if (item && item.code) {
                            let rawCode = item.code.trim();
                            const codeUpper = rawCode.toUpperCase();
                            // Skip non-subject activities (Tutorial, Practical, Library, Assembly)
                            if (['TUTORIAL', 'PRACTICAL', 'LIBRARY', 'LIB', 'ASSEMBLY', 'SEMINAR', 'MEETING', 'LUNCH', 'BREAK', 'TESTING'].some(k => codeUpper.includes(k))) {
                                continue;
                            }

                            const codeMatch = rawCode.match(/^[A-Za-z]{1,5}-?\s*\d{3,6}/);
                            if (codeMatch) {
                                rawCode = codeMatch[0].replace(/\s+/g, '');
                            }
                            if (rawCode.length > 20) continue;

                            const codeStr = rawCode.toUpperCase();
                            let subjectName = item.subject ? item.subject.trim() : rawCode;
                            const subjectUpper = subjectName.toUpperCase();
                            if (['TUTORIAL', 'PRACTICAL', 'LIBRARY', 'LIB', 'ASSEMBLY', 'INTRODUCTION', 'TESTING JOB'].some(k => subjectUpper.includes(k))) {
                                continue;
                            }
                            const teacherInSubject = subjectName.match(/\s{2,}(Daw |U |Dr\.|Dr |Prof\.?|Sayar ).+$/i);
                            if (teacherInSubject) {
                                subjectName = subjectName.substring(0, teacherInSubject.index).trim();
                            }

                            let teacherName = item.teacher ? item.teacher.trim() : '';
                            const teacherMatch = teacherName.match(/(Daw |U |Dr\.|Dr |Prof\.?|Sayar )(.+)$/i);
                            if (teacherMatch) {
                                teacherName = teacherMatch[0].trim();
                            }

                            const teacherObj = findTeacherByName(teacherName || item.teacher);
                            const itemSem = deriveSemesterFromCourseCode(rawCode, semNumber);

                            legendMap.set(codeStr, {
                                code: rawCode,
                                name: subjectName || rawCode,
                                year: yearNum,
                                yearLabel: yearLabel,
                                semester: itemSem,
                                teacherId: teacherObj ? teacherObj._id : null
                            });
                        }
                    }
                }
            }
        }
        // Clean up any legacy non-course entries (Tutorial, Practical, Lib, etc.)
        await Course.deleteMany({
            $or: [
                { name: { $regex: /(Tutorial|Practical|Introduction|Testing Job|Exam for all|Library|Assembly)/i } },
                { code: { $regex: /(TUTORIAL|PRACTICAL|LIBRARY|LIB|ASSEMBLY)/i } },
                { code: { $regex: '^[0-9]{1,2}[./-][0-9]{1,2}' } },
                { code: { $regex: '^GROUP', $options: 'i' } }
            ]
        });

        // Apply legendMap to Course collection: update year, semester, name, AND teacher strictly
        for (const [cleanCode, info] of legendMap.entries()) {
            const codeNoSpaces = info.code.replace(/\s+/g, '');
            let existing = await Course.findOne({ code: new RegExp(`^${info.code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') });
            if (!existing) {
                existing = await Course.findOne({ code: new RegExp(`^${codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}$`, 'i') });
            }
            if (!existing) {
                const flexPattern = codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&').replace(/-/g, '-\\s*');
                existing = await Course.findOne({ code: new RegExp(`^${flexPattern}$`, 'i') });
            }

            const derivedY = info.year || deriveYearFromCourseCode(info.code, 4);
            const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year', 7: 'ME Program' };
            const derivedLabel = info.yearLabel || labels[derivedY] || `${derivedY}th Year`;
            const derivedSem = info.semester || deriveSemesterFromCourseCode(info.code, 1);

            if (existing) {
                existing.name = info.name || existing.name;
                existing.year = derivedY;
                existing.yearLabel = derivedLabel;
                existing.semester = derivedSem || existing.semester;
                if (info.teacherId) existing.teacher = info.teacherId;
                await existing.save();
            } else {
                try {
                    await Course.create({
                        code: codeNoSpaces.charAt(0).toUpperCase() === codeNoSpaces.charAt(0) ? info.code.replace(/\s+/g, '') : info.code.trim(),
                        name: info.name,
                        year: derivedY,
                        yearLabel: derivedLabel,
                        semester: derivedSem,
                        description: `Official timetable subject offering for ${derivedLabel}`,
                        teacher: info.teacherId,
                        students: []
                    });
                } catch (createErr) {
                    if (createErr.code === 11000) {
                        const dup = await Course.findOne({ code: new RegExp(codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'), 'i') });
                        if (dup) {
                            dup.name = info.name;
                            dup.year = derivedY;
                            dup.yearLabel = derivedLabel;
                            dup.semester = derivedSem || dup.semester;
                            if (info.teacherId) dup.teacher = info.teacherId;
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
        if (req.query.year) {
            query.year = parseInt(req.query.year, 10);
        }
        if (req.query.semester) {
            query.semester = parseInt(req.query.semester, 10);
        }
        const role = (req.user.role || '').toLowerCase().trim();

        // Filter to assigned courses only if explicitly requested (e.g. ?assignedOnly=true)
        if (role === 'teacher' && req.query.assignedOnly === 'true') {
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

// @desc    Get course by ID or Code
// @route   GET /api/courses/:id
// @access  Private
const getCourseById = async (req, res) => {
    try {
        const paramId = req.params.id;
        const isObjectId = mongoose.Types.ObjectId.isValid(paramId);

        let course = null;
        if (isObjectId) {
            course = await Course.findById(paramId)
                .populate('teacher', 'name email')
                .populate('students', 'name email');
        }

        if (!course) {
            const cleanCode = String(paramId || '').replace(/\s+/g, '');
            course = await Course.findOne({
                $or: [
                    { code: new RegExp(`^${cleanCode}$`, 'i') },
                    { code: new RegExp(`^${paramId}$`, 'i') },
                    { name: new RegExp(`^${paramId}$`, 'i') }
                ]
            })
            .populate('teacher', 'name email')
            .populate('students', 'name email');
        }

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Role-based authorization check
        if (req.user && req.user.role === 'Teacher') {
            const tId = course.teacher?._id?.toString() || course.teacher?.toString();
            const uId = req.user._id?.toString() || req.user.id?.toString();
            // Allow if assigned teacher or if course has no assigned teacher
            if (tId && uId && tId !== uId) {
                // If teacher is from the same department, allow attendance logging
                console.log(`Teacher ${uId} accessing course ${course.code} assigned to ${tId}`);
            }
        }

        if (req.user && req.user.role === 'Student') {
            const uId = req.user._id?.toString() || req.user.id?.toString();
            const isEnrolled = course.students && course.students.some(s => (s._id?.toString() || s.toString()) === uId);
            if (!isEnrolled) {
                // Allow students to view course syllabus info
            }
        }

        res.json(course);
    } catch (error) {
        console.error('getCourseById error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Private (Admin)
const createCourse = async (req, res) => {
    try {
        const { name, code, description, teacher, students, year, semester, yearLabel } = req.body;

        const courseExists = await Course.findOne({ code });
        if (courseExists) {
            return res.status(400).json({ message: 'Course with this code already exists' });
        }

        const derivedY = year || deriveYearFromCourseCode(code, 4);
        const derivedSem = semester || deriveSemesterFromCourseCode(code, null);

        const course = await Course.create({
            name,
            code,
            description,
            teacher,
            year: derivedY,
            semester: derivedSem,
            yearLabel: yearLabel || `${derivedY}th Year`,
            students: students || [],
        });

        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update course
const updateCourse = async (req, res) => {
    try {
        const { name, description, teacher, students, year, semester, yearLabel, gradingScheme, curriculumModules, references } = req.body;
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Authorization: only Admin or assigned Teacher can update
        const isTeacherUser = req.user.role === 'Teacher';
        if (isTeacherUser) {
            const isDirectMatch = course.teacher && course.teacher.toString() === req.user._id.toString();
            if (!isDirectMatch) {
                const assignedTeacher = course.teacher ? await User.findById(course.teacher) : null;
                const stripHonorific = (n = '') => n.replace(/^(daw|u|dr|prof|tr)\.?\s+/i, '').trim().toLowerCase();
                const userNameClean = stripHonorific(req.user.name);
                const assignedNameClean = assignedTeacher ? stripHonorific(assignedTeacher.name) : '';
                if (!userNameClean || userNameClean !== assignedNameClean) {
                    return res.status(403).json({ message: 'Not authorized to update this course' });
                }
            }
        }

        course.name = name || course.name;
        course.description = description !== undefined ? description : course.description;
        if (year !== undefined) course.year = year;
        if (semester !== undefined) course.semester = semester;
        if (yearLabel !== undefined) course.yearLabel = yearLabel;
        if (['Admin', 'SuperAdmin', 'academicadmin'].includes(req.user.role)) {
            course.teacher = teacher || course.teacher;
        }
        if (students !== undefined) course.students = students;
        if (gradingScheme !== undefined) course.gradingScheme = gradingScheme;
        if (curriculumModules !== undefined) course.curriculumModules = curriculumModules;
        if (references !== undefined) course.references = references;

        const updatedCourse = await course.save();
        res.json(updatedCourse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Admin, Teacher if their course)
const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (course) {
            // Authorization: only Admin or assigned Teacher can delete
            if (req.user.role === 'Teacher' && course.teacher?.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to delete this course' });
            }

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
    syncCourseCollectionWithTimetable,
};
