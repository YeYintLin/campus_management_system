const mongoose = require('mongoose');
const axios = require('axios');
const AcademicEnrollment = require('../models/AcademicEnrollment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const AcademicSettings = require('../models/AcademicSettings');
const AcademicConfig = require('../models/AcademicConfig');

const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:5003';
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'cms-internal-secret-token';

// ─────────────────────────────────────────────
// POST /api/enrollments/recalculate-attendance
// Internal service endpoint (and admin backup)
// ─────────────────────────────────────────────
const recalculateAttendance = async (req, res) => {
    try {
        const internalToken = req.headers['x-internal-service-token'];
        const isInternalAuth = internalToken && internalToken === INTERNAL_SERVICE_SECRET;
        const isAdminAuth = req.user && ['admin', 'superadmin', 'academicadmin'].includes((req.user.role || '').toLowerCase());

        if (!isInternalAuth && !isAdminAuth) {
            return res.status(403).json({ message: 'Forbidden: Invalid internal service credentials' });
        }

        const { studentId, academicYear: providedYear } = req.body;
        if (!studentId) {
            return res.status(400).json({ message: 'studentId is required' });
        }

        // Determine target academic year
        let academicYear = providedYear;
        if (!academicYear) {
            const config = await AcademicConfig.findOne();
            academicYear = config?.currentAcademicYear || '2025-2026';
        }

        // Fetch attendance records for this student from attendance service
        let totalSessions = 0;
        let presentCount = 0;

        try {
            const attRes = await axios.get(`${ATTENDANCE_SERVICE_URL}/api/attendance`, {
                params: { student: studentId },
                headers: { 'x-internal-service-token': INTERNAL_SECRET },
                timeout: 4000,
            });

            const records = Array.isArray(attRes.data) ? attRes.data : [];
            for (const record of records) {
                if (record.records && Array.isArray(record.records)) {
                    for (const r of record.records) {
                        const sid = r.studentId?._id?.toString() || r.studentId?.toString();
                        if (sid === studentId.toString()) {
                            totalSessions++;
                            if (r.status === 'Present' || r.status === 'Late') {
                                presentCount++;
                            }
                        }
                    }
                }
            }
        } catch (fetchErr) {
            console.error(`recalculateAttendance fetch error for student ${studentId}:`, fetchErr.message);
        }

        const attendanceRate = totalSessions > 0
            ? Math.round((presentCount / totalSessions) * 100 * 10) / 10
            : 0;

        // Atomic update on AcademicEnrollment to prevent race conditions
        const updatedEnrollment = await AcademicEnrollment.findOneAndUpdate(
            { student: studentId, academicYear },
            { $set: { attendanceRate } },
            { new: true }
        );

        res.json({
            success: true,
            studentId,
            academicYear,
            totalSessions,
            presentCount,
            attendanceRate,
            enrollmentId: updatedEnrollment?._id,
        });
    } catch (error) {
        console.error('recalculateAttendance error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

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
// GET /api/enrollments
// Paginated & Filtered Enrollments (Admin view)
// ─────────────────────────────────────────────
const getEnrollments = async (req, res) => {
    try {
        const {
            academicYear,
            department,
            yearLevel,
            unassignedOnly,
            search,
            page = 1,
            limit = 100,
        } = req.query;

        const targetYearNum = yearLevel && yearLevel !== 'All' ? getYearNumber(yearLevel) : null;
        const targetYearLabel = targetYearNum ? `${targetYearNum}th Year` : null;

        const filter = {};
        if (academicYear) filter.academicYear = academicYear;
        if (department && department !== 'All') filter.department = new RegExp(`^${department}$`, 'i');
        if (targetYearNum) {
            filter.$or = [
                { yearLevel: yearLevel },
                { yearLevel: new RegExp(`^(${targetYearNum}|${targetYearNum}th|Fifth|Fourth|Third|Second|First|Final|VI|IV|III|II|I|V)`, 'i') }
            ];
        }
        if (unassignedOnly === 'true' || unassignedOnly === true) {
            filter.rollNo = { $in: [null, '', undefined] };
        }

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        // 1. Query existing AcademicEnrollment records
        let enrollments = await AcademicEnrollment.find(filter)
            .populate('student', 'name email permanentRegNo currentRollNo currentYear rollNo status department year')
            .populate('rollNoAssignedBy', 'name email')
            .sort({ rollNo: 1, name: 1 });

        // 2. If enrollments is empty, dynamically auto-populate from Student and User collections
        if (!enrollments || enrollments.length === 0) {
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
                if (targetYearNum) {
                    const sYr = extractStudentYearNum(s, u);
                    if (sYr !== targetYearNum) return false;
                }

                // Unassigned filter
                const currentRoll = s.enrollmentNumber || u.rollNo || u.currentRollNo;
                if ((unassignedOnly === 'true' || unassignedOnly === true) && currentRoll) {
                    return false;
                }

                return true;
            });

            const createdEnrollments = [];
            for (const s of matchedStudents) {
                const u = s.user;
                let existing = await AcademicEnrollment.findOne({
                    student: u._id,
                    academicYear: academicYear || '2025-2026'
                });
                if (!existing) {
                    existing = await AcademicEnrollment.create({
                        student: u._id,
                        academicYear: academicYear || '2025-2026',
                        yearLevel: targetYearLabel || u.year || '5th Year',
                        department: s.department || u.department || department || 'Mechatronics Engineering',
                        rollNo: s.enrollmentNumber || u.rollNo || u.currentRollNo || null,
                        status: 'Active',
                        attendanceRate: 85
                    });
                }
                existing.student = u;
                createdEnrollments.push(existing);
            }
            enrollments = createdEnrollments;
        }

        // Also check if any standalone Student users without Student doc exist
        if (targetYearNum && enrollments.length < 5) {
            const standaloneUsers = await User.find({
                role: 'Student',
                status: { $ne: 'Deactivated' }
            });

            for (const u of standaloneUsers) {
                const uYr = extractStudentYearNum(null, u);
                if (uYr === targetYearNum && !enrollments.some(e => e.student?._id?.toString() === u._id.toString())) {
                    let existing = await AcademicEnrollment.findOne({
                        student: u._id,
                        academicYear: academicYear || '2025-2026'
                    });
                    if (!existing) {
                        existing = await AcademicEnrollment.create({
                            student: u._id,
                            academicYear: academicYear || '2025-2026',
                            yearLevel: targetYearLabel || u.year || '5th Year',
                            department: u.department || department || 'Mechatronics Engineering',
                            rollNo: u.rollNo || u.currentRollNo || null,
                            status: 'Active',
                            attendanceRate: 85
                        });
                    }
                    existing.student = u;
                    enrollments.push(existing);
                }
            }
        }

        // Optional search by student name / email / permanentRegNo / rollNo
        if (search && search.trim()) {
            const query = search.trim().toLowerCase();
            enrollments = enrollments.filter(e => {
                const s = e.student;
                return (
                    s?.name?.toLowerCase().includes(query) ||
                    s?.email?.toLowerCase().includes(query) ||
                    s?.permanentRegNo?.toLowerCase().includes(query) ||
                    e.rollNo?.toLowerCase().includes(query) ||
                    s?.rollNo?.toLowerCase().includes(query)
                );
            });
        }

        const total = enrollments.length;
        const paginated = enrollments.slice(skip, skip + limitNum);

        res.json({
            enrollments: paginated,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
        });
    } catch (error) {
        console.error('getEnrollments error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/enrollments/assign-roll-numbers
// Bulk or Single Roll Number Assignment
// ─────────────────────────────────────────────
const assignRollNumbers = async (req, res) => {
    try {
        const { assignments } = req.body;
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ message: 'assignments array is required' });
        }

        const adminId = req.user._id;
        const results = [];
        let successfulCount = 0;
        let failedCount = 0;

        for (let i = 0; i < assignments.length; i++) {
            const item = assignments[i];
            const { enrollmentId, studentId, rollNo, academicYear, department } = item;
            const rowIndex = i + 1;

            if (!rollNo || !rollNo.trim()) {
                results.push({
                    row: rowIndex,
                    studentId,
                    enrollmentId,
                    status: 'error',
                    message: 'Roll number cannot be empty',
                });
                failedCount++;
                continue;
            }

            const cleanRollNo = rollNo.trim().toUpperCase();

            // Find enrollment
            let enrollment = null;
            if (enrollmentId) {
                enrollment = await AcademicEnrollment.findById(enrollmentId);
            } else if (studentId && academicYear) {
                enrollment = await AcademicEnrollment.findOne({ student: studentId, academicYear });
            }

            // If enrollment didn't exist yet, auto-create it from User record
            if (!enrollment && studentId) {
                const sUser = await User.findById(studentId);
                if (sUser) {
                    enrollment = await AcademicEnrollment.create({
                        student: studentId,
                        academicYear: academicYear || '2025-2026',
                        yearLevel: sUser.year || sUser.currentYear || '5th Year',
                        department: department || sUser.department || 'Mechatronics Engineering',
                        rollNo: cleanRollNo,
                        status: 'Active',
                        rollNoAssignedAt: new Date(),
                        rollNoAssignedBy: adminId,
                    });
                }
            }

            if (!enrollment) {
                results.push({
                    row: rowIndex,
                    studentId,
                    rollNo: cleanRollNo,
                    status: 'error',
                    message: 'Enrollment record not found for student in academic year',
                });
                failedCount++;
                continue;
            }

            // Validate duplicate roll number in same academicYear + department
            const targetDept = department || enrollment.department;
            const targetYear = academicYear || enrollment.academicYear;

            const existingDuplicate = await AcademicEnrollment.findOne({
                _id: { $ne: enrollment._id },
                academicYear: targetYear,
                department: new RegExp(`^${targetDept}$`, 'i'),
                rollNo: cleanRollNo,
            });

            if (existingDuplicate) {
                results.push({
                    row: rowIndex,
                    studentId: enrollment.student,
                    enrollmentId: enrollment._id,
                    rollNo: cleanRollNo,
                    status: 'error',
                    message: `Roll number "${cleanRollNo}" is already assigned to another student in ${targetDept} (${targetYear})`,
                });
                failedCount++;
                continue;
            }

            // Assign roll number
            const prevRollNo = enrollment.rollNo;
            enrollment.rollNo = cleanRollNo;
            enrollment.rollNoAssignedAt = new Date();
            enrollment.rollNoAssignedBy = adminId;
            await enrollment.save();

            // Update User denormalized currentRollNo and rollNo
            await User.findByIdAndUpdate(enrollment.student, {
                currentRollNo: cleanRollNo,
                rollNo: cleanRollNo,
            });

            // Update Student profile record if exists
            await Student.findOneAndUpdate(
                { user: enrollment.student },
                { $set: { enrollmentNumber: cleanRollNo } }
            );

            // Write AuditLog
            await AuditLog.create({
                action: 'RollNumberAssigned',
                performedBy: adminId,
                targetStudent: enrollment.student,
                academicYear: targetYear,
                details: {
                    enrollmentId: enrollment._id,
                    department: targetDept,
                    previousRollNo: prevRollNo,
                    assignedRollNo: cleanRollNo,
                },
            });

            results.push({
                row: rowIndex,
                studentId: enrollment.student,
                enrollmentId: enrollment._id,
                rollNo: cleanRollNo,
                status: 'ok',
                message: 'Successfully assigned',
            });
            successfulCount++;
        }

        res.json({
            message: `Processed ${assignments.length} assignments: ${successfulCount} succeeded, ${failedCount} failed`,
            totalProcessed: assignments.length,
            successful: successfulCount,
            failed: failedCount,
            results,
        });
    } catch (error) {
        console.error('assignRollNumbers error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/enrollments/:id/reassign-roll-number
// Correction / Reassignment flow with required reason
// ─────────────────────────────────────────────
const reassignRollNumber = async (req, res) => {
    try {
        const { id } = req.params;
        const { newRollNo, reason } = req.body;

        if (!newRollNo || !newRollNo.trim()) {
            return res.status(400).json({ message: 'newRollNo is required' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'A valid reason is required for roll number correction' });
        }

        const enrollment = await AcademicEnrollment.findById(id);
        if (!enrollment) {
            return res.status(404).json({ message: 'Academic enrollment not found' });
        }

        const cleanNewRollNo = newRollNo.trim().toUpperCase();

        // Check duplicate
        const duplicate = await AcademicEnrollment.findOne({
            _id: { $ne: enrollment._id },
            academicYear: enrollment.academicYear,
            department: new RegExp(`^${enrollment.department}$`, 'i'),
            rollNo: cleanNewRollNo,
        });

        if (duplicate) {
            return res.status(400).json({
                message: `Roll number "${cleanNewRollNo}" is already assigned to another student in ${enrollment.department} (${enrollment.academicYear})`,
            });
        }

        const previousRollNo = enrollment.rollNo;
        enrollment.rollNo = cleanNewRollNo;
        enrollment.rollNoAssignedAt = new Date();
        enrollment.rollNoAssignedBy = req.user._id;
        await enrollment.save();

        // Update User
        await User.findByIdAndUpdate(enrollment.student, {
            currentRollNo: cleanNewRollNo,
            rollNo: cleanNewRollNo,
        });

        // Write AuditLog for RollNumberCorrected
        await AuditLog.create({
            action: 'RollNumberCorrected',
            performedBy: req.user._id,
            targetStudent: enrollment.student,
            academicYear: enrollment.academicYear,
            details: {
                enrollmentId: enrollment._id,
                department: enrollment.department,
                previousRollNo,
                newRollNo: cleanNewRollNo,
                reason: reason.trim(),
            },
        });

        res.json({
            success: true,
            message: `Roll number corrected from "${previousRollNo || 'Unassigned'}" to "${cleanNewRollNo}"`,
            enrollment,
        });
    } catch (error) {
        console.error('reassignRollNumber error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    recalculateAttendance,
    getEnrollments,
    assignRollNumbers,
    reassignRollNumber,
};
