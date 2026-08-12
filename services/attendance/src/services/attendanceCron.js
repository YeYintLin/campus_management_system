const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const SessionOverride = require('../models/SessionOverride');
const axios = require('axios');

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:5002';
const CODE_VALIDITY_SECONDS = 20; // 20 seconds live window for QR/Passcode

// Generate random 4-digit code (e.g. "4829")
const generate4DigitCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

// Convert Date to day name string (e.g. "Monday")
const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
};

// Check and expire stale active sessions & mark unsubmitted students as Absent
const autoExpireSessions = async () => {
    try {
        const now = new Date();
        
        // 1. Mark sessions past expiresAt as expired
        await AttendanceSession.updateMany(
            { status: 'active', expiresAt: { $lt: now } },
            { status: 'expired' }
        );

        // 2. Finalize un-finalized expired sessions: mark all unsubmitted enrolled students as Absent
        const expiredSessions = await AttendanceSession.find({
            status: 'expired',
            finalized: { $ne: true }
        });

        for (const session of expiredSessions) {
            try {
                // Fetch course details to get enrolled students
                const response = await axios.get(`${CORE_SERVICE_URL}/api/courses/${session.courseId}`, {
                    timeout: 5000
                });

                const enrolledStudents = response.data?.students || [];

                if (enrolledStudents.length > 0) {
                    const sessionDate = new Date(session.createdAt || now);
                    const todayStart = new Date(sessionDate);
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date(sessionDate);
                    todayEnd.setHours(23, 59, 59, 999);

                    let attendanceRecord = await Attendance.findOne({
                        courseId: session.courseId,
                        date: { $gte: todayStart, $lte: todayEnd }
                    });

                    if (!attendanceRecord) {
                        attendanceRecord = new Attendance({
                            courseId: session.courseId,
                            date: todayStart,
                            records: []
                        });
                    }

                    // For each enrolled student, if no record exists, mark as Absent
                    enrolledStudents.forEach(st => {
                        const sId = (st._id || st).toString();
                        const exists = attendanceRecord.records.some(r => r.studentId.toString() === sId);
                        if (!exists) {
                            attendanceRecord.records.push({
                                studentId: sId,
                                status: 'Absent'
                            });
                        }
                    });

                    await attendanceRecord.save();
                }

                session.finalized = true;
                await session.save();
                console.log(`[Auto-Attendance] Finalized 20s session for ${session.courseId}. Unsubmitted students marked Absent.`);
            } catch (err) {
                console.error(`Error finalizing session ${session._id}:`, err.message);
                session.finalized = true;
                await session.save();
            }
        }
    } catch (err) {
        console.error('Error auto-expiring attendance sessions:', err.message);
    }
};

// Main trigger loop
const checkAndTriggerAttendance = async () => {
    try {
        await autoExpireSessions();

        const now = new Date();
        const currentDay = getDayName(now);

        // Fetch all timetable slots from Core service
        let timetableSlots = [];
        try {
            const res = await axios.get(`${CORE_SERVICE_URL}/api/timetable`, {
                params: { day: currentDay },
                timeout: 5000,
            });
            timetableSlots = Array.isArray(res.data) ? res.data : [];
        } catch (err) {
            console.error('AttendanceCron: Failed to fetch timetable from Core service:', err.message);
            return;
        }

        if (timetableSlots.length === 0) return;

        // Check each slot to see if class is ending in ~10 minutes
        for (const slot of timetableSlots) {
            if (!slot.course) continue;

            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);

            // 1. Check for Session Override (cancellations/reschedules)
            const override = await SessionOverride.findOne({
                courseCode: slot.course,
                originalDate: { $gte: todayStart, $lte: todayEnd },
                type: { $in: ['cancelled', 'rescheduled'] },
            });

            if (override) continue; // Skip — class is cancelled or moved

            // 2. Check if a session was already generated today for this course
            const existingSession = await AttendanceSession.findOne({
                courseId: slot.course,
                createdAt: { $gte: todayStart, $lte: todayEnd },
            });

            if (existingSession) continue; // Skip — already triggered today

            // 3. Time calculation: parse slot end time or trigger window
            // If slot.time is like "09:00 - 10:00" or "10:00 AM"
            const timeParts = slot.time.split('-');
            const endTimeStr = timeParts[1] ? timeParts[1].trim() : timeParts[0].trim();

            const [hours, minutes] = endTimeStr.replace(/[^0-9:]/g, '').split(':').map(Number);
            if (isNaN(hours)) continue;

            const classEndTime = new Date(now);
            classEndTime.setHours(hours, minutes || 0, 0, 0);

            const diffMinutes = (classEndTime.getTime() - now.getTime()) / (1000 * 60);

            // Trigger code if class ends within 0 to 12 minutes from now
            if (diffMinutes >= 0 && diffMinutes <= 12) {
                const code = generate4DigitCode();
                const crypto = require('crypto');
                const qrToken = crypto.randomBytes(16).toString('hex');
                const expiresAt = new Date(now.getTime() + CODE_VALIDITY_SECONDS * 1000);

                await AttendanceSession.create({
                    courseId: slot.course,
                    courseName: slot.course,
                    department: slot.department || 'Mechatronics Engineering',
                    year: slot.year || '',
                    code,
                    qrToken,
                    generatedAt: now,
                    expiresAt,
                    status: 'active',
                    createdBy: 'auto-cron',
                });

                console.log(`[Auto-Attendance] Generated Code ${code} for ${slot.course} (Expires at ${expiresAt.toLocaleTimeString()})`);
            }
        }
    } catch (err) {
        console.error('AttendanceCron check error:', err.message);
    }
};

// Start the cron engine loop (runs every 5 seconds for 20s sessions)
const startAttendanceCron = () => {
    console.log('[Auto-Attendance Engine] Running background cron every 5s...');
    setInterval(checkAndTriggerAttendance, 5000);
};

module.exports = {
    startAttendanceCron,
    checkAndTriggerAttendance,
};
