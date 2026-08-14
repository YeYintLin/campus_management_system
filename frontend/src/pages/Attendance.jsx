import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Users, BookOpen, ChevronRight, ArrowLeft, CheckCircle2, XCircle, Clock, Save, Search, Award, TrendingUp, Zap, KeyRound, Send, Check, Camera, QrCode, X, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { getNormalizedUserYear, normalizeYear, parseYearNumber } from '../utils/userYear';
import './Attendance.css';

const yearNumberToLabel = (num) => {
    const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
    return labels[num] || '1st Year';
};

const deriveSemFromCode = (code = '') => {
    const digits = String(code).replace(/[^0-9]/g, '');
    if (digits.length >= 5) {
        const semD = parseInt(digits[1], 10);
        if (semD === 1 || semD === 2) return semD;
    }
    return null;
};

const isCourseTaughtByTeacher = (course, user) => {
    if (!user) return false;
    const userTeacherId = user._id ? String(user._id) : '';
    const userTeacherName = (user.name || '').toLowerCase().trim();
    const userTeacherEmail = (user.email || '').toLowerCase().trim();

    const cTeacher = course.teacher;
    if (!cTeacher) return false;

    let cId = '';
    let cName = '';
    let cEmail = '';

    if (typeof cTeacher === 'object') {
        cId = cTeacher._id ? String(cTeacher._id) : '';
        cName = (cTeacher.name || '').toLowerCase().trim();
        cEmail = (cTeacher.email || '').toLowerCase().trim();
    } else if (typeof cTeacher === 'string') {
        cName = cTeacher.toLowerCase().trim();
        if (cTeacher.includes('@')) cEmail = cTeacher.toLowerCase().trim();
        else if (cTeacher.length > 15) cId = cTeacher;
    }

    if (userTeacherId && cId && userTeacherId === cId) return true;
    if (userTeacherEmail && cEmail && userTeacherEmail === cEmail) return true;

    // Strip honorifics (Daw, U, Prof, Dr) for resilient matching
    const cleanUser = userTeacherName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();
    const cleanCourse = cName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();

    if (cleanUser.length >= 3 && cleanCourse.length >= 3) {
        if (cleanCourse.includes(cleanUser) || cleanUser.includes(cleanCourse)) return true;
    }

    return false;
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

const sortRosterByRollNo = (rosterList) => {
    return [...rosterList].sort((a, b) => {
        const rollA = deriveRollNo(a, 0);
        const rollB = deriveRollNo(b, 0);

        const numAMatches = rollA.match(/\d+/g);
        const numBMatches = rollB.match(/\d+/g);

        const numA = numAMatches ? parseInt(numAMatches[numAMatches.length - 1], 10) : 999999;
        const numB = numBMatches ? parseInt(numBMatches[numBMatches.length - 1], 10) : 999999;

        const prefixA = rollA.replace(/\d+/g, '').toLowerCase();
        const prefixB = rollB.replace(/\d+/g, '').toLowerCase();

        if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
        return numA - numB;
    });
};

const Attendance = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const isStudent = user?.role === 'Student';
    const isTeacher = user?.role === 'Teacher';
    const isAdmin = user?.role === 'Admin';
    const canManageAttendance = isAdmin || isTeacher;
    const studentYear = getNormalizedUserYear(user);

    // State for Teacher / Admin view
    const [view, setView] = useState('courses'); // 'courses' or 'marking'
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [studentRoster, setStudentRoster] = useState([]);
    const [attendanceSheet, setAttendanceSheet] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // State for Active Live Session (Zero-Tap / Code / QR)
    const [activeSession, setActiveSession] = useState(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [inputCode, setInputCode] = useState('');
    const [codeSubmitting, setCodeSubmitting] = useState(false);
    const [codeMessage, setCodeMessage] = useState('');
    const [codeSuccess, setCodeSuccess] = useState(false);
    const [startingSession, setStartingSession] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false); // Teacher QR enlarged view

    // State for Excel Export Modal
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportConfig, setExportConfig] = useState({
        courseId: '',
        year: '5th Year',
        month: 'ဇန်နဝါရီ (Jan)',
        templateType: 'daily',
        semester: '1'
    });
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const handleDownloadRollCallExcel = async () => {
        setExporting(true);
        setExportError('');
        try {
            const { courseId, year, month, templateType, semester } = exportConfig;
            const targetCourse = courseId || (courses[0]?.code || courses[0]?._id || 'McE-52039');
            const response = await apiClient.get('/attendance/export-excel', {
                params: { courseId: targetCourse, year, month, templateType, semester },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Roll_Call_${targetCourse}_${templateType}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            setShowExportModal(false);
        } catch (err) {
            console.error('Excel Export Error:', err);
            let msg = 'Failed to export Roll Call Excel';
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const parsed = JSON.parse(text);
                    if (parsed.message) msg = parsed.message;
                } catch (e) {}
            } else if (err.response?.data?.message) {
                msg = err.response.data.message;
            }
            setExportError(msg);
        } finally {
            setExporting(false);
        }
    };

    // Live 20-second Countdown Timer
    useEffect(() => {
        if (!activeSession?.expiresAt) {
            setSecondsLeft(0);
            return;
        }

        const updateTimer = () => {
            const diff = Math.max(0, Math.ceil((new Date(activeSession.expiresAt).getTime() - Date.now()) / 1000));
            setSecondsLeft(diff);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    // QR Verification & Scanner State (Student View)
    const [verifyingQR, setVerifyingQR] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null); // { success, alreadyMarked, courseName, timestamp }
    const [verificationError, setVerificationError] = useState(null); // { errorCode, message }
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [cameraLoading, setCameraLoading] = useState(false);

    // Refs for in-app camera scanner
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animationFrameRef = useRef(null);

    // State for Student personal view
    const [studentAttendanceLogs, setStudentAttendanceLogs] = useState([]);
    const [studentStats, setStudentStats] = useState({ present: 0, late: 0, absent: 0, total: 0, percentage: '100%' });

    const teacherYears = useMemo(() => {
        if (!isTeacher) return [];
        const set = new Set();
        courses.forEach(c => {
            if (isCourseTaughtByTeacher(c, user)) {
                const yLabel = c.yearLabel ? normalizeYear(c.yearLabel) : normalizeYear(yearNumberToLabel(c.year || 1));
                if (yLabel && yLabel !== 'All') set.add(yLabel);
            }
        });
        const order = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];
        return order.filter(y => set.has(y));
    }, [isTeacher, courses, user]);

    const years = isStudent
        ? [studentYear]
        : isTeacher
        ? (teacherYears.length > 0 ? ['All', ...teacherYears] : ['All'])
        : ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];

    // Poll for active attendance session every 10 seconds
    const fetchActiveSession = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/attendance/active-session');
            setActiveSession(data);
        } catch (err) {
            console.error('Error checking active session:', err);
        }
    }, []);

    useEffect(() => {
        fetchActiveSession();
        const interval = setInterval(fetchActiveSession, 10000);
        return () => clearInterval(interval);
    }, [fetchActiveSession]);

    // ── SECONDARY FLOW: Deep link URL auto-verification (?qrToken=...) ──
    const processQRVerification = useCallback(async ({ qrToken, code }) => {
        setVerifyingQR(true);
        setVerificationError(null);
        try {
            const { data } = await apiClient.post('/attendance/scan-qr', { qrToken, code });
            if (data.success) {
                setVerificationResult({
                    success: true,
                    alreadyMarked: data.alreadyMarked,
                    courseName: data.courseName,
                    timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        } catch (err) {
            const errData = err.response?.data;
            setVerificationError({
                errorCode: errData?.errorCode || 'VERIFY_FAILED',
                message: errData?.message || err.message || 'Failed to verify QR code'
            });
        } finally {
            setVerifyingQR(false);
        }
    }, []);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const qrTokenParam = searchParams.get('qrToken');
        const codeParam = searchParams.get('code');

        if (qrTokenParam || codeParam) {
            if (!user) {
                // Not authenticated -> preserve search string and redirect to login
                sessionStorage.setItem('pendingQRScan', window.location.search);
                navigate(`/login?redirect=/attendance${window.location.search}`);
            } else if (isStudent) {
                processQRVerification({ qrToken: qrTokenParam, code: codeParam });
            }
        }
    }, [user, isStudent, navigate, processQRVerification]);

    // ── PRIMARY FLOW: In-app Camera Scanner (jsQR + getUserMedia) ──
    const scanVideoFrame = useCallback(() => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current || document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const codeResult = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });

            if (codeResult && codeResult.data) {
                stopCameraScanner();
                handleDecodedQRData(codeResult.data);
                return;
            }
        }
        animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }, []);

    const startCameraScanner = async () => {
        setShowCameraModal(true);
        setCameraError(null);
        setCameraLoading(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                await videoRef.current.play();
                setCameraLoading(false);
                animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
            }
        } catch (err) {
            setCameraLoading(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setCameraError('Camera access permission was denied. Please allow camera access in browser settings.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setCameraError('No camera found on your device.');
            } else {
                setCameraError('Failed to access camera: ' + err.message);
            }
        }
    };

    const stopCameraScanner = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowCameraModal(false);
    }, []);

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    const handleDecodedQRData = (decodedData) => {
        let qrToken = null;
        let code = null;

        try {
            if (decodedData.includes('?')) {
                const urlObj = new URL(decodedData, window.location.origin);
                qrToken = urlObj.searchParams.get('qrToken');
                code = urlObj.searchParams.get('code');
            } else {
                qrToken = decodedData;
            }
        } catch {
            qrToken = decodedData;
        }

        if (qrToken || code) {
            processQRVerification({ qrToken, code });
        } else {
            setVerificationError({
                errorCode: 'INVALID_FORMAT',
                message: 'Scanned QR code is not a valid CMS attendance pass'
            });
        }
    };

    // Teacher/Admin manually starts a 20-second live session
    const handleStartLiveSession = async (course) => {
        setStartingSession(true);
        try {
            const { data } = await apiClient.post('/attendance/create-session', {
                courseId: course.code || course._id,
                courseName: course.title || course.name || course.code,
                department: course.department || user?.department || 'Mechatronics Engineering',
                year: course.year || course.yearLabel || '',
                durationSeconds: 20
            });
            setActiveSession(data);
            setMessage(`⚡ 20-Second Live session started for ${course.name || course.code}! Code: ${data.code}. Students have 20 seconds to submit!`);
        } catch (err) {
            console.error('Failed to start live session:', err);
            setMessage('Failed to start live session');
        } finally {
            setStartingSession(false);
        }
    };

    // Student submits 4-digit code manually
    const handleSubmitCode = async (e) => {
        e.preventDefault();
        if (!inputCode || inputCode.length !== 4) return;
        setCodeSubmitting(true);
        setCodeMessage('');
        try {
            const { data } = await apiClient.post('/attendance/submit-code', { code: inputCode });
            setCodeSuccess(true);
            setCodeMessage(data.message || 'Attendance marked Present!');
            setInputCode('');
            // Set clean verification result
            setVerificationResult({
                success: true,
                alreadyMarked: false,
                courseName: activeSession?.courseName || activeSession?.courseId || 'Course',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } catch (err) {
            setCodeSuccess(false);
            setCodeMessage(err.response?.data?.message || 'Invalid or expired code');
        } finally {
            setCodeSubmitting(false);
        }
    };

    // Load courses for Teacher / Admin (combining /courses and /timetable)
    useEffect(() => {
        if (!canManageAttendance) return;
        const fetchCourses = async () => {
            setLoading(true);
            try {
                const [coursesRes, timetableRes] = await Promise.all([
                    apiClient.get('/courses').catch(() => ({ data: [] })),
                    apiClient.get('/timetable').catch(() => ({ data: [] })),
                ]);

                const dbCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
                const timetableData = Array.isArray(timetableRes.data) ? timetableRes.data : [];

                // Extract timetable legend items by clean code
                const timetableMap = new Map();
                timetableData.forEach(sheet => {
                    const sheetYearNum = sheet.yearNumber || (sheet.yearLabel ? parseYearNumber(sheet.yearLabel) : 1);
                    const sheetYear = sheet.yearLabel ? normalizeYear(sheet.yearLabel) : normalizeYear(sheetYearNum);

                    if (Array.isArray(sheet.legend)) {
                        sheet.legend.forEach(item => {
                            if (item.code) {
                                let rawCode = item.code.trim();
                                const codeMatch = rawCode.match(/^[A-Za-z]{1,5}-?\s*\d{3,6}/);
                                if (codeMatch) {
                                    rawCode = codeMatch[0].replace(/\s+/g, '');
                                }
                                if (rawCode.length > 20) return;

                                const cleanCode = rawCode.replace(/[\s-]+/g, '').toUpperCase();
                                timetableMap.set(cleanCode, {
                                    _id: `tt_${rawCode}`,
                                    code: rawCode,
                                    name: item.subject ? item.subject.trim() : rawCode,
                                    year: sheetYearNum,
                                    yearLabel: sheetYear,
                                    teacher: item.teacher ? { name: item.teacher.trim() } : null,
                                    isFromTimetable: true
                                });
                            }
                        });
                    }
                });

                // Process DB Courses & override with Timetable legend info if available
                const mergedCoursesMap = new Map();

                dbCourses.forEach(dbc => {
                    const cleanCode = (dbc.code || '').replace(/[\s-]+/g, '').toUpperCase();
                    if (!cleanCode) return;

                    const ttInfo = timetableMap.get(cleanCode);
                    const effectiveYearNum = dbc.year || (ttInfo ? ttInfo.year : parseYearNumber(dbc.yearLabel));
                    const effectiveYearLabel = normalizeYear(dbc.yearLabel || effectiveYearNum);

                    let newCourseObj = null;

                    if (ttInfo) {
                        newCourseObj = {
                            ...dbc,
                            name: dbc.name || ttInfo.name,
                            year: effectiveYearNum,
                            yearLabel: effectiveYearLabel,
                            teacher: dbc.teacher || ttInfo.teacher,
                            isFromTimetable: true
                        };
                    } else if (dbc.teacher) {
                        newCourseObj = {
                            ...dbc,
                            year: effectiveYearNum,
                            yearLabel: effectiveYearLabel
                        };
                    }

                    if (newCourseObj) {
                        if (mergedCoursesMap.has(cleanCode)) {
                            const existing = mergedCoursesMap.get(cleanCode);
                            const existingIsGeneric = (existing.description || '').includes('Official timetable subject offering');
                            const newIsGeneric = (newCourseObj.description || '').includes('Official timetable subject offering');
                            if (existingIsGeneric && !newIsGeneric) {
                                mergedCoursesMap.set(cleanCode, newCourseObj);
                            }
                        } else {
                            mergedCoursesMap.set(cleanCode, newCourseObj);
                        }
                    }
                });

                const mergedCourses = Array.from(mergedCoursesMap.values());
                const processedCodes = new Set(mergedCoursesMap.keys());

                // Add remaining timetable subjects not yet in DB
                timetableMap.forEach((ttInfo, cleanCode) => {
                    if (!processedCodes.has(cleanCode)) {
                        processedCodes.add(cleanCode);
                        mergedCourses.push(ttInfo);
                    }
                });

                // For Teachers, strictly filter courses assigned to them
                let finalCourses = mergedCourses;
                if (isTeacher) {
                    finalCourses = mergedCourses.filter(c => isCourseTaughtByTeacher(c, user));
                }

                // Final deduplication pass
                const finalDedup = new Map();
                finalCourses.forEach(c => {
                    const key = (c.code || '').replace(/[\s-]+/g, '').toUpperCase();
                    if (!key) return;
                    if (finalDedup.has(key)) {
                        const existing = finalDedup.get(key);
                        const existingIsGeneric = (existing.description || '').includes('Official timetable subject offering');
                        const newIsGeneric = (c.description || '').includes('Official timetable subject offering');
                        if (existingIsGeneric && !newIsGeneric) {
                            finalDedup.set(key, c);
                        }
                    } else {
                        finalDedup.set(key, c);
                    }
                });

                setCourses(Array.from(finalDedup.values()));
            } catch (err) {
                console.error('Error fetching courses for attendance:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchCourses();
    }, [canManageAttendance]);

    // Load personal attendance for Student
    useEffect(() => {
        if (!isStudent) return;
        const studentId = user?._id || user?.id;
        if (!studentId) return;

        const fetchStudentAttendance = async () => {
            setLoading(true);
            try {
                const { data } = await apiClient.get(`/attendance?student=${studentId}`);
                setStudentAttendanceLogs(Array.isArray(data) ? data : []);

                let present = 0;
                let late = 0;
                let absent = 0;
                let total = 0;

                (Array.isArray(data) ? data : []).forEach(log => {
                    log.records?.forEach(r => {
                        total += 1;
                        if (r.status === 'Present') present += 1;
                        else if (r.status === 'Late') late += 1;
                        else if (r.status === 'Absent') absent += 1;
                    });
                });

                const percentage = total > 0 ? `${Math.round(((present + late * 0.5) / total) * 100)}%` : '100%';
                setStudentStats({ present, late, absent, total, percentage });
            } catch (err) {
                console.error('Error fetching student attendance:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStudentAttendance();
    }, [isStudent, user?._id, user?.id]);

    // Compute Subject-by-Subject Attendance breakdown for Student View
    const perSubjectAttendance = useMemo(() => {
        if (!studentAttendanceLogs || studentAttendanceLogs.length === 0) return [];
        
        const subjectMap = {};
        studentAttendanceLogs.forEach(log => {
            const courseCode = log.courseCode || log.course?.code || log.course || 'Subject';
            const courseName = log.courseName || log.course?.name || courseCode;
            const key = courseCode;

            if (!subjectMap[key]) {
                subjectMap[key] = {
                    code: courseCode,
                    name: courseName,
                    total: 0,
                    present: 0,
                    late: 0,
                    absent: 0
                };
            }

            const record = log.records?.[0];
            const status = record?.status || 'Present';
            subjectMap[key].total += 1;
            if (status === 'Present') subjectMap[key].present += 1;
            else if (status === 'Late') subjectMap[key].late += 1;
            else if (status === 'Absent') subjectMap[key].absent += 1;
        });

        return Object.values(subjectMap).map(subj => {
            const attended = subj.present + subj.late;
            const percentage = subj.total > 0 ? Math.round((attended / subj.total) * 100) : 100;
            return { ...subj, percentage };
        });
    }, [studentAttendanceLogs]);

    // ── Helpers for year + department resolution (used by roster filtering) ──

    const deriveDepartmentFromCode = useCallback((code = '') => {
        const clean = code.toUpperCase();
        if (clean.includes('MCE') || clean.match(/\bMC\b/)) return 'Mechatronics Engineering';
        if (clean.includes('CE') && !clean.includes('MCE') && !clean.includes('ECE')) return 'Civil Engineering';
        if (clean.includes('EP')) return 'Electrical Power Engineering';
        if (clean.includes('ECE') || (clean.includes('EC') && !clean.includes('MCE'))) return 'Electronic Engineering';
        if (clean.includes('IT')) return 'Information Technology';
        if (clean.includes('ME') && !clean.includes('MCE')) return 'Mechanical Engineering';
        if (clean.includes('ARCH') || clean.includes('AR') || clean.includes('AG')) return 'Architecture';
        return '';
    }, []);

    // Derive department from student email prefix (e.g. v.mc.1@tuhmawbi → mc → Mechatronics)
    const deriveDepartmentFromEmail = useCallback((email = '') => {
        if (!email) return '';
        const prefix = email.split('@')[0].toLowerCase(); // e.g. "v.mc.1" or "vimc15"
        const parts = prefix.split('.');
        if (parts.length >= 2) {
            const deptCode = parts[1]; // e.g. "mc", "arch"
            if (deptCode === 'mc' || deptCode === 'mce') return 'Mechatronics Engineering';
            if (deptCode === 'arch' || deptCode === 'ar') return 'Architecture';
            if (deptCode === 'c' || deptCode === 'ce') return 'Civil Engineering';
            if (deptCode === 'ep') return 'Electrical Power Engineering';
            if (deptCode === 'ec' || deptCode === 'ece') return 'Electronic Engineering';
            if (deptCode === 'it') return 'Information Technology';
            if (deptCode === 'me') return 'Mechanical Engineering';
        }
        // Handle non-dot format: vimc15, iiimc5, iimc3
        const noDot = prefix.replace(/[0-9@]+.*$/, ''); // strip trailing numbers & domain
        if (noDot.endsWith('mc') || noDot.endsWith('mce')) return 'Mechatronics Engineering';
        if (noDot.endsWith('arch') || noDot.endsWith('ar')) return 'Architecture';
        if (noDot.endsWith('ce')) return 'Civil Engineering';
        if (noDot.endsWith('ep')) return 'Electrical Power Engineering';
        if (noDot.endsWith('ec') || noDot.endsWith('ece')) return 'Electronic Engineering';
        if (noDot.endsWith('it')) return 'Information Technology';
        if (noDot.endsWith('me') && !noDot.endsWith('mce')) return 'Mechanical Engineering';
        return '';
    }, []);

    // Derive year from email prefix: v.mc.1 → 5th, iii.mc.3 → 3rd, vimc15 → 6th, imc1 → 1st
    const deriveYearFromEmail = useCallback((email = '') => {
        if (!email) return '';
        const prefix = email.split('@')[0].toLowerCase();
        const parts = prefix.split('.');
        let yearPart = '';
        if (parts.length >= 2) {
            yearPart = parts[0]; // e.g. "v", "iii", "i", "vi", "iv", "ii"
        } else {
            // Non-dot format: vimc15 → extract roman prefix before dept code
            const m = prefix.match(/^(i{1,4}|iv|v|vi)(?=[a-z])/i);
            if (m) yearPart = m[1];
        }
        if (!yearPart) return '';
        const romanMap = { 'i': '1st Year', 'ii': '2nd Year', 'iii': '3rd Year', 'iv': '4th Year', 'v': '5th Year', 'vi': '6th Year' };
        return romanMap[yearPart.toLowerCase()] || '';
    }, []);

    // Resolve a student's department from: explicit field > email prefix > rollNo
    const resolveStudentDept = useCallback((student) => {
        if (student.department && student.department.trim()) return student.department.trim();
        const fromEmail = deriveDepartmentFromEmail(student.email);
        if (fromEmail) return fromEmail;
        if (student.rollNo) return deriveDepartmentFromCode(student.rollNo);
        return '';
    }, [deriveDepartmentFromEmail, deriveDepartmentFromCode]);

    // Resolve a student's year from: explicit field > email prefix
    const resolveStudentYear = useCallback((student) => {
        if (student.year && String(student.year).trim()) return normalizeYear(student.year);
        const fromEmail = deriveYearFromEmail(student.email);
        if (fromEmail) return normalizeYear(fromEmail);
        return '';
    }, [deriveYearFromEmail]);

    const matchesDept = useCallback((resolvedStudentDept, targetDept) => {
        if (!targetDept || targetDept === 'All') return true;
        if (!resolvedStudentDept) return false;
        const s = resolvedStudentDept.toLowerCase().trim();
        const t = targetDept.toLowerCase().trim();
        if (s === t) return true;
        if (s.includes(t) || t.includes(s)) return true;
        return false;
    }, []);

    // Load attendance marking sheet for selected course and date
    const loadCourseAttendance = useCallback(async (course, date, silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Derive course academic year (checking yearLabel, year, and code digits e.g. McE-52039 -> 5th Year)
            const deriveYearFromCourse = (c) => {
                if (c.yearLabel) return c.yearLabel;
                if (c.year && typeof c.year === 'string') return c.year;
                if (c.year && typeof c.year === 'number' && c.year >= 1 && c.year <= 6) {
                    return yearNumberToLabel(c.year);
                }
                const codeStr = c.code || c.name || '';
                const digits = codeStr.replace(/[^0-9]/g, '');
                if (digits.length > 0) {
                    const firstDigit = digits.charAt(0);
                    if (['1','2','3','4','5','6'].includes(firstDigit)) {
                        return yearNumberToLabel(Number(firstDigit));
                    }
                }
                return 'All';
            };

            const courseYearLabel = deriveYearFromCourse(course);
            const targetYearNorm = normalizeYear(courseYearLabel);
            const targetDept = course.department || deriveDepartmentFromCode(course.code || course.name || '');
            const courseSem = course.semester || deriveSemFromCode(course.code || course.name || '');
            const courseYearNum = parseYearNumber(courseYearLabel);

            // Fetch student profiles to have accurate semester mapping
            let studentSemesterMap = {};
            try {
                const studentsRes = await apiClient.get('/students').catch(() => ({ data: [] }));
                const studentsData = Array.isArray(studentsRes.data) ? studentsRes.data : [];
                studentsData.forEach(st => {
                    const uId = st.user?._id || st.user;
                    if (uId && typeof st.semester === 'number') {
                        studentSemesterMap[uId.toString()] = st.semester;
                    }
                });
            } catch (stErr) {
                console.error('Error loading student profiles for semester mapping:', stErr);
            }

            // Year + Department + Semester filter function
            const studentBelongsToCourse = (student) => {
                const sId = (student._id || student).toString();

                // Year check
                const sYear = resolveStudentYear(student);
                const yearOk = targetYearNorm === 'All' || !sYear || sYear === targetYearNorm;

                // Department check
                const sDept = resolveStudentDept(student);
                const deptOk = matchesDept(sDept, targetDept);

                // If student has NO year AND NO dept info (test/gmail accounts), exclude them
                if (!sYear && !sDept) return false;

                // Semester check: if course has semester defined and student profile has semester
                const studentAbsSem = studentSemesterMap[sId] ?? (typeof student.semester === 'number' ? student.semester : null);
                if (courseSem && typeof studentAbsSem === 'number' && studentAbsSem > 0) {
                    const studentSemInYear = studentAbsSem % 2 === 0 ? 2 : 1;
                    const studentYearNum = Math.ceil(studentAbsSem / 2);
                    if (studentYearNum === courseYearNum && studentSemInYear !== courseSem) {
                        return false;
                    }
                }

                return yearOk && deptOk;
            };

            // Start with enrolled students from course object, then filter
            let roster = [...(course.students || [])];

            if (roster.length > 0) {
                // Course has an explicit students list — filter out wrong year/dept/semester students
                roster = roster.filter(s => studentBelongsToCourse(s));
            }

            // If course has no students (or all were filtered out), fetch from users API
            if (roster.length === 0) {
                try {
                    const usersRes = await apiClient.get('/users').catch(() => ({ data: [] }));
                    const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
                    const allStudents = allUsers.filter(u => (u.role || '').toLowerCase() === 'student');

                    const yearAndDeptStudents = allStudents.filter(u => studentBelongsToCourse(u));

                    if (yearAndDeptStudents.length > 0) {
                        roster = yearAndDeptStudents;
                    }
                    // If still empty, roster stays empty — don't show wrong students
                } catch (uErr) {
                    console.error('Error fetching students:', uErr);
                }
            }

            // Fetch existing attendance logs for this course on date (using course.code || course._id)
            const courseKey = course.code || course._id;
            const { data } = await apiClient.get(`/attendance/course/${courseKey}?date=${date}`);
            const existingSheet = {};

            // Merge any students returned in DB records into the roster (only if they match year+dept)
            if (data && data.length > 0 && Array.isArray(data[0].records)) {
                const rosterSet = new Set(roster.map(s => (s._id || s).toString()));
                data[0].records.forEach(r => {
                    if (r.student) {
                        const sObj = typeof r.student === 'object' ? r.student : { _id: r.student, name: 'Student', email: '' };
                        const sId = (sObj._id || sObj).toString();
                        // Only add to roster if student belongs to this course's year+dept
                        if (!rosterSet.has(sId) && studentBelongsToCourse(sObj)) {
                            rosterSet.add(sId);
                            roster.push(sObj);
                        }
                        // Still record their attendance status even if filtered out of display
                        existingSheet[sId] = r.status || 'Present';
                    }
                });
            }

            // Default remaining enrolled/year students without a record to 'Absent'
            roster.forEach(s => {
                const sId = (s._id || s).toString();
                if (!existingSheet[sId]) {
                    existingSheet[sId] = 'Absent';
                }
            });

            const sortedRoster = sortRosterByRollNo(roster);
            setStudentRoster(sortedRoster);
            setAttendanceSheet(existingSheet);
        } catch (err) {
            console.error('Error loading course attendance:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [deriveDepartmentFromCode, deriveDepartmentFromEmail, resolveStudentDept, resolveStudentYear, matchesDept]);

    // Live polling when a live attendance session is active in marking view
    useEffect(() => {
        if (canManageAttendance && view === 'marking' && selectedCourse && activeSession?.code) {
            const interval = setInterval(() => {
                loadCourseAttendance(selectedCourse, selectedDate, true);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [canManageAttendance, view, selectedCourse, activeSession, selectedDate, loadCourseAttendance]);

    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
        setView('marking');
        setSearchTerm(''); // Clear search term so student roster is not filtered by course code search
        loadCourseAttendance(course, selectedDate);
    };

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
        if (selectedCourse) {
            loadCourseAttendance(selectedCourse, newDate);
        }
    };

    const handleStatusChange = (studentId, status) => {
        setAttendanceSheet(prev => ({ ...prev, [studentId]: status }));
    };

    const handleMarkUnsubmittedAbsent = () => {
        setAttendanceSheet(prev => {
            const updated = { ...prev };
            studentRoster.forEach(s => {
                const sId = s._id || s;
                if (!updated[sId] || updated[sId] === '') {
                    updated[sId] = 'Absent';
                }
            });
            return updated;
        });
    };

    const handleBack = () => {
        setView('courses');
        setSelectedCourse(null);
        setMessage('');
    };

    const handleSave = async () => {
        if (!selectedCourse) return;
        setSaving(true);
        setMessage('');

        try {
            // Build payload: Any student who hasn't submitted code or been marked defaults to 'Absent'
            const recordsPayload = studentRoster.map(s => {
                const sId = s._id || s;
                const currentStatus = attendanceSheet[sId];
                const finalStatus = currentStatus && currentStatus.trim() !== '' ? currentStatus : 'Absent';
                return {
                    student: sId,
                    status: finalStatus
                };
            });

            await apiClient.post('/attendance', {
                course: selectedCourse.code || selectedCourse._id,
                date: selectedDate,
                records: recordsPayload
            });

            // Update local sheet state to reflect final saved statuses
            const updatedSheet = {};
            recordsPayload.forEach(r => {
                updatedSheet[r.student] = r.status;
            });
            setAttendanceSheet(updatedSheet);

            setMessage(`Attendance saved for ${selectedCourse.name} on ${selectedDate}`);
            setTimeout(() => setMessage(''), 4000);
        } catch (err) {
            console.error('Failed to save attendance:', err);
            alert(err.response?.data?.message || 'Failed to save attendance.');
        } finally {
            setSaving(false);
        }
    };

    // Filter courses by selected year, search, and teacher assignment
    const filteredCourses = courses.filter(c => {
        if (isTeacher && !isCourseTaughtByTeacher(c, user)) {
            return false;
        }

        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.code.toLowerCase().includes(searchTerm.toLowerCase());

        const normTarget = normalizeYear(selectedYear);
        const normCourseYear = c.yearLabel ? normalizeYear(c.yearLabel) : normalizeYear(yearNumberToLabel(c.year || 1));
        const matchesYear = normTarget === 'All' || normCourseYear === 'All' || normCourseYear === normTarget;

        return matchesSearch && matchesYear;
    });

    // Filter student roster by search and sort by roll number
    const filteredStudents = useMemo(() => {
        const matching = studentRoster.filter(s => {
            const name = s.name || '';
            const email = s.email || '';
            const roll = deriveRollNo(s, 0);
            return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                roll.toLowerCase().includes(searchTerm.toLowerCase());
        });
        return sortRosterByRollNo(matching);
    }, [studentRoster, searchTerm]);

    // -------------------------------------------------------------
    // STUDENT VIEW: Read-Only Personal Attendance Record
    // -------------------------------------------------------------
    if (isStudent) {
        return (
            <div className="attendance-page animate-fade-in">
                <header className="page-header">
                    <div>
                        <h1>My Attendance Record</h1>
                        <p className="subtitle">Track your class attendance and compliance</p>
                    </div>
                </header>

                {/* ── Verifying Loader ── */}
                {verifyingQR && (
                    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', borderRadius: '16px' }}>
                        <RefreshCw size={28} className="spin text-primary" style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ margin: '0.75rem 0 0', fontWeight: '600', color: '#fff' }}>Verifying QR Attendance Pass...</p>
                    </div>
                )}

                {/* ── SHARED SUCCESS VIEW (Hides all inputs completely) ── */}
                {verificationResult && (
                    <div className="glass-panel animate-scale-up" style={{
                        padding: '2rem 1.5rem',
                        borderRadius: '20px',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.08))',
                        border: '1px solid rgba(34,197,94,0.4)',
                        boxShadow: '0 12px 32px rgba(34,197,94,0.2)'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'rgba(34,197,94,0.2)',
                            color: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem',
                            border: '2px solid #22c55e'
                        }}>
                            <CheckCircle2 size={36} />
                        </div>

                        <h2 style={{ fontSize: '1.35rem', color: '#fff', margin: '0 0 0.4rem', fontWeight: '700' }}>
                            {verificationResult.alreadyMarked ? 'Already Marked Present' : 'Attendance Verified!'}
                        </h2>

                        <p style={{ fontSize: '1.1rem', color: '#4ade80', fontWeight: '700', margin: '0 0 1rem' }}>
                            {verificationResult.courseName}
                        </p>

                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.45rem 1.1rem',
                            borderRadius: '20px',
                            background: 'rgba(0,0,0,0.35)',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <ShieldCheck size={16} style={{ color: '#22c55e' }} />
                            <span>Verified via Dynamic QR • {verificationResult.timestamp}</span>
                        </div>
                    </div>
                )}

                {/* ── EXPLICIT ERROR STATES ── */}
                {verificationError && !verificationResult && (
                    <div className="glass-panel" style={{
                        padding: '1.5rem',
                        borderRadius: '16px',
                        marginBottom: '1.5rem',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.75rem',
                        textAlign: 'center'
                    }}>
                        <AlertCircle size={32} style={{ color: '#ef4444' }} />
                        <div>
                            <h4 style={{ margin: '0 0 0.25rem', color: '#ef4444' }}>Verification Failed</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {verificationError.message}
                            </p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setVerificationError(null); fetchActiveSession(); }}
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* ── ACTIVE LIVE SESSION BANNER (Hidden when already verified) ── */}
                {activeSession && !verificationResult && (
                    <div className="glass-panel" style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: '16px',
                        marginBottom: '1.5rem',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                        border: '1px solid rgba(99,102,241,0.3)',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Zap size={22} style={{ color: '#818cf8', animation: 'pulse 1.5s infinite' }} />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                                        Live Attendance Active: <span style={{ color: '#a78bfa' }}>{activeSession.courseName || activeSession.courseId}</span>
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: secondsLeft > 0 ? '#f59e0b' : '#f87171', fontWeight: '600' }}>
                                        {secondsLeft > 0 ? 'Scan QR or enter 4-digit code within 30s or you will be marked Absent!' : '⚠️ 30-second window closed! Unsubmitted students marked Absent.'}
                                    </p>
                                </div>
                            </div>
                            <div style={{ background: secondsLeft <= 5 ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)', border: `1px solid ${secondsLeft <= 5 ? '#ef4444' : '#6366f1'}`, padding: '0.4rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={16} style={{ color: secondsLeft <= 5 ? '#f87171' : '#818cf8' }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: secondsLeft <= 5 ? '#f87171' : '#fff' }}>
                                    {secondsLeft}s Left
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* PRIMARY FLOW: In-App Camera Scanner Button */}
                            <button
                                className="btn btn-primary"
                                onClick={startCameraScanner}
                                style={{
                                    width: '100%',
                                    padding: '0.85rem 1.25rem',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.6rem',
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    boxShadow: '0 6px 20px rgba(99,102,241,0.4)'
                                }}
                            >
                                <Camera size={22} />
                                <span>Scan QR Code with Camera</span>
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.2rem 0' }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Or enter code</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            </div>

                            {/* FALLBACK: 4-Digit Passcode Input */}
                            <form onSubmit={handleSubmitCode} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: '1' }}>
                                    <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        maxLength="4"
                                        placeholder="4-Digit Code"
                                        value={inputCode}
                                        onChange={(e) => setInputCode(e.target.value.replace(/[^0-9]/g, ''))}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(0,0,0,0.3)',
                                            color: '#fff',
                                            fontSize: '1.1rem',
                                            fontWeight: '700',
                                            letterSpacing: '0.2em',
                                            textAlign: 'center'
                                        }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn-secondary"
                                    disabled={codeSubmitting || inputCode.length !== 4}
                                    style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Send size={16} />
                                    {codeSubmitting ? 'Verifying...' : 'Submit'}
                                </button>
                            </form>
                        </div>

                        {codeMessage && (
                            <p style={{
                                margin: '0.75rem 0 0',
                                fontSize: '0.85rem',
                                color: codeSuccess ? '#4ade80' : '#f87171',
                                fontWeight: '600'
                            }}>
                                {codeSuccess ? '✓ ' : '✗ '}{codeMessage}
                            </p>
                        )}
                    </div>
                )}

                <div className="attendance-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-muted">Attendance Rate</span>
                            <Award size={20} className="text-primary" />
                        </div>
                        <h2 style={{ fontSize: '2rem', marginTop: '0.5rem', color: 'var(--primary-color)' }}>{studentStats.percentage}</h2>
                    </div>
                    <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-muted">Classes Present</span>
                            <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
                        </div>
                        <h2 style={{ fontSize: '2rem', marginTop: '0.5rem', color: '#22c55e' }}>{studentStats.present}</h2>
                    </div>
                    <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-muted">Classes Late</span>
                            <Clock size={20} style={{ color: '#eab308' }} />
                        </div>
                        <h2 style={{ fontSize: '2rem', marginTop: '0.5rem', color: '#eab308' }}>{studentStats.late}</h2>
                    </div>
                    <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-muted">Classes Absent</span>
                            <XCircle size={20} style={{ color: '#ef4444' }} />
                        </div>
                        <h2 style={{ fontSize: '2rem', marginTop: '0.5rem', color: '#ef4444' }}>{studentStats.absent}</h2>
                    </div>
                </div>

                {/* ── Per-Subject Attendance Breakdown Card Grid ── */}
                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={20} className="text-primary" />
                        <span>Subject-by-Subject Attendance Breakdown</span>
                    </h3>

                    {perSubjectAttendance.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                            {perSubjectAttendance.map(subj => (
                                <div key={subj.code} style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--surface-border)',
                                    borderRadius: '12px',
                                    padding: '1rem 1.15rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div>
                                            <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: '700' }}>{subj.code}</span>
                                            <h4 style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', color: '#fff' }}>{subj.name}</h4>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{
                                                fontSize: '1.25rem',
                                                fontWeight: '800',
                                                color: subj.percentage >= 75 ? '#4ade80' : subj.percentage >= 60 ? '#fbbf24' : '#f87171'
                                            }}>
                                                {subj.percentage}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden', margin: '0.6rem 0 0.4rem' }}>
                                        <div style={{
                                            width: `${subj.percentage}%`,
                                            height: '100%',
                                            background: subj.percentage >= 75 ? 'linear-gradient(90deg, #22c55e, #10b981)' : subj.percentage >= 60 ? '#f59e0b' : '#ef4444',
                                            borderRadius: '999px',
                                            transition: 'width 0.4s ease'
                                        }} />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span>{subj.present + subj.late} / {subj.total} Sessions Attended</span>
                                        <span>{subj.absent} Absent</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted" style={{ margin: 0 }}>No subject attendance data recorded yet.</p>
                    )}
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Attendance History</h3>
                    {loading ? (
                        <p>Loading attendance history...</p>
                    ) : studentAttendanceLogs.length > 0 ? (
                        <div className="table-responsive">
                            <table className="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Subject Code</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentAttendanceLogs.map(log => {
                                        const myRecord = log.records?.[0];
                                        const status = myRecord?.status || 'Present';
                                        const displayCode = log.courseCode || log.course?.code || (typeof log.course === 'string' && log.course.length < 15 ? log.course : 'General Course');
                                        return (
                                            <tr key={log._id}>
                                                <td>{new Date(log.date).toLocaleDateString()}</td>
                                                <td><span className="font-mono" style={{ wordBreak: 'break-all' }}>{displayCode}</span></td>
                                                <td className="text-center">
                                                    <span className={`badge ${status === 'Present' ? 'badge-success' : status === 'Late' ? 'badge-warning' : 'badge-danger'}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted">No attendance logs found yet.</p>
                    )}
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------
    // TEACHER & ADMIN VIEW: Course Selection & Marking Panel
    // -------------------------------------------------------------
    return (
        <div className="attendance-page animate-fade-in">
            <header className="page-header">
                <div className="header-title-area">
                    {view === 'marking' && (
                        <button className="back-btn" onClick={handleBack}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1>{view === 'courses' ? 'Attendance Management' : selectedCourse?.name}</h1>
                        <p className="subtitle">
                            {view === 'courses'
                                ? 'Select a course to mark daily attendance'
                                : `Marking attendance for ${selectedCourse?.code}`}
                        </p>
                    </div>
                </div>
                {view === 'marking' && (
                    <div className="header-actions">
                        <div className="date-picker-wrapper glass-panel">
                            <Calendar size={18} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                            />
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={handleMarkUnsubmittedAbsent}
                            title="Set all unsubmitted students to Absent"
                            style={{ fontSize: '0.85rem' }}
                        >
                            <XCircle size={18} />
                            <span>Mark Unsubmitted Absent</span>
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save Attendance'}
                        </button>
                    </div>
                )}
            </header>

            {message && (
                <div className="alert alert-success" style={{ marginBottom: '1rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)' }}>
                    {message}
                </div>
            )}

            {/* ── Active Live Session Banner for Teacher ── */}
            {activeSession && activeSession.code && (
                <div className="glass-panel" style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '16px',
                    marginBottom: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(99,102,241,0.15))',
                    border: '1px solid rgba(20,184,166,0.3)',
                    boxShadow: '0 8px 24px rgba(20,184,166,0.2)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {/* CLIENT-SIDE QR CODE SVG (No external 3rd-party network calls) */}
                            <div
                                style={{ background: '#fff', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer' }}
                                onClick={() => setShowQRModal(true)}
                                title="Click to enlarge QR"
                            >
                                <QRCodeSVG
                                    value={`${window.location.origin}/attendance?qrToken=${activeSession.qrToken || ''}&code=${activeSession.code || ''}`}
                                    size={72}
                                    level="M"
                                />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Zap size={18} style={{ color: '#14b8a6' }} />
                                    <span>Active Session: <span style={{ color: '#2dd4bf' }}>{activeSession.courseName || activeSession.courseId}</span></span>
                                </h3>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: secondsLeft > 0 ? '#2dd4bf' : '#f87171', fontWeight: '600' }}>
                                    {secondsLeft > 0 ? 'Project this QR / Passcode. Unsubmitted students automatically marked Absent in 30s!' : '⚠️ 30-second window closed! Unsubmitted students marked Absent.'}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ background: secondsLeft <= 5 ? 'rgba(239,68,68,0.2)' : 'rgba(20,184,166,0.2)', border: `1px solid ${secondsLeft <= 5 ? '#ef4444' : '#14b8a6'}`, padding: '0.45rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={16} style={{ color: secondsLeft <= 5 ? '#f87171' : '#2dd4bf' }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: secondsLeft <= 5 ? '#f87171' : '#fff' }}>
                                    {secondsLeft}s Left
                                </span>
                            </div>

                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowQRModal(true)}
                                style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <QrCode size={16} />
                                <span>Enlarge QR</span>
                            </button>
                            <div style={{
                                background: 'rgba(0,0,0,0.4)',
                                padding: '0.45rem 1rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(45,212,191,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem'
                            }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Passcode:</span>
                                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2dd4bf', letterSpacing: '0.2em' }}>{activeSession.code}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'courses' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="year-filter-bar glass-panel" style={{ marginBottom: 0 }}>
                        {years.map(year => (
                            <button
                                key={year}
                                className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                                onClick={() => setSelectedYear(year)}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                    {canManageAttendance && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setExportConfig(prev => ({
                                    ...prev,
                                    courseId: courses[0]?.code || courses[0]?._id || '',
                                    year: selectedYear !== 'All' ? selectedYear : '5th Year'
                                }));
                                setShowExportModal(true);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1))', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80' }}
                        >
                            <Award size={18} style={{ color: '#22c55e' }} />
                            <span>Export Official Roll Call Excel</span>
                        </button>
                    )}
                </div>
            )}

            {view === 'courses' ? (
                <div className="courses-grid">
                    {loading ? (
                        <div className="glass-panel empty-state" style={{ gridColumn: '1 / -1' }}>
                            <p>Loading subjects...</p>
                        </div>
                    ) : filteredCourses.length > 0 ? (
                        filteredCourses.map(course => (
                            <div
                                key={course._id}
                                className="course-attendance-card glass-panel hover-glow"
                                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', cursor: 'pointer' }} onClick={() => handleCourseSelect(course)}>
                                    <div className="course-card-icon" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                                        <BookOpen size={32} />
                                    </div>
                                    <div className="course-card-info" style={{ flex: 1 }}>
                                        <span className="dept-tag" style={{ backgroundColor: '#6366f120', color: '#6366f1' }}>
                                            {course.code}
                                        </span>
                                        <h3>{course.name}</h3>
                                        <p>Teacher: {course.teacher?.name || 'Assigned Staff'}</p>
                                        <div className="course-stats">
                                            <div className="stat">
                                                <Users size={14} />
                                                <span>{course.students?.length || 0} Enrolled</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="card-arrow" />
                                </div>

                                <button
                                    className="btn btn-secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartLiveSession(course);
                                    }}
                                    disabled={startingSession}
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        fontSize: '0.85rem',
                                        padding: '0.5rem',
                                        gap: '0.5rem',
                                        background: 'rgba(99,102,241,0.12)',
                                        borderColor: 'rgba(99,102,241,0.3)',
                                        color: '#818cf8'
                                    }}
                                >
                                    <Zap size={16} />
                                    <span>Start 20-Sec Live Session</span>
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="glass-panel empty-state" style={{ gridColumn: '1 / -1' }}>
                            <p>No subjects available for attendance marking.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="marking-view">
                    <div className="marking-controls glass-panel">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search students..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="attendance-summary">
                            <div className="summary-item">
                                <span className="label">Present (Code Sent):</span>
                                <span className="count text-success">
                                    {filteredStudents.filter(s => attendanceSheet[s._id || s] === 'Present').length}
                                </span>
                            </div>
                            <div className="summary-item">
                                <span className="label">Absent:</span>
                                <span className="count text-danger">
                                    {filteredStudents.filter(s => attendanceSheet[s._id || s] !== 'Present').length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="student-attendance-list glass-panel">
                        {loading ? (
                            <p style={{ padding: '2rem', textAlign: 'center' }}>Loading roster...</p>
                        ) : filteredStudents.length > 0 ? (
                            <table className="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Roll No</th>
                                        <th>Student</th>
                                        <th>Email</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student, idx) => {
                                        const sId = student._id || student;
                                        const sName = student.name || 'Student';
                                        const sEmail = student.email || '';
                                        const rollDisplay = deriveRollNo(student, idx);
                                        const isPresent = attendanceSheet[sId] === 'Present';

                                        return (
                                            <tr key={sId}>
                                                <td>
                                                    <span className="badge badge-primary font-mono" style={{ fontSize: '0.8rem', fontWeight: '700', padding: '0.35rem 0.65rem' }}>
                                                        {rollDisplay}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="stu-profile">
                                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=374151&color=ffffff`} alt={sName} />
                                                        <span>{sName}</span>
                                                    </div>
                                                </td>
                                                <td className="text-muted font-mono">{sEmail}</td>
                                                <td>
                                                    <div className="status-toggles" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <button
                                                            className={`status-btn p-btn ${isPresent ? 'active' : ''}`}
                                                            onClick={() => handleStatusChange(sId, 'Present')}
                                                        >
                                                            <CheckCircle2 size={18} />
                                                            <span>Present</span>
                                                        </button>
                                                        <button
                                                            className={`status-btn a-btn ${!isPresent ? 'active' : ''}`}
                                                            onClick={() => handleStatusChange(sId, 'Absent')}
                                                        >
                                                            <XCircle size={18} />
                                                            <span>Absent</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ padding: '2rem', textAlign: 'center' }} className="text-muted">No students currently enrolled in this subject.</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── IN-APP CAMERA SCANNER MODAL (PRIMARY FLOW FOR STUDENT) ── */}
            {showCameraModal && createPortal(
                <div className="modal-overlay" onClick={stopCameraScanner} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1rem' }}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.5rem', textAlign: 'center' }}>
                        <div className="modal-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                                <Camera size={20} className="text-primary" />
                                <span>Scan Class QR Code</span>
                            </h3>
                            <button className="close-btn" onClick={stopCameraScanner}><X size={20} /></button>
                        </div>

                        {cameraError ? (
                            <div style={{ padding: '1.5rem 1rem', color: '#ef4444' }}>
                                <AlertCircle size={36} style={{ margin: '0 auto 0.75rem' }} />
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>{cameraError}</p>
                            </div>
                        ) : (
                            <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#000', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {cameraLoading && (
                                    <div style={{ position: 'absolute', color: '#fff', fontSize: '0.9rem' }}>
                                        Opening camera...
                                    </div>
                                )}
                                <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <canvas ref={canvasRef} style={{ display: 'none' }} />

                                {/* Viewfinder overlay */}
                                <div style={{
                                    position: 'absolute',
                                    width: '200px',
                                    height: '200px',
                                    border: '3px solid #818cf8',
                                    borderRadius: '16px',
                                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                                    pointerEvents: 'none'
                                }} />
                            </div>
                        )}

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                            Point your camera at the QR code on your teacher's screen
                        </p>
                    </div>
                </div>,
                document.body
            )}

            {/* ── TEACHER ENLARGED QR MODAL ── */}
            {showQRModal && activeSession && createPortal(
                <div className="modal-overlay" onClick={() => setShowQRModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1rem' }}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '2rem', textAlign: 'center' }}>
                        <div className="modal-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#fff' }}>Classroom Attendance Pass</h3>
                            <button className="close-btn" onClick={() => setShowQRModal(false)}><X size={20} /></button>
                        </div>

                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', marginBottom: '1.25rem' }}>
                            <QRCodeSVG
                                value={`${window.location.origin}/attendance?qrToken=${activeSession.qrToken || ''}&code=${activeSession.code || ''}`}
                                size={260}
                                level="H"
                            />
                        </div>

                        <h3 style={{ color: '#818cf8', margin: '0 0 0.25rem' }}>{activeSession.courseName || activeSession.courseId}</h3>
                        <p style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '0.2em', color: '#2dd4bf', margin: '0.5rem 0' }}>
                            CODE: {activeSession.code}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            Scan with mobile camera or enter code on app
                        </p>
                    </div>
                </div>,
                document.body
            )}

            {/* ── OFFICIAL ROLL CALL EXCEL EXPORT MODAL ── */}
            {showExportModal && createPortal(
                <div className="modal-overlay" onClick={() => setShowExportModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1rem' }}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
                        <div className="modal-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Award size={20} style={{ color: '#22c55e' }} />
                                <span>Export Official Roll Call Excel</span>
                            </h3>
                            <button className="close-btn" onClick={() => setShowExportModal(false)}><X size={20} /></button>
                        </div>

                        {exportError && (
                            <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                                {exportError}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Subject / Course Code</label>
                                <select
                                    value={exportConfig.courseId}
                                    onChange={(e) => setExportConfig({ ...exportConfig, courseId: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--surface-border)' }}
                                >
                                    {courses.map(c => (
                                        <option key={c._id} value={c.code || c._id} style={{ background: '#1e293b' }}>
                                            {c.code ? `${c.code} - ${c.name}` : c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Academic Year</label>
                                    <select
                                        value={exportConfig.year}
                                        onChange={(e) => setExportConfig({ ...exportConfig, year: e.target.value })}
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--surface-border)' }}
                                    >
                                        <option value="1st Year" style={{ background: '#1e293b' }}>1st Year</option>
                                        <option value="2nd Year" style={{ background: '#1e293b' }}>2nd Year</option>
                                        <option value="3rd Year" style={{ background: '#1e293b' }}>3rd Year</option>
                                        <option value="4th Year" style={{ background: '#1e293b' }}>4th Year</option>
                                        <option value="5th Year" style={{ background: '#1e293b' }}>5th Year</option>
                                        <option value="6th Year" style={{ background: '#1e293b' }}>6th Year</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Semester</label>
                                    <select
                                        value={exportConfig.semester}
                                        onChange={(e) => setExportConfig({ ...exportConfig, semester: e.target.value })}
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--surface-border)' }}
                                    >
                                        <option value="1" style={{ background: '#1e293b' }}>Semester I</option>
                                        <option value="2" style={{ background: '#1e293b' }}>Semester II</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Template Format</label>
                                    <select
                                        value={exportConfig.templateType}
                                        onChange={(e) => setExportConfig({ ...exportConfig, templateType: e.target.value })}
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--surface-border)' }}
                                    >
                                        <option value="daily" style={{ background: '#1e293b' }}>Daily Roll Call (Sheet V)</option>
                                        <option value="tutorial" style={{ background: '#1e293b' }}>Tutorial Sign-off (Sheet1)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Month</label>
                                    <input
                                        type="text"
                                        value={exportConfig.month}
                                        onChange={(e) => setExportConfig({ ...exportConfig, month: e.target.value })}
                                        placeholder="e.g. ဇန်နဝါရီ"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--surface-border)' }}
                                    />
                                </div>
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={handleDownloadRollCallExcel}
                                disabled={exporting}
                                style={{ marginTop: '0.5rem', width: '100%', padding: '0.8rem' }}
                            >
                                {exporting ? 'Generating Spreadsheet...' : 'Download Roll Call (.xlsx)'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Attendance;
