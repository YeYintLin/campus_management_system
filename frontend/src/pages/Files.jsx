import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
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

const normalizeYear = (yr) => {
    if (!yr) return 'All';
    const str = String(yr).trim().toLowerCase();
    if (str === 'all') return 'All';
    if (str.includes('1') || str.includes('first')) return '1st Year';
    if (str.includes('2') || str.includes('second')) return '2nd Year';
    if (str.includes('3') || str.includes('third')) return '3rd Year';
    if (str.includes('4') || str.includes('fourth')) return '4th Year';
    if (str.includes('5') || str.includes('fifth')) return '5th Year';
    if (str.includes('6') || str.includes('sixth') || str.includes('final')) return '6th Year';
    return yr;
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
    const [selectedFolder, setSelectedFolder] = useState(null);
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

                // Build subject folders from /courses (scoped for Teachers)
                const subjectFolders = (coursesRes.data || [])
                    .filter(c => c.code && !isNonAcademic(c.code, c.name))
                    .filter(c => !isTeacher || isCourseTaughtByTeacher(c, user))
                    .map(c => ({
                        name: `${c.code} - ${c.name}`,
                        code: c.code,
                        year: deriveYearTag(c.code),
                        description: `Syllabus, reference materials & study files for ${c.code}`,
                        iconColor: '#6366f1'
                    }));

                // Build subject folders from /timetable slots (scoped for Teachers)
                const timetableFolders = [];
                if (Array.isArray(timetableRes.data)) {
                    timetableRes.data.forEach(slot => {
                        const code = slot.courseCode || slot.subjectCode || slot.code || '';
                        const name = slot.courseName || slot.subjectName || slot.subject || slot.name || '';
                        if (code && !isNonAcademic(code, name)) {
                            const isTaught = !isTeacher || isCourseTaughtByTeacher({ code, name, teacher: slot.teacher }, user);
                            if (isTaught) {
                                timetableFolders.push({
                                    name: name ? `${code} - ${name}` : code,
                                    code: code,
                                    year: slot.year ? `${slot.year}${String(slot.year).endsWith('Year') ? '' : ' Year'}` : deriveYearTag(code),
                                    description: `Timetable course files for ${code}`,
                                    iconColor: '#10b981'
                                });
                            }
                        }
                    });
                }

                setFolders(prev => {
                    const combined = [...initialFolders, ...dbFolders];
                    const existingIdentifiers = new Set(
                        combined.flatMap(f => [
                            f.name.toUpperCase().trim(),
                            (f.code || '').toUpperCase().trim(),
                            f.name.split(' - ')[0].toUpperCase().trim()
                        ]).filter(Boolean)
                    );

                    const allNewSubjects = [...subjectFolders, ...timetableFolders];
                    const uniqueNew = allNewSubjects.filter(sf => {
                        const sfCode = (sf.code || '').toUpperCase().trim();
                        const sfName = sf.name.toUpperCase().trim();
                        return sfCode && !existingIdentifiers.has(sfCode) && !existingIdentifiers.has(sfName);
                    });

                    return [...combined, ...uniqueNew];
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

        // Trigger real file download in browser
        if (file.fileUrl) {
            window.open(file.fileUrl, '_blank');
        } else {
            // Generate resource file text download
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
For questions regarding this resource, please contact your course instructor or department head.

================================================================================
Downloaded by: ${user?.name || 'Student'} (${user?.email || 'N/A'})
TU Hmawbi Smart Campus Management System
================================================================================
`;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const getFileIcon = (type) => {
        const t = type?.toUpperCase();
        if (t === 'PDF') return <FileText className="file-icon pdf" />;
        if (['PNG', 'JPG', 'JPEG', 'GIF'].includes(t)) return <FileImage className="file-icon image" />;
        if (['SQL', 'JS', 'JSX', 'HTML', 'CSS', 'PY'].includes(t)) return <FileCode className="file-icon code" />;
        return <FileStack className="file-icon generic" />;
    };

    const handleDeleteFile = async (id) => {
        if (window.confirm('Delete this file permanently?')) {
            try {
                await apiClient.delete(`/files/resources/${id}`);
            } catch (err) {
                console.warn('Backend delete error (removing from state anyway):', err.message);
            }
            setFiles(files.filter(f => f.id !== id && f._id !== id));
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const folderData = {
            name: newFolderName.trim(),
            description: newFolderDesc || 'Custom collection',
            iconColor: randomColor,
            year: selectedYear !== 'All' ? selectedYear : 'All',
            parentFolder: selectedFolder || null,
        };

        try {
            const { data } = await apiClient.post('/files/folders', folderData);
            setFolders(prev => [data, ...prev]);
        } catch (err) {
            console.error('Failed to save folder to DB:', err);
            setFolders(prev => [{ ...folderData, _id: Date.now().toString() }, ...prev]);
        }

        setIsFolderModalOpen(false);
        setNewFolderName('');
        setNewFolderDesc('');
    };

    const handleDeleteFolder = async (e, folderName) => {
        e.stopPropagation();
        if (window.confirm(`Delete the folder "${folderName}" and all its contents?`)) {
            const targetFolder = folders.find(f => f.name === folderName);
            if (targetFolder && targetFolder._id) {
                try {
                    await apiClient.delete(`/files/folders/${targetFolder._id}`);
                } catch (err) {
                    console.warn('Folder DB delete warning:', err.message);
                }
            }
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

    const handleFinalizeUpload = async (e) => {
        e.preventDefault();
        const { file, year, folder } = uploadMetadata;
        if (!file) return;

        const extension = file.name.split('.').pop().toUpperCase();
        const fileData = {
            name: file.name,
            type: extension,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            category: folder,
            year: year,
            owner: user?.name || 'CurrentUser',
            date: new Date().toISOString().split('T')[0]
        };

        try {
            const { data } = await apiClient.post('/files/resources', fileData);
            setFiles(prev => [data, ...prev]);
        } catch (err) {
            console.error('Failed to save file to DB:', err);
            setFiles(prev => [{ ...fileData, id: Date.now() }, ...prev]);
        }

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
        // Parent folder filter: inside a folder -> show subfolders; top level -> show top folders
        const matchesParent = selectedFolder ? f.parentFolder === selectedFolder : !f.parentFolder;
        if (!matchesParent) return false;

        const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
        const folderFiles = files.filter(file => file.category === f.name);

        const targetYear = selectedYear;
        const normTarget = normalizeYear(targetYear);
        const normFolderYear = normalizeYear(f.year);

        const hasYearMatch = normTarget === 'All' ||
            normFolderYear === 'All' ||
            normFolderYear === normTarget ||
            !f.year ||
            folderFiles.some(file => normalizeYear(file.year) === normTarget || normalizeYear(file.year) === 'All');

        return matchesSearch && hasYearMatch;
    });

    const filteredFiles = files.filter(f => {
        const normTarget = normalizeYear(selectedYear);
        const normFileYear = normalizeYear(f.year);

        return (!selectedFolder || f.category === selectedFolder) &&
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (normTarget === 'All' || normFileYear === 'All' || normFileYear === normTarget || !f.year);
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
                    {canManageFiles && (
                        <button className="btn btn-secondary" onClick={() => setIsFolderModalOpen(true)}>
                            <FolderPlus size={18} />
                            {selectedFolder ? 'New Subfolder' : 'New Folder'}
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
