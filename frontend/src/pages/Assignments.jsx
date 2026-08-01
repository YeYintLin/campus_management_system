import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Edit2, Trash2, X, Calendar, Clock, BookOpen, Plus, FileText, CheckCircle } from 'lucide-react';
import './Assignments.css';

const Assignments = () => {
    const { user } = useContext(AuthContext);
    const canManageAssignments = user?.role === 'Admin' || user?.role === 'Teacher';

    const [assignments, setAssignments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAssignment, setCurrentAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        title: '', course: '', description: '', dueDate: ''
    });

    useEffect(() => {
        fetchAssignments();
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const { data } = await apiClient.get('/courses');
            setCourses(data);
        } catch (err) {
            console.error('Failed to fetch courses:', err);
        }
    };

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/assignments');
            setAssignments(data);
        } catch (err) {
            console.error('Failed to fetch assignments:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (assignment = null) => {
        if (assignment) {
            setCurrentAssignment(assignment);
            setFormData({
                title: assignment.title,
                course: assignment.course,
                description: assignment.description,
                dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : ''
            });
        } else {
            setCurrentAssignment(null);
            setFormData({ title: '', course: '', description: '', dueDate: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentAssignment(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (currentAssignment) {
                await apiClient.put(`/assignments/${currentAssignment._id}`, formData);
            } else {
                await apiClient.post('/assignments', formData);
            }
            fetchAssignments();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save assignment:', err);
            alert('Failed to save assignment.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this assignment?")) {
            try {
                await apiClient.delete(`/assignments/${id}`);
                fetchAssignments();
            } catch (err) {
                console.error('Failed to delete assignment:', err);
                alert('Failed to delete assignment.');
            }
        }
    };

    return (
        <div className="assignments-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Assignments</h1>
                    <p className="subtitle">Manage course assignments and due dates</p>
                </div>
                {canManageAssignments && (
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Create Assignment
                        </button>
                    </div>
                )}
            </header>

            <div className="assignments-grid">
                {loading ? (
                    <div className="empty-state-full glass-panel" style={{ gridColumn: '1 / -1' }}>
                        <p>Loading assignments...</p>
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="empty-state-full glass-panel" style={{ gridColumn: '1 / -1' }}>
                        <p>No assignments currently available.</p>
                        {canManageAssignments && (
                            <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Create One Now</button>
                        )}
                    </div>
                ) : (
                    assignments.map(assignment => {
                        const dueDate = new Date(assignment.dueDate);
                        const isOverdue = dueDate < new Date();
                        const courseCode = typeof assignment.course === 'object' ? assignment.course?.code : assignment.course;
                        
                        return (
                            <div key={assignment._id} className="assignment-card glass-panel hover-glow">
                                <div className="assignment-card-header">
                                    <div className="assignment-course">
                                        <span className="course-code">{courseCode}</span>
                                    </div>
                                    <div className="assignment-actions">
                                        {canManageAssignments && (
                                            <>
                                                <button className="icon-btn" onClick={() => handleOpenModal(assignment)} title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="icon-btn delete" onClick={() => handleDelete(assignment._id)} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="assignment-card-body">
                                    <h3 className="assignment-title">{assignment.title}</h3>
                                    <p className="assignment-description">{assignment.description}</p>
                                    
                                    <div className="assignment-details">
                                        <div className={`detail-item ${isOverdue ? 'overdue' : ''}`}>
                                            <Calendar size={14} />
                                            <span>Due: {dueDate.toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{currentAssignment ? 'Edit Assignment' : 'Create Assignment'}</h2>
                                <p className="modal-subtitle">Fill in the details below</p>
                            </div>
                            <button className="close-btn" onClick={handleCloseModal}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSave} className="modal-body">
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label className="form-label">Assignment Title</label>
                                    <input required type="text" name="title" value={formData.title} onChange={handleChange} className="form-input" placeholder="e.g. Chapter 3 Exercises" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Course Code</label>
                                    <select
                                        required
                                        name="course"
                                        value={formData.course}
                                        onChange={handleChange}
                                        className="form-input"
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map(c => (
                                            <option key={c._id} value={c._id}>
                                                {c.code} - {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date</label>
                                    <input required type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group full-width">
                                    <label className="form-label">Description</label>
                                    <textarea required name="description" value={formData.description} onChange={handleChange} className="form-input" rows="4" placeholder="Assignment details..."></textarea>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{currentAssignment ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assignments;
