import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import {
    ArrowRight, BookOpen, Calendar, CheckCircle2,
    Clock, ClipboardCheck, FileText, TrendingUp, ShieldCheck
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import EmptyState from '../../components/EmptyState';
import './StudentDashboard.css';

// Convert percentage to institutional letter grade (hides raw numerical marks)
const getLetterGrade = (percent) => {
    if (percent == null) return 'N/A';
    if (percent >= 80) return 'A';
    if (percent >= 65) return 'B';
    if (percent >= 50) return 'C';
    if (percent >= 40) return 'D';
    return 'F';
};

const StudentDashboard = () => {
    const { user } = useContext(AuthContext);
    const studentId = user?._id;

    const [stats, setStats] = useState(null);
    const [exams, setExams] = useState([]);
    const [grades, setGrades] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [studentCourses, setStudentCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsRes, coursesRes, configRes, examsRes, gradesRes, attendanceRes, notifRes] = await Promise.allSettled([
                    apiClient.get('/dashboard/stats'),
                    apiClient.get('/courses'),
                    apiClient.get('/academic-config'),
                    apiClient.get('/sessions', { params: { sessionType: 'Exam' } }),
                    apiClient.get('/grades', { params: { student: studentId } }),
                    apiClient.get('/attendance', { params: { student: studentId } }),
                    apiClient.get('/notifications'),
                ]);

                if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);

                if (coursesRes.status === 'fulfilled') {
                    const allC = Array.isArray(coursesRes.value.data) ? coursesRes.value.data : [];
                    const studentYearStr = String(user?.year || '1st Year');
                    const userYNum = parseInt(studentYearStr.replace(/\D/g, ''), 10) || 1;
                    
                    let activeSemNum = 1;
                    if (configRes.status === 'fulfilled' && configRes.value.data) {
                        const cfg = configRes.value.data;
                        const perYearTerms = cfg.perYearActiveTerms || {};
                        const yearKey = `${userYNum}th Year`;
                        const termStr = perYearTerms[yearKey] || perYearTerms[`${userYNum}`] || cfg.activeTerm || 'Semester 1';
                        if (termStr.includes('2')) activeSemNum = 2;
                    }

                    const junkRegex = /^(introduction|tutorial\s*i+|testing\s*job|practical\s*lab|prepared|approved|sr\.?|batch|group)/i;
                    const myYearCourses = allC.filter(c => {
                        const yNum = c.year || parseInt(String(c.yearLabel || '').replace(/\D/g, ''), 10);
                        const cName = (c.name || '').trim();
                        if (junkRegex.test(cName)) return false;
                        if (yNum !== userYNum) return false;

                        // Derive semester
                        let cSem = c.semester;
                        if (!cSem) {
                            const digits = String(c.code || '').replace(/[^0-9]/g, '');
                            if (digits.length >= 5) {
                                const d = parseInt(digits[1], 10);
                                if (d === 1 || d === 2) cSem = d;
                            }
                        }
                        if (cSem && cSem !== activeSemNum) return false;

                        return true;
                    });
                    setStudentCourses(myYearCourses);
                }

                let examSessionsData = [];
                if (examsRes.status === 'fulfilled') {
                    examSessionsData = Array.isArray(examsRes.value.data) ? examsRes.value.data : [];
                    setExams(examSessionsData);
                }

                if (gradesRes.status === 'fulfilled') setGrades(Array.isArray(gradesRes.value.data) ? gradesRes.value.data : []);
                if (attendanceRes.status === 'fulfilled') setAttendance(Array.isArray(attendanceRes.value.data) ? attendanceRes.value.data : []);

                // Combine backend notifications with client-generated exam reminders
                let backendNotifs = [];
                if (notifRes.status === 'fulfilled') {
                    backendNotifs = Array.isArray(notifRes.value.data) ? notifRes.value.data : [];
                }

                // Generate exam reminder notifications from session data (so they show even before VPS backend update)
                const examReminders = examSessionsData
                    .filter(s => {
                        const d = new Date(s.date);
                        return !isNaN(d.getTime()) && d >= new Date(new Date().setHours(0, 0, 0, 0));
                    })
                    .slice(0, 5)
                    .map(s => {
                        const daysLeft = Math.max(1, Math.ceil((new Date(s.date).getTime() - Date.now()) / (1000 * 3600 * 24)));
                        return {
                            _id: `exam-notif-${s._id}`,
                            type: 'exam',
                            message: `📝 Upcoming Exam (${daysLeft} day${daysLeft > 1 ? 's' : ''} away): [${s.courseCode}] ${s.title || s.courseName || ''} on ${new Date(s.date).toLocaleDateString()} (${s.startTime || '08:30 AM'}) at ${s.place || 'Hall'}.`,
                            createdAt: s.createdAt || new Date().toISOString(),
                            read: false
                        };
                    });

                // Merge: backend notifs first, then exam reminders (avoid duplicates)
                const existingIds = new Set(backendNotifs.map(n => n._id));
                const mergedNotifs = [...backendNotifs, ...examReminders.filter(r => !existingIds.has(r._id))];
                setNotifications(mergedNotifs.slice(0, 5));
            } catch (err) {
                console.error('Failed to fetch student dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (studentId) fetchData();
    }, [studentId]);

    // Attendance percentage
    const attendancePercent = useMemo(() => {
        if (!attendance || attendance.length === 0) return null;
        const present = attendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
        return Math.round((present / attendance.length) * 100);
    }, [attendance]);

    // Attendance trend (last 7 records)
    const attendanceTrend = useMemo(() => {
        if (!attendance || attendance.length === 0) return [];
        return attendance.slice(-7).map((a) => ({
            day: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
            attendance: a.status === 'Present' ? 100 : a.status === 'Late' ? 75 : 0,
        }));
    }, [attendance]);

    // Upcoming exams — show all exams with future dates, or if none, show most recent ones
    const upcomingExams = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const futureExams = exams
            .filter(ex => {
                const examDate = new Date(ex.date);
                return !isNaN(examDate.getTime()) && examDate >= now;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        // If no future exams found, just show latest ones so count isn't always 0
        if (futureExams.length === 0 && exams.length > 0) {
            return exams.slice(0, 3);
        }
        return futureExams.slice(0, 5);
    }, [exams]);

    // Latest grades from dashboard stats
    const latestGrades = stats?.latestGrades || [];

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

            {/* ── Stats Grid ── */}
            <div className="stats-grid">
                <div className="glass-card stat-card">
                    <div className="stat-icon student-courses-icon">
                        <BookOpen size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{(stats?.activeCourses && stats.activeCourses > 0) ? stats.activeCourses : (studentCourses.length || grades.length || 0)}</h3>
                        <p>Active Courses</p>
                    </div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-icon student-assignments-icon">
                        <ClipboardCheck size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.assignmentsDue ?? 0}</h3>
                        <p>Assignments Due</p>
                    </div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-icon student-attendance-icon">
                        <Calendar size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{attendancePercent !== null ? `${attendancePercent}%` : 'N/A'}</h3>
                        <p>{attendancePercent !== null ? 'Attendance Rate' : 'No attendance data'}</p>
                    </div>
                </div>

                <div className="glass-card stat-card highlight-card">
                    <div className="stat-icon student-gpa-icon">
                        <Calendar size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{upcomingExams.length}</h3>
                        <p>Upcoming Exams</p>
                    </div>
                </div>
            </div>

            {/* ── Two Column Grid: Attendance + Results ── */}
            <div className="student-insights-grid">
                {/* Left: Attendance Trend */}
                <div className="glass-card attendance-section">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Attendance Trends</h2>
                            <span className="text-muted text-sm">Recent Activity</span>
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
                                        <linearGradient id="colorStudentAttend" x1="0" y1="0" x2="0" y2="1">
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
                                        fill="url(#colorStudentAttend)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Clock}
                            message="No attendance data recorded yet"
                            submessage="Attendance trends will appear once classes begin"
                        />
                    )}
                </div>

                {/* Right: Latest Results (Hides raw marks, displays Letter Grade only) */}
                <div className="glass-card results-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Latest Results</h2>
                            <span className="text-muted text-sm">Official Letter Grades</span>
                        </div>
                        <Link to="/grades" className="view-link">
                            View All
                            <ArrowRight size={16} />
                        </Link>
                    </div>

                    {latestGrades.length > 0 ? (
                        <div className="results-list">
                            {latestGrades.map((grade, idx) => {
                                const letter = getLetterGrade(grade.percent);
                                return (
                                    <div key={idx} className="result-row glass-panel">
                                        <div className="result-icon">
                                            <FileText size={16} />
                                        </div>
                                        <div className="result-info">
                                            <h4>{grade.courseName || grade.courseCode}</h4>
                                            <p>{grade.assessmentType || 'Assessment'}</p>
                                        </div>
                                        <div className="result-score">
                                            <span className={`score-value ${
                                                letter === 'A' || letter === 'B' ? 'score-good' :
                                                letter === 'C' || letter === 'D' ? 'score-ok' : 'score-low'
                                            }`}>
                                                Grade {letter}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            icon={TrendingUp}
                            message="No results available yet"
                            submessage="Your letter grades will appear here once published"
                        />
                    )}
                </div>
            </div>

            {/* ── Bottom Row: Exams + Notifications ── */}
            <div className="student-bottom-grid">
                {/* Upcoming Exams */}
                <div className="glass-card exams-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Upcoming Exams</h2>
                            <span className="text-muted text-sm">
                                {upcomingExams.length} upcoming
                            </span>
                        </div>
                        <Link to="/exams" className="view-link">
                            View All
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="mini-list">
                        {upcomingExams.length > 0 ? upcomingExams.map(ex => (
                            <div key={ex._id} className="mini-item glass-panel">
                                <div className="item-date">
                                    <span className="month">
                                        {new Date(ex.date).toLocaleString('default', { month: 'short' })}
                                    </span>
                                    <span className="day">{new Date(ex.date).getDate()}</span>
                                </div>
                                <div className="item-info">
                                    <h4>{ex.title || ex.courseName || ex.courseCode || 'Examination'}</h4>
                                    <p>{ex.courseCode || ex.course || ''} • {ex.startTime || ex.time || ''} • {ex.place || ex.room || ''}</p>
                                </div>
                            </div>
                        )) : (
                            <EmptyState
                                icon={CheckCircle2}
                                message="No upcoming exams"
                                submessage="You're all caught up!"
                                compact
                            />
                        )}
                    </div>
                </div>

                {/* Latest Notifications */}
                <div className="glass-card notifications-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Notifications</h2>
                            <span className="text-muted text-sm">Latest updates</span>
                        </div>
                        <Link to="/notifications" className="view-link">
                            View All
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="notif-list">
                        {notifications.length > 0 ? notifications.map(notif => (
                            <div key={notif._id} className="notif-item">
                                <div className="notif-dot"></div>
                                <div className="notif-content">
                                    <p>{notif.message}</p>
                                    <span>{new Date(notif.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-muted text-sm" style={{ padding: '1rem 0' }}>
                                No recent notifications
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
