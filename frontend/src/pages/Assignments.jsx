import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Edit2, Trash2, X, Calendar, Clock, BookOpen, Plus, FileText, CheckCircle, CheckCircle2, Upload, Users, Download, Send } from 'lucide-react';
import './Assignments.css';

const Assignments = () => {
    const { user } = useContext(AuthContext);
    const canManageAssignments = user?.role === 'Admin' || user?.role === 'Teacher';
    const isStudent = user?.role === 'Student';

    const [assignments, setAssignments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAssignment, setCurrentAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        title: '', course: '', description: '', dueDate: ''
    });

    // Student Submission Modal state
    const [submitModalAssignment, setSubmitModalAssignment] = useState(null);
    const [submissionFileUrl, setSubmissionFileUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Teacher Submissions Inspection Drawer state
    const [viewSubmissionsAssignment, setViewSubmissionsAssignment] = useState(null);

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
                course: typeof assignment.course === 'object' ? assignment.course?._id : assignment.course,
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

    const handleSubmitSolution = async (e) => {
        e.preventDefault();
        if (!submitModalAssignment) return;
        setSubmitting(true);
        try {
            await apiClient.post(`/assignments/${submitModalAssignment._id}/submit`, {
                fileUrl: submissionFileUrl || `Solution_${user?.name || 'Student'}_${submitModalAssignment.title.replace(/\s+/g, '_')}.pdf`
            });
            alert('Assignment submitted successfully!');
            setSubmitModalAssignment(null);
            setSubmissionFileUrl('');
            fetchAssignments();
        } catch (err) {
            console.error('Failed to submit assignment:', err);
            alert(err.response?.data?.message || 'Failed to submit assignment');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="assignments-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Assignments</h1>
                    <p className="subtitle">Manage course assignments, due dates, and student submissions</p>
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
                        const courseName = typeof assignment.course === 'object' ? assignment.course?.name : '';
                        
                        // Check student submission
                        const mySubmission = isStudent && assignment.submissions?.find(s => {
                            const sId = typeof s.student === 'object' ? s.student?._id : s.student;
                            return sId && sId.toString() === user?._id?.toString();
                        });

                        return (
                            <div key={assignment._id} className="assignment-card glass-panel hover-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div className="assignment-card-header">
                                        <div className="assignment-course">
                                            <span className="course-code">{courseCode}</span>
                                            {courseName && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{courseName}</span>}
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

                                {/* Student Submission Action Bar */}
                                {isStudent && (
                                    <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        {mySubmission ? (
                                            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '0.45rem 0.85rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700' }}>
                                                <CheckCircle2 size={16} />
                                                <span>Submitted ({new Date(mySubmission.submittedAt).toLocaleDateString()})</span>
                                            </span>
                                        ) : (
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => setSubmitModalAssignment(assignment)}
                                                disabled={isOverdue}
                                                style={{ fontSize: '0.85rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center' }}
                                            >
                                                <Upload size={16} />
                                                <span>{isOverdue ? 'Deadline Passed' : 'Submit Assignment Work'}</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Teacher Submissions Inspection Counter Button */}
                                {canManageAssignments && (
                                    <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button
                                            className="btn btn-secondary-glass"
                                            onClick={() => setViewSubmissionsAssignment(assignment)}
                                            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center' }}
                                        >
                                            <Users size={16} />
                                            <span>View Submissions ({assignment.submissions?.length || 0})</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Create / Edit Assignment Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{currentAssignment ? 'Edit Assignment' : 'Create Assignment'}</h2>
                                <p className="modal-subtitle">Fill in assignment parameters below</p>
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
                                    <textarea required name="description" value={formData.description} onChange={handleChange} className="form-input" rows="4" placeholder="Assignment instructions & criteria..."></textarea>
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

            {/* Student Submit Solution Modal */}
            {submitModalAssignment && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }} onClick={() => setSubmitModalAssignment(null)}>
                    <div className="glass-panel" style={{ width: '90%', maxWidth: '500px', padding: '1.75rem', borderRadius: '20px', background: 'var(--surface-color, #1e293b)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(99,102,241,0.15)', padding: '0.6rem', borderRadius: '12px', color: '#6366f1' }}>
                                    <Upload size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Submit Assignment</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{submitModalAssignment.title}</p>
                                </div>
                            </div>
                            <button className="close-btn" type="button" onClick={() => setSubmitModalAssignment(null)}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSubmitSolution} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Solution File / Attachment Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Solution_Report_HSS61011.pdf"
                                    value={submissionFileUrl}
                                    onChange={(e) => setSubmissionFileUrl(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <p style={{ margin: '0 0 0.4rem', fontWeight: '700', color: '#fff' }}>Submission Guidelines:</p>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                    <li>Ensure your file covers all assignment criteria.</li>
                                    <li>Once submitted, your teacher will be notified automatically.</li>
                                </ul>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setSubmitModalAssignment(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Send size={16} />
                                    <span>{submitting ? 'Submitting...' : 'Confirm Submission'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Teacher Inspection Drawer for Submissions */}
            {viewSubmissionsAssignment && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }} onClick={() => setViewSubmissionsAssignment(null)}>
                    <div className="glass-panel" style={{ width: '90%', maxWidth: '600px', padding: '1.75rem', borderRadius: '20px', background: 'var(--surface-color, #1e293b)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(20,184,166,0.15)', padding: '0.6rem', borderRadius: '12px', color: '#14b8a6' }}>
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Student Submissions</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{viewSubmissionsAssignment.title}</p>
                                </div>
                            </div>
                            <button className="close-btn" type="button" onClick={() => setViewSubmissionsAssignment(null)}><X size={18} /></button>
                        </div>

                        {viewSubmissionsAssignment.submissions && viewSubmissionsAssignment.submissions.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                                {viewSubmissionsAssignment.submissions.map((sub, idx) => {
                                    const studentName = typeof sub.student === 'object' ? sub.student?.name : 'Student';
                                    const studentEmail = typeof sub.student === 'object' ? sub.student?.email : '';
                                    return (
                                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.85rem 1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>{studentName}</h4>
                                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{studentEmail}</p>
                                                <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>Submitted: {new Date(sub.submittedAt).toLocaleString()}</span>
                                            </div>
                                            <span className="badge badge-primary" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                {sub.fileUrl}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-muted" style={{ margin: 0, padding: '1rem 0' }}>No student submissions recorded yet for this assignment.</p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                            <button className="btn btn-secondary" onClick={() => setViewSubmissionsAssignment(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assignments;
