import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Users, BookOpen, ChevronRight, ArrowLeft, CheckCircle2, XCircle, Clock, Save, Search, Award, TrendingUp, Zap, KeyRound, Send, Check } from 'lucide-react';
import './Attendance.css';

const Attendance = () => {
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'Student';
    const isTeacher = user?.role === 'Teacher';
    const isAdmin = user?.role === 'Admin';
    const canManageAttendance = isAdmin || isTeacher;

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

    // State for Active Live Session (Zero-Tap / Code)
    const [activeSession, setActiveSession] = useState(null);
    const [inputCode, setInputCode] = useState('');
    const [codeSubmitting, setCodeSubmitting] = useState(false);
    const [codeMessage, setCodeMessage] = useState('');
    const [codeSuccess, setCodeSuccess] = useState(false);
    const [startingSession, setStartingSession] = useState(false);

    // State for Student personal view
    const [studentAttendanceLogs, setStudentAttendanceLogs] = useState([]);
    const [studentStats, setStudentStats] = useState({ present: 0, late: 0, absent: 0, total: 0, percentage: '100%' });

    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

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

    // Teacher/Admin manually starts a live session
    const handleStartLiveSession = async (course) => {
        setStartingSession(true);
        try {
            const { data } = await apiClient.post('/attendance/create-session', {
                courseId: course.code || course._id,
                courseName: course.title || course.name || course.code,
                durationMinutes: 5
            });
            setActiveSession(data);
            setMessage(`⚡ Live session started for ${course.name || course.code}! 4-Digit Code: ${data.code}`);
        } catch (err) {
            console.error('Failed to start live session:', err);
            setMessage('Failed to start live session');
        } finally {
            setStartingSession(false);
        }
    };

    // Student submits 4-digit code
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
            // Refresh student stats
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            setCodeSuccess(false);
            setCodeMessage(err.response?.data?.message || 'Invalid or expired code');
        } finally {
            setCodeSubmitting(false);
        }
    };

    // Load courses for Teacher / Admin
    useEffect(() => {
        if (!canManageAttendance) return;
        const fetchCourses = async () => {
            setLoading(true);
            try {
                const { data } = await apiClient.get('/courses');
                setCourses(data);
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
        const fetchStudentAttendance = async () => {
            setLoading(true);
            try {
                const { data } = await apiClient.get(`/attendance?student=${user._id}`);
                setStudentAttendanceLogs(data);

                let present = 0;
                let late = 0;
                let absent = 0;
                let total = 0;

                data.forEach(log => {
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
    }, [isStudent, user._id]);

    // Load attendance marking sheet for selected course and date
    const loadCourseAttendance = useCallback(async (course, date) => {
        setLoading(true);
        try {
            // Get enrolled students from course object or students list
            const studentsInCourse = course.students || [];
            setStudentRoster(studentsInCourse);

            // Fetch existing attendance logs for this course on date
            const { data } = await apiClient.get(`/attendance/course/${course._id}?date=${date}`);
            const existingSheet = {};

            if (data && data.length > 0 && data[0].records) {
                data[0].records.forEach(r => {
                    const studentId = r.student?._id || r.student;
                    if (studentId) existingSheet[studentId] = r.status;
                });
            } else {
                // Default everyone to Present
                studentsInCourse.forEach(s => {
                    const sId = s._id || s;
                    existingSheet[sId] = 'Present';
                });
            }

            setAttendanceSheet(existingSheet);
        } catch (err) {
            console.error('Error loading course attendance:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
        setView('marking');
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
            const recordsPayload = Object.entries(attendanceSheet).map(([studentId, status]) => ({
                student: studentId,
                status
            }));

            await apiClient.post('/attendance', {
                course: selectedCourse._id,
                date: selectedDate,
                records: recordsPayload
            });

            setMessage(`Attendance saved for ${selectedCourse.name} on ${selectedDate}`);
            setTimeout(() => setMessage(''), 4000);
        } catch (err) {
            console.error('Failed to save attendance:', err);
            alert(err.response?.data?.message || 'Failed to save attendance.');
        } finally {
            setSaving(false);
        }
    };

    // Filter courses by selected year and search
    const filteredCourses = courses.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.code.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Filter student roster by search
    const filteredStudents = studentRoster.filter(s => {
        const name = s.name || '';
        const email = s.email || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase()) || email.toLowerCase().includes(searchTerm.toLowerCase());
    });

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

                {/* ── Active Live Session Banner for Student ── */}
                {activeSession && (
                    <div className="glass-panel" style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: '16px',
                        marginBottom: '1.5rem',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                        border: '1px solid rgba(99,102,241,0.3)',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <Zap size={22} style={{ color: '#818cf8', animation: 'pulse 1.5s infinite' }} />
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                                    Live Attendance Active: <span style={{ color: '#a78bfa' }}>{activeSession.courseName || activeSession.courseId}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Enter the 4-digit code displayed by your teacher before it expires
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitCode} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: '1', maxWidth: '240px' }}>
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
                                className="btn btn-primary"
                                disabled={codeSubmitting || inputCode.length !== 4}
                                style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Send size={16} />
                                {codeSubmitting ? 'Verifying...' : 'Submit Code'}
                            </button>
                        </form>

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
                                        return (
                                            <tr key={log._id}>
                                                <td>{new Date(log.date).toLocaleDateString()}</td>
                                                <td><span className="font-mono">{log.course || 'Course'}</span></td>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Zap size={24} style={{ color: '#14b8a6' }} />
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                                    Active Live Session: <span style={{ color: '#2dd4bf' }}>{activeSession.courseName || activeSession.courseId}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Students can enter this code to mark themselves Present
                                </p>
                            </div>
                        </div>
                        <div style={{
                            background: 'rgba(0,0,0,0.4)',
                            padding: '0.5rem 1.25rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(45,212,191,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passcode:</span>
                            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#2dd4bf', letterSpacing: '0.25em' }}>{activeSession.code}</span>
                        </div>
                    </div>
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
                                    <span>Start 5-Min Live Session</span>
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
                                <span className="label">Present:</span>
                                <span className="count text-success">
                                    {Object.values(attendanceSheet).filter(s => s === 'Present').length}
                                </span>
                            </div>
                            <div className="summary-item">
                                <span className="label">Late:</span>
                                <span className="count text-warning" style={{ color: '#eab308' }}>
                                    {Object.values(attendanceSheet).filter(s => s === 'Late').length}
                                </span>
                            </div>
                            <div className="summary-item">
                                <span className="label">Absent:</span>
                                <span className="count text-danger">
                                    {Object.values(attendanceSheet).filter(s => s === 'Absent').length}
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
                                        <th>Student</th>
                                        <th>Email</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(student => {
                                        const sId = student._id || student;
                                        const sName = student.name || 'Student';
                                        const sEmail = student.email || '';
                                        const currentStatus = attendanceSheet[sId] || 'Present';

                                        return (
                                            <tr key={sId}>
                                                <td>
                                                    <div className="stu-profile">
                                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=374151&color=ffffff`} alt={sName} />
                                                        <span>{sName}</span>
                                                    </div>
                                                </td>
                                                <td className="text-muted font-mono">{sEmail}</td>
                                                <td>
                                                    <div className="status-toggles">
                                                        <button
                                                            className={`status-btn p-btn ${currentStatus === 'Present' ? 'active' : ''}`}
                                                            onClick={() => handleStatusChange(sId, 'Present')}
                                                        >
                                                            <CheckCircle2 size={18} />
                                                            <span>Present</span>
                                                        </button>
                                                        <button
                                                            className={`status-btn l-btn ${currentStatus === 'Late' ? 'active' : ''}`}
                                                            onClick={() => handleStatusChange(sId, 'Late')}
                                                        >
                                                            <Clock size={18} />
                                                            <span>Late</span>
                                                        </button>
                                                        <button
                                                            className={`status-btn a-btn ${currentStatus === 'Absent' ? 'active' : ''}`}
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
        </div>
    );
};

export default Attendance;
