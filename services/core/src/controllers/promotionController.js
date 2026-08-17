const mongoose = require('mongoose');
const AcademicEnrollment = require('../models/AcademicEnrollment');
const User = require('../models/User');
const PromotionJob = require('../models/PromotionJob');
const AuditLog = require('../models/AuditLog');
const AcademicSettings = require('../models/AcademicSettings');
const AcademicConfig = require('../models/AcademicConfig');

const Student = require('../models/Student');

// Helper to normalize year string to number (1-6)
const getYearNumber = (lvl) => {
    const s = String(lvl || '').toUpperCase().trim();
    if (s.includes('6') || s.includes('VI') || s.includes('SIXTH') || s.includes('FINAL')) return 6;
    if (s.includes('5') || s.includes('FIFTH') || s.includes('(V)') || s.match(/\bV\b/)) return 5;
    if (s.includes('4') || s.includes('FOURTH') || s.includes('IV')) return 4;
    if (s.includes('3') || s.includes('THIRD') || s.includes('III')) return 3;
    if (s.includes('2') || s.includes('SECOND') || s.includes('II')) return 2;
    if (s.includes('1') || s.includes('FIRST') || s.includes('I')) return 1;
    const m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : 5;
};

// Helper to advance year level string (e.g. "5th Year" -> "6th Year")
const getNextYearLevel = (currentLevel) => {
    const num = getYearNumber(currentLevel);
    const nextNum = num + 1;
    const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year', 7: 'Graduated' };
    return labels[nextNum] || `${nextNum}th Year`;
};

// Extract true year number (1-6) from Student and User documents
const extractStudentYearNum = (studentDoc, userDoc) => {
    const rawYr = String(userDoc?.year || userDoc?.currentYear || '').toUpperCase();
    if (rawYr.includes('6') || rawYr.includes('VI') || rawYr.includes('SIXTH') || rawYr.includes('FINAL')) return 6;
    if (rawYr.includes('5') || rawYr.includes('FIFTH') || rawYr.includes('(V)') || rawYr.match(/\bV\b/)) return 5;
    if (rawYr.includes('4') || rawYr.includes('FOURTH') || rawYr.includes('IV')) return 4;
    if (rawYr.includes('3') || rawYr.includes('THIRD') || rawYr.includes('III')) return 3;
    if (rawYr.includes('2') || rawYr.includes('SECOND') || rawYr.includes('II')) return 2;
    if (rawYr.includes('1') || rawYr.includes('FIRST') || rawYr.includes('I')) return 1;

    const roll = String(studentDoc?.enrollmentNumber || userDoc?.rollNo || userDoc?.currentRollNo || '').toUpperCase();
    if (roll.startsWith('VI-') || roll.startsWith('6-')) return 6;
    if (roll.startsWith('V-') || roll.startsWith('5-')) return 5;
    if (roll.startsWith('IV-') || roll.startsWith('4-')) return 4;
    if (roll.startsWith('III-') || roll.startsWith('3-')) return 3;
    if (roll.startsWith('II-') || roll.startsWith('2-')) return 2;
    if (roll.startsWith('I-') || roll.startsWith('1-')) return 1;

    if (studentDoc?.semester) {
        return Math.min(6, Math.max(1, Math.ceil(Number(studentDoc.semester) / 2)));
    }

    const email = String(userDoc?.email || '').toLowerCase();
    if (email.startsWith('vimc') || email.startsWith('6mc') || email.startsWith('vi.')) return 6;
    if (email.startsWith('vmc') || email.startsWith('5mc') || email.startsWith('v.')) return 5;
    if (email.startsWith('ivmc') || email.startsWith('4mc') || email.startsWith('iv.')) return 4;
    if (email.startsWith('iiimc') || email.startsWith('3mc') || email.startsWith('iii.')) return 3;
    if (email.startsWith('iimc') || email.startsWith('2mc') || email.startsWith('ii.')) return 2;
    if (email.startsWith('imc') || email.startsWith('1mc') || email.startsWith('i.')) return 1;

    return 1;
};

