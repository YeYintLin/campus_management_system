import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { X, Shield, UserCircle, Settings } from 'lucide-react';
import './Students.css';

const yearLookup = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

const semesterToYearLabel = (semester) => {
    if (!semester) return '1st Year';
    const bucket = Math.min(6, Math.max(1, Math.ceil(semester / 2)));
    return yearLookup[bucket - 1] || `${bucket}th Year`;
};

const getAvatarUrl = (name, id) => {
    const initials = name ? encodeURIComponent(name) : encodeURIComponent(id || 'Student');
    return `https://ui-avatars.com/api/?name=${initials}&background=374151&color=ffffff`;
};

const Students = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';
    const isStudent = user?.role === 'Student';

    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState('All');
    const [manageStudent, setManageStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRole, setSelectedRole] = useState('Student');
    const [selectedStatus, setSelectedStatus] = useState('Active');
    const [modalSaving, setModalSaving] = useState(false);
    const [modalError, setModalError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', email: '', password: '', enrollmentNumber: '', department: '', semester: 1, contactNumber: '' });
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
    const navigate = useNavigate();

    const years = ['All', ...yearLookup];

    useEffect(() => {
        const fetchStudents = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await apiClient.get('/students');
                setStudents(data);
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Failed to load students');
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    const enhancedStudents = students.map(student => ({
        ...student,
        yearLabel: semesterToYearLabel(student.semester),
        displayName: student.user?.name || student.enrollmentNumber || 'Student',
    }));

    const filteredStudents = enhancedStudents.filter(student => {
        const fullText = `${student.displayName} ${student.user?.email || ''} ${student.enrollmentNumber || ''}`.toLowerCase();
        const matchesSearch = fullText.includes(searchTerm.toLowerCase());
        const matchesYear = selectedYear === 'All' || student.yearLabel === selectedYear;
        return matchesSearch && matchesYear;
    });

    const handleViewGrades = (student) => {
        const studentId = student.user?._id || student._id;
        navigate('/grades', { state: { studentId, studentName: student.displayName } });
    };

    useEffect(() => {
        if (!manageStudent) return;
        setSelectedRole(manageStudent.user?.role || 'Student');
        setSelectedStatus(manageStudent.status || 'Active');
        setModalError('');
    }, [manageStudent]);

    const handleSavePermissions = async () => {
        if (!manageStudent) return;
        setModalSaving(true);
        setModalError('');

        try {
            const updates = [];
            if (manageStudent.user && manageStudent.user.role !== selectedRole) {
                updates.push(apiClient.put(`/users/${manageStudent.user._id}/role`, { role: selectedRole }));
            }

            updates.push(apiClient.put(`/students/${manageStudent._id}`, { status: selectedStatus }));

            await Promise.all(updates);

            setStudents(prev => prev.map(s => {
                if (s._id !== manageStudent._id) return s;
                return {
                    ...s,
                    status: selectedStatus || s.status,
                    user: {
                        ...s.user,
                        role: selectedRole || s.user?.role,
                    },
                };
            }));

            setManageStudent(prev => prev ? {
                ...prev,
                status: selectedStatus,
                user: {
                    ...prev.user,
                    role: selectedRole,
                },
            } : prev);
            setManageStudent(null);

        } catch (err) {
            setModalError(err.response?.data?.message || err.message || 'Unable to save changes');
        } finally {
            setModalSaving(false);
        }
    };

    const openAddModal = () => {
        setAddForm({ name: '', email: '', password: '', enrollmentNumber: '', department: '', semester: 1, contactNumber: '' });
        setAddError('');
        setShowAddModal(true);
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError('');
        try {
            const { data: userData } = await apiClient.post('/auth/admin-register', {
                name: addForm.name,
                email: addForm.email,
                password: addForm.password,
                role: 'Student',
            });
            const { data: studentData } = await apiClient.post('/students', {
                user: userData._id,
                enrollmentNumber: addForm.enrollmentNumber,
                department: addForm.department,
                semester: parseInt(addForm.semester),
                contactNumber: addForm.contactNumber,
            });
            setStudents(prev => [{ ...studentData, user: { _id: userData._id, name: userData.name, email: userData.email, role: userData.role } }, ...prev]);
            setShowAddModal(false);
        } catch (err) {
            setAddError(err.response?.data?.message || 'Failed to add student. Please try again.');
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="students-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Students Directory</h1>
                    <p className="subtitle">Manage and view student profiles</p>
                </div>
                <div className="header-actions">
                    <input
                        type="text"
                        placeholder="Search students..."
                        className="form-input search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {isAdmin && <button className="btn btn-primary" onClick={openAddModal}>+ Add Student</button>}
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

            {error && (
                <div className="glass-panel empty-state">
                    <p>{error}</p>
                </div>
            )}

            <div className="students-grid">
                {loading ? (
                    <div className="glass-panel empty-state">
                        <p>Loading students...</p>
                    </div>
                ) : filteredStudents.length > 0 ? (
                    filteredStudents.map(student => {
                        const status = student.status || 'Active';
                        return (
                            <div key={student._id} className="glass-card student-card">
                                <div className="student-card-header">
                                    <img src={getAvatarUrl(student.displayName, student._id)} alt={student.displayName} className="student-avatar" />
                                    <div className="student-status">
                                        <span className={`badge ${status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                                            {status}
                                        </span>
                                    </div>
                                </div>
                                <div className="student-card-body">
                                    <h3>{student.displayName}</h3>
                                    <p className="student-id">{student.enrollmentNumber || student._id}</p>
                                    <div className="student-details">
                                        <div className="detail-item">
                                            <span className="detail-label">Program</span>
                                            <span className="detail-value">{student.department || '?'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Academic Year</span>
                                            <span className="detail-value">{student.yearLabel}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Contact</span>
                                            <span className="detail-value">{student.contactNumber || 'Not added'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="student-card-footer">
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleViewGrades(student)}>
                                        View Grades
                                    </button>
                                    {isAdmin && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setManageStudent(student)}>
                                            <Settings size={14} />
                                            Manage
                                        </button>
                                    )}
                                    {!isStudent && !isAdmin && <button className="btn btn-secondary btn-sm">View Profile</button>}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="glass-panel empty-state">
                        <p>No students found matching your search.</p>
                    </div>
                )}
            </div>

            {manageStudent && (
                <div className="modal-overlay" onClick={() => setManageStudent(null)}>
                    <div className="modal-content glass-panel account-mgmt-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Manage Account</h2>
                                <p className="modal-subtitle">Update permissions for {manageStudent.displayName}</p>
                            </div>
                            <button className="close-btn" onClick={() => setManageStudent(null)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="user-preview-card glass-panel">
                                <img src={getAvatarUrl(manageStudent.displayName, manageStudent._id)} alt="" />
                                <div className="user-preview-summary">
                                    <span className="user-preview-name">{manageStudent.displayName}</span>
                                    <span className="user-preview-role">
                                        <span className="role-arrow">-&gt;</span>
                                        <span>{manageStudent.user?.role || 'Role not assigned'}</span>
                                    </span>
                                </div>
                            </div>

                            <div className="form-group mt-6">
                                <label className="form-label">System Role</label>
                                <div className="role-selector-grid">
                                    <button
                                        className={`role-option ${selectedRole === 'Student' ? 'active' : ''}`}
                                        onClick={() => setSelectedRole('Student')}
                                        type="button"
                                    >
                                        <UserCircle size={18} />
                                        <span>Student</span>
                                    </button>
                                    <button
                                        className={`role-option ${selectedRole === 'Teacher' ? 'active' : ''}`}
                                        onClick={() => setSelectedRole('Teacher')}
                                        type="button"
                                    >
                                        <Shield size={18} />
                                        <span>Teacher</span>
                                    </button>
                                    <button
                                        className={`role-option ${selectedRole === 'Admin' ? 'active' : ''}`}
                                        onClick={() => setSelectedRole('Admin')}
                                        type="button"
                                    >
                                        <Shield size={18} className="text-primary" />
                                        <span>Admin</span>
                                    </button>
                                </div>
                            </div>

                            <div className="form-group mt-4">
                                <label className="form-label">Account Status</label>
                                <select
                                    className="form-input"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Probation">Probation</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>
                            {modalError && (
                                <div className="alert alert-warning mt-4">
                                    {modalError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setManageStudent(null)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSavePermissions}
                                disabled={modalSaving}
                            >
                                {modalSaving ? 'Saving…' : 'Save Permissions'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content glass-panel account-mgmt-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Add New Student</h2>
                                <p className="modal-subtitle">Create a student account and profile</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddStudent}>
                            <div className="modal-body">
                                {addError && (
                                    <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{addError}</div>
                                )}
                                <div className="role-selector-grid" style={{ marginBottom: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input type="text" className="form-input" placeholder="Alice Johnson" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-input" placeholder="alice@altair.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password</label>
                                        <input type="password" className="form-input" placeholder="Min. 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required minLength={6} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Enrollment No.</label>
                                        <input type="text" className="form-input" placeholder="e.g. STU-2024-001" value={addForm.enrollmentNumber} onChange={e => setAddForm({ ...addForm, enrollmentNumber: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Department</label>
                                        <input type="text" className="form-input" placeholder="e.g. Computer Science" value={addForm.department} onChange={e => setAddForm({ ...addForm, department: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Semester</label>
                                        <input type="number" className="form-input" min="1" max="12" value={addForm.semester} onChange={e => setAddForm({ ...addForm, semester: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Number</label>
                                        <input type="text" className="form-input" placeholder="Optional" value={addForm.contactNumber} onChange={e => setAddForm({ ...addForm, contactNumber: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={addLoading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                                    {addLoading ? 'Adding...' : '+ Add Student'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Students;
