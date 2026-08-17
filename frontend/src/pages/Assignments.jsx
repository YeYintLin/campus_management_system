import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import {
    Folder,
    BookOpen,
    Calendar,
    Clock,
    FileText,
    Upload,
    Users,
    Download,
    Plus,
    Edit2,
    Trash2,
    X,
    ChevronRight,
    ArrowLeft,
    CheckCircle2,
    AlertTriangle,
    Clock3,
    Search,
    RefreshCw,
    Paperclip,
    ExternalLink,
    Filter
} from 'lucide-react';
import { getNormalizedUserYear, normalizeYear } from '../utils/userYear';
import './Assignments.css';

const deriveSemFromCourse = (course) => {
    if (course.semester && (course.semester === 1 || course.semester === 2)) {
        return course.semester;
    }
    const digits = String(course.code || course.name || '').replace(/[^0-9]/g, '');
    if (digits.length >= 5) {
        const s = parseInt(digits[1], 10);
        if (s === 1 || s === 2) return s;
    }
    return 1;
};

const formatDueDate = (dateStr) => {
    if (!dateStr) return 'No deadline';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const isDueDateOverdue = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
};

const getFileDownloadUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const clean = url.startsWith('/') ? url : `/${url}`;
    const base = import.meta.env.VITE_CORE_API_URL?.replace(/\/api\/?$/, '') || window.location.origin;
    return `${base}${clean}`;
};

