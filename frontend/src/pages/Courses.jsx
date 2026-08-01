import React, { useState, useEffect, useContext } from 'react';
import apiClient from '../api/apiClient';
import { AuthContext } from '../context/AuthContext';
import { X } from 'lucide-react';
import { getNormalizedUserYear } from '../utils/userYear';
import './Courses.css';

const yearFilters = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
const palette = ['#6366f1', '#10b981', '#f97316', '#ec4899', '#0ea5e9'];

const deriveYearTag = (code = '') => {
    const digits = code.match(/\d+/);
    if (!digits) return '1st Year';
    const firstDigit = digits[0][0];
    if (firstDigit === '1') return '1st Year';
    if (firstDigit === '2') return '2nd Year';
    if (firstDigit === '3') return '3rd Year';
    if (firstDigit === '4') return '4th Year';
    if (firstDigit === '5') return '5th Year';
    if (firstDigit === '6') return '6th Year';
    const number = parseInt(digits[0], 10);
    if (number < 200) return '1st Year';
    if (number < 300) return '2nd Year';
    if (number < 400) return '3rd Year';
    if (number < 500) return '4th Year';
    if (number < 600) return '5th Year';
    return '6th Year';
};

const initialCourseForm = {
    name: '',
    code: '',
    description: '',
    teacher: '',
};

