import React, { useCallback, useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Edit2, Trash2, X, Calendar, Clock, MapPin, Timer, BookOpen, Plus, MoreVertical } from 'lucide-react';
import './Exams.css';

const Exams = () => {
    const { user } = useContext(AuthContext);
    const canManageExams = user?.role === 'Admin' || user?.role === 'Teacher';

    const [exams, setExams] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentExam, setCurrentExam] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        course: '', title: '', date: '', time: '', duration: '', room: '', status: 'Upcoming', year: '1st Year'
    });

    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

    const fetchExams = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/exams', {
                params: { year: selectedYear !== 'All' ? selectedYear : undefined }
            });
            setExams(data);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch exams.');
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchExams();
    }, [fetchExams]);

    const handleOpenModal = (exam = null) => {
        if (exam) {
            setCurrentExam(exam);
            setFormData(exam);
        } else {
            setCurrentExam(null);
            setFormData({ course: '', title: '', date: '', time: '', duration: '', room: '', status: 'Upcoming', year: '1st Year' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentExam(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (currentExam) {
                await apiClient.put(`/exams/${currentExam._id}`, formData);
            } else {
                await apiClient.post('/exams', formData);
            }
            fetchExams();
            handleCloseModal();
        } catch (err) {
            console.error(err);
            alert('Failed to save exam.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this exam?")) {
            try {
                await apiClient.delete(`/exams/${id}`);
                fetchExams();
            } catch (err) {
                console.error(err);
                alert('Failed to delete exam.');
            }
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Upcoming': return 'status-upcoming';
            case 'Scheduled': return 'status-scheduled';
            case 'Published': return 'status-published';
            case 'Completed': return 'status-completed';
            default: return '';
        }
    };

    return (
        <div className="exams-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Examination Hub</h1>
                    <p className="subtitle">Manage and schedule upcoming examinations</p>
                </div>
                {canManageExams && (
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Schedule Exam
                        </button>
                    </div>
                )}
            </header>

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

            {error && (
                <div className="empty-state-full glass-panel" style={{ marginBottom: '1rem' }}>
                    <p>{error}</p>
                </div>
            )}

            <div className="exams-grid">
                {loading ? (
                    <div className="empty-state-full glass-panel" style={{ gridColumn: '1 / -1' }}>
                        <p>Loading exams...</p>
                    </div>
                ) : exams.length === 0 ? (
                    <div className="empty-state-full glass-panel" style={{ gridColumn: '1 / -1' }}>
                        <p>No exams currently scheduled for {selectedYear}.</p>
                        {canManageExams && (
                            <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Schedule One Now</button>
                        )}
                    </div>
                ) : (
                    exams.map(exam => (
                        <div key={exam._id} className="exam-card glass-panel hover-glow">
                            <div className="exam-card-header">
                                <div className="exam-course">
                                    <span className="course-code">{exam.course}</span>
                                    <span className="badge badge-year">{exam.year}</span>
                                    <span className={`status-badge ${getStatusClass(exam.status)}`}>
                                        {exam.status}
                                    </span>
                                </div>
                                <div className="exam-actions">
                                    {canManageExams && (
                                        <>
                                            <button className="icon-btn" onClick={() => handleOpenModal(exam)} title="Edit">
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="icon-btn delete" onClick={() => handleDelete(exam._id)} title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="exam-card-body">
                                <h3 className="exam-title">{exam.title}</h3>

                                <div className="exam-details">
                                    <div className="detail-item">
                                        <Calendar size={14} />
                                        <span>{exam.date}</span>
                                    </div>
                                    <div className="detail-item">
                                        <Clock size={14} />
                                        <span>{exam.time}</span>
                                    </div>
                                    <div className="detail-item">
                                        <Timer size={14} />
                                        <span>{exam.duration}</span>
                                    </div>
                                    <div className="detail-item">
                                        <MapPin size={14} />
                                        <span>{exam.room}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="exam-card-footer">
                                <span className="exam-id">ID: {exam._id.slice(-6).toUpperCase()}</span>
                                <button className="btn btn-link">Details</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{currentExam ? 'Edit Examination' : 'Schedule New Exam'}</h2>
                                <p className="modal-subtitle">Fill in the details below</p>
                            </div>
                            <button className="close-btn" onClick={handleCloseModal}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSave} className="modal-body">
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label className="form-label">Exam Title</label>
                                    <input required type="text" name="title" value={formData.title} onChange={handleChange} className="form-input" placeholder="e.g. Midterm Assessment" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Course Code</label>
                                    <input required type="text" name="course" value={formData.course} onChange={handleChange} className="form-input" placeholder="e.g. CS101" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Duration</label>
                                    <input required type="text" name="duration" value={formData.duration} onChange={handleChange} className="form-input" placeholder="e.g. 2 Hours" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input required type="date" name="date" value={formData.date} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time</label>
                                    <input required type="time" name="time" value={formData.time} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location / Room</label>
                                    <input required type="text" name="room" value={formData.room} onChange={handleChange} className="form-input" placeholder="e.g. Hall A" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Academic Year</label>
                                    <select required name="year" value={formData.year} onChange={handleChange} className="form-input">
                                        <option value="1st Year">1st Year</option>
                                        <option value="2nd Year">2nd Year</option>
                                        <option value="3rd Year">3rd Year</option>
                                        <option value="4th Year">4th Year</option>
                                        <option value="5th Year">5th Year</option>
                                        <option value="6th Year">6th Year</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select required name="status" value={formData.status} onChange={handleChange} className="form-input">
                                        <option value="Upcoming">Upcoming</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Published">Published</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Discard</button>
                                <button type="submit" className="btn btn-primary">{currentExam ? 'Update Exam' : 'Schedule Exam'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Exams;
