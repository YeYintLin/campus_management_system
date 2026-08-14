import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import { getNormalizedUserYear } from '../utils/userYear';
import { ArrowLeft, Award, BookOpen, CalendarDays, GraduationCap, Mail, Phone, ShieldCheck, UserRound, TrendingUp, CheckCircle } from 'lucide-react';
import './StudentProfile.css';

const yearLookup = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

const semesterToYearLabel = (semester) => {
    if (!semester) return '1st Year';
    const bucket = Math.min(6, Math.max(1, Math.ceil(Number(semester) / 2)));
    return yearLookup[bucket - 1] || `${bucket}th Year`;
};

const getAvatarUrl = (name, id) => {
    const initials = name ? encodeURIComponent(name) : encodeURIComponent(id || 'Student');
    return `https://ui-avatars.com/api/?name=${initials}&background=374151&color=ffffff`;
};

const formatRollNumberDisplay = (rollInput, yearLabel, department) => {
    const raw = String(rollInput || '').trim();
    if (!raw) return 'N/A';
    if (raw.includes('-') || raw.includes(' ')) return raw;

    const getYearPrefix = (yearStr) => {
        const text = String(yearStr || '').toUpperCase();
        if (text.includes('VI') || text.includes('6')) return 'VI';
        if (text.includes('V') || text.includes('5')) return 'V';
        if (text.includes('IV') || text.includes('4')) return 'IV';
        if (text.includes('III') || text.includes('3')) return 'III';
        if (text.includes('II') || text.includes('2')) return 'II';
        if (text.includes('I') || text.includes('1')) return 'I';
        return 'VI';
    };

    const getDeptCode = (deptStr) => {
        const text = String(deptStr || '').toUpperCase();
        if (text.includes('MECHATRONIC') || text.includes('MCE')) return 'MC';
        if (text.includes('COMPUTER') || text.includes('CE')) return 'CE';
        if (text.includes('INFORMATION') || text.includes('IT')) return 'IT';
        if (text.includes('ELECTRICAL') || text.includes('EP')) return 'EP';
        if (text.includes('MECHANICAL') || text.includes('MECH')) return 'Mech';
        if (text.includes('CIVIL')) return 'Civil';
        if (text.includes('ELECTRONIC') || text.includes('EC')) return 'EC';
        return 'MC';
    };

    const y = getYearPrefix(yearLabel);
    const d = getDeptCode(department);
    return `${y}-${d}-${raw}`;
};

