import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { Search, FileText, Download, Trash2, Upload, Folder, Filter, FileCode, FileImage, FileStack, ChevronRight, ArrowLeft, FolderPlus, X, ClipboardList, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { getNormalizedUserYear } from '../utils/userYear';
import './Files.css';

const initialFiles = [
    { id: 1, name: 'React_Basics_Tutorial.pdf', type: 'PDF', size: '2.4 MB', category: 'Tutorial', owner: 'Dr. Alan Turing', date: '2026-03-01', year: '1st Year' },
    { id: 2, name: 'Final_Exam_2024.pdf', type: 'PDF', size: '1.5 MB', category: 'Old Question', owner: 'Exam Cell', date: '2026-03-05', year: '4th Year' },
    { id: 3, name: 'CS_Algorithms_Textbook.pdf', type: 'PDF', size: '12.2 MB', category: 'Reference Books', owner: 'Library', date: '2026-02-28', year: '3rd Year' },
    { id: 4, name: 'Advanced_JS_Tutorial.mp4', type: 'VIDEO', size: '45 MB', category: 'Tutorial', owner: 'Prof. Grace Hopper', date: '2026-03-07', year: '2nd Year' },
    { id: 5, name: 'Midterm_MTH101_2023.docx', type: 'DOCX', size: '85 KB', category: 'Old Question', owner: 'Prof. Grace Hopper', date: '2026-03-04', year: '1st Year' },
    { id: 6, name: 'Clean_Code_Reference.epub', type: 'BOOK', size: '2.8 MB', category: 'Reference Books', owner: 'Admin', date: '2026-03-02', year: 'All' },
    { id: 7, name: 'McE_6th_Year_Project_Guidelines.pdf', type: 'PDF', size: '3.1 MB', category: 'Tutorial', owner: 'HOD Mechatronics', date: '2026-03-10', year: '6th Year' },
];

const initialFolders = [
    { name: 'Tutorial', description: 'Step-by-step guides and video lessons', iconColor: '#6366f1' },
    { name: 'Old Question', description: 'Past year papers and exam archives', iconColor: '#ec4899' },
    { name: 'Reference Books', description: 'Recommended textbooks and academic journals', iconColor: '#10b981' },
];

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
    return '1st Year';
};

