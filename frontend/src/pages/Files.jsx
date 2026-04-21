import React, { useState, useContext, useRef } from 'react';
import { Search, FileText, Download, Trash2, Upload, Folder, Filter, FileCode, FileImage, FileStack, ChevronRight, ArrowLeft, FolderPlus, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import './Files.css';

const initialFiles = [
    { id: 1, name: 'React_Basics_Tutorial.pdf', type: 'PDF', size: '2.4 MB', category: 'Tutorial', owner: 'Dr. Alan Turing', date: '2026-03-01', year: '1st Year' },
    { id: 2, name: 'Final_Exam_2024.pdf', type: 'PDF', size: '1.5 MB', category: 'Old Question', owner: 'Exam Cell', date: '2026-03-05', year: '4th Year' },
    { id: 3, name: 'CS_Algorithms_Textbook.pdf', type: 'PDF', size: '12.2 MB', category: 'Reference Books', owner: 'Library', date: '2026-02-28', year: '3rd Year' },
    { id: 4, name: 'Advanced_JS_Tutorial.mp4', type: 'VIDEO', size: '45 MB', category: 'Tutorial', owner: 'Prof. Grace Hopper', date: '2026-03-07', year: '2nd Year' },
    { id: 5, name: 'Midterm_MTH101_2023.docx', type: 'DOCX', size: '85 KB', category: 'Old Question', owner: 'Prof. Grace Hopper', date: '2026-03-04', year: '1st Year' },
    { id: 6, name: 'Clean_Code_Reference.epub', type: 'BOOK', size: '2.8 MB', category: 'Reference Books', owner: 'Admin', date: '2026-03-02', year: 'All' },
];

const initialFolders = [
    { name: 'Tutorial', description: 'Step-by-step guides and video lessons', iconColor: '#6366f1' },
    { name: 'Old Question', description: 'Past year papers and exam archives', iconColor: '#ec4899' },
    { name: 'Reference Books', description: 'Recommended textbooks and academic journals', iconColor: '#10b981' },
];

const Files = () => {
    const { user } = useContext(AuthContext);
    const fileInputRef = useRef(null);

    const [files, setFiles] = useState(initialFiles);
    const [folders, setFolders] = useState(initialFolders);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState('All');
    const [viewMode, setViewMode] = useState('folders'); // 'folders' or 'files'
    const [selectedFolder, setSelectedFolder] = useState(null);

    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

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

    const isAdmin = user?.role === 'Admin';
    const canManageFiles = user?.role === 'Admin' || user?.role === 'Teacher';

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
        // For folders, we show them if any file inside matches the year, or if it's 'All'
        const folderFiles = files.filter(file => file.category === f.name);
        const hasYearMatch = selectedYear === 'All' || folderFiles.some(file => file.year === selectedYear || file.year === 'All');
        return matchesSearch && hasYearMatch;
    });

    const filteredFiles = files.filter(f =>
        (!selectedFolder || f.category === selectedFolder) &&
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (selectedYear === 'All' || f.year === selectedYear || f.year === 'All')
    );

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
                            {viewMode === 'folders'
                                ? 'Browse through organized academic collections'
                                : `Viewing files in ${selectedFolder}`}
                        </p>
                    </div>
                </div>
                <div className="header-actions">
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
                                <button className="btn-icon-text" title="Download">
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
        </div>
    );
};

export default Files;
