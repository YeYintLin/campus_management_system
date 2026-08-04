import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import {
    AlertTriangle, ArrowRight, Bell, BookOpen, Calendar, CheckCircle2,
    Clock, ClipboardList, FileSpreadsheet, Upload, Users
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import EmptyState from '../../components/EmptyState';
import './TeacherDashboard.css';

const TeacherDashboard = () => {
    const { user } = useContext(AuthContext);

    const [stats, setStats] = useState(null);
    const [atRiskStudents, setAtRiskStudents] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [upcomingExams, setUpcomingExams] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsRes, riskRes, attRes, examsRes, notifRes] = await Promise.allSettled([
                    apiClient.get('/dashboard/stats'),
                    apiClient.get('/dashboard/at-risk', { params: { scope: 'own' } }),
                    apiClient.get('/attendance'),
                    apiClient.get('/sessions', { params: { sessionType: 'Exam' } }),
                    apiClient.get('/notifications'),
                ]);
                if (statsRes.status === 'fulfilled') setStats(statsRes.data);
                if (riskRes.status === 'fulfilled') setAtRiskStudents(Array.isArray(riskRes.data) ? riskRes.data : []);
                if (attRes.status === 'fulfilled') setAttendance(Array.isArray(attRes.data) ? attRes.data : []);
                if (examsRes.status === 'fulfilled') {
                    const examData = Array.isArray(examsRes.value?.data) ? examsRes.value.data : [];
                    const upcoming = examData.filter(ex => {
                        const d = new Date(ex.date);
                        return !isNaN(d.getTime()) && d >= new Date();
                    }).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
                    setUpcomingExams(upcoming);
                }
                if (notifRes.status === 'fulfilled') setNotifications(Array.isArray(notifRes.value?.data) ? notifRes.value.data.slice(0, 5) : []);
            } catch (err) {
                console.error('Failed to fetch teacher dashboard data:', err);
                setError('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Build attendance trend from own classes
    const attendanceTrend = (() => {
        if (!attendance || attendance.length === 0) return [];
        return attendance.slice(-7).map((a) => {
            const totalRecords = a.records?.length || 0;
            const presentCount = a.records?.filter(
                r => r.status === 'Present' || r.status === 'Late'
            ).length || 0;
            return {
                day: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
                attendance: totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
            };
        });
    })();

    const todayDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <div className="dashboard-loading">
                    <Clock size={28} className="spin" />
                    <p>Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container animate-fade-in">
            {/* ── Header ── */}
            <header className="dashboard-header">
                <div>
                    <h1>Welcome back, {user?.name}!</h1>
                    <p className="subtitle">{todayDate}</p>
                </div>
            </header>

            {error && <p className="text-muted text-sm">{error}</p>}

            {/* ── Stats Grid ── */}
            <div className="stats-grid">
                <div className="glass-card stat-card">
                    <div className="stat-icon courses-icon">
                        <BookOpen size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.activeCourses ?? 0}</h3>
                        <p>My Classes</p>
                    </div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-icon students-icon">
                        <Users size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.myStudentCount ?? 0}</h3>
                        <p>My Students</p>
                    </div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-icon assignments-icon">
                        <Calendar size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.upcomingExams ?? upcomingExams.length}</h3>
                        <p>Upcoming Exams</p>
                    </div>
                </div>

                <div className="glass-card stat-card highlight-card">
                    <div className="stat-icon risk-icon">
                        <AlertTriangle size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{atRiskStudents.length}</h3>
                        <p>At-Risk Students</p>
                    </div>
                </div>
            </div>

            {/* ── Today's Schedule ── */}
            <div className="glass-card schedule-card">
                <div className="section-header">
                    <div className="header-info">
                        <h2>Today's Schedule</h2>
                        <span className="text-muted text-sm">
                            {stats?.todaySchedule?.length || 0} class{(stats?.todaySchedule?.length || 0) !== 1 ? 'es' : ''} today
                        </span>
                    </div>
                    <Link to="/time-table" className="view-link">
                        Full Timetable
                        <ArrowRight size={16} />
                    </Link>
                </div>

                {stats?.todaySchedule && stats.todaySchedule.length > 0 ? (
                    <div className="schedule-list">
                        {stats.todaySchedule.map((slot) => (
                            <div key={slot._id} className="schedule-row glass-panel">
                                <div className="schedule-time">
                                    <Clock size={14} />
                                    <span>{slot.time}</span>
                                </div>
                                <div className="schedule-details">
                                    <h4>{slot.courseName}</h4>
                                    <p>{slot.courseCode} · {slot.room} · {slot.type}</p>
                                </div>
                                <Link
                                    to={`/attendance`}
                                    className="schedule-action-btn"
                                >
                                    <ClipboardList size={14} />
                                    Attendance
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={CheckCircle2}
                        message="No classes scheduled for today"
                        submessage="Enjoy your free day!"
                    />
                )}
            </div>

            {/* ── Two Column Grid: Attendance Trend + At-Risk ── */}
            <div className="teacher-insights-grid">
                {/* Left: Attendance Trend (own classes) */}
                <div className="glass-card attendance-section">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>My Classes Attendance</h2>
                            <span className="text-muted text-sm">Last 7 sessions</span>
                        </div>
                        <Link to="/attendance" className="view-link">
                            View All
                            <ArrowRight size={16} />
                        </Link>
                    </div>

                    {attendanceTrend.length > 0 ? (
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTeacherAttend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="day"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                        tickFormatter={(value) => `${value}%`}
                                        domain={[0, 100]}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(30, 41, 59, 0.8)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            backdropFilter: 'blur(8px)',
                                            color: '#fff'
                                        }}
                                        itemStyle={{ color: 'var(--primary-color)' }}
                                        formatter={(value) => [`${value}%`, 'Attendance']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="attendance"
                                        stroke="var(--primary-color)"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorTeacherAttend)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Clock}
                            message="No attendance data yet"
                            submessage="Attendance trends will appear once you start recording"
                        />
                    )}
                </div>

                {/* Right: At-Risk Students (own classes) */}
                <div className="glass-card attention-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>At-Risk Students</h2>
                            <span className="text-muted text-sm">From your classes</span>
                        </div>
                        <AlertTriangle size={20} className="section-icon warning-icon" />
                    </div>

                    <div className="attention-list">
                        {atRiskStudents.length > 0 ? atRiskStudents.slice(0, 5).map(student => (
                            <div key={student._id} className="attention-row">
                                <div className="attention-avatar">
                                    {student.name?.charAt(0) || 'S'}
                                </div>
                                <div className="attention-info">
                                    <h4>{student.name || 'Student'}</h4>
                                    <p>{student.enrollmentNumber || 'No enrollment no.'}</p>
                                </div>
                                <div className="risk-reasons">
                                    {student.riskReasons?.map((reason, idx) => (
                                        <span key={idx} className={`risk-pill ${
                                            reason.startsWith('Attendance') ? 'risk-attendance' :
                                            reason.startsWith('Failing') ? 'risk-failing' :
                                            'risk-status'
                                        }`}>
                                            {reason}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <div className="attention-empty">
                                <CheckCircle2 size={22} />
                                <span>All your students are on track!</span>
                            </div>
                        )}
                    </div>

                    {atRiskStudents.length > 5 && (
                        <Link to="/students" className="view-link" style={{ marginTop: '0.8rem', display: 'inline-flex' }}>
                            View all {atRiskStudents.length} students
                            <ArrowRight size={14} />
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="quick-actions-bar">
                <Link to="/grades?import=true" className="glass-card quick-action-card">
                    <div className="quick-action-icon upload-icon">
                        <Upload size={20} />
                    </div>
                    <div className="quick-action-info">
                        <h4>Import Marks</h4>
                        <p>Upload Excel marks sheet</p>
                    </div>
                    <ArrowRight size={16} className="quick-action-arrow" />
                </Link>

                <Link to="/attendance" className="glass-card quick-action-card">
                    <div className="quick-action-icon export-icon">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div className="quick-action-info">
                        <h4>Export Attendance</h4>
                        <p>Download as Excel file</p>
                    </div>
                    <ArrowRight size={16} className="quick-action-arrow" />
                </Link>
            </div>
            {/* ── Bottom Row: Upcoming Exams + Notifications ── */}
            <div className="teacher-insights-grid" style={{ marginTop: '1.5rem' }}>
                {/* Upcoming Exams */}
                <div className="glass-card attendance-section">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Upcoming Exams</h2>
                            <span className="text-muted text-sm">{upcomingExams.length} upcoming</span>
                        </div>
                        <Link to="/exams" className="view-link">
                            View All
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {upcomingExams.length > 0 ? upcomingExams.map(ex => (
                            <div key={ex._id} className="schedule-row glass-panel">
                                <div className="schedule-time">
                                    <Calendar size={14} />
                                    <span>{ex.date ? new Date(ex.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }) : 'TBA'}</span>
                                </div>
                                <div className="schedule-details">
                                    <h4>{ex.title || ex.courseName || 'Examination'}</h4>
                                    <p>{ex.courseCode || ''} · {ex.startTime || '08:30 AM'} · {ex.place || 'Hall'}</p>
                                </div>
                            </div>
                        )) : (
                            <EmptyState
                                icon={CheckCircle2}
                                message="No upcoming exams"
                                submessage="No exam sessions scheduled"
                                compact
                            />
                        )}
                    </div>
                </div>

                {/* Notifications */}
                <div className="glass-card attention-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Notifications</h2>
                            <span className="text-muted text-sm">Latest updates</span>
                        </div>
                        <Bell size={20} className="section-icon" />
                    </div>
                    <div className="attention-list">
                        {notifications.length > 0 ? notifications.map(notif => (
                            <div key={notif._id} className="attention-row">
                                <div className="attention-avatar" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>!</div>
                                <div className="attention-info">
                                    <h4 style={{ fontSize: '0.85rem' }}>{notif.message}</h4>
                                    <p>{new Date(notif.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="attention-empty">
                                <CheckCircle2 size={22} />
                                <span>No recent notifications</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