const Files = () => {
    const { user } = useContext(AuthContext);
    const fileInputRef = useRef(null);

    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const canManageFiles = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const [files, setFiles] = useState(initialFiles);
    const [folders, setFolders] = useState(initialFolders);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [viewMode, setViewMode] = useState('folders'); // 'folders' or 'files'
    const [selectedFolder, setSelectedFolder] = useState(null);

    // Dynamic Subject Folders auto-generated from Courses
    useEffect(() => {
        const fetchSubjectFolders = async () => {
            try {
                const { data: coursesData } = await apiClient.get('/courses');
                if (Array.isArray(coursesData)) {
                    const subjectFolders = coursesData.map(c => ({
                        name: `${c.code} - ${c.name}`,
                        code: c.code,
                        year: deriveYearTag(c.code),
                        description: `Syllabus, reference materials & study files for ${c.code}`,
                        iconColor: '#6366f1'
                    }));

                    setFolders(prev => {
                        const existingNames = new Set(prev.map(f => f.name));
                        const uniqueNew = subjectFolders.filter(f => !existingNames.has(f.name));
                        return [...prev, ...uniqueNew];
                    });
                }
            } catch (err) {
                console.error('Error fetching subject folders:', err);
            }
        };

        fetchSubjectFolders();
    }, []);

    const years = isStudent
        ? [studentYear]
        : ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

    // Modal states
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderDesc, setNewFolderDesc] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadMetadata, setUploadMetadata] = useState({
        file: null,
        year: '1st Year',
        folder: ''
    });

    // ── Audit Panel State ──
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditStats, setAuditStats] = useState(null);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditLoading, setAuditLoading] = useState(false);

    const fetchAuditData = useCallback(async () => {
        if (!canManageFiles) return;
        setAuditLoading(true);
        try {
            const [logsRes, statsRes] = await Promise.all([
                apiClient.get('/files/download-logs', { params: { search: auditSearch, limit: 100 } }),
                apiClient.get('/files/download-stats'),
            ]);
            setAuditLogs(logsRes.data.logs || []);
            setAuditStats(statsRes.data);
        } catch (err) {
            console.error('Failed to fetch audit data:', err);
        } finally {
            setAuditLoading(false);
        }
    }, [canManageFiles, auditSearch]);

    useEffect(() => {
        if (showAuditPanel) fetchAuditData();
    }, [showAuditPanel, fetchAuditData]);

    const handleDownloadFile = async (file) => {
        try {
            await apiClient.post('/files/log-download', {
                userName: user?.name || 'Unknown',
                fileName: file.name,
                fileCategory: file.category,
                fileSize: file.size,
                year: file.year,
            });
        } catch (err) {
            console.warn('Download log failed (non-blocking):', err.message);
        }
        // Trigger actual download (placeholder — adapt when real file URLs are wired)
        console.log('Downloading:', file.name);
    };

    const getFileIcon = (type) => {
        const t = type?.toUpperCase();
        if (t === 'PDF') return <FileText className="file-icon pdf" />;
        if (['PNG', 'JPG', 'JPEG', 'GIF'].includes(t)) return <FileImage className="file-icon image" />;
        if (['SQL', 'JS', 'JSX', 'HTML', 'CSS', 'PY'].includes(t)) return <FileCode className="file-icon code" />;
        return <FileStack className="file-icon generic" />;
    };

    const handleDeleteFile = (id) => {
        if (window.confirm('Delete this file permanently?')) {
            setFiles(files.filter(f => f.id !== id));
        }
    };

    const handleCreateFolder = (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const newFolder = {
            name: newFolderName,
            description: newFolderDesc || 'Custom collection',
            iconColor: randomColor
        };

        setFolders([...folders, newFolder]);
        setIsFolderModalOpen(false);
        setNewFolderName('');
        setNewFolderDesc('');
    };

    const handleDeleteFolder = (e, folderName) => {
        e.stopPropagation();
        if (window.confirm(`Delete the folder "${folderName}" and all its contents?`)) {
            setFolders(folders.filter(f => f.name !== folderName));
            setFiles(files.filter(f => f.category !== folderName));
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadMetadata({
            file: file,
            year: selectedYear !== 'All' ? selectedYear : '1st Year',
            folder: selectedFolder || (folders.length > 0 ? folders[0].name : 'Unsorted')
        });
        setIsUploadModalOpen(true);

        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

    const handleFinalizeUpload = (e) => {
        e.preventDefault();
        const { file, year, folder } = uploadMetadata;
        if (!file) return;

        const extension = file.name.split('.').pop().toUpperCase();
        const newFile = {
            id: Date.now(),
            name: file.name,
            type: extension,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            category: folder,
            year: year,
            owner: user?.name || 'CurrentUser',
            date: new Date().toISOString().split('T')[0]
        };

        setFiles([newFile, ...files]);
        setIsUploadModalOpen(false);
        setUploadMetadata({ file: null, year: '1st Year', folder: '' });
    };

    const handleFolderClick = (folderName) => {
        setSelectedFolder(folderName);
        setViewMode('files');
    };

    const handleBackClick = () => {
        setViewMode('folders');
        setSelectedFolder(null);
        setSearchTerm('');
    };

    const filteredFolders = folders.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
        const folderFiles = files.filter(file => file.category === f.name);
        const targetYear = isStudent ? studentYear : selectedYear;
        const hasYearMatch = targetYear === 'All' ||
            f.year === targetYear ||
            f.year === 'All' ||
            !f.year ||
            folderFiles.some(file => file.year === targetYear || file.year === 'All');
        return matchesSearch && hasYearMatch;
    });

    const filteredFiles = files.filter(f => {
        const targetYear = isStudent ? studentYear : selectedYear;
        return (!selectedFolder || f.category === selectedFolder) &&
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (targetYear === 'All' || f.year === targetYear || f.year === 'All');
    });

    return (
        <div className="files-page animate-fade-in">
            <header className="page-header">
                <div className="header-title-area">
                    {viewMode === 'files' && (
                        <button className="back-btn" onClick={handleBackClick}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1>{viewMode === 'folders' ? 'Resource Library' : selectedFolder}</h1>
                        <p className="subtitle">
                            {isStudent
                                ? `Showing ${studentYear} Academic Resources`
                                : viewMode === 'folders'
                                ? 'Browse through organized academic collections'
                                : `Viewing files in ${selectedFolder}`}
                        </p>
                    </div>
                </div>
                <div className="header-actions">
                    {canManageFiles && (
                        <button
                            className={`btn ${showAuditPanel ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowAuditPanel(!showAuditPanel)}
                        >
                            <ClipboardList size={18} />
                            {showAuditPanel ? 'Close Logs' : 'Download Logs'}
                        </button>
                    )}
                    {canManageFiles && viewMode === 'folders' && (
                        <button className="btn btn-secondary" onClick={() => setIsFolderModalOpen(true)}>
                            <FolderPlus size={18} />
                            New Folder
                        </button>
                    )}
                    {canManageFiles && viewMode === 'files' && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            <button className="btn btn-primary" onClick={handleUploadClick}>
                                <Upload size={18} />
                                Upload File
                            </button>
                        </>
                    )}
                </div>
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

            <div className="files-controls glass-panel">
                <div className="search-box">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder={viewMode === 'folders' ? "Search collections..." : `Search in ${selectedFolder}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {viewMode === 'files' && (
                    <div className="breadcrumb">
                        <span>All Folders</span>
                        <ChevronRight size={14} />
                        <span className="current">{selectedFolder}</span>
                    </div>
                )}
            </div>

            {viewMode === 'folders' ? (
                <div className="folders-grid">
                    {filteredFolders.map(folder => {
                        const fileCount = files.filter(f => f.category === folder.name).length;
                        return (
                            <div
                                key={folder.name}
                                className="folder-card glass-panel hover-glow"
                                onClick={() => handleFolderClick(folder.name)}
                            >
                                <div className="folder-icon-wrapper" style={{ backgroundColor: `${folder.iconColor}15`, color: folder.iconColor }}>
                                    <Folder size={40} fill={folder.iconColor} fillOpacity={0.2} />
                                </div>
                                <div className="folder-info">
                                    <h3>{folder.name}</h3>
                                    <p>{folder.description}</p>
                                    <div className="folder-meta">
                                        <FileStack size={14} />
                                        <span>{fileCount} Files</span>
                                    </div>
                                </div>
                                <div className="folder-actions-end">
                                    {isAdmin && (
                                        <button
                                            className="folder-delete-btn"
                                            onClick={(e) => handleDeleteFolder(e, folder.name)}
                                            title="Delete Folder"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <ChevronRight className="folder-arrow" size={20} />
                                </div>
                            </div>
                        );
                    })}
                    {filteredFolders.length === 0 && (
                        <div className="empty-state-full">
                            <Folder size={48} opacity={0.3} />
                            <p>No folders found</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="files-grid">
                    {filteredFiles.map(file => (
                        <div key={file.id} className="file-card glass-panel hover-glow">
                            <div className="file-card-header">
                                {getFileIcon(file.type)}
                                <div className="file-badges">
                                    <span className="badge badge-primary">{file.category}</span>
                                    <span className="badge badge-secondary-glass">{file.year}</span>
                                </div>
                            </div>
                            <div className="file-card-body">
                                <h3 title={file.name}>{file.name}</h3>
                                <div className="file-meta">
                                    <span>{file.size}</span>
                                    <span className="dot">•</span>
                                    <span>{file.date}</span>
                                </div>
                                <div className="file-owner">
                                    <div className="owner-avatar">{file.owner.charAt(0)}</div>
                                    <span>{file.owner}</span>
                                </div>
                            </div>
                            <div className="file-card-footer">
                                <button className="btn-icon-text" title="Download" onClick={() => handleDownloadFile(file)}>
                                    <Download size={18} />
                                    <span>Download</span>
                                </button>
                                {canManageFiles && (
                                    <button
                                        className="btn-icon-only text-danger"
                                        onClick={() => handleDeleteFile(file.id)}
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredFiles.length === 0 && (
                        <div className="empty-files-container">
                            <div className="empty-files glass-panel">
                                <Folder size={48} />
                                <p>This folder is empty</p>
                                {canManageFiles && <p className="text-sm">Click "Upload File" to add resources.</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create Folder Modal */}
            {isFolderModalOpen && (
                <div className="modal-overlay" onClick={() => setIsFolderModalOpen(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New Folder</h2>
                            <button className="close-btn" onClick={() => setIsFolderModalOpen(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateFolder} className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Folder Name</label>
                                <input
                                    required
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. Assignments 2026"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <textarea
                                    value={newFolderDesc}
                                    onChange={(e) => setNewFolderDesc(e.target.value)}
                                    className="form-input"
                                    placeholder="Brief summary of contents..."
                                    rows="3"
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsFolderModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Folder</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Upload Details Modal */}
            {isUploadModalOpen && (
                <div className="modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload File Details</h2>
                            <button className="close-btn" onClick={() => setIsUploadModalOpen(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleFinalizeUpload} className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Selected File</label>
                                <div className="form-input disabled-input" style={{ opacity: 0.8 }}>
                                    {uploadMetadata.file?.name}
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Academic Year</label>
                                    <select
                                        required
                                        className="form-input"
                                        value={uploadMetadata.year}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, year: e.target.value })}
                                    >
                                        {years.filter(y => y !== 'All').map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                        <option value="All">All Years</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Target Folder</label>
                                    <select
                                        required
                                        className="form-input"
                                        value={uploadMetadata.folder}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, folder: e.target.value })}
                                    >
                                        {folders.map(f => (
                                            <option key={f.name} value={f.name}>{f.name}</option>
                                        ))}
                                        {folders.every(f => f.name !== 'Unsorted') && <option value="Unsorted">Unsorted</option>}
                                    </select>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    <Upload size={18} />
                                    Confirm Upload
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Download Audit Logs Panel ── */}
            {showAuditPanel && canManageFiles && (
                <div className="audit-panel-overlay" onClick={() => setShowAuditPanel(false)}>
                    <div className="audit-panel glass-panel animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="audit-panel-header">
                            <div>
                                <h2>Download Audit Logs</h2>
                                <p className="text-muted text-sm">Track all file download activity by students</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowAuditPanel(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Stats Cards */}
                        {auditStats && (
                            <div className="audit-stats-grid">
                                <div className="audit-stat-card">
                                    <div className="audit-stat-icon"><Download size={20} /></div>
                                    <div>
                                        <h4>{auditStats.totalDownloads || 0}</h4>
                                        <p>Total Downloads</p>
                                    </div>
                                </div>
                                <div className="audit-stat-card">
                                    <div className="audit-stat-icon top-file"><TrendingUp size={20} /></div>
                                    <div>
                                        <h4>{auditStats.topFiles?.[0]?._id?.substring(0, 20) || 'N/A'}</h4>
                                        <p>Most Downloaded</p>
                                    </div>
                                </div>
                                <div className="audit-stat-card">
                                    <div className="audit-stat-icon students"><Users size={20} /></div>
                                    <div>
                                        <h4>{auditStats.activeStudents?.length || 0}</h4>
                                        <p>Active Students</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Search */}
                        <div className="audit-search-bar">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search by student name or file name..."
                                value={auditSearch}
                                onChange={(e) => setAuditSearch(e.target.value)}
                            />
                        </div>

                        {/* Log Table */}
                        <div className="audit-table-wrapper">
                            {auditLoading ? (
                                <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>Loading audit logs...</p>
                            ) : auditLogs.length > 0 ? (
                                <table className="audit-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Role</th>
                                            <th>File</th>
                                            <th>Category</th>
                                            <th>Year</th>
                                            <th>Downloaded At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogs.map((log, idx) => (
                                            <tr key={log._id || idx}>
                                                <td>
                                                    <div className="audit-user-cell">
                                                        <div className="audit-avatar">{(log.userName?.charAt(0) || '?').toUpperCase()}</div>
                                                        <div>
                                                            <span className="audit-name">{log.userName}</span>
                                                            <span className="audit-email">{log.userEmail}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className={`audit-role-badge role-${log.userRole?.toLowerCase()}`}>{log.userRole}</span></td>
                                                <td className="audit-filename">{log.fileName}</td>
                                                <td>{log.fileCategory}</td>
                                                <td>{log.year}</td>
                                                <td className="audit-timestamp">{new Date(log.downloadedAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>No download records found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Files;