const Courses = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';
    const isTeacher = user?.role === 'Teacher';
    const isStudent = user?.role === 'Student';
    const studentYear = getNormalizedUserYear(user);
    const canCreateCourses = isAdmin;
    const canEditCourses = isAdmin || isTeacher;

    const canManageCourse = (course) => {
        if (isAdmin) return true;
        if (isTeacher) {
            const teacherId = course.teacher?._id || course.teacher;
            return teacherId && teacherId.toString() === user?._id?.toString();
        }
        return false;
    };

    const [courses, setCourses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [teachers, setTeachers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalCourse, setModalCourse] = useState(null);
    const [formData, setFormData] = useState({ ...initialCourseForm });
    const [savingCourse, setSavingCourse] = useState(false);
    const [modalError, setModalError] = useState('');

    const loadCourses = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await apiClient.get('/courses');
            setCourses(data);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCourses();
    }, []);

    useEffect(() => {
        if (!isAdmin && !isTeacher) return;
        const fetchTeachers = async () => {
            try {
                const { data } = await apiClient.get('/users?role=Teacher');
                setTeachers(data);
            } catch (err) {
                console.error('Unable to load teacher list', err);
            }
        };

        fetchTeachers();
    }, [isAdmin, isTeacher]);

    const resetForm = () => {
        setFormData({ ...initialCourseForm });
        setModalCourse(null);
        setModalError('');
    };

    const openCourseModal = (course = null) => {
        setIsModalOpen(true);
        setModalCourse(course);
        setModalError('');
        if (course) {
            setFormData({
                name: course.name,
                code: course.code,
                description: course.description || '',
                teacher: course.teacher?._id || course.teacher || '',
            });
        } else {
            resetForm();
        }
    };

    const closeCourseModal = () => {
        resetForm();
        setIsModalOpen(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveCourse = async (event) => {
        event.preventDefault();
        if (!canEditCourses || savingCourse) return;

        const payload = {
            name: formData.name,
            code: formData.code,
            description: formData.description,
            teacher: formData.teacher,
        };

        if (modalCourse) {
            payload.students = (modalCourse.students?.map(student => student._id) ?? []);
        }

        setSavingCourse(true);
        setModalError('');

        try {
            if (modalCourse) {
                await apiClient.put(`/courses/${modalCourse._id}`, payload);
            } else {
                await apiClient.post('/courses', payload);
            }

            closeCourseModal();
            loadCourses();
        } catch (err) {
            setModalError(err.response?.data?.message || err.message || 'Unable to save course');
        } finally {
            setSavingCourse(false);
        }
    };

    const filteredCourses = courses.filter(course => {
        const target = `${course.name} ${course.code} ${course.description || ''} ${course.teacher?.name || ''}`.toLowerCase();
        const matchesSearch = target.includes(searchTerm.toLowerCase());
        const courseYear = deriveYearTag(course.code);
        const matchesYear = isStudent ? (courseYear === studentYear) : (selectedYear === 'All' || courseYear === selectedYear);
        return matchesSearch && matchesYear;
    });

    return (
        <div className={`courses-page${isModalOpen ? '' : ' animate-fade-in'}`}>
            <header className="page-header">
                <div>
                    <h1>Subjects Directory</h1>
                    <p className="subtitle">
                        {isStudent ? `Showing ${studentYear} Academic Subjects` : 'Explore and manage academic subjects'}
                    </p>
                </div>
                <div className="header-actions">
                    <input
                        type="text"
                        placeholder="Search subjects..."
                        className="form-input search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {canCreateCourses && (
                        <button className="btn btn-primary" onClick={() => openCourseModal()}>
                            + Add Subject
                        </button>
                    )}
                </div>
            </header>

            {!isStudent && (
                <div className="year-filter-bar glass-panel">
                    {yearFilters.map(year => (
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

            {error && (
                <div className="glass-panel empty-state">
                    <p>{error}</p>
                </div>
            )}

            <div className="courses-grid">
                {loading ? (
                    <div className="glass-panel empty-state">
                        <p>Loading subjects...</p>
                    </div>
                ) : filteredCourses.length > 0 ? (
                    filteredCourses.map((course, index) => {
                        const enrolled = course.students?.length ?? 0;
                        const capacity = Math.max(enrolled + 5, 30);
                        const enrollmentPercentage = Math.min(100, Math.round((enrolled / capacity) * 100));
                        const status = enrollmentPercentage >= 100 ? 'Full' : 'Active';
                        const baseColor = palette[index % palette.length];
                        const yearTag = deriveYearTag(course.code);
                        const isManageable = canManageCourse(course);

                        return (
                            <div key={course._id} className="glass-card course-card">
                                <div className="course-color-strip" style={{ backgroundColor: baseColor }}></div>
                                <div className="course-card-header">
                                    <div className="header-left">
                                        <span className="course-code">{course.code}</span>
                                        <span className="year-badge">{yearTag}</span>
                                    </div>
                                    <span className={`badge ${status === 'Full' ? 'badge-warning' : 'badge-success'}`}>
                                        {status}
                                    </span>
                                </div>

                                <div className="course-card-body">
                                    <h3>{course.name}</h3>
                                    <p className="course-instructor">Instructor: {course.teacher?.name || 'TBA'}</p>
                                    <p className="course-description">{course.description || 'No description yet.'}</p>

                                    <div className="course-meta">
                                        <span className="meta-item">{`Enrolled ${enrolled}`}</span>
                                        <span className="meta-item">{`Teacher: ${course.teacher?.email || '?'}`}</span>
                                    </div>

                                    <div className="enrollment-section">
                                        <div className="enrollment-header">
                                            <span className="enrollment-label">Enrollment</span>
                                            <span className="enrollment-stats">{`${enrolled} / ${capacity}`}</span>
                                        </div>
                                        <div className="progress-bar-container">
                                            <div
                                                className="progress-bar-fill"
                                                style={{
                                                    width: `${enrollmentPercentage}%`,
                                                    backgroundColor: status === 'Full' ? 'var(--warning)' : baseColor,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="course-card-footer">
                                    <button className="btn btn-secondary btn-sm">View Syllabus</button>
                                    {isManageable && (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            style={{ background: baseColor, border: 'none' }}
                                            onClick={() => openCourseModal(course)}
                                        >
                                            Manage
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="glass-panel empty-state">
                        <p>No subjects found matching your search.</p>
                    </div>
                )}
            </div>
            {canEditCourses && isModalOpen && (
                <div className="modal-overlay" onClick={closeCourseModal}>
                    <form
                        className="modal-content glass-panel course-modal"
                        onSubmit={handleSaveCourse}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div>
                                <h2>{modalCourse ? 'Edit Subject' : 'Add Subject'}</h2>
                                <p className="subtitle">{modalCourse ? 'Modify existing data' : 'Create a new offering'}</p>
                            </div>
                            <button className="close-btn" type="button" onClick={closeCourseModal}><X size={18} /></button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Subject Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject Code</label>
                                <input
                                    type="text"
                                    name="code"
                                    className="form-input"
                                    value={formData.code}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Instructor</label>
                                <select
                                    name="teacher"
                                    className="form-input"
                                    value={formData.teacher}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">Select instructor</option>
                                    {teachers.map(teacher => (
                                        <option key={teacher._id} value={teacher._id}>
                                            {teacher.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    name="description"
                                    className="form-input"
                                    rows={2}
                                    value={formData.description}
                                    onChange={handleFormChange}
                                />
                            </div>
                            {modalError && (
                                <div className="alert alert-warning mt-4">
                                    {modalError}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeCourseModal}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={savingCourse}>
                                {savingCourse ? 'Saving…' : modalCourse ? 'Save Changes' : 'Create Subject'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Courses;
