import React, { useCallback, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Edit2, Trash2, X, Calendar, Clock, MapPin, Timer, BookOpen, Plus, LayoutGrid, Users, Upload, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { getNormalizedUserYear } from '../utils/userYear';
import './Exams.css';

const Exams = () => {
    const { user } = useContext(AuthContext);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const canManageExams = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const [exams, setExams] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeSeatingExam, setActiveSeatingExam] = useState(null);
    const [seatingViewTab, setSeatingViewTab] = useState('grid'); // 'grid' or 'photo'
    const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
    const [currentExam, setCurrentExam] = useState(null);
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        course: '', title: '', date: '', time: '', duration: '', room: '', status: 'Upcoming', year: '1st Year'
    });

    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState('');
    const [importError, setImportError] = useState('');

    const handleFileUploadClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleSeatingPhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data: photoUrl } = await apiClient.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadedPhotoUrl(photoUrl);
            if (activeSeatingExam) {
                activeSeatingExam.seatingPhoto = photoUrl;
            }
            alert('Official hand-written paper seating plan photo uploaded successfully!');
        } catch (err) {
            console.error('Photo upload failed:', err);
            alert('Failed to upload seating photo.');
        }
    };

    const years = isStudent
        ? [studentYear]
        : ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

    const fetchExams = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const targetYear = isStudent ? studentYear : selectedYear;
            const params = { year: targetYear !== 'All' ? targetYear : undefined };

            let dbExams = [];
            let sessionExams = [];

            try {
                const examsRes = await apiClient.get('/exams', { params });
                dbExams = Array.isArray(examsRes.data) ? examsRes.data : [];
            } catch (e) {
                console.warn('Exams endpoint:', e.message);
            }

            try {
                const sessionsRes = await apiClient.get('/sessions', { params: { ...params, sessionType: 'Exam' } });
                sessionExams = Array.isArray(sessionsRes.data) ? sessionsRes.data.map((s, idx) => ({
                    _id: s._id,
                    title: s.title || `${s.examType || 'Mid-Term'} Examination`,
                    course: s.courseCode || 'SUBJ',
                    courseName: s.courseName || '',
                    year: s.year,
                    date: s.date ? new Date(s.date).toLocaleDateString() : 'TBA',
                    time: `${s.startTime || '08:30 AM'} - ${s.endTime || '11:30 AM'}`,
                    duration: '3 Hours',
                    room: s.place || 'Hall 3/212-A',
                    seatingPhoto: s.seatingPhoto || '',
                    seatProcedure: s.groupTag ? `Group ${s.groupTag} (Seats #${idx * 30 + 1} - #${(idx + 1) * 30})` : `Roll No: ${s.major || 'MC'}-1 to ${s.major || 'MC'}-30`,
                    invigilator: s.teacher || 'Faculty Member',
                    status: s.status === 'Published' ? 'Published' : 'Upcoming'
                })) : [];
            } catch (e) {
                console.warn('Sessions endpoint:', e.message);
            }

            setExams([...sessionExams, ...dbExams]);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch exams.');
        } finally {
            setLoading(false);
        }
    }, [selectedYear, isStudent, studentYear]);

    useEffect(() => {
        fetchExams();
    }, [fetchExams]);

    const handleOpenModal = (exam = null) => {
        if (exam) {
            setCurrentExam(exam);
            setFormData({
                course: exam.course || '',
                title: exam.title || '',
                date: exam.date || '',
                time: exam.time || '',
                duration: exam.duration || '',
                room: exam.room || '',
                status: exam.status || 'Upcoming',
                year: exam.year || '1st Year'
            });
        } else {
            setCurrentExam(null);
            setFormData({
                course: '', title: '', date: '', time: '', duration: '2 Hours', room: '', status: 'Upcoming', year: '1st Year'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentExam(null);
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
        if (!window.confirm('Are you sure you want to delete this exam?')) return;
        try {
            await apiClient.delete(`/exams/${id}`);
            fetchExams();
        } catch (err) {
            console.error(err);
            alert('Failed to delete exam.');
        }
    };

    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'upcoming': return 'status-upcoming';
            case 'completed': return 'status-completed';
            case 'published': return 'status-published';
            default: return '';
        }
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        setImportError('');
        setImportSuccess('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('year', selectedYear !== 'All' ? selectedYear : '6th Year');
        formData.append('semester', 'Semester 1');
        formData.append('major', 'MC');
        formData.append('sessionType', 'Exam');

        try {
            const { data } = await apiClient.post('/sessions/batch-import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportSuccess(data.message || 'Imported Exam Schedule & Seating Plan successfully!');
            fetchExams();
            setTimeout(() => setImportSuccess(''), 5000);
        } catch (err) {
            console.error('Import failed:', err);
            setImportError(err.response?.data?.message || 'Failed to import Excel file.');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    return (
        <div className="exams-page animate-fade-in">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
            />

            <header className="page-header">
                <div>
                    <h1>Examination Hub</h1>
                    <p className="subtitle">Official TU Hmawbi Exam Schedules & Seating Plans</p>
                </div>
                {canManageExams && (
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={handleFileUploadClick} disabled={importing}>
                            <Upload size={18} />
                            {importing ? 'Parsing...' : 'Import Seating / Exam Excel'}
                        </button>
                        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Schedule Exam
                        </button>
                    </div>
                )}
            </header>

            {importSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={18} />
                    <span>{importSuccess}</span>
                </div>
            )}

            {importError && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} />
                    <span>{importError}</span>
                </div>
            )}

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
                        <p>No exams currently scheduled for {isStudent ? studentYear : selectedYear}.</p>
                        {canManageExams && (
                            <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Schedule One Now</button>
                        )}
                    </div>
                ) : (
                    exams.filter(exam => {
                        const targetYear = isStudent ? studentYear : selectedYear;
                        return targetYear === 'All' || exam.year === targetYear || exam.year === 'All';
                    }).map(exam => (
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
                                <h3 className="exam-title" style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: '#fff' }}>{exam.title}</h3>
                                {exam.courseName && (
                                    <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem', color: '#818cf8', fontWeight: '600' }}>{exam.courseName}</p>
                                )}

                                <div className="exam-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                                    <div className="detail-item">
                                        <Calendar size={14} style={{ color: '#4ade80' }} />
                                        <span><strong>Date:</strong> {exam.date}</span>
                                    </div>
                                    <div className="detail-item">
                                        <Clock size={14} style={{ color: '#818cf8' }} />
                                        <span><strong>Time:</strong> {exam.time}</span>
                                    </div>
                                    <div className="detail-item">
                                        <MapPin size={14} style={{ color: '#f87171' }} />
                                        <span><strong>Room:</strong> {exam.room}</span>
                                    </div>
                                    <div className="detail-item" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.04)', padding: '0.4rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <BookOpen size={14} style={{ color: '#fbbf24' }} />
                                        <span><strong>Seat Procedure:</strong> {exam.seatProcedure || 'Standard Roll Order (#1-#30)'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="exam-card-footer" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <span className="exam-id" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invigilator: <strong style={{ color: '#fff' }}>{exam.invigilator || 'Faculty Member'}</strong></span>
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => setActiveSeatingExam(exam)}>
                                    <LayoutGrid size={14} />
                                    <span>Seating Plan 🪑</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* SEATING PLAN MODAL (MATCHING TU HMAWBI OFFICIAL SEATING PAPER) */}
            {activeSeatingExam && (
                <div className="modal-overlay" onClick={() => setActiveSeatingExam(null)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Technological University (Hmawbi)</h2>
                                <p className="modal-subtitle" style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)' }}>
                                    Official Seating Plan (စာမေးပွဲဖြေဆိုရန် ထိုင်ခုံဇယား) — Room 1/109
                                </p>
                            </div>
                            <button className="close-btn" onClick={() => setActiveSeatingExam(null)}><X size={24} /></button>
                        </div>

                        {/* VIEW MODE TABS: GRID VS PAPER PHOTO */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <button
                                className={`btn ${seatingViewTab === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSeatingViewTab('grid')}
                                style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem', borderRadius: '10px' }}
                            >
                                <LayoutGrid size={16} style={{ marginRight: '0.4rem' }} />
                                <span>Paired Desk Grid</span>
                            </button>
                            <button
                                className={`btn ${seatingViewTab === 'photo' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSeatingViewTab('photo')}
                                style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem', borderRadius: '10px' }}
                            >
                                <Camera size={16} style={{ marginRight: '0.4rem' }} />
                                <span>Hand-Written Paper Photo 📷</span>
                            </button>
                        </div>

                        <div style={{ background: 'rgba(99,102,241,0.1)', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
                            <div>Class: <strong style={{ color: '#fff' }}>VI (Mech, MC, EP)</strong> | Exam: <strong style={{ color: '#4ade80' }}>Mid-Term</strong></div>
                            <div>Course: <strong style={{ color: '#818cf8' }}>{activeSeatingExam.course} ({activeSeatingExam.title})</strong></div>
                        </div>

                        {seatingViewTab === 'photo' ? (
                            <div>
                                {(activeSeatingExam.seatingPhoto || uploadedPhotoUrl) ? (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: '600' }}>✓ Official Hand-Written Paper Seating Chart</span>
                                            {canManageExams && (
                                                <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                                                    <span>Replace Photo</span>
                                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleSeatingPhotoUpload} />
                                                </label>
                                            )}
                                        </div>
                                        <img
                                            src={activeSeatingExam.seatingPhoto || uploadedPhotoUrl}
                                            alt="Official Hand-written Exam Seating Chart"
                                            style={{ width: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--surface-border)', background: '#000' }}
                                        />
                                    </div>
                                ) : (
                                    <div className="glass-panel" style={{ padding: '3rem 1.5rem', textAlign: 'center', borderRadius: '16px' }}>
                                        <Camera size={40} style={{ color: '#818cf8', marginBottom: '0.75rem' }} />
                                        <h3 style={{ margin: '0 0 0.4rem', color: '#fff' }}>No Hand-Written Seating Photo Uploaded Yet</h3>
                                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Upload a photo of the official hand-written paper seating plan posted on the university notice board.
                                        </p>
                                        {canManageExams && (
                                            <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.65rem 1.25rem' }}>
                                                <Upload size={16} style={{ marginRight: '0.4rem' }} />
                                                <span>Upload Paper Seating Chart Photo</span>
                                                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleSeatingPhotoUpload} />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                                    {[
                                        { deskId: 1, left: 'VI-EP 1', right: 'VI-EP 38' },
                                        { deskId: 2, left: 'VI-EP 2', right: 'VI-Mech 49' },
                                        { deskId: 3, left: 'VI-EP 14', right: 'VI-Mech 62' },
                                        { deskId: 4, left: 'VI-EP 26', right: 'VI-Mech 74' },
                                        { deskId: 5, left: 'VI-EP 39', right: 'VI-MC 8' },
                                        { deskId: 6, left: 'VI-Mech 50', right: 'VI-EP 3' },
                                        { deskId: 7, left: 'VI-Mech 63', right: 'VI-EP 15' },
                                        { deskId: 8, left: 'VI-Mech 75', right: 'VI-EP 27' },
                                        { deskId: 9, left: 'VI-MC 9', right: 'VI-EP 40' },
                                        { deskId: 10, left: 'VI-EP 4', right: 'VI-Mech 51' },
                                        { deskId: 11, left: 'VI-EP 16', right: 'VI-Mech 64' },
                                        { deskId: 12, left: 'VI-EP 28', right: 'VI-EP 76' },
                                        { deskId: 13, left: 'VI-EP 41', right: 'VI-MC 10' },
                                        { deskId: 14, left: 'VI-Mech 52', right: 'VI-EP 5' },
                                        { deskId: 17, left: 'VI-MC 11', right: 'VI-EP 42' },
                                        { deskId: 18, left: 'VI-MC 13', right: 'VI-EP 44' }
                                    ].map(pair => (
                                        <div key={pair.deskId} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)', borderRadius: '10px', padding: '0.65rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.4rem', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.2rem' }}>
                                                Desk Pair #{pair.deskId}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '700' }}>
                                                <div style={{ background: 'rgba(99,102,241,0.15)', padding: '0.35rem 0.2rem', borderRadius: '6px', color: '#818cf8' }}>
                                                    {pair.left}
                                                </div>
                                                <div style={{ background: 'rgba(16,185,129,0.15)', padding: '0.35rem 0.2rem', borderRadius: '6px', color: '#4ade80' }}>
                                                    {pair.right}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--surface-border)', fontSize: '0.85rem' }}>
                                    <h4 style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '0.9rem' }}>Seating Roll Range Summary:</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: 'var(--text-muted)' }}>
                                        <div>• <strong>VI.Mech:</strong> Roll 49 to 79 + Ext-1 to Ext-2 = <strong>29 Students</strong></div>
                                        <div>• <strong>VI.EP:</strong> Roll 1 to 50 = <strong>50 Students</strong></div>
                                        <div>• <strong>VI.MC:</strong> Roll 1 to 15 = <strong>15 Students</strong></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* EDIT/CREATE EXAM MODAL */}
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
                                    <label>Course / Subject Code</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. McE 61028"
                                        value={formData.course}
                                        onChange={e => setFormData({ ...formData, course: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label>Exam Title</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Mid-Term Examination"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Year</label>
                                    <select
                                        className="form-input"
                                        value={formData.year}
                                        onChange={e => setFormData({ ...formData, year: e.target.value })}
                                    >
                                        {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 08:30 AM"
                                        value={formData.time}
                                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Duration</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 3 Hours"
                                        value={formData.duration}
                                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Room / Exam Hall</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Hall 1/109"
                                        value={formData.room}
                                        onChange={e => setFormData({ ...formData, room: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        className="form-input"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Upcoming">Upcoming</option>
                                        <option value="Published">Published</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Exam</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Exams;
