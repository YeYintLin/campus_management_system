import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import {
    Bug,
    Send,
    Upload,
    Paperclip,
    CheckCircle2,
    Clock,
    AlertCircle,
    AlertTriangle,
    Flame,
    X,
    ExternalLink,
    Filter,
    Search,
    RefreshCw,
    Shield,
    User,
    Mail,
    FileText,
    ArrowRight,
    MessageSquare,
    Eye
} from 'lucide-react';
import { getNormalizedUserYear } from '../utils/userYear';
import './BugReport.css';

const CATEGORIES = [
    'Assignment & Tutorial',
    'Attendance',
    'Timetable',
    'Grades & Exams',
    'Account & Login',
    'UI/Performance',
    'Other',
];

const PRIORITIES = [
    { value: 'Low', label: 'Low', color: 'low', icon: <CheckCircle2 size={14} /> },
    { value: 'Medium', label: 'Medium', color: 'medium', icon: <AlertCircle size={14} /> },
    { value: 'High', label: 'High', color: 'high', icon: <AlertTriangle size={14} /> },
    { value: 'Urgent', label: 'Urgent (Blocker)', color: 'urgent', icon: <Flame size={14} /> },
];

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed', 'Duplicate', "Won't Fix"];

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
};

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Open': return 'badge-open';
        case 'In Progress': return 'badge-in-progress';
        case 'Resolved': return 'badge-resolved';
        case 'Closed': return 'badge-closed';
        case "Won't Fix":
        case 'Duplicate': return 'badge-wontfix';
        default: return 'badge-open';
    }
};

