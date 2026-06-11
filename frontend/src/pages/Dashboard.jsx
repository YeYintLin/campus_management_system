import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, ArrowRight, Award, CheckCircle2, FileText, UserRoundCheck, Users } from 'lucide-react';
import apiClient from '../api/apiClient';
import './Dashboard.css';

const studentStatusColors = {
    Active: '#22c55e',
    Probation: '#f59e0b',
    Suspended: '#f43f5e',
};

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'Student';
    const isStaff = user?.role === 'Teacher' || user?.role === 'Admin';
    const studentId = user?._id;

    const [staffStudents, setStaffStudents] = useState([]);
    const [staffStudentsLoading, setStaffStudentsLoading] = useState(false);
    const [staffStudentsError, setStaffStudentsError] = useState('');

    const [exams, setExams] = useState([]);
    const [grades, setGrades] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                if (isStaff) {
                    setStaffStudentsLoading(true);
                    const [studentsRes, notifRes] = await Promise.all([
                        apiClient.get('/students'),
                        apiClient.get('/notifications')
                    ]);
                    setStaffStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
                    setNotifications(notifRes.data.slice(0, 5)); // Get top 5 notifications for recent activity
                    setStaffStudentsLoading(false);
                }

                if (isStudent && studentId) {
                    const [examsRes, gradesRes, attendanceRes] = await Promise.all([
                        apiClient.get('/exams'),
                        apiClient.get('/grades', { params: { student: studentId } }),
                        apiClient.get('/attendance', { params: { student: studentId } })
                    ]);
                    setExams(examsRes.data);
                    setGrades(gradesRes.data);
                    setAttendance(attendanceRes.data);
                }
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                if (isStaff) setStaffStudentsError('Failed to load insights.');
            }
        };

        fetchDashboardData();
    }, [isStaff, isStudent, studentId]);

    const { stats, upcomingExams, attendanceTrend, staffInsights } = useMemo(() => {
        // Calculate GPA
        const totalPoints = grades.reduce((acc, g) => acc + ((g.marks || 0) / 25 * g.credits), 0);
        const totalCredits = grades.reduce((acc, g) => acc + (g.credits || 3), 0);
        const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

        // Staff Insights
        const statusCounts = staffStudents.reduce((acc, student) => {
            const status = student.status || 'Active';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        const statusData = ['Active', 'Probation', 'Suspended'].map(status => ({
            name: status,
            value: statusCounts[status] || 0,
        }));
        const attentionStudents = staffStudents
            .filter(student => student.status === 'Probation' || student.status === 'Suspended')
            .slice(0, 4);
        const departmentSummary = Object.entries(
            staffStudents.reduce((acc, student) => {
                const department = student.department || 'Unassigned';
                acc[department] = (acc[department] || 0) + 1;
                return acc;
            }, {})
        )
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        const stats = isStudent
            ? { courses: grades.length || 6, pendingAssignments: 2, gpa }
            : { courses: 4, students: staffStudents.length, pendingAssignments: 3, gpa: 'N/A' };

        const upcoming = isStudent
            ? exams.filter(ex => new Date(ex.date) >= new Date() && ex.status === 'Upcoming').slice(0, 3)
            : [];

        // Build a fake 7-day trend from real attendance if possible, or fallback to a default shape
        let trend = [];
        if (attendance.length > 0) {
            // Very simplified trend based on recent attendance records
            trend = attendance.slice(-7).map((a) => ({
                day: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
                attendance: a.status === 'Present' ? 100 : a.status === 'Late' ? 75 : 0
            }));
        } else {
            trend = [
                { day: 'Mon', attendance: 85 }, { day: 'Tue', attendance: 92 },
                { day: 'Wed', attendance: 88 }, { day: 'Thu', attendance: 95 },
                { day: 'Fri', attendance: 82 }, { day: 'Sat', attendance: 75 },
                { day: 'Sun', attendance: 60 }
            ];
        }

        return {
            stats,
            upcomingExams: upcoming,
            attendanceTrend: trend,
            staffInsights: {
                statusData,
                attentionStudents,
                departmentSummary,
                activeCount: statusCounts.Active || 0,
                totalStudents: staffStudents.length,
            },
        };
    }, [isStudent, staffStudents, exams, grades, attendance]);

    return (
        <div className="dashboard-container animate-fade-in">
            <header className="dashboard-header">
                <div>
                    <h1>Welcome back, {user?.name}!</h1>
                    <p className="subtitle">Here's what's happening with your account today.</p>
                </div>
            </header>

            <div className="stats-grid">
                <div className="glass-card stat-card">
                    <div className="stat-icon courses-icon">C</div>
                    <div className="stat-info">
                        <h3>{stats.courses}</h3>
                        <p>Active Courses</p>
                    </div>
                </div>

                {user?.role !== 'Student' && (
                    <div className="glass-card stat-card">
                        <div className="stat-icon students-icon">S</div>
                        <div className="stat-info">
                            <h3>{stats.students}</h3>
                            <p>Total Students</p>
                        </div>
                    </div>
                )}

                <div className="glass-card stat-card">
                    <div className="stat-icon assignments-icon">A</div>
                    <div className="stat-info">
                        <h3>{stats.pendingAssignments}</h3>
                        <p>{user?.role === 'Student' ? 'Pending Tasks' : 'Need Grading'}</p>
                    </div>
                </div>

                {user?.role === 'Student' && (
                    <div className="glass-card stat-card highlight-card">
                        <div className="stat-icon gpa-icon">
                            <Award size={24} />
                        </div>
                        <div className="stat-info">
                            <h3>{stats.gpa}</h3>
                            <p>Cumulative GPA</p>
                        </div>
                    </div>
                )}
            </div>

            {isStaff && (
                <div className="staff-insights-grid">
                    <div className="glass-card staff-chart-card">
                        <div className="section-header">
                            <div className="header-info">
                                <h2>Student Status</h2>
                                <span className="text-muted text-sm">
                                    {staffStudentsLoading ? 'Loading student records...' : `${staffInsights.totalStudents} students tracked`}
                                </span>
                            </div>
                            <UserRoundCheck size={20} className="section-icon" />
                        </div>

                        {staffStudentsError ? (
                            <p className="text-muted text-sm">{staffStudentsError}</p>
                        ) : (
                            <div className="status-chart-layout">
                                <div className="status-chart">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={staffInsights.statusData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={56}
                                                outerRadius={82}
                                                paddingAngle={3}
                                                stroke="transparent"
                                            >
                                                {staffInsights.statusData.map(entry => (
                                                    <Cell key={entry.name} fill={studentStatusColors[entry.name]} />
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
                                        <strong>{staffInsights.activeCount}</strong>
                                        <span>Active</span>
                                    </div>
                                </div>
                                <div className="status-legend">
                                    {staffInsights.statusData.map(item => (
                                        <div key={item.name} className="legend-row">
                                            <span className="legend-color" style={{ background: studentStatusColors[item.name] }}></span>
                                            <span>{item.name}</span>
                                            <strong>{item.value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="glass-card attention-card">
                        <div className="section-header">
                            <div className="header-info">
                                <h2>Needs Attention</h2>
                                <span className="text-muted text-sm">Students and class load signals</span>
                            </div>
                            <AlertTriangle size={20} className="section-icon warning-icon" />
                        </div>

                        <div className="attention-list">
                            {staffInsights.attentionStudents.length > 0 ? staffInsights.attentionStudents.map(student => (
                                <div key={student._id} className="attention-row">
                                    <div className="attention-avatar">{student.user?.name?.charAt(0) || student.enrollmentNumber?.charAt(0) || 'S'}</div>
                                    <div className="attention-info">
                                        <h4>{student.user?.name || student.enrollmentNumber || 'Student'}</h4>
                                        <p>{student.department || 'No department'} - {student.enrollmentNumber || 'No enrollment no.'}</p>
                                    </div>
                                    <span className={`badge ${student.status === 'Suspended' ? 'badge-danger' : 'badge-warning'}`}>
                                        {student.status}
                                    </span>
                                </div>
                            )) : (
                                <div className="attention-empty">
                                    <CheckCircle2 size={22} />
                                    <span>No probation or suspended students right now.</span>
                                </div>
                            )}
                        </div>

                        <div className="department-strip">
                            <div className="department-strip-title">
                                <Users size={16} />
                                <span>Largest Departments</span>
                            </div>
                            {staffInsights.departmentSummary.map(([department, count]) => (
                                <div key={department} className="department-row">
                                    <span>{department}</span>
                                    <strong>{count}</strong>
                                </div>
                            ))}
                            {staffInsights.departmentSummary.length === 0 && (
                                <p className="text-muted text-sm">No department data yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="dashboard-content">
                <div className="glass-card attendance-section">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Attendance Trends</h2>
                            <span className="text-muted text-sm">Recent Activity</span>
                        </div>
                        <Link to="/attendance" className="view-link">
                            View Full Records
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAttend" x1="0" y1="0" x2="0" y2="1">
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
                                />
                                <Area
                                    type="monotone"
                                    dataKey="attendance"
                                    stroke="var(--primary-color)"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAttend)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {isStudent ? (
                    <div className="glass-card student-widgets">
                        <div className="widget-section">
                            <div className="section-header">
                                <h2>Upcoming Exams</h2>
                                <Link to="/exams" className="text-sm view-link">View All <ArrowRight size={14} /></Link>
                            </div>
                            <div className="mini-list">
                                {upcomingExams.length > 0 ? upcomingExams.map(ex => (
                                    <div key={ex._id} className="mini-item glass-panel">
                                        <div className="item-date">
                                            <span className="month">{new Date(ex.date).toLocaleString('default', { month: 'short' })}</span>
                                            <span className="day">{new Date(ex.date).getDate()}</span>
                                        </div>
                                        <div className="item-info">
                                            <h4>{ex.title}</h4>
                                            <p>{ex.course} • {ex.time} • {ex.room}</p>
                                        </div>
                                    </div>
                                )) : <p className="text-muted text-sm">No exams scheduled</p>}
                            </div>
                        </div>

                        <div className="widget-section mt-6">
                            <div className="section-header">
                                <h2>Latest Notifications</h2>
                            </div>
                            <div className="mini-list">
                                {notifications.length > 0 ? notifications.slice(0, 3).map(notif => (
                                    <div key={notif._id} className="mini-item glass-panel" style={{ padding: '0.75rem' }}>
                                        <div className="item-info">
                                            <p style={{ margin: 0 }}>{notif.message}</p>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(notif.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                )) : <p className="text-muted text-sm">No recent notifications</p>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card recent-activity">
                        <h2>Recent Activity</h2>
                        <div className="activity-list">
                            {notifications.length > 0 ? notifications.map((notif, index) => (
                                <div key={notif._id} className="activity-item">
                                    <div className={`activity-dot ${index > 0 ? 'pt-2' : ''}`}></div>
                                    <div className="activity-details">
                                        <p>{notif.message}</p>
                                        <span>{new Date(notif.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-muted text-sm">No recent activity found.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
