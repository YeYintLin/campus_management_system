import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import {
    Search, UserPlus, Shield, UserCircle,
    UserCheck, UserX, AlertTriangle,
    Mail, Calendar, Filter, Download, X, Settings, Lock, User, Check, RefreshCw
} from 'lucide-react';
import './AccountManagement.css';

const getInitials = (name) => {
    if (!name) return 'U';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return words.map(w => w[0]).join('').toUpperCase();
};

const getAvatarColor = (role) => {
    if (role === 'Admin') return 'linear-gradient(135deg, #6366f1, #4f46e5)';
    if (role === 'Teacher') return 'linear-gradient(135deg, #10b981, #059669)';
    return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
};

const AccountManagement = () => {
    const { user: currentUser } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedUser, setSelectedUser] = useState(null);
    const [resetPasswordUser, setResetPasswordUser] = useState(null);
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMsg, setResetMsg] = useState('');
    const [resetError, setResetError] = useState('');
    
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'Student', department: 'Mechatronics Engineering', year: 'Final Year (VI)' });
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState('');
    const [registerSuccess, setRegisterSuccess] = useState('');
    const [savingUser, setSavingUser] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const [approvalLoadingId, setApprovalLoadingId] = useState(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await apiClient.get('/users');
            const normalized = data.map(u => ({
                ...u,
                id: u._id,
                status: u.status || 'Active',
                lastLogin: u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : 'N/A',
            }));
            setUsers(normalized);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load user accounts');
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!users.length) return;
        const headers = ['Name,Email,Role,Status,Verified,Approved,LastActivity'];
        const rows = filteredUsers.map(u => 
            `"${u.name || ''}","${u.email || ''}","${u.role || ''}","${u.status || 'Active'}","${u.isEmailVerified ? 'Yes' : 'No'}","${u.isApproved ? 'Yes' : 'No'}","${u.lastLogin || ''}"`
        );
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `system_users_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        if (currentUser?.role === 'Admin') {
            fetchUsers();
        }
    }, [currentUser]);

    if (currentUser?.role !== 'Admin') {
        return <div className="p-8 text-center glass-panel">Unauthorized. Administrative access required.</div>;
    }

    const pendingUsers = users.filter(u => u.status === 'Pending' || u.isApproved === false);

    const filteredUsers = users.filter(u => {
        const nameText = u.name || '';
        const emailText = u.email || '';
        const matchesSearch = nameText.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emailText.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'All' || u.role === roleFilter;
        const uStatus = u.status || 'Active';
        const matchesStatus = statusFilter === 'All' || uStatus === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        setSavingUser(true);
        setUpdateError('');
        try {
            await apiClient.put(`/users/${selectedUser._id}/role`, { role: selectedUser.role });
            const { data } = await apiClient.put(`/users/${selectedUser._id}`, {
                name: selectedUser.name,
                email: selectedUser.email,
                status: selectedUser.status,
                department: selectedUser.department,
            });
            
            setUsers(prev => prev.map(u => u._id === selectedUser._id ? { ...u, ...data } : u));
            setSelectedUser(null);
        } catch (err) {
            setUpdateError(err.response?.data?.message || 'Failed to update user profile');
        } finally {
            setSavingUser(false);
        }
    };

    const handleApproveUser = async (userToApprove) => {
        try {
            setApprovalLoadingId(userToApprove._id);
            await apiClient.put(`/users/${userToApprove._id}/approve`);
            setUsers(prev => prev.map(u => u._id === userToApprove._id ? { ...u, isApproved: true, status: 'Active' } : u));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve user account');
        } finally {
            setApprovalLoadingId(null);
        }
    };

    const handleRejectUser = async (userToReject) => {
        if (!window.confirm(`Are you sure you want to reject/deactivate ${userToReject.name}?`)) return;
        try {
            setApprovalLoadingId(userToReject._id);
            await apiClient.put(`/users/${userToReject._id}/reject`);
            setUsers(prev => prev.map(u => u._id === userToReject._id ? { ...u, isApproved: false, status: 'Deactivated' } : u));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reject user account');
        } finally {
            setApprovalLoadingId(null);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!newPasswordInput || newPasswordInput.length < 6) {
            setResetError('Password must be at least 6 characters');
            return;
        }
        try {
            setResetLoading(true);
            setResetError('');
            setResetMsg('');
            const { data } = await apiClient.put(`/users/${resetPasswordUser._id}/reset-password`, { newPassword: newPasswordInput });
            setResetMsg(data.message || 'Password reset successfully');
            setTimeout(() => {
                setResetPasswordUser(null);
                setNewPasswordInput('');
                setResetMsg('');
            }, 1800);
        } catch (err) {
            setResetError(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setResetLoading(false);
        }
    };

    const openRegisterModal = () => {
        setRegisterForm({ name: '', email: '', password: '', role: 'Student', department: 'Mechatronics Engineering', year: 'Final Year (VI)' });
        setRegisterError('');
        setRegisterSuccess('');
        setShowRegisterModal(true);
    };

    const handleRegisterUser = async (e) => {
        e.preventDefault();
        setRegisterLoading(true);
        setRegisterError('');
        setRegisterSuccess('');
        try {
            const { data } = await apiClient.post('/auth/admin-register', registerForm);
            const newUser = {
                ...data,
                id: data._id,
                status: 'Active',
                isEmailVerified: true,
                isApproved: true,
                lastLogin: 'Just now',
            };
            setUsers(prev => [newUser, ...prev]);
            setRegisterSuccess(`User "${data.name}" registered successfully!`);
            setTimeout(() => setShowRegisterModal(false), 1500);
        } catch (err) {
            setRegisterError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setRegisterLoading(false);
        }
    };

    return (
        <div className="account-mgmt-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Unified Account Management</h1>
                    <p className="subtitle">Centralized control for all system users</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary-glass" onClick={handleExportCSV}>
                        <Download size={18} />
                        Export Data
                    </button>
                    <button className="btn btn-primary" onClick={openRegisterModal}>
                        <UserPlus size={18} />
                        Register New User
                    </button>
                </div>
            </header>

            <div className="mgmt-filters-bar glass-panel">
                <div className="search-box">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filters-group">
                    <div className="filter-item">
                        <Filter size={16} />
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="All">All Roles</option>
                            <option value="Admin">Administrators</option>
                            <option value="Teacher">Faculty</option>
                            <option value="Student">Students</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending Approval ({pendingUsers.length})</option>
                            <option value="Active">Active</option>
                            <option value="Deactivated">Deactivated</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="users-table-container glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Loading accounts...</p>
                </div>
            )}

            {error && (
                <div className="users-table-container glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
                    <AlertTriangle size={32} style={{ color: '#ef4444', marginBottom: '0.5rem' }} />
                    <p style={{ color: '#ef4444' }}>{error}</p>
                    <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={fetchUsers}>Retry</button>
                </div>
            )}

            {!loading && !error && (
            <div className="users-table-container glass-panel">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>System Role</th>
                            <th>Status & Verification</th>
                            <th>Last Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr key={u._id || u.id}>
                                <td>
                                    <div className="user-cell">
                                        <div className="avatar-initials" style={{ background: getAvatarColor(u.role) }}>
                                            {getInitials(u.name)}
                                        </div>
                                        <div className="user-info">
                                            <span className="name">{u.name}</span>
                                            <span className="email">{u.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`role-badge ${u.role.toLowerCase()}`}>
                                        {u.role === 'Admin' ? <Shield size={14} /> : <UserCircle size={14} />}
                                        {u.role}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span className={`status-badge ${(u.status || 'Active').toLowerCase()}`}>
                                            {u.status}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: u.isEmailVerified ? '#4ade80' : '#f87171' }}>
                                            {u.isEmailVerified ? '✓ Gmail Verified' : '⚠ Unverified Gmail'}
                                        </span>
                                    </div>
                                </td>
                                <td className="text-muted">{u.lastLogin}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                        {(u.status === 'Pending' || !u.isApproved) && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', borderRadius: '6px' }}
                                                title="Approve User Account"
                                                onClick={() => handleApproveUser(u)}
                                                disabled={approvalLoadingId === u._id}
                                            >
                                                <UserCheck size={14} />
                                                <span>Approve</span>
                                            </button>
                                        )}

                                        <button
                                            className="action-btn"
                                            title="Reset Password"
                                            onClick={() => { setResetError(''); setResetMsg(''); setNewPasswordInput(''); setResetPasswordUser(u); }}
                                            style={{ color: '#0891b2' }}
                                        >
                                            <Lock size={16} />
                                        </button>

                                        <button
                                            className="action-btn"
                                            title="Edit User Access & Status"
                                            onClick={() => { setUpdateError(''); setSelectedUser(u); }}
                                        >
                                            <Settings size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredUsers.length === 0 && (
                    <div className="empty-table-state">
                        <AlertTriangle size={48} />
                        <p>No user records found matching your criteria.</p>
                    </div>
                )}
            </div>
            )}

            {/* EDIT USER ACCESS MODAL */}
            {selectedUser && createPortal(
                <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
                    <div className="modal-content glass-panel account-edit-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Edit Account Access</h2>
                                <p className="modal-subtitle">Modifying permissions for {selectedUser.name}</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedUser(null)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Full Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedUser.name}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Gmail Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={selectedUser.email}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group mt-6">
                                <label className="form-label">Change System Role</label>
                                <div className="role-selector-row">
                                    {['Student', 'Teacher', 'Admin'].map(role => (
                                        <button
                                            key={role}
                                            className={`role-btn ${selectedUser.role === role ? 'active' : ''}`}
                                            onClick={() => setSelectedUser({ ...selectedUser, role })}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group mt-4">
                                <label className="form-label">Account Status</label>
                                <select
                                    className="form-input"
                                    value={selectedUser.status}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value })}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Pending">Pending Approval</option>
                                    <option value="Deactivated">Deactivated</option>
                                </select>
                            </div>

                            {updateError && (
                                <div className="security-info-box alert-box" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', marginTop: '1rem' }}>
                                    <AlertTriangle size={18} />
                                    <p>{updateError}</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedUser(null)} disabled={savingUser}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleUpdateUser} disabled={savingUser}>
                                {savingUser ? 'Saving Changes...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ADMIN RESET PASSWORD MODAL */}
            {resetPasswordUser && createPortal(
                <div className="modal-overlay" onClick={() => setResetPasswordUser(null)}>
                    <div className="modal-content glass-panel account-edit-modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Reset Password</h2>
                                <p className="modal-subtitle">Resetting password for {resetPasswordUser.name}</p>
                            </div>
                            <button className="close-btn" onClick={() => setResetPasswordUser(null)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleResetPasswordSubmit}>
                            <div className="modal-body">
                                {resetError && (
                                    <div className="security-info-box alert-box" style={{ marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                        <AlertTriangle size={18} />
                                        <p>{resetError}</p>
                                    </div>
                                )}

                                {resetMsg && (
                                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#22c55e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <Check size={18} />
                                        <span>{resetMsg}</span>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Min 6 characters"
                                        value={newPasswordInput}
                                        onChange={(e) => setNewPasswordInput(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setResetPasswordUser(null)} disabled={resetLoading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                                    {resetLoading ? 'Resetting...' : 'Confirm Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* REGISTER MODAL */}
            {showRegisterModal && createPortal(
                <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
                    <div className="modal-content glass-panel account-edit-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Register New User</h2>
                                <p className="modal-subtitle">Create a new account in the system</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowRegisterModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleRegisterUser}>
                            <div className="modal-body">
                                {registerError && (
                                    <div className="security-info-box alert-box" style={{ marginBottom: '1rem' }}>
                                        <AlertTriangle size={18} />
                                        <p>{registerError}</p>
                                    </div>
                                )}
                                {registerSuccess && (
                                    <div className="security-info-box" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', marginBottom: '1rem', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <UserCheck size={18} style={{ color: '#22c55e' }} />
                                        <p style={{ color: '#22c55e', margin: 0 }}>{registerSuccess}</p>
                                    </div>
                                )}

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Full Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ paddingLeft: '2.25rem' }}
                                            placeholder="e.g. Dr. Jane Smith"
                                            value={registerForm.name}
                                            onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Email Address</label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="email"
                                            className="form-input"
                                            style={{ paddingLeft: '2.25rem' }}
                                            placeholder="user@tuhmawbi.edu.mm"
                                            value={registerForm.email}
                                            onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="password"
                                            className="form-input"
                                            style={{ paddingLeft: '2.25rem' }}
                                            placeholder="Min. 6 characters"
                                            value={registerForm.password}
                                            onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Department / Major</label>
                                    <select
                                        className="form-input"
                                        value={registerForm.department}
                                        onChange={e => setRegisterForm({ ...registerForm, department: e.target.value })}
                                    >
                                        <option value="Mechatronics Engineering">Mechatronics Engineering</option>
                                        <option value="Computer Engineering">Computer Engineering</option>
                                        <option value="Information Technology">Information Technology</option>
                                        <option value="Electrical Engineering">Electrical Engineering</option>
                                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Academic Year</label>
                                    <select
                                        className="form-input"
                                        value={registerForm.year}
                                        onChange={e => setRegisterForm({ ...registerForm, year: e.target.value })}
                                    >
                                        <option value="Final Year (VI)">Final Year (VI)</option>
                                        <option value="Fifth Year (V)">Fifth Year (V)</option>
                                        <option value="Fourth Year (IV)">Fourth Year (IV)</option>
                                        <option value="Third Year (III)">Third Year (III)</option>
                                        <option value="Second Year (II)">Second Year (II)</option>
                                        <option value="First Year (I)">First Year (I)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">System Role</label>
                                    <div className="role-selector-row">
                                        {['Student', 'Teacher', 'Admin'].map(role => (
                                            <button
                                                type="button"
                                                key={role}
                                                className={`role-btn ${registerForm.role === role ? 'active' : ''}`}
                                                onClick={() => setRegisterForm({ ...registerForm, role })}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)} disabled={registerLoading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={registerLoading}>
                                    {registerLoading ? 'Creating...' : <><UserPlus size={16} /> Create Account</>}
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

export default AccountManagement;
