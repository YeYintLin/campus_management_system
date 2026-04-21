import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Calendar, Users, BookOpen, ChevronRight, ArrowLeft, CheckCircle2, XCircle, Clock, Save, Search } from 'lucide-react';
import './Attendance.css';

// Synchronized with Students.jsx
const dummyStudents = [
    { id: 'STU001', name: 'Alice Johnson', major: 'Computer Science', year: '3rd Year', avatar: 'https://i.pravatar.cc/150?u=alice' },
    { id: 'STU002', name: 'Bob Smith', major: 'Mathematics', year: '4th Year', avatar: 'https://i.pravatar.cc/150?u=bob' },
    { id: 'STU003', name: 'Charlie Davis', major: 'Physics', year: '2nd Year', avatar: 'https://i.pravatar.cc/150?u=charlie' },
    { id: 'STU004', name: 'Diana Evans', major: 'Biology', year: '1st Year', avatar: 'https://i.pravatar.cc/150?u=diana' },
    { id: 'STU005', name: 'Evan Garcia', major: 'Engineering', year: '3rd Year', avatar: 'https://i.pravatar.cc/150?u=evan' },
    { id: 'STU006', name: 'Fiona Hall', major: 'History', year: '4th Year', avatar: 'https://i.pravatar.cc/150?u=fiona' },
];

const dummyCourses = [
    { id: 'CS101', name: 'Introduction to Computer Science', department: 'CS', color: '#6366f1', students: 45, year: '1st Year' },
    { id: 'MTH101', name: 'Calculus I', department: 'Mathematics', color: '#8b5cf6', students: 50, year: '1st Year' },
    { id: 'MTH202', name: 'Advanced Calculus', department: 'Mathematics', color: '#ec4899', students: 32, year: '2nd Year' },
    { id: 'PHY301', name: 'Quantum Mechanics', department: 'Physics', color: '#10b981', students: 28, year: '3rd Year' },
    { id: 'ENG105', name: 'Modern Literature', department: 'English', color: '#f59e0b', students: 50, year: '1st Year' },
    { id: 'CS402', name: 'Artificial Intelligence', department: 'CS', color: '#06b6d4', students: 25, year: '4th Year' },
];

const Attendance = () => {
    const { user } = useContext(AuthContext);
    const canManageAttendance = user?.role === 'Admin' || user?.role === 'Teacher';

    const [view, setView] = useState('courses'); // 'courses' or 'marking'
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

    const handleCourseSelect = (course) => {
        if (!canManageAttendance) return;
        setSelectedCourse(course);
        setView('marking');

        // Initialize attendance for this course/date if not exists
        const key = `${course.id}-${selectedDate}`;
        if (!attendanceData[key]) {
            const initialAttendance = {};
            const courseStudents = dummyStudents.filter(stu => stu.year === course.year);
            courseStudents.forEach(stu => {
                initialAttendance[stu.id] = 'Present';
            });
            setAttendanceData({ ...attendanceData, [key]: initialAttendance });
        }
    };

    const handleStatusChange = (studentId, status) => {
        const key = `${selectedCourse.id}-${selectedDate}`;
        const currentSheet = { ...attendanceData[key] };
        currentSheet[studentId] = status;
        setAttendanceData({
            ...attendanceData,
            [key]: currentSheet
        });
    };

    const handleBack = () => {
        setView('courses');
        setSelectedCourse(null);
    };

    const handleSave = () => {
        alert(`Attendance for ${selectedCourse.name} on ${selectedDate} has been saved!`);
        // In real app, API call here
    };

    const currentAttendanceSheet = selectedCourse ? attendanceData[`${selectedCourse.id}-${selectedDate}`] || {} : {};

    const filteredCourses = dummyCourses.filter(course =>
        (selectedYear === 'All' || course.year === selectedYear) &&
        (course.name.toLowerCase().includes(searchTerm.toLowerCase()) || course.id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredStudents = dummyStudents.filter(stu =>
        selectedCourse && stu.year === selectedCourse.year &&
        (stu.name.toLowerCase().includes(searchTerm.toLowerCase()) || stu.id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                        <h1>{view === 'courses' ? 'Attendance Management' : selectedCourse.name}</h1>
                        <p className="subtitle">
                            {view === 'courses'
                                ? 'Select a course to mark daily attendance'
                                : `Marking attendance for ${selectedCourse.id}`}
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
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        {canManageAttendance && (
                            <button className="btn btn-primary" onClick={handleSave}>
                                <Save size={18} />
                                Save Attendance
                            </button>
                        )}
                    </div>
                )}
            </header>

            {view === 'courses' && (
                <div className="year-filter-bar glass-panel">
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
            )}

            {view === 'courses' ? (
                <div className="courses-grid">
                    {filteredCourses.map(course => (
                        <div
                            key={course.id}
                            className="course-attendance-card glass-panel hover-glow"
                            onClick={() => handleCourseSelect(course)}
                        >
                            <div className="course-card-icon" style={{ backgroundColor: `${course.color}15`, color: course.color }}>
                                <BookOpen size={32} />
                            </div>
                            <div className="course-card-info">
                                <span className="dept-tag" style={{ backgroundColor: `${course.color}20`, color: course.color }}>
                                    {course.department}
                                </span>
                                <h3>{course.name}</h3>
                                <p>{course.id}</p>
                                <div className="course-stats">
                                    <div className="stat">
                                        <Users size={14} />
                                        <span>{course.students} Students</span>
                                    </div>
                                    <div className="stat">
                                        <Clock size={14} />
                                        <span>3 Sessions Today</span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="card-arrow" />
                        </div>
                    ))}
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
                                    {Object.values(currentAttendanceSheet).filter(s => s === 'Present').length}
                                </span>
                            </div>
                            <div className="summary-item">
                                <span className="label">Absent:</span>
                                <span className="count text-danger">
                                    {Object.values(currentAttendanceSheet).filter(s => s === 'Absent').length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="student-attendance-list glass-panel">
                        <table className="attendance-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>ID</th>
                                    <th>Department</th>
                                    <th className="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(student => (
                                    <tr key={student.id}>
                                        <td>
                                            <div className="stu-profile">
                                                <img src={student.avatar} alt={student.name} />
                                                <span>{student.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-muted font-mono">{student.id}</td>
                                        <td className="text-muted">{student.major}</td>
                                        <td>
                                            <div className="status-toggles">
                                                <button
                                                    className={`status-btn p-btn ${currentAttendanceSheet[student.id] === 'Present' ? 'active' : ''}`}
                                                    onClick={() => canManageAttendance && handleStatusChange(student.id, 'Present')}
                                                    title="Mark Present"
                                                    disabled={!canManageAttendance}
                                                >
                                                    <CheckCircle2 size={18} />
                                                    <span>Present</span>
                                                </button>
                                                <button
                                                    className={`status-btn l-btn ${currentAttendanceSheet[student.id] === 'Late' ? 'active' : ''}`}
                                                    onClick={() => canManageAttendance && handleStatusChange(student.id, 'Late')}
                                                    title="Mark Late"
                                                    disabled={!canManageAttendance}
                                                >
                                                    <Clock size={18} />
                                                    <span>Late</span>
                                                </button>
                                                <button
                                                    className={`status-btn a-btn ${currentAttendanceSheet[student.id] === 'Absent' ? 'active' : ''}`}
                                                    onClick={() => canManageAttendance && handleStatusChange(student.id, 'Absent')}
                                                    title="Mark Absent"
                                                    disabled={!canManageAttendance}
                                                >
                                                    <XCircle size={18} />
                                                    <span>Absent</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