const Assignments = () => {
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'Student';
    const isTeacher = user?.role === 'Teacher';
    const isAdmin = user?.role === 'Admin' || user?.role === 'AcademicAdmin';
    const canManageAssignments = isAdmin || isTeacher;
    const studentYear = getNormalizedUserYear(user);

    // Data States
    const [assignments, setAssignments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Navigation & Drilldown States
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [selectedSemester, setSelectedSemester] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSubject, setActiveSubject] = useState(null);
    const [activeReviewAssignment, setActiveReviewAssignment] = useState(null);

    // Roster Review Data
    const [rosterData, setRosterData] = useState(null);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterSearch, setRosterSearch] = useState('');
    const [rosterFilter, setRosterFilter] = useState('all'); // 'all' | 'submitted' | 'late' | 'missing'
    const [rosterPage, setRosterPage] = useState(1);
    const [rosterPerPage, setRosterPerPage] = useState(25);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        course: '',
        description: '',
        dueDate: '',
        fileUrl: '',
        fileName: '',
    });
    const [uploadingQuestionFile, setUploadingQuestionFile] = useState(false);

    // Student Solution Submission Modal
    const [submitModalAssignment, setSubmitModalAssignment] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);
    const questionFileInputRef = useRef(null);

    useEffect(() => {
        fetchCourses();
        fetchAssignments();
    }, []);

    const fetchCourses = async () => {
        try {
            const { data } = await apiClient.get('/courses');
            setCourses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch courses:', err);
        }
    };

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/assignments');
            setAssignments(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch assignments:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter courses matching role, year, and semester
    const filteredCourses = useMemo(() => {
        return courses.filter(c => {
            // Role scoping for Teachers
            if (isTeacher) {
                const teacherId = user?._id ? String(user._id) : (user?.id ? String(user.id) : '');
                const teacherEmail = (user?.email || '').toLowerCase().trim();
                const teacherName = (user?.name || '').toLowerCase().trim();
                const cleanTeacher = teacherName.replace(/\b(daw|u|prof|dr|mr|mrs|ms|tr)\b/gi, '').trim();

                const cTeacher = c.teacher;
                if (cTeacher) {
                    let match = false;
                    if (typeof cTeacher === 'object') {
                        const cId = cTeacher._id ? String(cTeacher._id) : String(cTeacher);
                        const cEmail = (cTeacher.email || '').toLowerCase().trim();
                        const cName = (cTeacher.name || '').toLowerCase().trim();
                        const cleanC = cName.replace(/\b(daw|u|prof|dr|mr|mrs|ms|tr)\b/gi, '').trim();

                        if (teacherId && cId && teacherId === cId) match = true;
                        if (teacherEmail && cEmail && teacherEmail === cEmail) match = true;
                        if (cleanTeacher && cleanC && (cleanC.includes(cleanTeacher) || cleanTeacher.includes(cleanC))) match = true;
                    } else if (typeof cTeacher === 'string') {
                        const cStr = cTeacher.toLowerCase().trim();
                        const cleanC = cStr.replace(/\b(daw|u|prof|dr|mr|mrs|ms|tr)\b/gi, '').trim();
                        if (cStr === teacherId || cStr === teacherEmail) match = true;
                        if (cleanTeacher && cleanC && (cleanC.includes(cleanTeacher) || cleanTeacher.includes(cleanC))) match = true;
                    }
                    if (!match) return false;
                }
            }

            // Year filter
            const cYear = c.yearLabel ? normalizeYear(c.yearLabel) : `${c.year || 1}${c.year === 1 ? 'st' : c.year === 2 ? 'nd' : c.year === 3 ? 'rd' : 'th'} Year`;
            const yearMatch = selectedYear === 'All' || cYear === selectedYear;

            // Semester filter
            const semNum = deriveSemFromCourse(c);
            let semMatch = true;
            if (selectedSemester === 'Semester 1') semMatch = semNum === 1;
            if (selectedSemester === 'Semester 2') semMatch = semNum === 2;

            // Search query
            const fullText = `${c.code || ''} ${c.name || ''}`.toLowerCase();
            const searchMatch = !searchTerm || fullText.includes(searchTerm.toLowerCase());

            return yearMatch && semMatch && searchMatch;
        });
    }, [courses, isTeacher, user, selectedYear, selectedSemester, searchTerm]);

    // Assignments grouped by course (matched by ID, course code, or name)
    const assignmentsByCourse = useMemo(() => {
        const map = new Map();
        courses.forEach(c => {
            const cIdStr = String(c._id);
            const cCode = (c.code || '').replace(/[\s-]+/g, '').toUpperCase();
            const cName = (c.name || '').toLowerCase().trim();

            const matched = assignments.filter(a => {
                const cObj = typeof a.course === 'object' ? a.course : null;
                const aCourseId = cObj ? String(cObj._id) : String(a.course);
                if (aCourseId === cIdStr) return true;
                if (cObj) {
                    const aCode = (cObj.code || '').replace(/[\s-]+/g, '').toUpperCase();
                    const aName = (cObj.name || '').toLowerCase().trim();
                    if (cCode && aCode && aCode === cCode) return true;
                    if (cName && aName && (aName.includes(cName) || cName.includes(aName))) return true;
                }
                return false;
            });

            map.set(cIdStr, matched);
        });
        return map;
    }, [courses, assignments]);

    // Assignments for currently open subject
    const currentSubjectAssignments = useMemo(() => {
        if (!activeSubject) return [];
        const targetId = activeSubject._id ? String(activeSubject._id) : '';
        const targetCode = (activeSubject.code || '').replace(/[\s-]+/g, '').toUpperCase();
        const targetName = (activeSubject.name || '').toLowerCase().trim();

        return assignments.filter(a => {
            const cObj = typeof a.course === 'object' ? a.course : null;
            const aCourseId = cObj ? String(cObj._id) : String(a.course);

            if (targetId && aCourseId && aCourseId === targetId) return true;

            if (cObj) {
                const aCode = (cObj.code || '').replace(/[\s-]+/g, '').toUpperCase();
                const aName = (cObj.name || '').toLowerCase().trim();
                if (targetCode && aCode && aCode === targetCode) return true;
                if (targetName && aName && (aName.includes(targetName) || targetName.includes(aName))) return true;
            }
            return false;
        });
    }, [activeSubject, assignments]);

    // Load Roster Review for an assignment
    const openRosterReview = async (assignment) => {
        setActiveReviewAssignment(assignment);
        setRosterLoading(true);
        setRosterPage(1);
        setRosterFilter('all');
        setRosterSearch('');
        try {
            const { data } = await apiClient.get(`/assignments/${assignment._id}/roster-review`);
            setRosterData(data);
        } catch (err) {
            console.error('Failed to load roster review:', err);
            alert(err.response?.data?.message || 'Failed to load student roster review.');
        } finally {
            setRosterLoading(false);
        }
    };

    // Filtered Roster for Teacher Review Table
    const filteredRoster = useMemo(() => {
        if (!rosterData?.roster) return [];
        return rosterData.roster.filter(st => {
            // Status Tab Filter
            if (rosterFilter === 'submitted' && st.status !== 'Submitted') return false;
            if (rosterFilter === 'late' && st.status !== 'Late') return false;
            if (rosterFilter === 'missing' && st.status !== 'Missing') return false;

            // Search query
            if (rosterSearch.trim()) {
                const q = rosterSearch.toLowerCase().trim();
                const roll = (st.rollNo || '').toLowerCase();
                const name = (st.name || '').toLowerCase();
                const email = (st.email || '').toLowerCase();
                return roll.includes(q) || name.includes(q) || email.includes(q);
            }
            return true;
        });
    }, [rosterData, rosterFilter, rosterSearch]);

    // Paginated Roster
    const paginatedRoster = useMemo(() => {
        if (rosterPerPage >= 999) return filteredRoster;
        const start = (rosterPage - 1) * rosterPerPage;
        return filteredRoster.slice(start, start + rosterPerPage);
    }, [filteredRoster, rosterPage, rosterPerPage]);

    const totalRosterPages = Math.ceil(filteredRoster.length / (rosterPerPage >= 999 ? 1 : rosterPerPage)) || 1;

    // Handle Question Paper File Upload
    const handleQuestionFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingQuestionFile(true);
        const form = new FormData();
        form.append('file', file);

        try {
            const { data: fileUrl } = await apiClient.post('/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData(prev => ({
                ...prev,
                fileUrl,
                fileName: file.name
            }));
        } catch (err) {
            console.error('Question file upload failed:', err);
            alert('Failed to upload question paper file.');
        } finally {
            setUploadingQuestionFile(false);
        }
    };

    // Handle Create / Edit Assignment Form Save
    const handleSaveAssignment = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title: formData.title,
                course: formData.course,
                description: formData.description,
                dueDate: formData.dueDate,
                fileUrl: formData.fileUrl || undefined,
                fileName: formData.fileName || undefined,
            };

            if (editingAssignment) {
                await apiClient.put(`/assignments/${editingAssignment._id}`, payload);
            } else {
                await apiClient.post('/assignments', payload);
            }

            fetchAssignments();
            setIsModalOpen(false);
            setEditingAssignment(null);
        } catch (err) {
            console.error('Failed to save assignment:', err);
            alert(err.response?.data?.message || 'Failed to save assignment.');
        }
    };

    // Handle Delete Assignment
    const handleDeleteAssignment = async (id) => {
        if (window.confirm("Are you sure you want to delete this tutorial/assignment?")) {
            try {
                await apiClient.delete(`/assignments/${id}`);
                fetchAssignments();
                if (activeReviewAssignment?._id === id) {
                    setActiveReviewAssignment(null);
                }
            } catch (err) {
                console.error('Failed to delete assignment:', err);
                alert(err.response?.data?.message || 'Failed to delete assignment.');
            }
        }
    };

    // Handle Student Solution Submission
    const handleSubmitSolution = async (e) => {
        e.preventDefault();
        if (!submitModalAssignment || !selectedFile) {
            alert('Please select a solution PDF or image file to upload.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Upload the physical file to /api/upload
            const form = new FormData();
            form.append('file', selectedFile);

            const { data: uploadedFileUrl } = await apiClient.post('/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Format human-readable file size (e.g. 2.4 MB)
            const sizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
            const fileSizeStr = selectedFile.size < 1024 * 1024
                ? `${Math.round(selectedFile.size / 1024)} KB`
                : `${sizeInMB} MB`;

            // 2. Submit to Assignment endpoint
            await apiClient.post(`/assignments/${submitModalAssignment._id}/submit`, {
                fileUrl: uploadedFileUrl,
                fileName: selectedFile.name,
                fileSize: fileSizeStr,
            });

            alert('Solution work submitted successfully!');
            setSubmitModalAssignment(null);
            setSelectedFile(null);
            fetchAssignments();
        } catch (err) {
            console.error('Failed to submit assignment:', err);
            alert(err.response?.data?.message || 'Failed to submit assignment.');
        } finally {
            setSubmitting(false);
        }
    };

    const openCreateModal = (targetCourse = null) => {
        const courseId = targetCourse?._id || activeSubject?._id || (courses[0]?._id || '');
        setEditingAssignment(null);
        setFormData({
            title: '',
            course: courseId,
            description: '',
            dueDate: '',
            fileUrl: '',
            fileName: '',
        });
        setIsModalOpen(true);
    };

    const openEditModal = (assignment) => {
        setEditingAssignment(assignment);
        setFormData({
            title: assignment.title,
            course: typeof assignment.course === 'object' ? assignment.course?._id : assignment.course,
            description: assignment.description || '',
            dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : '',
            fileUrl: assignment.fileUrl || '',
            fileName: assignment.fileName || '',
        });
        setIsModalOpen(true);
    };

    const yearsList = isStudent
        ? [studentYear]
        : ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

    return (
        <div className="assignments-page animate-fade-in">
            {/* Header */}
            <header className="page-header">
                <div>
                    <h1>Assignments & Tutorials</h1>
                    <p className="subtitle">
                        {isStudent
                            ? 'Download tutorial question papers, submit solution files, and track your progress'
                            : 'Organize course assignments, upload tutorial questions, and review student submissions'}
                    </p>
                </div>
                {canManageAssignments && (
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={() => openCreateModal()}>
                            <Plus size={18} />
                            + New Assignment
                        </button>
                    </div>
                )}
            </header>

            {/* Breadcrumbs Navigation */}
            <div className="assignment-breadcrumbs glass-panel">
                <button
                    className={`breadcrumb-item ${!activeSubject ? 'active' : ''}`}
                    onClick={() => {
                        setActiveSubject(null);
                        setActiveReviewAssignment(null);
                    }}
                >
                    <Folder size={16} />
                    <span>All Subjects</span>
                </button>

                {activeSubject && (
                    <>
                        <span className="breadcrumb-separator">/</span>
                        <button
                            className={`breadcrumb-item ${!activeReviewAssignment ? 'active' : ''}`}
                            onClick={() => setActiveReviewAssignment(null)}
                        >
                            <BookOpen size={16} />
                            <span>{activeSubject.code} - {activeSubject.name}</span>
                        </button>
                    </>
                )}

                {activeReviewAssignment && (
                    <>
                        <span className="breadcrumb-separator">/</span>
                        <span className="breadcrumb-item active">
                            <Users size={16} />
                            <span>{activeReviewAssignment.title} (Roster Review)</span>
                        </span>
                    </>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                LEVEL 3: TEACHER ROSTER REVIEW VIEW
               ══════════════════════════════════════════════════════════════ */}
            {activeReviewAssignment ? (
                <div className="roster-review-page animate-fade-in">
                    {/* Header Banner */}
                    <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button className="btn btn-secondary-glass btn-sm" onClick={() => setActiveReviewAssignment(null)}>
                                    <ArrowLeft size={16} /> Back to Subject
                                </button>
                                <span className="badge badge-primary font-mono">{rosterData?.assignment?.course?.code}</span>
                            </div>
                            <h2 style={{ margin: '0.5rem 0 0.2rem', color: 'var(--text-primary)' }}>{activeReviewAssignment.title}</h2>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Due: {formatDueDate(activeReviewAssignment.dueDate)} • {activeReviewAssignment.description || 'No instructions provided.'}
                            </p>
                        </div>

                        {activeReviewAssignment.fileUrl && (
                            <a
                                href={getFileDownloadUrl(activeReviewAssignment.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <FileText size={16} />
                                Question Paper PDF
                            </a>
                        )}
                    </div>

                    {/* Metrics Row */}
                    {rosterData?.stats && (
                        <div className="metrics-row">
                            <div className="metric-card">
                                <span className="metric-label">Total Enrolled</span>
                                <span className="metric-value">{rosterData.stats.totalEnrolled}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#4ade80' }}>Submitted (On-time)</span>
                                <span className="metric-value" style={{ color: '#4ade80' }}>{rosterData.stats.onTimeCount}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#fbbf24' }}>Submitted (Late)</span>
                                <span className="metric-value" style={{ color: '#fbbf24' }}>{rosterData.stats.lateCount}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#f87171' }}>Missing / Unsubmitted</span>
                                <span className="metric-value" style={{ color: '#f87171' }}>{rosterData.stats.missingCount}</span>
                            </div>
                        </div>
                    )}

                    {/* Controls Bar */}
                    <div className="roster-controls glass-panel" style={{ padding: '0.85rem 1.25rem' }}>
                        <div className="roster-filter-pills">
                            <button
                                className={`roster-filter-btn ${rosterFilter === 'all' ? 'active' : ''}`}
                                onClick={() => { setRosterFilter('all'); setRosterPage(1); }}
                            >
                                All Students ({rosterData?.stats?.totalEnrolled || 0})
                            </button>
                            <button
                                className={`roster-filter-btn ${rosterFilter === 'submitted' ? 'active' : ''}`}
                                onClick={() => { setRosterFilter('submitted'); setRosterPage(1); }}
                            >
                                On-Time ({rosterData?.stats?.onTimeCount || 0})
                            </button>
                            <button
                                className={`roster-filter-btn ${rosterFilter === 'late' ? 'active' : ''}`}
                                onClick={() => { setRosterFilter('late'); setRosterPage(1); }}
                            >
                                Late ({rosterData?.stats?.lateCount || 0})
                            </button>
                            <button
                                className={`roster-filter-btn ${rosterFilter === 'missing' ? 'active' : ''}`}
                                onClick={() => { setRosterFilter('missing'); setRosterPage(1); }}
                            >
                                Missing ({rosterData?.stats?.missingCount || 0})
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search roll no, name..."
                                    className="form-input"
                                    value={rosterSearch}
                                    onChange={e => { setRosterSearch(e.target.value); setRosterPage(1); }}
                                    style={{ paddingLeft: '2rem', width: '220px', fontSize: '0.85rem' }}
                                />
                            </div>

                            <select
                                className="form-input"
                                value={rosterPerPage}
                                onChange={e => { setRosterPerPage(Number(e.target.value)); setRosterPage(1); }}
                                style={{ width: '110px', fontSize: '0.85rem' }}
                            >
                                <option value={25}>25 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={999}>View All</option>
                            </select>
                        </div>
                    </div>

                    {/* Roster Table */}
                    <div className="roster-table-container glass-panel">
                        {rosterLoading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.75rem' }} />
                                <p style={{ margin: 0 }}>Loading student roster records...</p>
                            </div>
                        ) : paginatedRoster.length > 0 ? (
                            <table className="roster-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '120px' }}>Roll No</th>
                                        <th>Student Name</th>
                                        <th>Status</th>
                                        <th>Submitted At</th>
                                        <th>Attached Solution File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRoster.map((st, idx) => {
                                        const isDone = st.status === 'Submitted' || st.status === 'Late';
                                        const fullFileUrl = st.fileUrl ? getFileDownloadUrl(st.fileUrl) : null;

                                        return (
                                            <tr key={idx}>
                                                <td className="font-mono" style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                                                    {st.rollNo}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{st.name}</div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{st.email}</div>
                                                </td>
                                                <td>
                                                    {st.status === 'Submitted' && (
                                                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
                                                            <CheckCircle2 size={13} /> On-time
                                                        </span>
                                                    )}
                                                    {st.status === 'Late' && (
                                                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24' }}>
                                                            <Clock3 size={13} /> Late
                                                        </span>
                                                    )}
                                                    {st.status === 'Missing' && (
                                                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                                                            <X size={13} /> Missing
                                                        </span>
                                                    )}
                                                    {st.status === 'Pending' && (
                                                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(var(--primary-rgb), 0.08)', color: 'var(--text-muted)' }}>
                                                            <Clock size={13} /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '0.82rem', color: isDone ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                    {st.submittedAt ? new Date(st.submittedAt).toLocaleString() : '—'}
                                                </td>
                                                <td>
                                                    {isDone && fullFileUrl ? (
                                                        <a
                                                            href={fullFileUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="btn btn-secondary-glass btn-sm"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                                                        >
                                                            <FileText size={14} className="text-primary" />
                                                            <span>{st.fileName || 'View Solution PDF'}</span>
                                                            <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                                        </a>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No submission attached</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <p style={{ margin: 0 }}>No student records match the selected filter.</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination Bar */}
                    {totalRosterPages > 1 && rosterPerPage < 999 && (
                        <div className="pagination-bar glass-panel">
                            <span>
                                Showing {(rosterPage - 1) * rosterPerPage + 1} - {Math.min(rosterPage * rosterPerPage, filteredRoster.length)} of {filteredRoster.length} students
                            </span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                    className="btn btn-secondary-glass btn-sm"
                                    disabled={rosterPage === 1}
                                    onClick={() => setRosterPage(prev => Math.max(1, prev - 1))}
                                >
                                    Previous
                                </button>
                                <span style={{ padding: '0.3rem 0.75rem', alignSelf: 'center', fontSize: '0.85rem', fontWeight: '600' }}>
                                    Page {rosterPage} of {totalRosterPages}
                                </span>
                                <button
                                    className="btn btn-secondary-glass btn-sm"
                                    disabled={rosterPage >= totalRosterPages}
                                    onClick={() => setRosterPage(prev => Math.min(totalRosterPages, prev + 1))}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : activeSubject ? (
                /* ══════════════════════════════════════════════════════════════
                    LEVEL 2: INSIDE SUBJECT FOLDER (ASSIGNMENTS LIST)
                   ══════════════════════════════════════════════════════════════ */
                <div className="subject-assignments-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Subject Banner */}
                    <div className="glass-panel subject-banner">
                        <div className="subject-banner-info">
                            <div className="subject-banner-header">
                                <button className="btn btn-secondary-glass btn-sm" onClick={() => setActiveSubject(null)}>
                                    <ArrowLeft size={16} /> All Subjects
                                </button>
                                <span className="badge badge-primary font-mono">{activeSubject.code}</span>
                                <span className="badge badge-secondary">Semester {deriveSemFromCourse(activeSubject)}</span>
                            </div>
                            <h2 className="subject-banner-title">{activeSubject.name}</h2>
                            <p className="subject-banner-meta">
                                {activeSubject.yearLabel || 'Academic Subject'} • Department: {activeSubject.department || 'Mechatronics'}
                            </p>
                        </div>

                        {canManageAssignments && (
                            <button className="btn btn-primary" onClick={() => openCreateModal(activeSubject)}>
                                <Plus size={16} /> + New Tutorial / Assignment
                            </button>
                        )}
                    </div>

                    {/* Assignments List */}
                    <div className="assignments-grid">
                        {currentSubjectAssignments.length === 0 ? (
                            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                                <h3>No Tutorials or Assignments Posted Yet</h3>
                                <p style={{ margin: '0.25rem 0 1rem' }}>
                                    {canManageAssignments
                                        ? 'Upload the first tutorial question file for your students.'
                                        : 'Your teacher has not uploaded assignments for this subject yet.'}
                                </p>
                                {canManageAssignments && (
                                    <button className="btn btn-primary" onClick={() => openCreateModal(activeSubject)}>
                                        + Create Assignment Now
                                    </button>
                                )}
                            </div>
                        ) : (
                            currentSubjectAssignments.map(assignment => {
                                const isOverdue = isDueDateOverdue(assignment.dueDate);
                                const fullQuestionUrl = assignment.fileUrl ? getFileDownloadUrl(assignment.fileUrl) : null;

                                // Student's own submission
                                const mySubmission = isStudent && assignment.submissions?.find(s => {
                                    const sId = typeof s.student === 'object' ? s.student?._id : s.student;
                                    return sId && String(sId) === String(user?._id);
                                });

                                return (
                                    <div key={assignment._id} className="assignment-card glass-panel hover-glow">
                                        <div>
                                            <div className="assignment-card-header">
                                                <div className="assignment-course">
                                                    <span className="course-code">{activeSubject.code}</span>
                                                </div>
                                                <div className="assignment-actions">
                                                    {canManageAssignments && (
                                                        <>
                                                            <button className="icon-btn" onClick={() => openEditModal(assignment)} title="Edit">
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button className="icon-btn delete" onClick={() => handleDeleteAssignment(assignment._id)} title="Delete">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="assignment-card-body" style={{ marginTop: '0.75rem' }}>
                                                <h3 className="assignment-title">{assignment.title}</h3>
                                                <p className="assignment-description">{assignment.description || 'No additional instructions.'}</p>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: isOverdue ? '#f87171' : 'var(--text-muted)', marginTop: '0.4rem' }}>
                                                    <Calendar size={14} />
                                                    <span>Due: <strong>{formatDueDate(assignment.dueDate)}</strong> {isOverdue && '(Deadline Passed)'}</span>
                                                </div>

                                                {/* Question File Attachment */}
                                                {fullQuestionUrl && (
                                                    <div className="question-file-box">
                                                        <div className="question-file-info">
                                                            <FileText size={16} className="text-primary" />
                                                            <span title={assignment.fileName || 'Question Paper'}>
                                                                {assignment.fileName || 'Question_Paper.pdf'}
                                                            </span>
                                                        </div>
                                                        <a
                                                            href={fullQuestionUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="btn btn-secondary-glass btn-sm"
                                                            style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                                                        >
                                                            <Download size={13} /> Download
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom Action Section */}
                                        <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                            {isStudent ? (
                                                mySubmission ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
                                                                <CheckCircle2 size={14} /> Submitted {mySubmission.isLate ? '(Late)' : '(On-time)'}
                                                            </span>
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                                {new Date(mySubmission.submittedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <a
                                                                href={getFileDownloadUrl(mySubmission.fileUrl)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn btn-secondary btn-sm"
                                                                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}
                                                            >
                                                                <FileText size={14} /> View My Solution
                                                            </a>
                                                            <button
                                                                className="btn btn-secondary-glass btn-sm"
                                                                onClick={() => {
                                                                    setSelectedFile(null);
                                                                    setSubmitModalAssignment(assignment);
                                                                }}
                                                                style={{ fontSize: '0.8rem' }}
                                                                title="Resubmit solution file"
                                                            >
                                                                Replace File
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => {
                                                            setSelectedFile(null);
                                                            setSubmitModalAssignment(assignment);
                                                        }}
                                                        style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
                                                    >
                                                        <Upload size={16} />
                                                        <span>Upload Solution PDF / Work</span>
                                                    </button>
                                                )
                                            ) : (
                                                /* Teacher Roster Button */
                                                <button
                                                    className="btn btn-secondary-glass"
                                                    onClick={() => openRosterReview(assignment)}
                                                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    <Users size={16} />
                                                    <span>Review Submissions Roster ({assignment.submissions?.length || 0})</span>
                                                    <ChevronRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : (
                /* ══════════════════════════════════════════════════════════════
                    LEVEL 1: SUBJECT FOLDERS DIRECTORY
                   ══════════════════════════════════════════════════════════════ */
                <div className="subjects-directory-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Filters Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="year-filter-bar glass-panel">
                            {yearsList.map(year => (
                                <button
                                    key={year}
                                    className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                                    onClick={() => setSelectedYear(year)}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>

                        <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Semester:</span>
                                {['All', 'Semester 1', 'Semester 2'].map(sem => (
                                    <button
                                        key={sem}
                                        className={`year-tag ${selectedSemester === sem ? 'active' : ''}`}
                                        onClick={() => setSelectedSemester(sem)}
                                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                                    >
                                        {sem}
                                    </button>
                                ))}
                            </div>

                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search subject code or name..."
                                    className="form-input"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '2rem', width: '250px', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subject Folders Grid */}
                    <div className="subject-folders-grid">
                        {loading ? (
                            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.75rem' }} />
                                <p style={{ margin: 0 }}>Loading subjects...</p>
                            </div>
                        ) : filteredCourses.length === 0 ? (
                            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Folder size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                                <h3>No Subjects Found</h3>
                                <p style={{ margin: 0 }}>No subjects match the selected Year and Semester criteria.</p>
                            </div>
                        ) : (
                            filteredCourses.map(course => {
                                const courseAssignments = assignmentsByCourse.get(String(course._id)) || [];
                                const totalCount = courseAssignments.length;
                                const semNum = deriveSemFromCourse(course);

                                return (
                                    <div
                                        key={course._id}
                                        className="subject-folder-card glass-panel"
                                        onClick={() => setActiveSubject(course)}
                                    >
                                        <div>
                                            <div className="folder-top">
                                                <div className="folder-icon-wrap">
                                                    <Folder size={24} />
                                                </div>
                                                <div className="folder-badge-group">
                                                    <span className="badge badge-primary font-mono">{course.code}</span>
                                                    <span className="badge badge-secondary">Sem {semNum}</span>
                                                </div>
                                            </div>

                                            <div className="folder-body">
                                                <h3>{course.name}</h3>
                                                <p>{course.yearLabel || `${course.year || 1}th Year`} • {course.department || 'Mechatronics'}</p>
                                            </div>
                                        </div>

                                        <div className="folder-footer">
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <FileText size={14} />
                                                <strong>{totalCount}</strong> {totalCount === 1 ? 'Assignment' : 'Assignments'}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#818cf8', fontWeight: '600' }}>
                                                Open Folder <ChevronRight size={14} />
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MODAL 1: TEACHER CREATE / EDIT ASSIGNMENT
               ══════════════════════════════════════════════════════════════ */}
            {isModalOpen && (
                <div className="modal-overlay assignment-modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1.5rem' }}>
                    <div className="modal glass-panel animate-scale-up" style={{ maxWidth: '580px', width: '90%', maxHeight: '90vh', overflowY: 'auto', margin: 'auto', borderRadius: '16px' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.85rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                                    {editingAssignment ? 'Edit Tutorial / Assignment' : 'Create New Tutorial / Assignment'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Upload question files and specify submission criteria
                                </p>
                            </div>
                            <button className="icon-btn" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Subject / Course</label>
                                <select
                                    required
                                    className="form-input"
                                    value={formData.course}
                                    onChange={e => setFormData({ ...formData, course: e.target.value })}
                                >
                                    <option value="" disabled>Select Subject</option>
                                    {courses.map(c => (
                                        <option key={c._id} value={c._id}>
                                            {c.code} - {c.name} ({c.yearLabel || `${c.year}th Year`})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="e.g. Tutorial 1: State Space Analysis"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Due Date & Deadline</label>
                                <input
                                    type="date"
                                    required
                                    className="form-input"
                                    value={formData.dueDate}
                                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Instructions / Description</label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    placeholder="Provide detailed instructions, problem numbers, or criteria..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {/* Question File Upload */}
                            <div className="form-group">
                                <label className="form-label">Attach Question Paper / Tutorial PDF (Optional)</label>
                                <input
                                    type="file"
                                    ref={questionFileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                    onChange={handleQuestionFileUpload}
                                />

                                {formData.fileUrl ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.3)', padding: '0.6rem 0.85rem', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                            <FileText size={16} className="text-primary" />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {formData.fileName || 'Attached_Question_File.pdf'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-secondary-glass btn-sm"
                                            onClick={() => setFormData({ ...formData, fileUrl: '', fileName: '' })}
                                            style={{ color: '#f87171' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => questionFileInputRef.current?.click()}
                                        disabled={uploadingQuestionFile}
                                        style={{ width: '100%', justifyContent: 'center', border: '1px dashed var(--surface-border)' }}
                                    >
                                        <Paperclip size={16} />
                                        {uploadingQuestionFile ? 'Uploading file...' : 'Choose Question Paper File (PDF/Doc)'}
                                    </button>
                                )}
                            </div>

                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingAssignment ? 'Save Changes' : 'Create Assignment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MODAL 2: STUDENT SOLUTION UPLOAD
               ══════════════════════════════════════════════════════════════ */}
            {submitModalAssignment && (
                <div className="modal-overlay assignment-modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1.5rem' }}>
                    <div className="modal glass-panel animate-scale-up" style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto', margin: 'auto', borderRadius: '16px' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ background: 'rgba(var(--primary-rgb), 0.15)', padding: '0.5rem', borderRadius: '10px', color: 'var(--primary-color)' }}>
                                    <Upload size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Submit Solution Work</h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{submitModalAssignment.title}</p>
                                </div>
                            </div>
                            <button className="icon-btn" onClick={() => setSubmitModalAssignment(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitSolution} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={e => {
                                    if (e.target.files?.[0]) {
                                        setSelectedFile(e.target.files[0]);
                                    }
                                }}
                            />

                            {/* Dropzone */}
                            <div
                                className="file-dropzone"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={32} style={{ color: 'var(--primary-color)', margin: '0 auto 0.5rem' }} />
                                {selectedFile ? (
                                    <div>
                                        <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>{selectedFile.name}</p>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#4ade80' }}>
                                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to submit
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>Click or drag your solution PDF / photo here</p>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports PDF, JPG, PNG, DOCX up to 10MB</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                <p style={{ margin: '0 0 0.3rem', fontWeight: '700', color: '#cbd5e1' }}>Submission Note:</p>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                                    <li>You can take photos of your handwritten tutorial notes and save as PDF.</li>
                                    <li>Resubmissions replace previous uploads before the due date.</li>
                                </ul>
                            </div>

                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setSubmitModalAssignment(null)} disabled={submitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting || !selectedFile}>
                                    {submitting ? 'Uploading & Submitting...' : 'Confirm Submission'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assignments;
