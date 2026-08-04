import React, { useCallback, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Edit2, Trash2, X, Calendar, Clock, MapPin, Timer, BookOpen, Plus, LayoutGrid, Users, Upload, CheckCircle, AlertCircle, Camera, Sun, Moon } from 'lucide-react';
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
    const [examSessionShift, setExamSessionShift] = useState('morning'); // 'morning' or 'afternoon'
    const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
    const [currentExam, setCurrentExam] = useState(null);
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        course: '', title: '', date: '', time: '08:30 AM - 11:30 AM', sessionShift: 'Morning', duration: '3 Hours', room: '', status: 'Upcoming', year: '1st Year'
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
                    sessionShift: (s.startTime || '').includes('12:') || (s.startTime || '').includes('01:') || (s.startTime || '').includes('02:') ? 'Afternoon' : 'Morning',
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

            const defaultDemoExams = [
                {
                    _id: 'demo-exam-1',
                    title: 'Mid-Term Examination',
                    course: 'McE 61028',
                    courseName: 'Mechatronics System Design',
                    year: '6th Year',
                    date: '8/10/2026',
                    time: '08:30 AM - 11:30 AM',
                    sessionShift: 'Morning',
                    duration: '3 Hours',
                    room: 'Room 1/109',
                    seatProcedure: 'Roll No: VI-EP 1-50, VI-Mech 49-79, VI-MC 1-15',
                    invigilator: 'Daw Thin Yu Maw',
                    status: 'Published'
                },
                {
                    _id: 'demo-exam-2',
                    title: 'Final Examination',
                    course: 'HSS 61011',
                    courseName: 'Humanities & Social Science',
                    year: '6th Year',
                    date: '8/17/2026',
                    time: '12:30 PM - 03:30 PM',
                    sessionShift: 'Afternoon',
                    duration: '3 Hours',
                    room: 'Room 3/212-A',
                    seatProcedure: 'Standard Roll Order (Seats #1-#30)',
                    invigilator: 'Daw Thin Yu Maw',
                    status: 'Upcoming'
                }
            ];

            const combinedExams = [...sessionExams, ...dbExams];
            setExams(combinedExams.length > 0 ? combinedExams : defaultDemoExams);
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
                time: exam.time || '08:30 AM - 11:30 AM',
                sessionShift: exam.sessionShift || 'Morning',
                duration: exam.duration || '3 Hours',
                room: exam.room || '',
                status: exam.status || 'Upcoming',
                year: exam.year || '1st Year'
            });
        } else {
            setCurrentExam(null);
            setFormData({
                course: '', title: '', date: '', time: '08:30 AM - 11:30 AM', sessionShift: 'Morning', duration: '3 Hours', room: '', status: 'Upcoming', year: '1st Year'
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

        // Remove card instantly from UI state
        setExams(prev => prev.filter(e => e._id !== id));

        if (id.toString().startsWith('demo-')) {
            return;
        }

        try {
            await apiClient.delete(`/exams/${id}`).catch(() => apiClient.delete(`/sessions/${id}`));
        } catch (err) {
            console.error('Delete error:', err);
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
                                        <span><strong>Shift:</strong> {exam.sessionShift === 'Afternoon' ? '🌆 Afternoon (12:30 PM)' : '🌅 Morning (08:30 AM)'}</span>
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
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => {
                                    setActiveSeatingExam(exam);
                                    setExamSessionShift((exam.sessionShift || 'Morning').toLowerCase());
                                }}>
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
                                    Official Seating Plan (စာမေးပွဲဖြေဆိုရန် ထိုင်ခုံဇယား) — Room {activeSeatingExam.room || '1/109'}
                                </p>
                            </div>
                            <button className="close-btn" onClick={() => setActiveSeatingExam(null)}><X size={24} /></button>
                        </div>

                        {/* MORNING VS AFTERNOON SESSION SHIFT TOGGLE */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.65rem 0.85rem', borderRadius: '12px', border: '1px solid var(--surface-border)', marginBottom: '1rem', display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>Exam Shift / Session Time:</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={`btn ${examSessionShift === 'morning' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setExamSessionShift('morning')}
                                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', borderRadius: '8px' }}
                                >
                                    <Sun size={14} style={{ marginRight: '0.3rem' }} />
                                    <span>Morning Shift (08:30 AM - 11:30 AM)</span>
                                </button>
                                <button
                                    className={`btn ${examSessionShift === 'afternoon' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setExamSessionShift('afternoon')}
                                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', borderRadius: '8px' }}
                                >
                                    <Moon size={14} style={{ marginRight: '0.3rem' }} />
                                    <span>Afternoon Shift (12:30 PM - 03:30 PM)</span>
                                </button>
                            </div>
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
                            <div>Class: <strong style={{ color: '#fff' }}>{activeSeatingExam.year === '1st Year' ? 'I (BE)' : activeSeatingExam.year === '2nd Year' ? 'II (Mech + MC + EP)' : activeSeatingExam.year === '3rd Year' ? 'III (Mech + MC + EP)' : activeSeatingExam.year === '4th Year' ? 'IV (Mech + MC + EP)' : activeSeatingExam.year === '5th Year' ? 'V (Mech + MC + EP)' : 'VI (Mech + MC + EP)'}</strong> | Exam: <strong style={{ color: '#4ade80' }}>{activeSeatingExam.title || 'Mid-Term'}</strong></div>
                            <div>Shift: <strong style={{ color: '#fbbf24' }}>{examSessionShift === 'afternoon' ? 'Afternoon (12:30 PM - 03:30 PM)' : 'Morning (08:30 AM - 11:30 AM)'}</strong></div>
                        </div>

                        {seatingViewTab === 'photo' ? (
                            <div>
                                {(activeSeatingExam.seatingPhoto || uploadedPhotoUrl) ? (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: '600' }}>✓ Official Hand-Written Paper Seating Chart ({examSessionShift === 'afternoon' ? 'Afternoon' : 'Morning'})</span>
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
                                            Upload a photo of the official hand-written paper seating plan for the {examSessionShift === 'afternoon' ? 'Afternoon' : 'Morning'} shift.
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
                            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '1.25rem', color: '#f0f6fc', fontFamily: "'Inter', sans-serif" }}>
                                {/* OFFICIAL PAPER DOCUMENT HEADER */}
                                <div style={{ borderBottom: '2px solid rgba(255,255,255,0.2)', paddingBottom: '0.85rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', fontWeight: '700' }}>နည်းပညာတက္ကသိုလ် (မှော်ဘီ)</h3>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: '#94a3b8', fontWeight: '600' }}>စာမေးပွဲဖြေဆိုရန် ထိုင်ခုံဇယား ({examSessionShift === 'afternoon' ? 'မွန်းလွဲပိုင်း' : 'နံနက်ပိုင်း'})</p>
                                        <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <span>သင်တန်းအမည်: <strong style={{ color: '#fff' }}>{activeSeatingExam.year === '1st Year' ? 'I (BE)' : activeSeatingExam.year === '2nd Year' ? 'II (Mech + MC + EP)' : activeSeatingExam.year === '3rd Year' ? 'III (Mech + MC + EP)' : activeSeatingExam.year === '4th Year' ? 'IV (Mech + MC + EP)' : activeSeatingExam.year === '5th Year' ? 'V (Mech + MC + EP)' : 'VI (Mech + MC + EP)'}</strong></span>
                                            <span>အချိန်: <strong style={{ color: '#fbbf24' }}>{examSessionShift === 'afternoon' ? '12:30 PM - 03:30 PM' : '08:30 AM - 11:30 AM'}</strong></span>
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(56,189,248,0.15)', padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)', textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Room / Hall</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#38bdf8' }}>{activeSeatingExam.room || '1 / 109'}</div>
                                    </div>
                                </div>

                                {/* MOBILE HORIZONTAL SCROLL HELP BANNER */}
                                <div style={{ background: 'rgba(56,189,248,0.1)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px dashed rgba(56,189,248,0.3)', marginBottom: '0.85rem', fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>👈 👉 Swipe left/right to view all 4 Exam Hall Columns side-by-side</span>
                                    <span style={{ fontWeight: '700', fontSize: '0.7rem', background: '#38bdf8', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>4 Columns</span>
                                </div>

                                {/* HORIZONTAL SCROLL CONTAINER TO PRESERVE EXACT 4-COLUMN PAPER LAYOUT ON MOBILE */}
                                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: '0.75rem', minWidth: '680px' }}>
                                        {/* COLUMN 1 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            <div style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid #6366f1', borderRadius: '6px', padding: '0.35rem', textAlign: 'center', fontWeight: '700', fontSize: '0.78rem', color: '#a5b4fc' }}>VI-EP 1</div>
                                            {[
                                                ['VI-EP 2', 'VI-Mech 49'],
                                                ['VI-Mech 50', 'VI-EP 3'],
                                                ['VI-EP 4', 'VI-Mech 51'],
                                                ['VI-Mech 52', 'VI-EP 5'],
                                                ['VI-EP 6', 'VI-Mech 53'],
                                                ['VI-Mech 54', 'VI-EP 7'],
                                                ['VI-EP 8', 'VI-Mech 55'],
                                                ['VI-Mech 56', 'VI-EP 9'],
                                                ['VI-EP 10', 'VI-Mech 57'],
                                                ['VI-Mech 58', 'VI-EP 11'],
                                                ['VI-EP 12', 'VI-Mech 59'],
                                                ['VI-Mech 61', 'VI-EP 13']
                                            ].map(([left, right], idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '2px', textAlign: 'center', fontSize: '0.74rem', fontWeight: '700' }}>
                                                    <div style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{left}</div>
                                                    <div style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{right}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* COLUMN 2 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {[
                                                ['VI-EP 14', 'VI-Mech 62'],
                                                ['VI-Mech 63', 'VI-EP 15'],
                                                ['VI-EP 16', 'VI-Mech 64'],
                                                ['VI-Mech 65', 'VI-EP 17'],
                                                ['VI-EP 18', 'VI-Mech 66'],
                                                ['VI-Mech 67', 'VI-EP 19'],
                                                ['VI-EP 20', 'VI-Mech 68'],
                                                ['VI-Mech 69', 'VI-EP 21'],
                                                ['VI-EP 22', 'VI-Mech 70'],
                                                ['VI-Mech 71', 'VI-EP 23'],
                                                ['VI-EP 24', 'VI-Mech 72'],
                                                ['VI-Mech 73', 'VI-EP 25']
                                            ].map(([left, right], idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '2px', textAlign: 'center', fontSize: '0.74rem', fontWeight: '700' }}>
                                                    <div style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{left}</div>
                                                    <div style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{right}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* COLUMN 3 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {[
                                                ['VI-EP 26', 'VI-Mech 74'],
                                                ['VI-Mech 75', 'VI-EP 27'],
                                                ['VI-EP 28', 'VI-EP 76'],
                                                ['VI-Mech 79', 'VI-EP 29'],
                                                ['VI-EP 30', 'Ext-2'],
                                                ['VI-MC 1', 'VI-EP 31'],
                                                ['VI-EP 32', 'VI-MC 2'],
                                                ['VI-MC 3', 'VI-EP 33'],
                                                ['VI-EP 34', 'VI-MC 4'],
                                                ['VI-MC 5', 'VI-EP 35'],
                                                ['VI-EP 36', 'VI-MC 6'],
                                                ['VI-MC 7', 'VI-EP 37']
                                            ].map(([left, right], idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '2px', textAlign: 'center', fontSize: '0.74rem', fontWeight: '700' }}>
                                                    <div style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{left}</div>
                                                    <div style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{right}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* COLUMN 4 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            <div style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid #6366f1', borderRadius: '6px', padding: '0.35rem', textAlign: 'center', fontWeight: '700', fontSize: '0.78rem', color: '#a5b4fc' }}>VI-EP 38</div>
                                            {[
                                                ['VI-EP 39', 'VI-MC 8'],
                                                ['VI-MC 9', 'VI-EP 40'],
                                                ['VI-EP 41', 'VI-MC 10'],
                                                ['VI-MC 11', 'VI-EP 42'],
                                                ['VI-EP 43', 'VI-MC 12'],
                                                ['VI-MC 13', 'VI-EP 44'],
                                                ['VI-EP 45', 'VI-MC 14'],
                                                ['VI-MC 15', 'VI-EP 46'],
                                                ['VI-EP 47', 'Ext-1']
                                            ].map(([left, right], idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '2px', textAlign: 'center', fontSize: '0.74rem', fontWeight: '700' }}>
                                                    <div style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{left}</div>
                                                    <div style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', padding: '0.3rem 0.1rem', borderRadius: '4px' }}>{right}</div>
                                                </div>
                                            ))}
                                            <div style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.3rem', textAlign: 'center', fontWeight: '700', fontSize: '0.74rem', color: '#a5b4fc' }}>VI-EP 48</div>
                                            <div style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.3rem', textAlign: 'center', fontWeight: '700', fontSize: '0.74rem', color: '#a5b4fc' }}>VI-EP 49</div>
                                            <div style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.3rem', textAlign: 'center', fontWeight: '700', fontSize: '0.74rem', color: '#a5b4fc' }}>VI-EP 50</div>
                                        </div>
                                    </div>
                                </div>

                                {/* HANDWRITTEN PAPER SUMMARY BREAKDOWN MATCHING FOOTER OF PHOTO */}
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px border rgba(255,255,255,0.15)', fontSize: '0.83rem', fontFamily: 'monospace' }}>
                                    <div style={{ color: '#38bdf8', fontWeight: '700', marginBottom: '0.3rem' }}>✍️ Official Paper Roll Count Breakdown (ထိုင်ခုံစာရင်း ချုပ်):</div>
                                    <div style={{ color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <div>• VI.Mech. 49 to 79 + Ext-1 to Ext-2 = <strong>29 Students</strong> (60,77,78,Ext-1 etc.)</div>
                                        <div>• VI.EP. 1 to 50 = <strong>50 Students</strong></div>
                                        <div>• VI.MC. 1 to 15 = <strong>15 Students</strong></div>
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
                                    <label>Exam Shift / Time</label>
                                    <select
                                        className="form-input"
                                        value={formData.sessionShift}
                                        onChange={e => {
                                            const shift = e.target.value;
                                            setFormData({
                                                ...formData,
                                                sessionShift: shift,
                                                time: shift === 'Afternoon' ? '12:30 PM - 03:30 PM' : '08:30 AM - 11:30 AM'
                                            });
                                        }}
                                    >
                                        <option value="Morning">🌅 Morning Shift (08:30 AM - 11:30 AM)</option>
                                        <option value="Afternoon">🌆 Afternoon Shift (12:30 PM - 03:30 PM)</option>
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
                                    <label>Time String</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 08:30 AM - 11:30 AM"
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
