import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Users, BookOpen, ChevronRight, ArrowLeft, CheckCircle2, XCircle, Clock, Save, Search, Award, TrendingUp } from 'lucide-react';
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

    // State for Student personal view
    const [studentAttendanceLogs, setStudentAttendanceLogs] = useState([]);
    const [studentStats, setStudentStats] = useState({ present: 0, late: 0, absent: 0, total: 0, percentage: '100%' });

    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

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
                                onClick={() => handleCourseSelect(course)}
                            >
                                <div className="course-card-icon" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                                    <BookOpen size={32} />
                                </div>
                                <div className="course-card-info">
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