const StudentProfile = () => {
    const { studentId } = useParams();
    const { user } = useContext(AuthContext);
    const effectiveStudentId = studentId || user?._id;
    const location = useLocation();
    const navigate = useNavigate();
    const [student, setStudent] = useState(location.state?.student || null);
    const [loading, setLoading] = useState(!location.state?.student);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({ gpa: 'N/A', attendance: 'N/A' });

    useEffect(() => {
        if (!effectiveStudentId) return undefined;
        if (student?._id === effectiveStudentId || student?.user?._id === effectiveStudentId) return undefined;

        const abortController = new AbortController();

        const fetchStudent = async () => {
            setLoading(true);
            setError('');

            try {
                const { data } = await apiClient.get(`/students/${effectiveStudentId}`, { signal: abortController.signal });
                setStudent(data);
                
                // Also fetch grades and attendance for stats
                const [gradesRes, attendanceRes] = await Promise.all([
                    apiClient.get('/grades', { params: { student: effectiveStudentId }, signal: abortController.signal }).catch(() => ({ data: [] })),
                    apiClient.get('/attendance', { params: { student: effectiveStudentId }, signal: abortController.signal }).catch(() => ({ data: [] }))
                ]);
                
                const grades = gradesRes.data;
                const attendance = attendanceRes.data;
                
                let gpa = 'N/A';
                if (grades.length > 0) {
                    const totalMarks = grades.reduce((sum, g) => sum + (g.marks || 0), 0);
                    const avg = totalMarks / grades.length;
                    gpa = (avg / 25).toFixed(2); // Rough GPA calc (out of 4.0 based on 100 max)
                }
                
                let attendanceRate = 'N/A';
                if (attendance.length > 0) {
                    const present = attendance.filter(a => a.status === 'Present').length;
                    attendanceRate = `${Math.round((present / attendance.length) * 100)}%`;
                }
                
                setStats({ gpa, attendance: attendanceRate });
                
            } catch (err) {
                if (err?.code !== 'ERR_CANCELED') {
                    setError(err.response?.data?.message || err.message || 'Unable to load student profile');
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchStudent();
        return () => abortController.abort();
    }, [student?._id, student?.user?._id, effectiveStudentId]);

    const isStudentSelf = user?.role === 'Student' && (user?._id === effectiveStudentId || !studentId);

    if (loading) {
        return (
            <div className="student-profile-page animate-fade-in">
                {isStudentSelf ? (
                    <button className="btn btn-secondary profile-back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} />
                        Back
                    </button>
                ) : (
                    <Link to="/students" className="btn btn-secondary profile-back-link">
                        <ArrowLeft size={16} />
                        Back to Students
                    </Link>
                )}
                <div className="glass-panel empty-state">
                    <p>Loading student profile...</p>
                </div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="student-profile-page animate-fade-in">
                {isStudentSelf ? (
                    <button className="btn btn-secondary profile-back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} />
                        Back
                    </button>
                ) : (
                    <Link to="/students" className="btn btn-secondary profile-back-link">
                        <ArrowLeft size={16} />
                        Back to Students
                    </Link>
                )}
                <div className="glass-panel empty-state">
                    <p>{error || 'Student profile not found.'}</p>
                </div>
            </div>
        );
    }

    const displayName = student.user?.name || student.enrollmentNumber || 'Student';
    const userId = student.user?._id || student._id;
    const yearLabel = getNormalizedUserYear(student.user || student) || semesterToYearLabel(student.semester);
    const semesterInYear = Number(student.semester) % 2 === 0 ? 2 : 1;
    const status = student.status || 'Active';

    return (
        <div className="student-profile-page animate-fade-in">
            {isStudentSelf ? (
                <button className="btn btn-secondary profile-back-link" onClick={() => navigate(-1)}>
                    <ArrowLeft size={16} />
                    Back
                </button>
            ) : (
                <Link to="/students" className="btn btn-secondary profile-back-link">
                    <ArrowLeft size={16} />
                    Back to Students
                </Link>
            )}

            <section className="glass-card student-profile-hero">
                <img src={getAvatarUrl(displayName, student._id)} alt={displayName} className="profile-avatar" />
                <div className="profile-hero-info">
                    <div className="profile-title-row">
                        <div>
                            <h1>{displayName}</h1>
                            <p>{formatRollNumberDisplay(student.enrollmentNumber || student.user?.rollNo, yearLabel, student.department)}</p>
                        </div>
                        <span className={`badge ${status === 'Active' ? 'badge-success' : status === 'Suspended' ? 'badge-danger' : 'badge-warning'}`}>
                            {status}
                        </span>
                    </div>
                    <div className="profile-contact-grid">
                        <span><Mail size={16} />{student.user?.email || 'No email available'}</span>
                        <span><Phone size={16} />{student.contactNumber || 'No contact number'}</span>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary profile-grade-btn"
                        onClick={() => navigate('/grades', { state: { studentId: userId, studentName: displayName } })}
                    >
                        <Award size={16} />
                        View Grades
                    </button>
                </div>
            </section>

            <section className="profile-details-grid">
                <div className="glass-card profile-detail-card">
                    <GraduationCap size={22} />
                    <span>Department</span>
                    <strong>{student.department || 'Unassigned'}</strong>
                </div>
                <div className="glass-card profile-detail-card">
                    <BookOpen size={22} />
                    <span>Academic Year</span>
                    <strong>{yearLabel}</strong>
                </div>
                <div className="glass-card profile-detail-card">
                    <CalendarDays size={22} />
                    <span>Semester</span>
                    <strong>Semester {semesterInYear}</strong>
                </div>
                <div className="glass-card profile-detail-card">
                    <ShieldCheck size={22} />
                    <span>System Role</span>
                    <strong>{student.user?.role || 'Student'}</strong>
                </div>
            </section>

            <section className="profile-details-grid" style={{ marginTop: '1.5rem' }}>
                <div className="glass-card profile-detail-card" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)' }}>
                    <TrendingUp size={22} color="var(--success-color)" />
                    <span>Current GPA</span>
                    <strong style={{ fontSize: '1.5rem', color: 'var(--success-color)' }}>{stats.gpa}</strong>
                </div>
                <div className="glass-card profile-detail-card" style={{ background: 'var(--primary-bg)', borderColor: 'var(--primary-border)' }}>
                    <CheckCircle size={22} color="var(--primary-color)" />
                    <span>Attendance Rate</span>
                    <strong style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>{stats.attendance}</strong>
                </div>
            </section>

            <section className="glass-card profile-overview-card">
                <div className="profile-section-heading">
                    <UserRound size={20} />
                    <h2>Student Profile</h2>
                </div>
                <p>
                    {displayName} is enrolled in {student.department || 'the academic program'} for {yearLabel}. This profile keeps the student's academic identity, contact details, and grade access in one place.
                </p>
            </section>
        </div>
    );
};

export default StudentProfile;
