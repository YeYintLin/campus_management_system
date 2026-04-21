import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import {
    Search, UserPlus, Shield, UserCircle,
    MoreVertical, UserCheck, UserX, AlertTriangle,
    Mail, Calendar, Filter, Download, X, Settings, Lock, User
} from 'lucide-react';
import './AccountManagement.css';

const dummyUsers = [
    { id: 1, name: 'Admin User', email: 'admin@altair.edu', role: 'Admin', status: 'Active', lastLogin: '10 mins ago', avatar: 'https://i.pravatar.cc/150?u=admin' },
    { id: 2, name: 'Dr. Alan Turing', email: 'alan.t@altair.edu', role: 'Teacher', status: 'Active', lastLogin: '2 hours ago', avatar: 'https://i.pravatar.cc/150?u=alan' },
    { id: 3, name: 'Alice Johnson', email: 'alice.j@student.altair.edu', role: 'Student', status: 'Active', lastLogin: '1 day ago', avatar: 'https://i.pravatar.cc/150?u=alice' },
    { id: 4, name: 'Bob Smith', email: 'bob.s@student.altair.edu', role: 'Student', status: 'Probation', lastLogin: '3 days ago', avatar: 'https://i.pravatar.cc/150?u=bob' },
    { id: 5, name: 'Prof. Isaac Newton', email: 'isaac.n@altair.edu', role: 'Teacher', status: 'Active', lastLogin: '5 hours ago', avatar: 'https://i.pravatar.cc/150?u=isaac' },
    { id: 6, name: 'Charlie Davis', email: 'charlie.d@student.altair.edu', role: 'Student', status: 'Suspended', lastLogin: '1 week ago', avatar: 'https://i.pravatar.cc/150?u=charlie' },
];

const AccountManagement = () => {
    const { user: currentUser } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState(dummyUsers);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'Student' });
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState('');
    const [registerSuccess, setRegisterSuccess] = useState('');

    // Redirect if not admin
    if (currentUser?.role !== 'Admin') {
        return <div className="p-8 text-center glass-panel">Unauthorized. Administrative access required.</div>;
    }

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'All' || u.role === roleFilter;
        const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const handleUpdateUser = (updatedUser) => {
        setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSelectedUser(null);
        alert(`Account for ${updatedUser.name} updated successfully!`);
    };

    const openRegisterModal = () => {
        setRegisterForm({ name: '', email: '', password: '', role: 'Student' });
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
                id: data._id,
                name: data.name,
                email: data.email,
                role: data.role,
                status: 'Active',
                lastLogin: 'Just now',
                avatar: `https://i.pravatar.cc/150?u=${data._id}`,
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
                    <button className="btn btn-secondary-glass">
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
                            <option value="Active">Active</option>
                            <option value="Probation">Probation</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="users-table-container glass-panel">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>System Role</th>
                            <th>Status</th>
                            <th>Last Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr key={u.id}>
                                <td>
                                    <div className="user-cell">
                                        <img src={u.avatar} alt="" />
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
                                    <span className={`status-badge ${u.status.toLowerCase()}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="text-muted">{u.lastLogin}</td>
                                <td>
                                    <button className="action-btn" onClick={() => setSelectedUser(u)}>
                                        <Settings size={18} />
                                    </button>
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

            {selectedUser && (
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
                            <div className="user-profile-summary">
                                <img src={selectedUser.avatar} alt="" />
                                <div>
                                    <h3>{selectedUser.name}</h3>
                                    <p><Mail size={14} /> {selectedUser.email}</p>
                                    <p><Calendar size={14} /> Registered: Jan 2024</p>
                                </div>
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
                                    <option value="Probation">Probation</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>

                            <div className="security-info-box alert-box">
                                <AlertTriangle size={18} />
                                <p>Role changes affect system access and visibility of modules immediately.</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => handleUpdateUser(selectedUser)}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {showRegisterModal && (
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
                                            placeholder="user@altair.edu"
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
                </div>
            )}
        </div>
    );
};

export default AccountManagement;
