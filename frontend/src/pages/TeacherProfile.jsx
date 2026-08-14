import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Building2, CalendarClock, Edit3, Mail, MapPin, Save, ShieldCheck, X, FileText } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { defaultTeachers } from '../data/teachers';
import './TeacherProfile.css';

const getTeacherId = (teacher) => teacher?._id || teacher?.id;

const buildProfileForm = (teacher = {}) => ({
    name: teacher.name || '',
    email: teacher.email || '',
    department: teacher.department || '',
    title: teacher.title || teacher.role || 'Teacher',
    status: teacher.status || 'Active',
    year: teacher.year || '',
    office: teacher.office || '',
    consultationHours: teacher.consultationHours || '',
    specialization: teacher.specialization || '',
});

const TeacherProfile = () => {
    const { user } = useContext(AuthContext);
    const { teacherId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const effectiveTeacherId = teacherId || (user?.role === 'Teacher' ? user?._id : null);
    const isTeacherSelf = user?.role === 'Teacher' && (user?._id === effectiveTeacherId || !teacherId);
    const isAdmin = user?.role === 'Admin';
    const canEdit = isAdmin || isTeacherSelf;

    const teacherFromState = location.state?.teacher;
    const getInitialTeacher = () => {
        if (teacherFromState && (getTeacherId(teacherFromState) === effectiveTeacherId || teacherFromState?._id === effectiveTeacherId)) {
            return teacherFromState;
        }
        if (isTeacherSelf && user) {
            return {
                ...user,
                id: user._id,
                role: user.title || user.role || 'Lecturer',
                department: user.department || 'Mechatronics Engineering',
                office: user.office || 'MECH-204',
                consultationHours: user.consultationHours || 'Mon/Wed 2:00 PM - 4:00 PM',
                specialization: user.specialization || 'Robotics and Control Systems',
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=374151&color=ffffff`,
            };
        }
        return defaultTeachers.find(item => item.id === effectiveTeacherId || item._id === effectiveTeacherId) || defaultTeachers[0];
    };

    const [teacher, setTeacher] = useState(getInitialTeacher);
    const [profileForm, setProfileForm] = useState(() => buildProfileForm(getInitialTeacher()));
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchTeacherProfile = async () => {
            const targetId = effectiveTeacherId || getTeacherId(teacher);
            if (!targetId || String(targetId).startsWith('T')) {
                return;
            }

            setLoadingProfile(true);
            setSaveError('');

            try {
                const { data } = await apiClient.get(`/users/${targetId}`, { signal: abortController.signal });
                const fetchedTeacher = {
                    ...data,
                    id: data._id,
                    role: data.title || data.role || 'Lecturer',
                    department: data.department || 'Mechatronics Engineering',
                    office: data.office || 'MECH-204',
                    consultationHours: data.consultationHours || 'Mon/Wed 2:00 PM - 4:00 PM',
                    specialization: data.specialization || 'Robotics and Control Systems',
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=374151&color=ffffff`,
                };
                setTeacher(fetchedTeacher);
                setProfileForm(buildProfileForm(fetchedTeacher));
                
                // Fetch assigned courses for this teacher
                const coursesRes = await apiClient.get('/courses', { params: { teacher: targetId }, signal: abortController.signal }).catch(() => ({ data: [] }));
                setCourses(coursesRes.data || []);
            } catch (error) {
                if (error?.code !== 'ERR_CANCELED') {
                    if (isTeacherSelf && user) {
                        const fallbackTeacher = {
                            ...user,
                            id: user._id,
                            role: user.title || user.role || 'Lecturer',
                            department: user.department || 'Mechatronics Engineering',
                            office: user.office || 'MECH-204',
                            consultationHours: user.consultationHours || 'Mon/Wed 2:00 PM - 4:00 PM',
                            specialization: user.specialization || 'Robotics and Control Systems',
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=374151&color=ffffff`,
                        };
                        setTeacher(fallbackTeacher);
                        setProfileForm(buildProfileForm(fallbackTeacher));
                    } else if (teacher) {
                        // Keep current teacher
                    } else {
                        setTeacher(undefined);
                        setSaveError(error.response?.data?.message || error.message || 'Unable to load teacher profile.');
                    }
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setLoadingProfile(false);
                }
            }
        };

        fetchTeacherProfile();
        return () => abortController.abort();
    }, [effectiveTeacherId]);

    const handleFormChange = (field, value) => {
        setProfileForm(previous => ({ ...previous, [field]: value }));
    };

    const handleCancelEdit = () => {
        setProfileForm(buildProfileForm(teacher));
        setIsEditing(false);
        setSaveError('');
        setSaveSuccess('');
    };

    const handleSaveProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        setSaveError('');
        setSaveSuccess('');

        try {
            const teacherDbId = teacher?._id || (isTeacherSelf ? user?._id : null);
            const updatedTeacher = teacherDbId
                ? (await apiClient.put(`/users/${teacherDbId}`, profileForm)).data
                : { ...teacher, ...profileForm, role: profileForm.title };

            setTeacher({
                ...teacher,
                ...updatedTeacher,
                id: updatedTeacher._id || teacher?.id,
                role: updatedTeacher.title || updatedTeacher.role || profileForm.title,
                avatar: teacher?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(updatedTeacher.name || teacher.name)}&background=374151&color=ffffff`,
            });
            setProfileForm(buildProfileForm({
                ...teacher,
                ...updatedTeacher,
                role: updatedTeacher.title || updatedTeacher.role || profileForm.title,
            }));
            setIsEditing(false);
            setSaveSuccess('Teacher profile updated successfully.');
        } catch (error) {
            setSaveError(error.response?.data?.message || error.message || 'Unable to update teacher profile.');
        } finally {
            setSaving(false);
        }
    };

    if (!teacher) {
        return (
            <div className="teacher-profile-page animate-fade-in">
                {isTeacherSelf ? (
                    <button type="button" className="btn btn-secondary profile-back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} />
                        Back
                    </button>
                ) : (
                    <Link to="/teachers" className="btn btn-secondary profile-back-link">
                        <ArrowLeft size={16} />
                        Back to Teachers
                    </Link>
                )}
                <div className="glass-panel empty-state">
                    <p>{loadingProfile ? 'Loading teacher profile...' : (saveError || 'Teacher profile not found.')}</p>
                </div>
            </div>
        );
    }

    const teacherInitial = teacher.name?.charAt(0) || 'T';
    const statusClass = teacher.status === 'Active' ? 'badge-success' : 'badge-warning';

    return (
        <div className="teacher-profile-page animate-fade-in">
            {isTeacherSelf ? (
                <button type="button" className="btn btn-secondary profile-back-link" onClick={() => navigate(-1)}>
                    <ArrowLeft size={16} />
                    Back
                </button>
            ) : (
                <Link to="/teachers" className="btn btn-secondary profile-back-link">
                    <ArrowLeft size={16} />
                    Back to Teachers
                </Link>
            )}

            <section className="glass-card teacher-profile-hero">
                <div className="profile-avatar-wrap">
                    {teacher.avatar ? (
                        <img src={teacher.avatar} alt={teacher.name} className="profile-avatar" />
                    ) : (
                        <div className="profile-avatar profile-avatar-fallback">{teacherInitial}</div>
                    )}
                </div>
                <div className="profile-hero-info">
                    <div className="profile-title-row">
                        <div>
                            <h1>{teacher.name}</h1>
                            <p>{teacher.role || 'Teacher'} in {teacher.department || 'Unassigned Department'}</p>
                        </div>
                        <div className="profile-actions">
                            <span className={`badge ${statusClass}`}>{teacher.status || 'Active'}</span>
                            {canEdit && !isEditing && (
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
                                    <Edit3 size={15} />
                                    Edit Profile
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="profile-contact-line">
                        <Mail size={16} />
                        <span>{teacher.email || 'No email available'}</span>
                    </div>
                </div>
            </section>

            {saveSuccess && <div className="profile-message success-message">{saveSuccess}</div>}
            {saveError && <div className="profile-message error-message">{saveError}</div>}

            {canEdit && isEditing && (
                <form className="glass-card profile-edit-card" onSubmit={handleSaveProfile}>
                    <div className="profile-section-heading">
                        <Edit3 size={20} />
                        <h2>Edit Teacher Profile</h2>
                    </div>
                    <div className="profile-edit-grid">
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" value={profileForm.name} onChange={event => handleFormChange('name', event.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={profileForm.email} onChange={event => handleFormChange('email', event.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <input className="form-input" value={profileForm.department} onChange={event => handleFormChange('department', event.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Title</label>
                            <select className="form-input" value={profileForm.title} onChange={event => handleFormChange('title', event.target.value)}>
                                <option value="Teacher">Teacher</option>
                                <option value="Lecturer">Lecturer</option>
                                <option value="Professor">Professor</option>
                                <option value="Associate Prof">Associate Prof</option>
                                <option value="Head of Dept">Head of Dept</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-input" value={profileForm.status} onChange={event => handleFormChange('status', event.target.value)}>
                                <option value="Active">Active</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Retired">Retired</option>
                                <option value="Suspended">Suspended</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Academic Year</label>
                            <input className="form-input" value={profileForm.year} onChange={event => handleFormChange('year', event.target.value)} placeholder="e.g. 3rd Year" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Office</label>
                            <input className="form-input" value={profileForm.office} onChange={event => handleFormChange('office', event.target.value)} placeholder="e.g. Room 204" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Consultation Hours</label>
                            <input className="form-input" value={profileForm.consultationHours} onChange={event => handleFormChange('consultationHours', event.target.value)} placeholder="e.g. Mon 10:00 AM - 12:00 PM" />
                        </div>
                        <div className="form-group profile-wide-field">
                            <label className="form-label">Faculty Profile</label>
                            <textarea className="form-input" rows="4" value={profileForm.specialization} onChange={event => handleFormChange('specialization', event.target.value)} />
                        </div>
                    </div>
                    <div className="profile-edit-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                            <X size={16} />
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>
            )}

            <section className="profile-details-grid">
                <div className="glass-card profile-detail-card">
                    <Building2 size={22} />
                    <span>Department</span>
                    <strong>{teacher.department || 'Unassigned'}</strong>
                </div>
                <div className="glass-card profile-detail-card">
                    <BookOpen size={22} />
                    <span>Academic Year</span>
                    <strong>{teacher.year || 'Not assigned'}</strong>
                </div>
                <div className="glass-card profile-detail-card">
                    <MapPin size={22} />
                    <span>Office</span>
                    <strong>{teacher.office || 'Not set'}</strong>
                </div>
                <div className="glass-card profile-detail-card">
                    <CalendarClock size={22} />
                    <span>Consultation</span>
                    <strong>{teacher.consultationHours || 'Not set'}</strong>
                </div>
            </section>

            <section className="glass-card profile-overview-card">
                <div className="profile-section-heading">
                    <ShieldCheck size={20} />
                    <h2>Faculty Profile</h2>
                </div>
                <p>
                    {teacher.specialization || `${teacher.name} is part of the ${teacher.department || 'faculty'} team and supports students through assigned courses, consultation, and academic guidance.`}
                </p>
            </section>

            <section className="glass-card profile-overview-card" style={{ marginTop: '1.5rem' }}>
                <div className="profile-section-heading">
                    <FileText size={20} />
                    <h2>Assigned Courses</h2>
                </div>
                {courses.length > 0 ? (
                    <div className="courses-list" style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                        {courses.map(course => (
                            <div key={course._id} className="course-item" style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <strong>{course.code}</strong> - {course.name}
                                <span style={{ float: 'right', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    Credits: {course.credits}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ marginTop: '1rem' }}>No courses currently assigned to this teacher.</p>
                )}
            </section>
        </div>
    );
};

export default TeacherProfile;
