import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, FileText, Download, Trash2, Upload, Folder, Filter, FileCode, FileImage, FileStack, ChevronRight, ArrowLeft, FolderPlus, X, ClipboardList, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { getNormalizedUserYear, normalizeYear, parseYearNumber } from '../utils/userYear';
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

const deriveYearTag = (code = '', defaultYear = null) => {
    const clean = String(code).trim().toUpperCase();
    const match = clean.match(/[-_\s]?(\d{1,5})/);
    if (match) {
        const numStr = match[1];
        const firstDigit = numStr[0];
        if (firstDigit === '6') return '6th Year';
        if (firstDigit === '5') return '5th Year';
        if (firstDigit === '4') return '4th Year';
        if (firstDigit === '3') return '3rd Year';
        if (firstDigit === '2') return '2nd Year';
        if (firstDigit === '1') return '1st Year';
    }
    if (defaultYear) {
        if (typeof defaultYear === 'number') return `${defaultYear}${defaultYear === 1 ? 'st' : defaultYear === 2 ? 'nd' : defaultYear === 3 ? 'rd' : 'th'} Year`;
        if (typeof defaultYear === 'string' && defaultYear.includes('Year')) return defaultYear;
    }
    return '1st Year';
};



const isCourseTaughtByTeacher = (course, user) => {
    if (!user) return false;
    const userTeacherId = user._id ? String(user._id) : '';
    const userTeacherName = (user.name || '').toLowerCase().trim();
    const userTeacherEmail = (user.email || '').toLowerCase().trim();

    const cTeacher = course.teacher;
    if (!cTeacher) return false;

    let cId = '';
    let cName = '';
    let cEmail = '';

    if (typeof cTeacher === 'object') {
        cId = cTeacher._id ? String(cTeacher._id) : '';
        cName = (cTeacher.name || '').toLowerCase().trim();
        cEmail = (cTeacher.email || '').toLowerCase().trim();
    } else if (typeof cTeacher === 'string') {
        cName = cTeacher.toLowerCase().trim();
        if (cTeacher.includes('@')) cEmail = cTeacher.toLowerCase().trim();
        else if (cTeacher.length > 15) cId = cTeacher;
    }

    if (userTeacherId && cId && userTeacherId === cId) return true;
    if (userTeacherEmail && cEmail && userTeacherEmail === cEmail) return true;

    const cleanUser = userTeacherName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();
    const cleanCourse = cName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();

    if (cleanUser.length >= 3 && cleanCourse.length >= 3) {
        if (cleanCourse.includes(cleanUser) || cleanUser.includes(cleanCourse)) return true;
    }

    return false;
};