// ─────────────────────────────────────────────
// POST /api/promotions/preview
// ─────────────────────────────────────────────
const previewPromotion = async (req, res) => {
    try {
        const { fromYear, toYear, cohortYearLevel, department } = req.body;

        if (!fromYear || !cohortYearLevel) {
            return res.status(400).json({ message: 'fromYear and cohortYearLevel are required' });
        }

        const cohortNum = getYearNumber(cohortYearLevel);

        // Determine next academic year if not provided
        let targetYear = toYear;
        if (!targetYear) {
            const parts = fromYear.split('-');
            if (parts.length === 2 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
                targetYear = `${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`;
            } else {
                targetYear = '2026-2027';
            }
        }

        // Read threshold from AcademicSettings - never hardcoded
        const threshold = await AcademicSettings.getSetting(
            'attendanceQualificationThreshold',
            department || null,
            75
        );

        // 1. Try finding from AcademicEnrollment
        const enrollFilter = {
            academicYear: fromYear,
            $or: [
                { yearLevel: cohortYearLevel },
                { yearLevel: new RegExp(`^${cohortNum}`, 'i') }
            ]
        };
        if (department && department !== 'All') {
            enrollFilter.department = new RegExp(`^${department}$`, 'i');
        }

        let enrollments = await AcademicEnrollment.find(enrollFilter)
            .populate('student', 'name email permanentRegNo currentRollNo rollNo accountStatus year department')
            .sort({ rollNo: 1 });

        let students = [];

        if (enrollments && enrollments.length > 0) {
            const isFinalYear = cohortNum >= 6;
            students = enrollments.map(e => {
                const s = e.student;
                const rate = typeof e.attendanceRate === 'number' ? e.attendanceRate : 85;
                const isQualified = rate >= threshold;

                let suggestedAction = 'Promote';
                if (!isQualified) {
                    suggestedAction = 'HoldBack';
                } else if (isFinalYear) {
                    suggestedAction = 'Graduate';
                }

                return {
                    enrollmentId: e._id,
                    studentId: s?._id,
                    name: s?.name || 'Unknown',
                    email: s?.email,
                    permanentRegNo: s?.permanentRegNo || 'N/A',
                    currentRollNo: e.rollNo || s?.currentRollNo || s?.rollNo || 'Not yet assigned',
                    department: e.department || s?.department || 'Mechatronics Engineering',
                    attendanceRate: rate,
                    isQualified,
                    threshold,
                    suggestedAction,
                    targetYearLevel: suggestedAction === 'Promote' ? getNextYearLevel(cohortYearLevel) : cohortYearLevel,
                };
            });
        } else {
            // 2. Fallback: Query all students from Student model populated with User
            const allStudents = await Student.find().populate('user', 'name email permanentRegNo currentRollNo currentYear rollNo status department year');

            const matchedStudents = allStudents.filter(s => {
                const u = s.user;
                if (!u || u.status === 'Deactivated') return false;

                // Department match
                if (department && department !== 'All') {
                    const deptStr = String(s.department || u.department || '').toLowerCase();
                    const filterDept = String(department).toLowerCase();
                    if (!deptStr.includes(filterDept.split(' ')[0])) return false;
                }

                // Year level match
                const sYr = extractStudentYearNum(s, u);
                if (sYr !== cohortNum) return false;

                return true;
            });

            const isFinalYear = cohortNum >= 6;

            students = matchedStudents.map(s => {
                const u = s.user;
                const rate = 88; // Default qualified attendance
                const isQualified = rate >= threshold;

                let suggestedAction = 'Promote';
                if (!isQualified) {
                    suggestedAction = 'HoldBack';
                } else if (isFinalYear) {
                    suggestedAction = 'Graduate';
                }

                return {
                    enrollmentId: null,
                    studentId: u._id,
                    name: u.name,
                    email: u.email,
                    permanentRegNo: u.permanentRegNo || 'N/A',
                    currentRollNo: s.enrollmentNumber || u.rollNo || u.currentRollNo || 'Not yet assigned',
                    department: s.department || u.department || 'Mechatronics Engineering',
                    attendanceRate: rate,
                    isQualified,
                    threshold,
                    suggestedAction,
                    targetYearLevel: suggestedAction === 'Promote' ? getNextYearLevel(cohortYearLevel) : cohortYearLevel,
                };
            });

            // Also check standalone User records if any
            if (students.length < 5) {
                const standaloneUsers = await User.find({
                    role: 'Student',
                    status: { $ne: 'Deactivated' }
                });

                for (const u of standaloneUsers) {
                    const uYr = extractStudentYearNum(null, u);
                    if (uYr === cohortNum && !students.some(st => st.studentId?.toString() === u._id.toString())) {
                        const rate = 88;
                        const isQualified = rate >= threshold;
                        let suggestedAction = 'Promote';
                        if (!isQualified) suggestedAction = 'HoldBack';
                        else if (isFinalYear) suggestedAction = 'Graduate';

                        students.push({
                            enrollmentId: null,
                            studentId: u._id,
                            name: u.name,
                            email: u.email,
                            permanentRegNo: u.permanentRegNo || 'N/A',
                            currentRollNo: u.rollNo || u.currentRollNo || 'Not yet assigned',
                            department: u.department || 'Mechatronics Engineering',
                            attendanceRate: rate,
                            isQualified,
                            threshold,
                            suggestedAction,
                            targetYearLevel: suggestedAction === 'Promote' ? getNextYearLevel(cohortYearLevel) : cohortYearLevel,
                        });
                    }
                }
            }
        }

        res.json({
            fromYear,
            toYear: targetYear,
            cohortYearLevel,
            department: department || 'All',
            attendanceThreshold: threshold,
            totalStudents: students.length,
            qualifiedCount: students.filter(s => s.isQualified).length,
            notQualifiedCount: students.filter(s => !s.isQualified).length,
            students,
        });
    } catch (error) {
        console.error('previewPromotion error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/promotions/execute
// Safe Batch Promotion Execution with Concurrency Guard & Resumable Jobs
// ─────────────────────────────────────────────
const executePromotion = async (req, res) => {
    try {
        const { runId: clientRunId, fromYear, toYear, cohortYearLevel, decisions } = req.body;

        if (!fromYear || !toYear || !Array.isArray(decisions) || decisions.length === 0) {
            return res.status(400).json({ message: 'fromYear, toYear, and decisions array are required' });
        }

        const runId = clientRunId || new mongoose.Types.ObjectId().toString();

        // 1. Concurrency Guard: Check for any existing active/pending run
        const activeJob = await PromotionJob.findOne({
            status: 'Pending',
            runId: { $ne: runId },
        });

        if (activeJob) {
            return res.status(409).json({
                message: `Conflict: Another promotion batch run (${activeJob.runId}) is currently in progress. Please wait for it to complete.`,
            });
        }

        // 2. Create or verify PromotionJob rows for each student
        const jobRows = [];
        for (const d of decisions) {
            const { studentId, enrollmentId, action } = d;
            let job = await PromotionJob.findOne({ runId, student: studentId });
            if (!job) {
                job = await PromotionJob.create({
                    runId,
                    student: studentId,
                    fromEnrollmentId: enrollmentId || null,
                    action: action || 'Promote',
                    status: 'Pending',
                });
            }
            jobRows.push(job);
        }

        let promotedCount = 0;
        let heldBackCount = 0;
        let graduatedCount = 0;
        let withdrawnCount = 0;
        let failedCount = 0;

        const results = [];

        // 3. Process each job row
        for (const job of jobRows) {
            if (job.status === 'Done') {
                results.push({ studentId: job.student, action: job.action, status: 'Done' });
                continue;
            }

            try {
                const student = await User.findById(job.student);
                if (!student) {
                    throw new Error(`Student user record ${job.student} not found`);
                }

                // Resolve source enrollment
                let sourceEnrollment = null;
                if (job.fromEnrollmentId) {
                    sourceEnrollment = await AcademicEnrollment.findById(job.fromEnrollmentId);
                } else {
                    sourceEnrollment = await AcademicEnrollment.findOne({ student: student._id, academicYear: fromYear });
                }

                const dept = sourceEnrollment?.department || student.department || 'Mechatronics Engineering';
                const currentLevel = sourceEnrollment?.yearLevel || cohortYearLevel || student.currentYear || '5th Year';

                if (job.action === 'Promote') {
                    const nextLevel = getNextYearLevel(currentLevel);

                    if (sourceEnrollment) {
                        sourceEnrollment.status = 'Completed';
                        await sourceEnrollment.save();
                    }

                    // Create new AcademicEnrollment for next year (rollNo starts NULL)
                    let newEnrollment = await AcademicEnrollment.findOne({
                        student: student._id,
                        academicYear: toYear,
                    });

                    if (!newEnrollment) {
                        newEnrollment = await AcademicEnrollment.create({
                            student: student._id,
                            academicYear: toYear,
                            yearLevel: nextLevel,
                            department: dept,
                            rollNo: null, // Nullable at year start
                            attendanceRate: 0,
                            status: 'Active',
                        });
                    }

                    // Update User denormalized state
                    student.currentYear = nextLevel;
                    student.currentRollNo = null;
                    student.year = nextLevel;
                    student.rollNo = null;
                    student.accountStatus = 'Active';
                    await student.save();

                    // Update Student collection if exists
                    const studentDoc = await Student.findOne({ user: student._id });
                    if (studentDoc) {
                        const nextSem = (getYearNumber(nextLevel) - 1) * 2 + 1;
                        studentDoc.semester = nextSem;
                        studentDoc.status = 'Active';
                        await studentDoc.save();
                    }

                    job.toEnrollmentId = newEnrollment._id;
                    job.status = 'Done';
                    job.error = null;
                    await job.save();
                    promotedCount++;

                } else if (job.action === 'HoldBack') {
                    if (sourceEnrollment) {
                        sourceEnrollment.status = 'Held Back';
                        await sourceEnrollment.save();
                    }

                    // Create enrollment repeating current year level
                    let newEnrollment = await AcademicEnrollment.findOne({
                        student: student._id,
                        academicYear: toYear,
                    });

                    if (!newEnrollment) {
                        newEnrollment = await AcademicEnrollment.create({
                            student: student._id,
                            academicYear: toYear,
                            yearLevel: currentLevel,
                            department: dept,
                            rollNo: null,
                            attendanceRate: 0,
                            status: 'Active',
                        });
                    }

                    student.currentRollNo = null;
                    student.rollNo = null;
                    await student.save();

                    job.toEnrollmentId = newEnrollment._id;
                    job.status = 'Done';
                    job.error = null;
                    await job.save();
                    heldBackCount++;

                } else if (job.action === 'Graduate') {
                    if (sourceEnrollment) {
                        sourceEnrollment.status = 'Completed';
                        await sourceEnrollment.save();
                    }

                    student.accountStatus = 'Graduated';
                    student.status = 'Graduated';
                    student.currentRollNo = null;
                    student.rollNo = null;
                    await student.save();

                    const studentDoc = await Student.findOne({ user: student._id });
                    if (studentDoc) {
                        studentDoc.status = 'Graduated';
                        await studentDoc.save();
                    }

                    job.status = 'Done';
                    job.error = null;
                    await job.save();
                    graduatedCount++;

                } else if (job.action === 'Withdraw') {
                    if (sourceEnrollment) {
                        sourceEnrollment.status = 'Withdrawn';
                        await sourceEnrollment.save();
                    }

                    student.accountStatus = 'Withdrawn';
                    student.status = 'Withdrawn';
                    student.currentRollNo = null;
                    student.rollNo = null;
                    await student.save();

                    const studentDoc = await Student.findOne({ user: student._id });
                    if (studentDoc) {
                        studentDoc.status = 'Suspended';
                        await studentDoc.save();
                    }

                    job.status = 'Done';
                    job.error = null;
                    await job.save();
                    withdrawnCount++;
                    await job.save();
                    withdrawnCount++;
                }

                results.push({ studentId: student._id, name: student.name, action: job.action, status: 'Done' });

            } catch (jobErr) {
                console.error(`Promotion error for student ${job.student}:`, jobErr.message);
                job.status = 'Failed';
                job.error = jobErr.message;
                await job.save();
                failedCount++;
                results.push({ studentId: job.student, action: job.action, status: 'Failed', error: jobErr.message });
            }
        }

        // 4. Write summary AuditLog
        await AuditLog.create({
            action: 'PromotionEngineRun',
            performedBy: req.user._id,
            academicYear: toYear,
            details: {
                runId,
                fromYear,
                toYear,
                cohortYearLevel,
                totalProcessed: decisions.length,
                promoted: promotedCount,
                heldBack: heldBackCount,
                graduated: graduatedCount,
                withdrawn: withdrawnCount,
                failed: failedCount,
            },
        });

        res.json({
            success: failedCount === 0,
            runId,
            fromYear,
            toYear,
            totalProcessed: decisions.length,
            promoted: promotedCount,
            heldBack: heldBackCount,
            graduated: graduatedCount,
            withdrawn: withdrawnCount,
            failed: failedCount,
            results,
        });

    } catch (error) {
        console.error('executePromotion error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/promotions/audit-logs
// ─────────────────────────────────────────────
const getPromotionAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const total = await AuditLog.countDocuments({ action: 'PromotionEngineRun' });
        const logs = await AuditLog.find({ action: 'PromotionEngineRun' })
            .populate('performedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            logs,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
        });
    } catch (error) {
        console.error('getPromotionAuditLogs error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/promotions/runs/:runId
// ─────────────────────────────────────────────
const getPromotionRunStatus = async (req, res) => {
    try {
        const { runId } = req.params;
        const jobs = await PromotionJob.find({ runId })
            .populate('student', 'name email permanentRegNo currentRollNo')
            .populate('fromEnrollmentId', 'yearLevel academicYear department rollNo')
            .populate('toEnrollmentId', 'yearLevel academicYear department rollNo');

        if (!jobs || jobs.length === 0) {
            return res.status(404).json({ message: 'Promotion run not found' });
        }

        const summary = {
            runId,
            total: jobs.length,
            done: jobs.filter(j => j.status === 'Done').length,
            pending: jobs.filter(j => j.status === 'Pending').length,
            failed: jobs.filter(j => j.status === 'Failed').length,
        };

        res.json({
            summary,
            jobs,
        });
    } catch (error) {
        console.error('getPromotionRunStatus error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/promotions/settings & PUT /api/promotions/settings
// ─────────────────────────────────────────────
const getAcademicSettingsList = async (req, res) => {
    try {
        const settings = await AcademicSettings.find({}).sort({ key: 1 });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAcademicSetting = async (req, res) => {
    try {
        const { key, value, department } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ message: 'key and value are required' });
        }

        const setting = await AcademicSettings.findOneAndUpdate(
            { key, department: department || null },
            { $set: { value, updatedBy: req.user._id, updatedAt: new Date() } },
            { upsert: true, new: true }
        );

        res.json({ success: true, setting });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    previewPromotion,
    executePromotion,
    getPromotionAuditLogs,
    getPromotionRunStatus,
    getAcademicSettingsList,
    updateAcademicSetting,
};
