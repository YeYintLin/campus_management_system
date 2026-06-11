import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { X, Shield, UserCircle, Settings, UserCheck, UserPlus } from 'lucide-react';
import { defaultTeachers } from '../data/teachers';
import './Teachers.css';

const getTeacherId = (teacher) => teacher._id || teacher.id;

const Teachers = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';

    const [teachers, setTeachers] = useState(defaultTeachers);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState('All');
    const [manageTeacher, setManageTeacher] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', email: '', password: '', department: '', title: 'Professor' });
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
    const [addSuccess, setAddSuccess] = useState('');

    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

    useEffect(() => {
        if (!isAdmin) return undefined;

        const abortController = new AbortController();

        const fetchTeachers = async () => {
            try {
                const { data } = await apiClient.get('/users?role=Teacher', { signal: abortController.signal });
                const fetchedTeachers = Array.isArray(data)
                    ? data.map(teacher => ({
                        id: teacher._id,
                        _id: teacher._id,
                        name: teacher.name,
                        email: teacher.email,
                        department: teacher.department || 'Unassigned',
                        role: teacher.title || 'Teacher',
                        status: teacher.status || 'Active',
                        year: teacher.year || 'All Years',
                        office: teacher.office || '',
                        consultationHours: teacher.consultationHours || '',
                        specialization: teacher.specialization || '',
                        avatar: `https://i.pravatar.cc/150?u=${teacher._id}`,
                    }))
                    : [];

                setTeachers(fetchedTeachers.length > 0 ? fetchedTeachers : defaultTeachers);
            } catch (err) {
                if (err?.code !== 'ERR_CANCELED') {
                    setTeachers(defaultTeachers);
                }
            }
        };

        fetchTeachers();
        return () => abortController.abort();
    }, [isAdmin]);

    const filteredTeachers = teachers.filter(teacher => {
        const matchesSearch = teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            teacher.department.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesYear = selectedYear === 'All' || teacher.year === selectedYear;
        return matchesSearch && matchesYear;
    });

    const openAddModal = () => {
        setAddForm({ name: '', email: '', password: '', department: '', title: 'Professor' });
        setAddError('');
        setAddSuccess('');
        setShowAddModal(true);
    };

    const handleAddTeacher = async (e) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError('');
        setAddSuccess('');
        try {
            const { data } = await apiClient.post('/auth/admin-register', {
                name: addForm.name,
                email: addForm.email,
                password: addForm.password,
                role: 'Teacher',
            });
            const newTeacher = {
                id: data._id,
                name: data.name,
                email: data.email,
                department: addForm.department,
                role: addForm.title,
                status: 'Active',
                year: '1st Year',
                avatar: `https://i.pravatar.cc/150?u=${data._id}`,
            };
            setTeachers(prev => [newTeacher, ...prev]);
            setAddSuccess(`Teacher "${data.name}" added successfully!`);
            setTimeout(() => setShowAddModal(false), 1500);
        } catch (err) {
            setAddError(err.response?.data?.message || 'Failed to add teacher.');
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="teachers-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Faculty Directory</h1>
                    <p className="subtitle">Manage teaching staff and department heads</p>
                </div>
                <div className="header-actions">
                    <input
                        type="text"
                        placeholder="Search faculty..."
                        className="form-input search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {isAdmin && <button className="btn btn-primary" onClick={openAddModal}><UserPlus size={18} /> Add Teacher</button>}
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

            <div className="teachers-grid">
                {filteredTeachers.map(teacher => (
                    <div key={getTeacherId(teacher)} className="glass-card teacher-card">
                        <div className="teacher-header">
                            <img src={teacher.avatar} alt={teacher.name} className="teacher-avatar" />
                            <div className="teacher-info">
                                <h3>{teacher.name}</h3>
                                <p className="teacher-role">{teacher.role}</p>
                            </div>
                        </div>

                        <div className="teacher-body">
                            <div className="detail-row">
                                <span className="detail-label">Department</span>
                                <span className="detail-value">{teacher.department}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Academic Year</span>
                                <span className="detail-value">{teacher.year}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`badge ${teacher.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                                    {teacher.status}
                                </span>
                            </div>
                        </div>

                        <div className="teacher-footer">
                            <Link
                                to={`/teachers/${getTeacherId(teacher)}`}
                                state={{ teacher }}
                                className="btn btn-secondary btn-sm"
                            >
                                Profile
                            </Link>
                            {isAdmin && (
                                <button className="btn btn-primary btn-sm" onClick={() => setManageTeacher(teacher)}>
                                    <Settings size={14} />
                                    Manage
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredTeachers.length === 0 && (
                <div className="glass-panel empty-state">
                    <p>No faculty members found matching your search.</p>
                </div>
            )}

            {manageTeacher && (
                <div className="modal-overlay" onClick={() => setManageTeacher(null)}>
                    <div className="modal-content glass-panel account-mgmt-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Manage Teacher Account</h2>
                                <p className="modal-subtitle">Update permissions for {manageTeacher.name}</p>
                            </div>
                            <button className="close-btn" onClick={() => setManageTeacher(null)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="user-preview-card glass-panel">
                                <img src={manageTeacher.avatar} alt="" />
                                <div>
                                    <h3>{manageTeacher.name}</h3>
                                    <p>{manageTeacher.email}</p>
                                </div>
                            </div>

                            <div className="form-group mt-6">
                                <label className="form-label">System Role</label>
                                <div className="role-selector-grid">
                                    <button className={`role-option ${manageTeacher.role === 'Student' ? 'active' : ''}`}>
                                        <UserCircle size={18} />
                                        <span>Student</span>
                                    </button>
                                    <button className={`role-option ${manageTeacher.role === 'Teacher' || !manageTeacher.role ? 'active' : ''}`}>
                                        <Shield size={18} />
                                        <span>Teacher</span>
                                    </button>
                                    <button className={`role-option ${manageTeacher.role === 'Admin' ? 'active' : ''}`}>
                                        <Shield size={18} className="text-primary" />
                                        <span>Admin</span>
                                    </button>
                                </div>
                            </div>

                            <div className="form-group mt-4">
                                <label className="form-label">Faculty Status</label>
                                <select className="form-input" defaultValue={manageTeacher.status}>
                                    <option value="Active">Active</option>
                                    <option value="On Leave">On Leave</option>
                                    <option value="Retired">Retired</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setManageTeacher(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => {
                                alert("Teacher permissions updated!");
                                setManageTeacher(null);
                            }}>Apply Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content glass-panel account-mgmt-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Add New Teacher</h2>
                                <p className="modal-subtitle">Create a faculty account in the system</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddTeacher}>
                            <div className="modal-body">
                                {addError && (
                                    <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{addError}</div>
                                )}
                                {addSuccess && (
                                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#22c55e', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <UserCheck size={18} /> {addSuccess}
                                    </div>
                                )}
                                <div className="role-selector-grid" style={{ marginBottom: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input type="text" className="form-input" placeholder="Dr. Jane Smith" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-input" placeholder="jane@altair.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password</label>
                                        <input type="password" className="form-input" placeholder="Min. 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required minLength={6} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Department</label>
                                        <input type="text" className="form-input" placeholder="e.g. Physics" value={addForm.department} onChange={e => setAddForm({ ...addForm, department: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Title</label>
                                        <select className="form-input" value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })}>
                                            <option>Professor</option>
                                            <option>Associate Prof</option>
                                            <option>Head of Dept</option>
                                            <option>Lecturer</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={addLoading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                                    {addLoading ? 'Adding...' : <><UserPlus size={16} /> Add Teacher</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Teachers;