const Files = () => {
    const { user } = useContext(AuthContext);
    const fileInputRef = useRef(null);

    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isTeacher = roleStr === 'teacher';
    const canManageFiles = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const [files, setFiles] = useState(initialFiles);
    const [folders, setFolders] = useState(initialFolders);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [viewMode, setViewMode] = useState('folders'); // 'folders' or 'files'
    const [folderPath, setFolderPath] = useState([]);
    const selectedFolder = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
    const [allCourses, setAllCourses] = useState([]);

    // Fetch custom folders, resource files, courses, AND timetable slots from backend DB on mount
    useEffect(() => {
        const loadPersistedData = async () => {
            try {
                const [foldersRes, filesRes, coursesRes, timetableRes] = await Promise.all([
                    apiClient.get('/files/folders').catch(() => ({ data: [] })),
                    apiClient.get('/files/resources').catch(() => ({ data: [] })),
                    apiClient.get('/courses').catch(() => ({ data: [] })),
                    apiClient.get('/timetable').catch(() => ({ data: [] })),
                ]);

                if (Array.isArray(coursesRes.data)) {
                    setAllCourses(coursesRes.data);
                }

                const dbFolders = (foldersRes.data || []).map(f => ({
                    _id: f._id,
                    name: f.name,
                    description: f.description,
                    iconColor: f.iconColor || '#6366f1',
                    year: f.year || 'All',
                    parentFolder: f.parentFolder || null,
                }));

                const dbFiles = (filesRes.data || []).map(f => ({
                    id: f._id,
                    _id: f._id,
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    category: f.category,
                    owner: f.owner,
                    date: f.createdAt ? f.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
                    year: f.year,
                }));

                const isNonAcademic = (code = '', name = '') => {
                    const text = (code + ' ' + name).toLowerCase();
                    return (
                        text.includes('private study') ||
                        text.includes('extra') ||
                        text.includes('self-study') ||
                        text.includes('lunch')
                    );
                };

                // Build clean subject folders from /courses (synced from timetable)
                const subjectFolders = (coursesRes.data || [])
                    .filter(c => c.code && !isNonAcademic(c.code, c.name))
                    .filter(c => !isTeacher || isCourseTaughtByTeacher(c, user))
                    .map(c => {
                        const cleanCode = (c.code || '').trim();
                        const cleanName = (c.name || '').trim();
                        const folderName = `${cleanCode} - ${cleanName}`;
                        const yLabel = c.yearLabel ? normalizeYear(c.yearLabel) : deriveYearTag(cleanCode, c.year);
                        return {
                            name: folderName,
                            code: cleanCode,
                            year: yLabel,
                            description: c.description || `Syllabus, reference materials & study files for ${cleanCode}`,
                            iconColor: '#6366f1',
                            isSubjectFolder: true
                        };
                    });

                setFolders(prev => {
                    const combined = [...initialFolders, ...dbFolders];
                    const existingCodes = new Set(combined.map(f => (f.code || f.name.split(' - ')[0] || '').replace(/[\s-]+/g, '').toUpperCase()));

                    const uniqueSubjectFolders = [];
                    subjectFolders.forEach(sf => {
                        const normCode = sf.code.replace(/[\s-]+/g, '').toUpperCase();
                        if (normCode && !existingCodes.has(normCode)) {
                            existingCodes.add(normCode);
                            uniqueSubjectFolders.push(sf);
                        }
                    });

                    return [...combined, ...uniqueSubjectFolders];
                });

                if (dbFiles.length > 0) {
                    setFiles(prev => {
                        const existingIds = new Set(prev.map(f => f.id || f._id));
                        const uniqueDbFiles = dbFiles.filter(df => !existingIds.has(df._id));
                        return [...uniqueDbFiles, ...prev];
                    });
                }
            } catch (err) {
                console.error('Error fetching resource data:', err);
            }
        };

        loadPersistedData();
    }, [isTeacher, user]);

    const teacherYears = useMemo(() => {
        if (!isTeacher) return [];
        const set = new Set();
        allCourses.forEach(c => {
            if (isCourseTaughtByTeacher(c, user)) {
                const yTag = deriveYearTag(c.code);
                if (yTag) set.add(yTag);
            }
        });
        const order = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
        return order.filter(y => set.has(y));
    }, [isTeacher, allCourses, user]);

    const years = isStudent
        ? [studentYear]
        : isTeacher
        ? (teacherYears.length > 0 ? ['All', ...teacherYears] : ['All'])
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
    const [auditSearchTerm, setAuditSearchTerm] = useState('');
    const [auditLoading, setAuditLoading] = useState(false);

    const fetchAuditData = useCallback(async () => {
        if (!canManageFiles) return;
        setAuditLoading(true);
        try {
            const [logsRes, statsRes] = await Promise.all([
                apiClient.get('/files/download-logs', { params: { search: auditSearchTerm, limit: 100 } }),
                apiClient.get('/files/download-stats'),
            ]);
            setAuditLogs(logsRes.data.logs || []);
            setAuditStats(statsRes.data);
        } catch (err) {
            console.error('Failed to fetch audit data:', err);
        } finally {
            setAuditLoading(false);
        }
    }, [canManageFiles, auditSearchTerm]);

    useEffect(() => {
        if (showAuditPanel) fetchAuditData();
    }, [showAuditPanel, fetchAuditData]);

    const handleDownloadFile = async (file) => {
        try {
            await apiClient.post('/files/logs', {
                fileId: file._id || file.id,
                fileName: file.name,
                fileCategory: file.category,
                fileSize: file.size,
                year: file.year,
            });
        } catch (err) {
            console.warn('Audit logging silent fail:', err.message);
        }

        if (file.fileUrl) {
            window.open(file.fileUrl, '_blank');
        } else {
            const content = `================================================================================
                    TECHNOLOGICAL UNIVERSITY (HMAWBI)
                     ACADEMIC RESOURCE FILE DOWNLOAD
================================================================================

RESOURCE NAME: ${file.name}
CATEGORY     : ${file.category}
ACADEMIC YEAR: ${file.year}
UPLOADED BY  : ${file.owner}
FILE SIZE    : ${file.size}
DATE LOGGED  : ${file.date}

--------------------------------------------------------------------------------
DOCUMENT CONTENT & STUDY MATERIAL
--------------------------------------------------------------------------------
This is an official academic resource document provided by Technological University (Hmawbi).
For questions regarding this resource, please contact your course instructor.
`;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const yearNumberToLabel = (num) => {
        const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
        return labels[num] || '1st Year';
    };

    const filteredAuditLogs = useMemo(() => {
        if (!auditSearchTerm.trim()) return auditLogs;
        const term = auditSearchTerm.toLowerCase();
        return auditLogs.filter(log => {
            const uName = (log.userName || '').toLowerCase();
            const uEmail = (log.userEmail || '').toLowerCase();
            const fName = (log.fileName || '').toLowerCase();
            const uRole = (log.userRole || '').toLowerCase();
            return uName.includes(term) || uEmail.includes(term) || fName.includes(term) || uRole.includes(term);
        });
    }, [auditLogs, auditSearchTerm]);
    const getFileIcon = (type) => {
        switch (type.toUpperCase()) {
            case 'PDF': return <FileText className="file-icon pdf" size={24} />;
            case 'VIDEO':
            case 'MP4': return <FileCode className="file-icon image" size={24} />;
            case 'DOCX':
            case 'BOOK': return <FileText className="file-icon code" size={24} />;
            default: return <FileText className="file-icon generic" size={24} />;
        }
    };

    const handleDeleteFile = async (id) => {
        if (window.confirm('Are you sure you want to delete this resource file?')) {
            try {
                await apiClient.delete(`/files/resources/${id}`);
            } catch (err) {
                console.warn('Backend delete error (removing from state anyway):', err.message);
            }
            setFiles(prev => prev.filter(f => f.id !== id && f._id !== id));
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        const trimmedName = newFolderName.trim();
        if (!trimmedName) return;

        if (selectedFolder && trimmedName.toLowerCase() === selectedFolder.toLowerCase()) {
            alert('A subfolder cannot have the same name as its parent folder.');
            return;
        }

        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newFolder = {
            name: trimmedName,
            description: newFolderDesc || 'Custom collection',
            iconColor: randomColor,
            parentFolder: selectedFolder || null,
            year: 'All'
        };
        try {
            const { data } = await apiClient.post('/files/folders', newFolder);
            setFolders(prev => [data, ...prev]);
        } catch (err) {
            setFolders(prev => [{ ...newFolder, _id: Date.now().toString() }, ...prev]);
        }
        setIsFolderModalOpen(false);
        setNewFolderName('');
        setNewFolderDesc('');
    };

    const handleDeleteFolder = async (e, folderItem) => {
        e.stopPropagation();
        const targetName = typeof folderItem === 'object' ? folderItem.name : folderItem;
        const targetId = typeof folderItem === 'object' ? folderItem._id : folders.find(f => f.name === folderItem)?._id;

        if (window.confirm(`Delete folder "${targetName}"?`)) {
            if (targetId) {
                try {
                    await apiClient.delete(`/files/folders/${targetId}`);
                } catch (err) {
                    console.warn('Backend delete folder error:', err.message);
                }
            }
            setFolders(prev => prev.filter(f => f.name !== targetName && (!targetId || f._id !== targetId)));
        }
    };

    const handleUploadClick = () => fileInputRef.current.click();

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadMetadata({
            file: file,
            year: '1st Year',
            folder: selectedFolder || folders[0]?.name || 'Unsorted'
        });
        setIsUploadModalOpen(true);
        e.target.value = '';
    };

    const handleFinalizeUpload = async (e) => {
        e.preventDefault();
        const { file, year, folder } = uploadMetadata;
        const newFile = {
            id: Date.now(),
            name: file.name,
            type: file.name.split('.').pop(),
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            category: folder,
            owner: user?.name || 'User',
            date: new Date().toISOString().split('T')[0],
            year: year
        };
        try {
            await apiClient.post('/files/resources', newFile);
            setFiles(prev => [newFile, ...prev]);
        } catch (err) {
            setFiles(prev => [newFile, ...prev]);
        }
        setIsUploadModalOpen(false);
        setUploadMetadata({ file: null, year: '1st Year', folder: '' });
    };

    const handleFolderClick = (folderName) => {
        if (!folderName) return;
        if (folderPath.includes(folderName)) return; // Prevent recursive loops
        setFolderPath(prev => [...prev, folderName]);
        setSearchTerm('');
    };

    const handleBackClick = () => {
        setFolderPath(prev => prev.slice(0, -1));
        setSearchTerm('');
    };

    const filteredFolders = folders.filter(f => {
        const matchesParent = selectedFolder 
            ? (f.parentFolder === selectedFolder && f.name.toLowerCase() !== selectedFolder.toLowerCase())
            : !f.parentFolder;
        return matchesParent && f.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const filteredFiles = files.filter(f => {
        const matchesCategory = selectedFolder ? f.category === selectedFolder : !folders.some(fold => fold.name === f.category);
        return matchesCategory && f.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedYear === 'All' || f.year === selectedYear);
    });

    return (
        <div className="files-page animate-fade-in">
            <header className="page-header">
                <div className="header-title-area">
                    {selectedFolder && (
                        <button className="back-btn" onClick={handleBackClick} title="Go Back">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1>{selectedFolder || 'Resource Library'}</h1>
                        <p className="subtitle">
                            {isStudent
                                ? `Showing ${studentYear} Academic Resources`
                                : selectedFolder
                                ? `Viewing contents of ${selectedFolder}`
                                : 'Browse through organized academic collections'}
                        </p>
                    </div>
                </div>
                <div className="header-actions">
                    {canManageFiles && (
                        <button className={`btn ${showAuditPanel ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowAuditPanel(!showAuditPanel)}>
                            <ClipboardList size={18} />
                            Logs
                        </button>
                    )}
                    {canManageFiles && (
                        <button className="btn btn-secondary" onClick={() => setIsFolderModalOpen(true)}>
                            <FolderPlus size={18} />
                            {selectedFolder ? 'New Subfolder' : 'New Folder'}
                        </button>
                    )}
                    {canManageFiles && selectedFolder && (
                        <>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                            <button className="btn btn-primary" onClick={handleUploadClick}>
                                <Upload size={18} />
                                Upload
                            </button>
                        </>
                    )}
                </div>
            </header>

            <div className="year-filter-bar glass-panel">
                {years.map(year => (
                    <button key={year} className={`year-tag ${selectedYear === year ? 'active' : ''}`} onClick={() => setSelectedYear(year)}>
                        {year}
                    </button>
                ))}
            </div>

            <div className="files-controls glass-panel">
                <div className="search-box">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder={selectedFolder ? `Search in ${selectedFolder}...` : "Search collections..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span 
                        style={{ cursor: 'pointer', color: selectedFolder ? 'var(--primary-color)' : 'var(--text-main)', fontWeight: selectedFolder ? 500 : 700 }}
                        onClick={() => setFolderPath([])}
                    >
                        All Folders
                    </span>
                    {folderPath.map((folderName, index) => (
                        <React.Fragment key={index}>
                            <ChevronRight size={14} style={{ opacity: 0.5 }} />
                            <span
                                style={{
                                    cursor: index < folderPath.length - 1 ? 'pointer' : 'default',
                                    color: index === folderPath.length - 1 ? 'var(--primary-color)' : 'var(--text-muted)',
                                    fontWeight: index === folderPath.length - 1 ? 700 : 500
                                }}
                                onClick={() => index < folderPath.length - 1 && setFolderPath(folderPath.slice(0, index + 1))}
                            >
                                {folderName}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {filteredFolders.length > 0 && (
                <div style={{ marginBottom: (selectedFolder && filteredFiles.length > 0) ? '2.5rem' : 0 }}>
                    {selectedFolder && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Folder size={18} className="text-primary" />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                                Subfolders ({filteredFolders.length})
                            </h3>
                        </div>
                    )}
                    <div className="folders-grid">
                        {filteredFolders.map(folder => {
                            const fileCount = files.filter(f => f.category === folder.name).length;
                            return (
                                <div key={folder.name} className="folder-card glass-panel hover-glow" onClick={() => handleFolderClick(folder.name)}>
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
                                        {canManageFiles && !folder.isSubjectFolder && (
                                            <button className="folder-delete-btn" onClick={(e) => handleDeleteFolder(e, folder)} title="Delete Folder">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <ChevronRight className="folder-arrow" size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {selectedFolder && (
                <div>
                    {filteredFolders.length > 0 && filteredFiles.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <FileText size={18} className="text-primary" />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                                Files ({filteredFiles.length})
                            </h3>
                        </div>
                    )}
                    {filteredFiles.length > 0 ? (
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
                                            <button className="btn-icon-only text-danger" onClick={() => handleDeleteFile(file.id)} title="Delete">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}

            {filteredFolders.length === 0 && (!selectedFolder || filteredFiles.length === 0) && (
                <div className="empty-files-container">
                    <div className="empty-files glass-panel">
                        <Folder size={48} opacity={0.3} />
                        <p>{selectedFolder ? `This folder "${selectedFolder}" is empty` : 'No folders found'}</p>
                        {canManageFiles && <p className="text-sm">Click "Upload File" or "New Subfolder" to add resources.</p>}
                    </div>
                </div>
            )}

            {isFolderModalOpen && createPortal(
                <div className="modal-overlay" onClick={() => setIsFolderModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1rem' }}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedFolder ? `Create Subfolder in "${selectedFolder}"` : 'Create New Folder'}</h2>
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
                                    placeholder={selectedFolder ? "e.g. Chapter 1 Notes" : "e.g. Assignments 2026"}
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
                                <button type="submit" className="btn btn-primary">{selectedFolder ? 'Create Subfolder' : 'Create Folder'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Upload Details Modal */}
            {isUploadModalOpen && createPortal(
                <div className="modal-overlay" onClick={() => setIsUploadModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1rem' }}>
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
                                        onChange={(e) => {
                                            const targetFolderName = e.target.value;
                                            const matchedFolder = folders.find(f => f.name === targetFolderName);
                                            setUploadMetadata({
                                                ...uploadMetadata,
                                                folder: targetFolderName,
                                                year: matchedFolder?.year && matchedFolder.year !== 'All' ? matchedFolder.year : uploadMetadata.year
                                            });
                                        }}
                                    >
                                        {folders.map(f => (
                                            <option key={f.name} value={f.name}>{f.name}</option>
                                        ))}
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
                </div>,
                document.body
            )}

            {/* ── Download Audit Logs Panel ── */}
            {showAuditPanel && canManageFiles && createPortal(
                <div className="audit-panel-overlay" onClick={() => setShowAuditPanel(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, padding: '1rem' }}>
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
                                        <h4>{auditStats.topFile || 'None Yet'}</h4>
                                        <p>Most Downloaded</p>
                                    </div>
                                </div>
                                <div className="audit-stat-card">
                                    <div className="audit-stat-icon students"><Users size={20} /></div>
                                    <div>
                                        <h4>{auditStats.studentDownloads || 0}</h4>
                                        <p>Student Downloads</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Search */}
                        <div className="audit-search-bar">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search by student name, file name, or email..."
                                value={auditSearchTerm}
                                onChange={(e) => setAuditSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Log Table */}
                        <div className="audit-table-wrapper">
                            {auditLoading ? (
                                <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>Loading audit logs...</p>
                            ) : filteredAuditLogs.length > 0 ? (
                                <table className="audit-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Role</th>
                                            <th>File</th>
                                            <th>Downloaded At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAuditLogs.map((log, idx) => (
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
                                                <td className="audit-timestamp">{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>No download records found.</p>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Files;
