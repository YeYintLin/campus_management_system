import { useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowRight, Award, Calendar, FileText, TrendingUp, Clock, BookOpen } from 'lucide-react';
import './Dashboard.css';

// Move static data outside component to prevent recreation on every render
const initialExams = [
    { id: 'EX001', course: 'CS101', title: 'Midterm Exam', date: '2026-03-15', time: '09:00', duration: '2 Hours', room: 'Hall A', status: 'Upcoming', year: '1st Year' },
    { id: 'EX002', course: 'MTH202', title: 'Final Exam', date: '2026-04-10', time: '14:00', duration: '3 Hours', room: 'Lab 3', status: 'Scheduled', year: '2nd Year' },
    { id: 'EX003', course: 'PHY301', title: 'Quiz 1', date: '2026-03-08', time: '10:00', duration: '45 Mins', room: 'Room 201', status: 'Upcoming', year: '3rd Year' },
];

const initialFiles = [
    { id: 1, name: 'React_Basics_Tutorial.pdf', type: 'PDF', size: '2.4 MB', category: 'Tutorial', year: '1st Year' },
    { id: 2, name: 'Final_Exam_2024.pdf', type: 'PDF', size: '1.5 MB', category: 'Old Question', year: '4th Year' },
    { id: 3, name: 'CS_Algorithms_Textbook.pdf', type: 'PDF', size: '12.2 MB', category: 'Reference Books', year: '3rd Year' },
];

const initialGradesData = {
    'STU001': [
        { course: 'CS101', credits: 3, score: 92 },
        { course: 'MTH202', credits: 4, score: 78 },
        { course: 'PHY301', credits: 4, score: 88 },
    ],
};

const attendanceData = [
    { day: 'Mon', attendance: 85 },
    { day: 'Tue', attendance: 92 },
    { day: 'Wed', attendance: 88 },
    { day: 'Thu', attendance: 95 },
    { day: 'Fri', attendance: 82 },
    { day: 'Sat', attendance: 75 },
    { day: 'Sun', attendance: 60 },
];

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'Student';
    const studentId = user?._id || 'STU001';

    // Memoize expensive calculations
    const { stats, upcomingExams, recommendedFiles } = useMemo(() => {
        const calculateLetterGrade = (score) => {
            if (score >= 81) return 4.0;
            if (score >= 61) return 3.0;
            if (score >= 41) return 2.0;
            if (score >= 21) return 1.0;
            return 0.0;
        };

        const grades = initialGradesData[studentId] || [];
        const totalPoints = grades.reduce((acc, g) => acc + (calculateLetterGrade(g.score) * g.credits), 0);
        const totalCredits = grades.reduce((acc, g) => acc + g.credits, 0);
        const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

        const stats = isStudent
            ? { courses: 6, pendingAssignments: 2, gpa }
            : { courses: 4, students: 120, pendingAssignments: 3, gpa: 'N/A' };

        const studentYear = '3rd Year';
        const upcomingExams = isStudent
            ? initialExams.filter(ex => ex.year === studentYear && ex.status === 'Upcoming')
            : [];
        const recommendedFiles = isStudent
            ? initialFiles.filter(f => f.year === studentYear).slice(0, 3)
            : [];

        return { stats, upcomingExams, recommendedFiles };
    }, [isStudent, studentId]);

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

            <div className="dashboard-content">
                <div className="glass-card attendance-section">
                    <div className="section-header">
                        <div className="header-info">
                            <h2>Attendance Trends</h2>
                            <span className="text-muted text-sm">Last 7 Days</span>
                        </div>
                        <Link to="/attendance" className="view-link">
                            View Full Records
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

                {user?.role === 'Student' ? (
                    <div className="glass-card student-widgets">
                        <div className="widget-section">
                            <div className="section-header">
                                <h2>Upcoming Exams</h2>
                                <Link to="/exams" className="text-sm view-link">View All <ArrowRight size={14} /></Link>
                            </div>
                            <div className="mini-list">
                                {upcomingExams.length > 0 ? upcomingExams.map(ex => (
                                    <div key={ex.id} className="mini-item glass-panel">
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
                                <h2>Recommended Resources</h2>
                                <Link to="/files" className="text-sm view-link">Library <ArrowRight size={14} /></Link>
                            </div>
                            <div className="mini-list">
                                {recommendedFiles.map(file => (
                                    <div key={file.id} className="mini-item glass-panel">
                                        <div className="item-icon">
                                            <FileText size={18} />
                                        </div>
                                        <div className="item-info">
                                            <h4>{file.name}</h4>
                                            <p>{file.category} • {file.size}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card recent-activity">
                        <h2>Recent Activity</h2>
                        <div className="activity-list">
                            <div className="activity-item">
                                <div className="activity-dot"></div>
                                <div className="activity-details">
                                    <p>System Update: Midterm grades are due next week.</p>
                                    <span>2 hours ago</span>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-dot pt-2"></div>
                                <div className="activity-details">
                                    <p>New Course Material uploaded for CS101.</p>
                                    <span>Yesterday</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
