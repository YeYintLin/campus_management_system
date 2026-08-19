import React, { useState, useEffect, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import {
    BookOpen,
    Search,
    Download,
    Eye,
    Plus,
    Trash2,
    Pencil,
    Filter,
    FileText,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    X,
    Upload,
    Clock,
    Tag,
    Lock,
    FolderGit2,
    BookMarked,
    GraduationCap,
    SlidersHorizontal,
    Layers,
    FileCode,
    FileType
} from 'lucide-react';
import './ELibrary.css';

const CATEGORIES = [
    'All',
    'Textbook',
    'Lecture Notes',
    'Thesis / Project',
    'Lab Manual',
    'Past Question Papers',
    'Research Paper',
    'Tutorial Sheet'
];

const YEAR_LEVELS = [
    'All Years',
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
    '5th Year',
    '6th Year',
    'ME Program'
];

const ELibrary = () => {
    const { user } = useContext(AuthContext);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedYear, setSelectedYear] = useState('All Years');
    const [sortBy, setSortBy] = useState('latest');

    // Upload Modal State (Teachers & Admins)
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const [newDoc, setNewDoc] = useState({
        title: '',
        author: '',
        category: 'Textbook',
        yearLevel: 'All Years',
        courseCode: '',
        courseName: '',
        description: '',
        tags: '',
        coverImage: '',
        file: null
    });

    // Edit Modal State (Technical Admin Only)
    const [editingItem, setEditingItem] = useState(null);
    const [editForm, setEditForm] = useState({
        title: '',
        author: '',
        category: 'Textbook',
        yearLevel: 'All Years',
        courseCode: '',
        courseName: '',
        description: '',
        tags: ''
    });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');

    // Preview / View Modal
    const [activePreviewItem, setActivePreviewItem] = useState(null);

    const userRole = (user?.role || '').toLowerCase().trim();
    const isTeacher = userRole === 'teacher';

    const isTechnicalAdmin = useMemo(() => {
        if (!user) return false;
        const role = (user.role || '').toLowerCase().trim();
        const adminType = (user.adminType || '').toLowerCase().trim();
        if (role === 'academicadmin' || adminType === 'user_management') return false;
        return ['admin', 'superadmin'].includes(role) || adminType === 'system_technical';
    }, [user]);

    const canUpload = isTeacher || isTechnicalAdmin;
    const canEditOrDelete = isTechnicalAdmin; // Only Technical Admin can fully edit and delete!

    const isMechatronicsMember = useMemo(() => {
        if (!user) return false;
        if (isTechnicalAdmin) return true;
        const dept = (user.department || '').toLowerCase().trim();
        if (dept.includes('mechatronic') || dept === 'mc' || dept === 'mce') return true;
        const email = (user.email || '').toLowerCase().trim();
        if (email.includes('.mc.') || email.includes('.mce.') || email.startsWith('vimc') || email.startsWith('vmc') || email.startsWith('mc')) {
            return true;
        }
        if (isTeacher) {
            const isOtherDept = dept.includes('civil') || dept.includes('arch') || dept.includes('ep') || dept.includes('ec') || dept.includes('it') || (dept.includes('mechanical') && !dept.includes('mechatronic'));
            if (!isOtherDept) return true;
        }
        return false;
    }, [user, isTechnicalAdmin, isTeacher]);

    useEffect(() => {
        if (isMechatronicsMember) {
            fetchLibraryItems();
        }
    }, [selectedCategory, selectedYear, sortBy, isMechatronicsMember]);

    const fetchLibraryItems = async () => {
        try {
            setLoading(true);
            setError('');
            const params = {
                category: selectedCategory !== 'All' ? selectedCategory : undefined,
                yearLevel: selectedYear !== 'All Years' ? selectedYear : undefined,
                search: searchQuery.trim() || undefined,
                sort: sortBy
            };
            const { data } = await apiClient.get('/elibrary', { params });
            setItems(Array.isArray(data.items) ? data.items : []);
        } catch (err) {
            console.error('Failed to fetch library items:', err);
            setError(err.response?.data?.message || 'Failed to load E-Library materials.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchLibraryItems();
    };

    const handleDownload = async (item) => {
        try {
            const res = await apiClient.get(`/elibrary/${item._id}/download`, {
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', item.originalFileName || `${item.title}.${item.fileType}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            // Increment local download count
            setItems(prev => prev.map(it => it._id === item._id ? { ...it, downloadsCount: (it.downloadsCount || 0) + 1 } : it));
        } catch (err) {
            console.error('Download error:', err);
            alert(err.response?.data?.message || 'Failed to download file.');
        }
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setEditForm({
            title: item.title || '',
            author: item.author || '',
            category: item.category || 'Textbook',
            yearLevel: item.yearLevel || 'All Years',
            courseCode: item.courseCode || '',
            courseName: item.courseName || '',
            description: item.description || '',
            tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '')
        });
        setEditError('');
        setEditSuccess('');
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingItem) return;
        try {
            setEditLoading(true);
            setEditError('');
            const { data } = await apiClient.put(`/elibrary/${editingItem._id}`, editForm);
            setEditSuccess('Resource metadata updated successfully!');
            setItems(prev => prev.map(it => it._id === editingItem._id ? data.item : it));
            if (activePreviewItem?._id === editingItem._id) {
                setActivePreviewItem(data.item);
            }
            setTimeout(() => {
                setEditingItem(null);
                setEditSuccess('');
            }, 1000);
        } catch (err) {
            console.error('Update failed:', err);
            setEditError(err.response?.data?.message || 'Failed to update resource metadata.');
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (itemId, title) => {
        if (!isTechnicalAdmin) {
            alert('Forbidden: Only Technical System Administrators can delete E-Library resources.');
            return;
        }
        if (!window.confirm(`Are you sure you want to remove "${title}" from the E-Library?`)) return;

        try {
            await apiClient.delete(`/elibrary/${itemId}`);
            setItems(prev => prev.filter(it => it._id !== itemId));
            if (activePreviewItem?._id === itemId) {
                setActivePreviewItem(null);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert(err.response?.data?.message || 'Failed to delete library item.');
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!newDoc.file) {
            setUploadError('Please choose a valid document file (.pdf, .epub, .docx, .pptx, .zip).');
            return;
        }

        const formData = new FormData();
        formData.append('title', newDoc.title);
        formData.append('author', newDoc.author || user?.name || 'Department Faculty');
        formData.append('category', newDoc.category);
        formData.append('yearLevel', newDoc.yearLevel);
        formData.append('courseCode', newDoc.courseCode);
        formData.append('courseName', newDoc.courseName);
        formData.append('description', newDoc.description);
        formData.append('tags', newDoc.tags);
        formData.append('coverImage', newDoc.coverImage);
        formData.append('file', newDoc.file);

        try {
            setUploading(true);
            setUploadError('');
            const res = await apiClient.post('/elibrary/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadSuccess('Resource successfully added to Mechatronics E-Library!');
            setTimeout(() => {
                setIsUploadModalOpen(false);
                setUploadSuccess('');
                setNewDoc({
                    title: '',
                    author: '',
                    category: 'Textbook',
                    yearLevel: 'All Years',
                    courseCode: '',
                    courseName: '',
                    description: '',
                    tags: '',
                    coverImage: '',
                    file: null
                });
                fetchLibraryItems();
            }, 1200);
        } catch (err) {
            console.error('Upload failed:', err);
            setUploadError(err.response?.data?.message || 'Failed to upload document.');
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Non-Mechatronics Access Guard
    if (!isMechatronicsMember) {
        return (
            <div className="elibrary-access-denied glass-card animate-fade-in">
                <Lock size={48} className="lock-icon" />
                <h2>Access Restricted</h2>
                <p>
                    The Digital E-Library repository is exclusively accessible to students and faculty of the <strong>Department of Mechatronics Engineering</strong>.
                </p>
                <span className="dept-tag">Department of Mechatronics Engineering • TU Hmawbi</span>
            </div>
        );
    }

    return (
        <div className="elibrary-page animate-fade-in">
            {/* Header Banner */}
            <header className="elibrary-header glass-card">
                <div className="header-left">
                    <div className="elibrary-icon-badge">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <div className="dept-badge-pill">Department of Mechatronics Engineering</div>
                        <h1>Mechatronics E-Library</h1>
                        <p className="subtitle">Official Digital Textbooks, Lecture Notes, Thesis Reports & Lab Manuals</p>
                    </div>
                </div>

                {canUpload && (
                    <div className="header-right">
                        <button
                            className="btn btn-primary upload-trigger-btn"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            <Plus size={18} />
                            Upload New Material
                        </button>
                    </div>
                )}
            </header>

            {/* Search and Sort Toolbar */}
            <div className="elibrary-toolbar glass-panel">
                <form onSubmit={handleSearchSubmit} className="search-box-form">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search textbooks, authors, course codes (e.g. McE-51017, Robotics)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    <button type="submit" className="btn btn-secondary btn-sm search-btn">
                        Search
                    </button>
                </form>

                <div className="sort-controls">
                    <span className="sort-label">Sort by:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                    >
                        <option value="latest">Latest Uploads</option>
                        <option value="popular">Most Downloaded</option>
                        <option value="views">Most Viewed</option>
                        <option value="title">Title (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="category-filter-bar glass-panel">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Year Level Filter Pills */}
            <div className="year-filter-bar glass-panel" style={{ marginBottom: '1.25rem' }}>
                {YEAR_LEVELS.map(yr => (
                    <button
                        key={yr}
                        className={`year-tag ${selectedYear === yr ? 'active' : ''}`}
                        onClick={() => setSelectedYear(yr)}
                    >
                        {yr}
                    </button>
                ))}
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-danger" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Main Library Resource Grid */}
            {loading ? (
                <div className="library-loading glass-panel">
                    <Clock className="spin" size={32} />
                    <p>Loading Mechatronics E-Library repository...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="library-empty glass-panel">
                    <BookMarked size={48} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                    <h3>No Learning Materials Found</h3>
                    <p>No resources match your active search or category filters.</p>
                </div>
            ) : (
                <div className="library-grid">
                    {items.map(item => (
                        <div key={item._id} className="book-card glass-card">
                            {/* Card Top Thumbnail / Icon */}
                            <div className="book-thumbnail-container">
                                {item.coverImage ? (
                                    <img src={item.coverImage} alt={item.title} className="book-cover-img" />
                                ) : (
                                    <div className="book-placeholder-cover">
                                        <BookOpen size={40} className="placeholder-icon" />
                                        <span className="file-type-badge uppercase font-mono">{item.fileType}</span>
                                    </div>
                                )}
                                <span className={`category-tag badge-${item.category.replace(/[^a-zA-Z]/g, '').toLowerCase()}`}>
                                    {item.category}
                                </span>
                            </div>

                            {/* Book Info */}
                            <div className="book-card-body">
                                {item.courseCode && (
                                    <span className="course-code-tag font-mono">
                                        {item.courseCode} {item.courseName ? `• ${item.courseName}` : ''}
                                    </span>
                                )}
                                <h3 className="book-title" title={item.title}>
                                    {item.title}
                                </h3>
                                <p className="book-author">By {item.author || 'Department Faculty'}</p>

                                {item.description && (
                                    <p className="book-description">
                                        {item.description}
                                    </p>
                                )}

                                <div className="book-meta-footer">
                                    <span className="meta-item">
                                        <Download size={13} /> {item.downloadsCount || 0}
                                    </span>
                                    <span className="meta-item">
                                        <Eye size={13} /> {item.viewsCount || 0}
                                    </span>
                                    <span className="meta-item size-tag font-mono">
                                        {formatFileSize(item.fileSize)}
                                    </span>
                                    <span className="year-pill-mini">
                                        {item.yearLevel}
                                    </span>
                                </div>
                            </div>

                            {/* Card Action Buttons */}
                            <div className="book-card-actions">
                                <button
                                    className="btn btn-secondary btn-sm preview-btn"
                                    onClick={() => setActivePreviewItem(item)}
                                >
                                    <Eye size={15} />
                                    Details
                                </button>
                                <button
                                    className="btn btn-primary btn-sm download-btn"
                                    onClick={() => handleDownload(item)}
                                >
                                    <Download size={15} />
                                    Download
                                </button>
                                {isTechnicalAdmin && (
                                    <>
                                        <button
                                            className="btn btn-secondary-icon"
                                            onClick={() => openEditModal(item)}
                                            title="Edit Resource (Technical Admin Only)"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            className="btn btn-danger-icon"
                                            onClick={() => handleDelete(item._id, item.title)}
                                            title="Delete Resource (Technical Admin Only)"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Details Modal */}
            {activePreviewItem && typeof document !== 'undefined' && createPortal(
                <div
                    className="elibrary-modal-overlay animate-fade-in"
                    onClick={() => setActivePreviewItem(null)}
                >
                    <div
                        className="modal-card elibrary-details-modal animate-scale-up glass-panel"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '620px',
                            width: '100%',
                            maxHeight: '88vh',
                            overflowY: 'auto',
                            margin: 'auto',
                            borderRadius: '16px',
                            background: 'var(--surface-color, #0f172a)',
                            border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                        }}
                    >
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <BookOpen size={20} className="text-primary" />
                                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{activePreviewItem.title}</h3>
                            </div>
                            <button className="icon-btn" onClick={() => setActivePreviewItem(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="details-meta-grid">
                                <div><strong>Author:</strong> {activePreviewItem.author}</div>
                                <div><strong>Category:</strong> {activePreviewItem.category}</div>
                                <div><strong>Year Level:</strong> {activePreviewItem.yearLevel}</div>
                                <div><strong>Course:</strong> {activePreviewItem.courseCode || 'General'}</div>
                                <div><strong>File Size:</strong> {formatFileSize(activePreviewItem.fileSize)}</div>
                                <div><strong>Format:</strong> {activePreviewItem.fileType.toUpperCase()}</div>
                                <div><strong>Uploaded By:</strong> {activePreviewItem.uploadedByName}</div>
                                <div><strong>Downloads:</strong> {activePreviewItem.downloadsCount || 0}</div>
                            </div>
                            {activePreviewItem.description && (
                                <div style={{ marginTop: '1rem' }}>
                                    <strong>Description / Overview:</strong>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                                        {activePreviewItem.description}
                                    </p>
                                </div>
                            )}
                            {Array.isArray(activePreviewItem.tags) && activePreviewItem.tags.length > 0 && (
                                <div className="tags-container" style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    {activePreviewItem.tags.map((t, idx) => (
                                        <span key={idx} className="tag-badge">#{t}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div>
                                {isTechnicalAdmin && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => { const it = activePreviewItem; setActivePreviewItem(null); openEditModal(it); }}>
                                            <Pencil size={14} /> Edit
                                        </button>
                                        <button className="btn btn-danger-icon" onClick={() => handleDelete(activePreviewItem._id, activePreviewItem.title)} title="Delete Resource">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn btn-secondary" onClick={() => setActivePreviewItem(null)}>
                                    Close
                                </button>
                                <button className="btn btn-primary" onClick={() => handleDownload(activePreviewItem)}>
                                    <Download size={16} />
                                    Download ({formatFileSize(activePreviewItem.fileSize)})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Modal (Technical Admin Only) */}
            {editingItem && isTechnicalAdmin && typeof document !== 'undefined' && createPortal(
                <div
                    className="elibrary-modal-overlay animate-fade-in"
                    onClick={() => setEditingItem(null)}
                >
                    <div
                        className="modal-card elibrary-upload-modal animate-scale-up glass-panel"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '620px',
                            width: '100%',
                            maxHeight: '88vh',
                            overflowY: 'auto',
                            margin: 'auto',
                            borderRadius: '16px',
                            background: 'var(--surface-color, #0f172a)',
                            border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                        }}
                    >
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Pencil size={20} className="text-primary" />
                                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Learning Material</h3>
                            </div>
                            <button className="icon-btn" onClick={() => setEditingItem(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        {editSuccess && (
                            <div className="alert alert-success" style={{ margin: '1rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={18} />
                                <span>{editSuccess}</span>
                            </div>
                        )}

                        {editError && (
                            <div className="alert alert-danger" style={{ margin: '1rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertCircle size={18} />
                                <span>{editError}</span>
                            </div>
                        )}

                        <form onSubmit={handleEditSubmit} className="modal-form-body">
                            <div className="form-group">
                                <label>Book / Material Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Author / Publisher</label>
                                    <input
                                        type="text"
                                        value={editForm.author}
                                        onChange={e => setEditForm({ ...editForm, author: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category *</label>
                                    <select
                                        value={editForm.category}
                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                        className="form-input"
                                    >
                                        {CATEGORIES.filter(c => c !== 'All').map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Target Year Level *</label>
                                    <select
                                        value={editForm.yearLevel}
                                        onChange={e => setEditForm({ ...editForm, yearLevel: e.target.value })}
                                        className="form-input"
                                    >
                                        {YEAR_LEVELS.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Course Code (Optional)</label>
                                    <input
                                        type="text"
                                        value={editForm.courseCode}
                                        onChange={e => setEditForm({ ...editForm, courseCode: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description / Overview</label>
                                <textarea
                                    rows={3}
                                    value={editForm.description}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Tags (Comma separated)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Robotics, Kinematics, Control"
                                    value={editForm.tags}
                                    onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                                    className="form-input"
                                />
                            </div>

                            <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingItem(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                                    <CheckCircle2 size={16} />
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Upload Modal (Teachers & Admins Only) */}
            {isUploadModalOpen && canUploadOrDelete && typeof document !== 'undefined' && createPortal(
                <div
                    className="elibrary-modal-overlay animate-fade-in"
                    onClick={() => setIsUploadModalOpen(false)}
                >
                    <div
                        className="modal-card elibrary-upload-modal animate-scale-up glass-panel"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '620px',
                            width: '100%',
                            maxHeight: '88vh',
                            overflowY: 'auto',
                            margin: 'auto',
                            borderRadius: '16px',
                            background: 'var(--surface-color, #0f172a)',
                            border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                        }}
                    >
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Upload size={20} className="text-primary" />
                                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Upload Learning Material</h3>
                            </div>
                            <button className="icon-btn" onClick={() => setIsUploadModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {uploadSuccess && (
                            <div className="alert alert-success" style={{ margin: '1rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={18} />
                                <span>{uploadSuccess}</span>
                            </div>
                        )}

                        {uploadError && (
                            <div className="alert alert-danger" style={{ margin: '1rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertCircle size={18} />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        <form onSubmit={handleUploadSubmit} className="modal-form-body">
                            <div className="form-group">
                                <label>Book / Material Title *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Modern Control Systems (13th Edition)"
                                    value={newDoc.title}
                                    onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Author / Publisher</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Richard C. Dorf"
                                        value={newDoc.author}
                                        onChange={e => setNewDoc({ ...newDoc, author: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category *</label>
                                    <select
                                        value={newDoc.category}
                                        onChange={e => setNewDoc({ ...newDoc, category: e.target.value })}
                                        className="form-input"
                                    >
                                        {CATEGORIES.filter(c => c !== 'All').map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Target Year Level *</label>
                                    <select
                                        value={newDoc.yearLevel}
                                        onChange={e => setNewDoc({ ...newDoc, yearLevel: e.target.value })}
                                        className="form-input"
                                    >
                                        {YEAR_LEVELS.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Course Code (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. McE-51017"
                                        value={newDoc.courseCode}
                                        onChange={e => setNewDoc({ ...newDoc, courseCode: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description / Overview</label>
                                <textarea
                                    rows={3}
                                    placeholder="Brief summary of the textbook, lecture modules, or thesis project..."
                                    value={newDoc.description}
                                    onChange={e => setNewDoc({ ...newDoc, description: e.target.value })}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Document File * (.pdf, .epub, .docx, .pptx, .zip — max 100MB)</label>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf, .epub, .docx, .pptx, .zip"
                                    onChange={e => setNewDoc({ ...newDoc, file: e.target.files?.[0] || null })}
                                    className="form-input-file"
                                />
                            </div>

                            <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={uploading}>
                                    <Upload size={16} />
                                    {uploading ? 'Uploading...' : 'Upload Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ELibrary;