const BugReport = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin' || user?.role === 'AcademicAdmin';
    const isStudent = user?.role === 'Student';
    const isTeacher = user?.role === 'Teacher';
    const studentYear = getNormalizedUserYear(user);

    // Active Tab: 'submit' | 'my' | 'admin'
    const [activeTab, setActiveTab] = useState('submit');

    // Submission Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [priority, setPriority] = useState('Medium');
    const [contactEmail, setContactEmail] = useState(user?.email || '');
    const [pageUrl, setPageUrl] = useState(window.location.pathname);
    const [attachments, setAttachments] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submittedReport, setSubmittedReport] = useState(null);
    const fileInputRef = useRef(null);

    // User's Submitted Reports State
    const [myReports, setMyReports] = useState([]);
    const [myReportsLoading, setMyReportsLoading] = useState(false);

    // Admin Bug Tracker State
    const [adminReports, setAdminReports] = useState([]);
    const [adminStats, setAdminStats] = useState(null);
    const [adminLoading, setAdminLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterPriority, setFilterPriority] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Admin Status Update Modal State
    const [selectedReport, setSelectedReport] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Auto-fill user email on load
    useEffect(() => {
        if (user?.email && !contactEmail) {
            setContactEmail(user.email);
        }
    }, [user]);

    // Fetch reports when tab changes
    useEffect(() => {
        if (activeTab === 'my') {
            fetchMyReports();
        } else if (activeTab === 'admin' && isAdmin) {
            fetchAdminReports();
        }
    }, [activeTab, filterStatus, filterCategory, filterPriority]);

    const fetchMyReports = async () => {
        setMyReportsLoading(true);
        try {
            const { data } = await apiClient.get('/bug-reports/my');
            setMyReports(data.reports || []);
        } catch (err) {
            console.error('Failed to fetch my reports:', err);
        } finally {
            setMyReportsLoading(false);
        }
    };

    const fetchAdminReports = async () => {
        setAdminLoading(true);
        try {
            const params = {};
            if (filterStatus !== 'All') params.status = filterStatus;
            if (filterCategory !== 'All') params.category = filterCategory;
            if (filterPriority !== 'All') params.priority = filterPriority;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const { data } = await apiClient.get('/bug-reports', { params });
            setAdminReports(data.reports || []);
            setAdminStats(data.stats || null);
        } catch (err) {
            console.error('Failed to fetch admin reports:', err);
        } finally {
            setAdminLoading(false);
        }
    };

    // Handle File Attachment Upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (attachments.length >= 5) {
            alert('You can attach at most 5 files per bug report.');
            return;
        }

        setUploadingFile(true);
        const form = new FormData();
        form.append('file', file);

        try {
            const { data: fileUrl } = await apiClient.post('/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const sizeStr = file.size < 1024 * 1024
                ? `${Math.round(file.size / 1024)} KB`
                : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

            setAttachments(prev => [
                ...prev,
                {
                    fileUrl,
                    fileName: file.name,
                    fileSize: sizeStr,
                    fileType: file.type || 'file',
                },
            ]);
        } catch (err) {
            console.error('Attachment upload failed:', err);
            alert(err.response?.data?.message || 'Failed to upload attachment.');
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Handle Form Submit
    const handleSubmitBugReport = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            alert('Please enter a summary title for the issue.');
            return;
        }
        if (!description.trim()) {
            alert('Please provide a detailed description of what happened.');
            return;
        }
        if (!isValidEmail(contactEmail)) {
            alert('Please provide a valid contact Gmail/email address so we can reply.');
            return;
        }

        // Build User Cohort
        let cohortStr = '';
        if (isStudent) {
            cohortStr = `${studentYear || ''} • ${user?.department || 'Mechatronics'}`.trim();
        } else if (isTeacher) {
            cohortStr = `${user?.department || 'Mechatronics'} Faculty`;
        } else {
            cohortStr = 'Administration';
        }

        // Detect Browser / Device Info
        const deviceInfo = {
            browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Browser',
            os: navigator.platform || 'Unknown OS',
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            userAgent: navigator.userAgent,
        };

        setSubmitting(true);
        try {
            const { data } = await apiClient.post('/bug-reports', {
                title: title.trim(),
                description: description.trim(),
                category,
                priority,
                reporterEmail: contactEmail.trim(),
                reporterCohort: cohortStr,
                pageUrl: pageUrl.trim(),
                attachments,
                deviceInfo,
            });

            setSubmittedReport(data.bugReport);
            // Reset form
            setTitle('');
            setDescription('');
            setAttachments([]);
            setPriority('Medium');
        } catch (err) {
            console.error('Failed to submit bug report:', err);
            alert(err.response?.data?.message || 'Failed to submit bug report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Admin Update Status
    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        if (!selectedReport) return;

        setUpdatingStatus(true);
        try {
            await apiClient.patch(`/bug-reports/${selectedReport._id}/status`, {
                status: newStatus,
                adminNotes: adminNotes.trim(),
            });

            alert('Report status updated and notification dispatched to the sender.');
            setSelectedReport(null);
            fetchAdminReports();
        } catch (err) {
            console.error('Failed to update status:', err);
            alert(err.response?.data?.message || 'Failed to update report status.');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const openStatusModal = (report) => {
        setSelectedReport(report);
        setNewStatus(report.status || 'Open');
        setAdminNotes(report.adminNotes || '');
    };

    return (
        <div className="bug-report-page animate-fade-in">
            {/* Header */}
            <header className="page-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '0.4rem', borderRadius: '10px' }}>
                            <Bug size={24} />
                        </div>
                        <h1 style={{ margin: 0 }}>Bug Report & Helpdesk</h1>
                    </div>
                    <p className="subtitle">
                        Encountered a glitch, attendance issue, or upload error? Report it directly to our development team.
                    </p>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bug-tabs-bar glass-panel">
                <button
                    className={`bug-tab-btn ${activeTab === 'submit' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('submit'); setSubmittedReport(null); }}
                >
                    <Send size={16} />
                    <span>Submit New Report</span>
                </button>
                <button
                    className={`bug-tab-btn ${activeTab === 'my' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my')}
                >
                    <FileText size={16} />
                    <span>My Submitted Reports ({myReports.length})</span>
                </button>
                {isAdmin && (
                    <button
                        className={`bug-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        <Shield size={16} />
                        <span>Admin Bug Tracker</span>
                    </button>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TAB 1: SUBMIT BUG REPORT FORM
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'submit' && (
                submittedReport ? (
                    <div className="glass-panel animate-scale-up" style={{ padding: '3rem 2rem', textAlign: 'center', width: '100%' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                            <CheckCircle2 size={36} />
                        </div>
                        <h2 style={{ color: 'var(--text-color, #fff)', margin: '0 0 0.5rem' }}>Bug Report Submitted Successfully!</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.5rem', maxWidth: '650px', marginLeft: 'auto', marginRight: 'auto' }}>
                            An alert email has been dispatched to the development team (<code>yeyint2702@gmail.com</code>) with your contact email (<code>{submittedReport.reporterEmail}</code>) set as the direct reply address.
                        </p>

                        <div style={{ background: 'var(--bg-glass-card, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))', borderRadius: '12px', padding: '1.25rem', textAlign: 'left', marginBottom: '1.5rem', maxWidth: '650px', marginLeft: 'auto', marginRight: 'auto' }}>
                            <p style={{ margin: '0 0 0.4rem', fontWeight: '700', color: 'var(--text-color, #fff)' }}>Ticket Summary:</p>
                            <p style={{ margin: '0 0 0.25rem', fontSize: '0.88rem', color: 'var(--text-color, #cbd5e1)' }}><strong>Title:</strong> {submittedReport.title}</p>
                            <p style={{ margin: '0 0 0.25rem', fontSize: '0.88rem', color: 'var(--text-color, #cbd5e1)' }}><strong>Category:</strong> {submittedReport.category} • <strong>Priority:</strong> {submittedReport.priority}</p>
                            <p style={{ margin: '0', fontSize: '0.88rem', color: 'var(--text-color, #cbd5e1)' }}><strong>Status:</strong> <span className={`badge ${getStatusBadgeClass(submittedReport.status)}`}>{submittedReport.status}</span></p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setSubmittedReport(null)}>
                                Submit Another Report
                            </button>
                            <button className="btn btn-primary" onClick={() => setActiveTab('my')}>
                                View My Tickets <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitBugReport} className="bug-form-container glass-panel">
                        
                        {/* Auto-filled Sender Info Banner */}
                        <div className="sender-info-box">
                            <div className="sender-item">
                                <span className="sender-label">Reporter Name</span>
                                <span className="sender-value">{user?.name || 'User'}</span>
                            </div>
                            <div className="sender-item">
                                <span className="sender-label">Role & Department</span>
                                <span className="sender-value">
                                    {user?.role} {isStudent && studentYear ? `• ${studentYear}` : ''}
                                </span>
                            </div>
                            <div className="sender-item full-width">
                                <span className="sender-label">Contact Gmail / Email (Where admin can reply)</span>
                                <div className="email-input-wrapper">
                                    <Mail size={16} className="email-input-icon" />
                                    <input
                                        type="email"
                                        required
                                        className="form-input email-input-field"
                                        placeholder="e.g. yourname@gmail.com"
                                        value={contactEmail}
                                        onChange={e => setContactEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Category & Priority Row */}
                        <div className="form-row-2col">
                            <div className="form-group">
                                <label className="form-label">Issue Category</label>
                                <select
                                    className="form-input"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Severity / Priority</label>
                                <div className="priority-pills-group">
                                    {PRIORITIES.map(p => (
                                        <button
                                            type="button"
                                            key={p.value}
                                            className={`priority-pill ${p.color} ${priority === p.value ? 'active' : ''}`}
                                            onClick={() => setPriority(p.value)}
                                        >
                                            {p.icon}
                                            <span>{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Title & Page Location Row */}
                        <div className="form-row-2col">
                            <div className="form-group">
                                <label className="form-label">Issue Title / Short Summary</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="e.g. Cannot submit PDF assignment"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    maxLength={150}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Page Where Issue Occurred</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. /assignments or /attendance"
                                    value={pageUrl}
                                    onChange={e => setPageUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="form-group">
                            <label className="form-label">
                                Detailed Description & Steps to Reproduce
                            </label>
                            <textarea
                                required
                                rows="5"
                                className="form-input"
                                placeholder="1. What were you trying to do?&#10;2. What went wrong / what error message appeared?&#10;3. What did you expect to happen?"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                style={{ lineHeight: 1.5 }}
                            />
                        </div>

                        {/* Screenshot / File Attachment Box */}
                        <div className="form-group">
                            <label className="form-label">Attach Screenshots / Files (Optional, Max 5)</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept=".png,.jpg,.jpeg,.pdf,.mp4,.doc,.docx"
                                onChange={handleFileUpload}
                            />

                            <div
                                className="file-dropzone"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={24} style={{ color: '#818cf8', margin: '0 auto 0.35rem' }} />
                                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-color, #fff)', fontSize: '0.9rem' }}>
                                    {uploadingFile ? 'Uploading attachment...' : 'Click to attach screenshot or video (PNG, JPG, PDF, MP4)'}
                                </p>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    Up to 15MB per file • Screenshots help us fix the issue faster!
                                </p>
                            </div>

                            {/* Attached Files List */}
                            {attachments.length > 0 && (
                                <div className="attached-files-list">
                                    {attachments.map((att, idx) => (
                                        <div key={idx} className="attached-file-pill">
                                            <div className="attached-file-info">
                                                <Paperclip size={15} className="text-primary" />
                                                <span style={{ color: 'var(--text-color, #fff)', fontWeight: '600' }}>
                                                    {att.fileName}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>({att.fileSize})</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="icon-btn delete"
                                                onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                                                title="Remove file"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="submit-action-row">
                            <button
                                type="submit"
                                className="btn btn-primary submit-report-btn"
                                disabled={submitting || uploadingFile}
                            >
                                {submitting ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={16} />
                                        <span>Dispatching to Admin...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        <span>Submit Bug Report</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 2: MY SUBMITTED REPORTS
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'my' && (
                <div className="my-reports-section animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>My Submitted Reports</h2>
                        <button className="btn btn-secondary-glass btn-sm" onClick={fetchMyReports}>
                            <RefreshCw size={14} className={myReportsLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>

                    {myReportsLoading ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.75rem' }} />
                            <p style={{ margin: 0 }}>Loading your bug reports...</p>
                        </div>
                    ) : myReports.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Bug size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                            <h3>No Bug Reports Submitted</h3>
                            <p style={{ margin: '0.25rem 0 1rem' }}>You haven't submitted any bug reports or feedback yet.</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('submit')}>
                                + Report an Issue Now
                            </button>
                        </div>
                    ) : (
                        <div className="my-reports-grid">
                            {myReports.map(report => (
                                <div key={report._id} className="my-report-card">
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <span className={`badge ${getStatusBadgeClass(report.status)}`}>
                                                {report.status}
                                            </span>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {new Date(report.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', color: '#fff' }}>{report.title}</h3>
                                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                            {report.description}
                                        </p>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.8rem' }}>
                                            <span className="badge badge-secondary">{report.category}</span>
                                            <span className="badge badge-primary">{report.priority} Priority</span>
                                        </div>

                                        {/* Attachments */}
                                        {report.attachments && report.attachments.length > 0 && (
                                            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                {report.attachments.map((att, i) => (
                                                    <a
                                                        key={i}
                                                        href={att.fileUrl.startsWith('http') ? att.fileUrl : `http://165.245.181.251:5001${att.fileUrl}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="btn btn-secondary-glass btn-sm"
                                                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                                    >
                                                        <Paperclip size={12} /> {att.fileName || 'Attachment'}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Admin Notes if provided */}
                                    {report.adminNotes && (
                                        <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid #38bdf8', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                                            <strong style={{ color: '#38bdf8' }}>Admin Note:</strong>
                                            <p style={{ margin: '0.2rem 0 0', color: '#f1f5f9' }}>{report.adminNotes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 3: ADMIN BUG TRACKER (ADMIN ONLY)
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'admin' && isAdmin && (
                <div className="admin-bug-tracker-section animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Metrics Row */}
                    {adminStats && (
                        <div className="metrics-row">
                            <div className="metric-card">
                                <span className="metric-label">Total Reports</span>
                                <span className="metric-value">{adminStats.total}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#60a5fa' }}>Open Issues</span>
                                <span className="metric-value" style={{ color: '#60a5fa' }}>{adminStats.openCount}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#fbbf24' }}>In Progress</span>
                                <span className="metric-value" style={{ color: '#fbbf24' }}>{adminStats.inProgressCount}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#4ade80' }}>Resolved</span>
                                <span className="metric-value" style={{ color: '#4ade80' }}>{adminStats.resolvedCount}</span>
                            </div>
                            <div className="metric-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                                <span className="metric-label" style={{ color: '#f87171' }}>Urgent Blockers</span>
                                <span className="metric-value" style={{ color: '#f87171' }}>{adminStats.urgentCount}</span>
                            </div>
                        </div>
                    )}

                    {/* Filter & Search Bar */}
                    <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                                className="form-input"
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                style={{ width: '130px', fontSize: '0.85rem' }}
                            >
                                <option value="All">All Statuses</option>
                                {STATUS_OPTIONS.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>

                            <select
                                className="form-input"
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                style={{ width: '150px', fontSize: '0.85rem' }}
                            >
                                <option value="All">All Categories</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>

                            <select
                                className="form-input"
                                value={filterPriority}
                                onChange={e => setFilterPriority(e.target.value)}
                                style={{ width: '130px', fontSize: '0.85rem' }}
                            >
                                <option value="All">All Priorities</option>
                                {PRIORITIES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search title, name, email..."
                                    className="form-input"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchAdminReports()}
                                    style={{ paddingLeft: '2rem', width: '220px', fontSize: '0.85rem' }}
                                />
                            </div>
                            <button className="btn btn-secondary-glass btn-sm" onClick={fetchAdminReports}>
                                <RefreshCw size={14} className={adminLoading ? 'animate-spin' : ''} /> Filter
                            </button>
                        </div>
                    </div>

                    {/* Admin Bug Table */}
                    <div className="admin-bug-table-container glass-panel">
                        {adminLoading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.75rem' }} />
                                <p style={{ margin: 0 }}>Loading bug reports...</p>
                            </div>
                        ) : adminReports.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <p style={{ margin: 0 }}>No bug reports match the selected filters.</p>
                            </div>
                        ) : (
                            <table className="admin-bug-table">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Priority</th>
                                        <th>Title & Category</th>
                                        <th>Reporter</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adminReports.map(report => (
                                        <tr key={report._id}>
                                            <td>
                                                <span className={`badge ${getStatusBadgeClass(report.status)}`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge badge-primary" style={{ fontWeight: '700' }}>
                                                    {report.priority}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '600', color: '#fff' }}>{report.title}</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{report.category}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '600', color: '#fff' }}>{report.reporterName}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#818cf8' }}>{report.reporterEmail}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{report.reporterRole} ({report.reporterCohort})</div>
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(report.createdAt).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-secondary-glass btn-sm"
                                                    onClick={() => openStatusModal(report)}
                                                    style={{ fontSize: '0.8rem' }}
                                                >
                                                    Update Status
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ADMIN STATUS UPDATE MODAL
               ══════════════════════════════════════════════════════════════ */}
            {selectedReport && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }}>
                    <div className="modal glass-panel animate-scale-up" style={{ maxWidth: '560px', width: '90%' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.85rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Update Ticket Status</h3>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    {selectedReport.title}
                                </p>
                            </div>
                            <button className="icon-btn" onClick={() => setSelectedReport(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">New Status</label>
                                <select
                                    className="form-input"
                                    value={newStatus}
                                    onChange={e => setNewStatus(e.target.value)}
                                >
                                    {STATUS_OPTIONS.map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Resolution Notes / Developer Response</label>
                                <textarea
                                    rows="4"
                                    className="form-input"
                                    placeholder="Explain how the issue was fixed, or provide instructions for the user..."
                                    value={adminNotes}
                                    onChange={e => setAdminNotes(e.target.value)}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    This note will be emailed to <strong>{selectedReport.reporterEmail}</strong> and saved in their ticket.
                                </span>
                            </div>

                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedReport(null)} disabled={updatingStatus}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={updatingStatus}>
                                    {updatingStatus ? 'Updating...' : 'Save & Notify User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BugReport;
