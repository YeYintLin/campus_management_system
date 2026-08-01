import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
    AlertTriangle, ArrowRight, Award, Bell, BookOpen,
    CheckCircle2, Clock, FileText, TrendingUp, UserRoundCheck, Users
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import EmptyState from '../../components/EmptyState';
import './AdminDashboard.css';

const STATUS_COLORS = {
    Active: '#22c55e',
    Probation: '#f59e0b',
    Suspended: '#f43f5e',
};

const YEAR_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#22c55e', '#ec4899', '#f97316'];

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);

    const [stats, setStats] = useState(null);
    const [atRiskStudents, setAtRiskStudents] = useState([]);
    const [passRates, setPassRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsRes, riskRes, passRes] = await Promise.all([
                    apiClient.get('/dashboard/stats'),
                    apiClient.get('/dashboard/at-risk', { params: { scope: 'all' } }),
                    apiClient.get('/dashboard/pass-rates'),
                ]);
                setStats(statsRes.data);
                setAtRiskStudents(Array.isArray(riskRes.data) ? riskRes.data : []);
                setPassRates(Array.isArray(passRes.data) ? passRes.data : []);
            } catch (err) {
                console.error('Failed to fetch admin dashboard data:', err);
                setError('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Build status data for pie chart
    const statusData = stats?.studentsByStatus
        ? ['Active', 'Probation', 'Suspended'].map(status => ({
            name: status,
            value: stats.studentsByStatus[status] || 0,
        }))
        : [];

    const activeCount = stats?.studentsByStatus?.Active || 0;

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
                    <p>Loading dashboard...</p>
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
                    <div className="stat-icon admin-students-icon">
                        <Users size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.totalStudents ?? 0}</h3>
                        <p>Total Students</p>
                    </div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-icon admin-courses-icon">
                        <BookOpen size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.activeCourses ?? 0}</h3>
                        <p>Active Courses</p>
                    </div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-icon admin-notif-icon">
                        <Bell size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{stats?.notificationsSentToday ?? 0}</h3>
                        <p>Notifications Today</p>
                    </div>
                </div>

                <div className="glass-card stat-card highlight-card">
                    <div className="stat-icon admin-risk-icon">
                        <AlertTriangle size={22} />
                    </div>
                    <div className="stat-info">
                        <h3>{atRiskStudents.length}</h3>
                        <p>At-Risk Students</p>
                    </div>
                </div>
            </div>

            {/* ── Row: Students By Year + Status Pie ── */}
            <div className="admin-insights-grid">
                {/* Left: Students By Year */}
                <div className="glass-card year-breakdown-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Students by Year</h2>
                            <span className="text-muted text-sm">
                                {stats?.totalStudents || 0} total across all years
                            </span>
                        </div>
                        <Users size={20} className="section-icon" />
                    </div>

                    {stats?.studentsByYear && stats.studentsByYear.length > 0 ? (
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart
                                    data={stats.studentsByYear.map(item => ({
                                        year: `Year ${item.year}`,
                                        count: item.count,
                                    }))}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="year"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#fff'
                                        }}
                                        formatter={(value) => [value, 'Students']}
                                    />
                                    <Bar
                                        dataKey="count"
                                        radius={[6, 6, 0, 0]}
                                        animationDuration={1200}
                                    >
                                        {stats.studentsByYear.map((_, idx) => (
                                            <Cell key={idx} fill={YEAR_COLORS[idx % YEAR_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Users}
                            message="No student data available"
                            submessage="Students will appear here once enrolled"
                        />
                    )}
                </div>

                {/* Right: Student Status Pie */}
                <div className="glass-card staff-chart-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Student Status</h2>
                            <span className="text-muted text-sm">
                                {stats?.totalStudents || 0} students tracked
                            </span>
                        </div>
                        <UserRoundCheck size={20} className="section-icon" />
                    </div>

                    {statusData.some(d => d.value > 0) ? (
                        <div className="status-chart-layout">
                            <div className="status-chart">
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={56}
                                            outerRadius={82}
                                            paddingAngle={3}
                                            stroke="transparent"
                                        >
                                            {statusData.map(entry => (
                                                <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="chart-center-label">
                                    <strong>{activeCount}</strong>
                                    <span>Active</span>
                                </div>
                            </div>
                            <div className="status-legend">
                                {statusData.map(item => (
                                    <div key={item.name} className="legend-row">
                                        <span className="legend-color" style={{ background: STATUS_COLORS[item.name] }}></span>
                                        <span>{item.name}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            icon={UserRoundCheck}
                            message="No status data available"
                        />
                    )}
                </div>
            </div>

            {/* ── Row: Pass Rates + At-Risk ── */}
            <div className="admin-insights-grid">
                {/* Left: Pass Rates */}
                <div className="glass-card pass-rates-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Course Pass Rates</h2>
                            <span className="text-muted text-sm">Based on current grades</span>
                        </div>
                        <TrendingUp size={20} className="section-icon" />
                    </div>

                    {passRates.length > 0 ? (
                        <div className="pass-rates-list">
                            {passRates.slice(0, 6).map((course) => (
                                <div key={course.courseCode} className="pass-rate-row">
                                    <div className="pass-rate-info">
                                        <h4>{course.courseName}</h4>
                                        <p>{course.courseCode} · {course.totalStudents} students</p>
                                    </div>
                                    <div className="pass-rate-bar-container">
                                        <div className="pass-rate-bar-bg">
                                            <div
                                                className="pass-rate-bar-fill"
                                                style={{
                                                    width: `${course.passRate}%`,
                                                    background: course.passRate >= 80
                                                        ? '#22c55e'
                                                        : course.passRate >= 50
                                                            ? '#f59e0b'
                                                            : '#f43f5e',
                                                }}
                                            />
                                        </div>
                                        <span className={`pass-rate-value ${
                                            course.passRate >= 80 ? 'rate-good' :
                                            course.passRate >= 50 ? 'rate-warn' : 'rate-danger'
                                        }`}>
                                            {course.passRate}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={Award}
                            message="No grading data available yet"
                            submessage="Pass rates will appear once grades are submitted"
                        />
                    )}
                </div>

                {/* Right: At-Risk Students */}
                <div className="glass-card attention-card">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Needs Attention</h2>
                            <span className="text-muted text-sm">Computed from attendance & grades</span>
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
                                    <p>{student.department || 'N/A'} · {student.enrollmentNumber || 'No ID'}</p>
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
                                <span>No at-risk students detected. All students are on track!</span>
                            </div>
                        )}
                    </div>

                    {atRiskStudents.length > 5 && (
                        <Link to="/students" className="view-link" style={{ marginTop: '0.8rem', display: 'inline-flex' }}>
                            View all {atRiskStudents.length} at-risk students
                            <ArrowRight size={14} />
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Recent Activity ── */}
            <div className="glass-card recent-activity-card">
                <div className="section-header">
                    <div className="header-info">
                        <h2>Recent Activity</h2>
                        <span className="text-muted text-sm">Latest system notifications</span>
                    </div>
                    <Link to="/notifications" className="view-link">
                        View All
                        <ArrowRight size={16} />
                    </Link>
                </div>
                <div className="activity-list">
                    {stats?.recentNotifications && stats.recentNotifications.length > 0 ? (
                        stats.recentNotifications.map((notif, index) => (
                            <div key={notif._id} className="activity-item">
                                <div className={`activity-dot ${index > 0 ? 'pt-2' : ''}`}></div>
                                <div className="activity-details">
                                    <p>{notif.message}</p>
                                    <span>{new Date(notif.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted text-sm">No recent activity found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
