import React, { useState, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { X, Settings, Save } from 'lucide-react';
import { getNormalizedUserYear } from '../utils/userYear';
import './Students.css';

const DEFAULT_ACADEMIC_CONFIG = {
    maxYear: 6,
    departments: [
        { name: 'Mechatronics Engineering', code: 'MC', active: true },
        { name: 'Civil Engineering', code: 'C', active: true },
        { name: 'Computer Science', code: 'CS', active: true },
    ],
};

const romanize = (num) => {
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) return '';
    const romans = [
        ['M', 1000],
        ['CM', 900],
        ['D', 500],
        ['CD', 400],
        ['C', 100],
        ['XC', 90],
        ['L', 50],
        ['XL', 40],
        ['X', 10],
        ['IX', 9],
        ['V', 5],
        ['IV', 4],
        ['I', 1],
    ];
    let value = Math.floor(n);
    let out = '';
    for (const [sym, v] of romans) {
        while (value >= v) {
            out += sym;
            value -= v;
        }
    }
    return out;
};

const ordinalYearLabel = (yearNumber) => {
    const y = Number(yearNumber);
    if (!Number.isFinite(y) || y <= 0) return 'Year';
    const lastTwo = y % 100;
    const last = y % 10;
    const suffix = (lastTwo >= 11 && lastTwo <= 13)
        ? 'th'
        : last === 1
            ? 'st'
            : last === 2
                ? 'nd'
                : last === 3
                    ? 'rd'
                    : 'th';
    return `${y}${suffix} Year`;
};

const pad3 = (num) => String(num).padStart(3, '0');

const semesterToYearLabel = (semester, maxYear) => {
    if (!semester) return '1st Year';
    const bucket = Math.ceil(Number(semester) / 2);
    const clamped = Math.min(maxYear || 6, Math.max(1, bucket));
    return ordinalYearLabel(clamped);
};

const getAvatarUrl = (name, id) => {
    const initials = name ? encodeURIComponent(name) : encodeURIComponent(id || 'Student');
    return `https://ui-avatars.com/api/?name=${initials}&background=374151&color=ffffff`;
};

const formatRollNumberDisplay = (rollInput, yearLabel, department) => {
    const raw = String(rollInput || '').trim();
    if (!raw) return 'N/A';
    if (raw.includes('-') || raw.includes(' ')) return raw;

    const getYearPrefix = (yearStr) => {
        const text = String(yearStr || '').toUpperCase();
        if (text.includes('VI') || text.includes('6')) return 'VI';
        if (text.includes('V') || text.includes('5')) return 'V';
        if (text.includes('IV') || text.includes('4')) return 'IV';
        if (text.includes('III') || text.includes('3')) return 'III';
        if (text.includes('II') || text.includes('2')) return 'II';
        if (text.includes('I') || text.includes('1')) return 'I';
        return 'VI';
    };

    const getDeptCode = (deptStr) => {
        const text = String(deptStr || '').toUpperCase();
        if (text.includes('MECHATRONIC') || text.includes('MCE')) return 'MC';
        if (text.includes('COMPUTER') || text.includes('CE')) return 'CE';
        if (text.includes('INFORMATION') || text.includes('IT')) return 'IT';
        if (text.includes('ELECTRICAL') || text.includes('EP')) return 'EP';
        if (text.includes('MECHANICAL') || text.includes('MECH')) return 'Mech';
        if (text.includes('CIVIL')) return 'Civil';
        if (text.includes('ELECTRONIC') || text.includes('EC')) return 'EC';
        return 'MC';
    };

    const y = getYearPrefix(yearLabel);
    const d = getDeptCode(department);
    return `${y}-${d}-${raw}`;
};

const Students = () => {
    const { user } = useContext(AuthContext);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [manageStudent, setManageStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalSaving, setModalSaving] = useState(false);
    const [modalError, setModalError] = useState('');
    const [editForm, setEditForm] = useState({
        enrollmentNumber: '',
        department: '',
        year: 1,
        semesterInYear: 1,
        semester: 1,
        contactNumber: '',
        status: 'Active',
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        name: '',
        email: '',
        password: '',
        enrollmentNumber: '',
        department: '',
        year: 1,
        semesterInYear: 1,
        semester: 1,
        contactNumber: '',
    });
    const [isEnrollmentAuto, setIsEnrollmentAuto] = useState(true);
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
    const [academicConfig, setAcademicConfig] = useState(DEFAULT_ACADEMIC_CONFIG);

    const maxYear = academicConfig?.maxYear ?? DEFAULT_ACADEMIC_CONFIG.maxYear;
    const departmentOptions = (academicConfig?.departments || DEFAULT_ACADEMIC_CONFIG.departments).filter(d => d?.active !== false);

    const years = isStudent
        ? [studentYear]
        : ['All', ...Array.from({ length: maxYear }, (_, i) => ordinalYearLabel(i + 1))];

    useEffect(() => {
        const fetchAcademicConfig = async () => {
            try {
                const { data } = await apiClient.get('/academic-config');
                setAcademicConfig(data || DEFAULT_ACADEMIC_CONFIG);
            } catch {
                setAcademicConfig(DEFAULT_ACADEMIC_CONFIG);
            }
        };
        fetchAcademicConfig();
    }, []);

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

    const enhancedStudents = students.map(student => {
        const yearLabel = semesterToYearLabel(student.semester, maxYear);
        const displayRoll = formatRollNumberDisplay(student.enrollmentNumber || student.user?.rollNo, yearLabel, student.department);
        return {
            ...student,
            yearLabel,
            displayRoll,
            displayName: student.user?.name || displayRoll || 'Student',
        };
    });

    const userDepartment = React.useMemo(() => {
        if (user?.department && user.department.trim()) return user.department.trim();
        if (user?.email) {
            const parts = user.email.split('@')[0].toLowerCase().split('.');
            if (parts.length >= 2) {
                const d = parts[1];
                if (d === 'mc' || d === 'mce') return 'Mechatronics Engineering';
                if (d === 'arch' || d === 'ar') return 'Architecture';
                if (d === 'c' || d === 'ce') return 'Civil Engineering';
                if (d === 'ep') return 'Electrical Power Engineering';
                if (d === 'ec' || d === 'ece') return 'Electronic Engineering';
                if (d === 'it') return 'Information Technology';
                if (d === 'me') return 'Mechanical Engineering';
            }
        }
        if (user?.rollNo) {
            const c = String(user.rollNo).toUpperCase();
            if (c.includes('MC') || c.includes('MCE')) return 'Mechatronics Engineering';
            if (c.includes('CE') && !c.includes('ECE')) return 'Civil Engineering';
            if (c.includes('EP')) return 'Electrical Power Engineering';
            if (c.includes('EC')) return 'Electronic Engineering';
            if (c.includes('IT')) return 'Information Technology';
            if (c.includes('ME')) return 'Mechanical Engineering';
            if (c.includes('ARCH') || c.includes('AR')) return 'Architecture';
        }
        return 'Mechatronics Engineering';
    }, [user]);

    const initialDepartment = isAdmin ? 'All' : userDepartment;
    const [selectedDepartment, setSelectedDepartment] = useState(initialDepartment);

    // Keep selectedDepartment locked for non-admins if user state updates
    useEffect(() => {
        if (!isAdmin) {
            setSelectedDepartment(userDepartment);
        }
    }, [isAdmin, userDepartment]);

    const availableDepartments = [
        'All',
        'Mechatronics Engineering',
        'Civil Engineering',
        'Electrical Power Engineering',
        'Electronic Engineering',
        'Information Technology',
        'Mechanical Engineering'
    ];

    const filteredStudents = enhancedStudents.filter(student => {
        const fullText = `${student.displayName} ${student.user?.email || ''} ${student.enrollmentNumber || ''} ${student.department || ''}`.toLowerCase();
        const matchesSearch = fullText.includes(searchTerm.toLowerCase());
        const targetYear = isStudent ? studentYear : selectedYear;
        const matchesYear = targetYear === 'All' || student.yearLabel === targetYear;

        // Department filter matching
        let matchesDept = true;
        if (selectedDepartment !== 'All') {
            const sDept = (student.department || student.user?.department || '').toLowerCase().trim();
            const rollStr = (student.enrollmentNumber || student.user?.rollNo || student.displayRoll || '').toUpperCase();
            const emailStr = (student.user?.email || '').toLowerCase();
            const target = selectedDepartment.toLowerCase().trim();

            // Extract department code from roll number (e.g. "V-MC-1" → "MC", "III-C-5" → "C")
            const rollDeptMatch = rollStr.match(/^[IVX]+-([A-Z]+)-/);
            const rollDeptCode = rollDeptMatch ? rollDeptMatch[1] : '';

            // Extract department code from email prefix (e.g. "v.mc.1@" → "mc", "iii.c.5@" → "c")
            const emailParts = emailStr.split('@')[0].split('.');
            const emailDeptCode = emailParts.length >= 2 ? emailParts[1].toLowerCase() : '';

            if (target.includes('mechatronics')) {
                matchesDept = sDept.includes('mechatronics') || rollDeptCode === 'MC' || rollDeptCode === 'MCE' || emailDeptCode === 'mc' || emailDeptCode === 'mce';
            } else if (target.includes('civil')) {
                matchesDept = sDept.includes('civil') || rollDeptCode === 'C' || rollDeptCode === 'CE' || emailDeptCode === 'c' || emailDeptCode === 'ce';
            } else if (target.includes('electrical power')) {
                matchesDept = sDept.includes('electrical power') || sDept.includes('electrical') || rollDeptCode === 'EP' || emailDeptCode === 'ep';
            } else if (target.includes('electronic')) {
                matchesDept = sDept.includes('electronic') || rollDeptCode === 'EC' || rollDeptCode === 'ECE' || emailDeptCode === 'ec' || emailDeptCode === 'ece';
            } else if (target.includes('information')) {
                matchesDept = sDept.includes('information') || rollDeptCode === 'IT' || emailDeptCode === 'it';
            } else if (target.includes('mechanical')) {
                matchesDept = (sDept.includes('mechanical') && !sDept.includes('mechatronics')) || rollDeptCode === 'ME' || rollDeptCode === 'MECH' || emailDeptCode === 'me';
            } else if (target.includes('architecture')) {
                matchesDept = sDept.includes('architecture') || rollDeptCode === 'AR' || rollDeptCode === 'ARCH' || emailDeptCode === 'arch' || emailDeptCode === 'ar';
            } else {
                matchesDept = sDept.includes(target) || target.includes(sDept);
            }
        }

        return matchesSearch && matchesYear && matchesDept;
    });

    useEffect(() => {
        if (!manageStudent) return;
        const semesterRaw = Number(manageStudent.semester) || 1;
        const year = Math.max(1, Math.min(maxYear || 6, Math.ceil(semesterRaw / 2)));
        const semesterInYear = semesterRaw % 2 === 0 ? 2 : 1;
        setEditForm({
            enrollmentNumber: manageStudent.enrollmentNumber || '',
            department: manageStudent.department || '',
            year,
            semesterInYear,
            semester: semesterRaw,
            contactNumber: manageStudent.contactNumber || '',
            status: manageStudent.status || 'Active',
        });
        setModalError('');
    }, [manageStudent, maxYear]);

    useEffect(() => {
        if (!manageStudent) return;
        setEditForm(prev => {
            const year = Number(prev.year) || 1;
            const semesterInYear = Number(prev.semesterInYear) || 1;
            const yearClamped = Math.max(1, Math.min(maxYear || 6, year));
            const semester = (yearClamped - 1) * 2 + (semesterInYear === 2 ? 2 : 1);
            if (Number(prev.semester) === semester) return prev;
            return { ...prev, semester };
        });
    }, [editForm.year, editForm.semesterInYear, manageStudent, maxYear]);

    const handleSaveProfile = async () => {
        if (!manageStudent) return;
        setModalSaving(true);
        setModalError('');

        try {
            const payload = {
                enrollmentNumber: editForm.enrollmentNumber,
                department: editForm.department,
                semester: parseInt(editForm.semester, 10),
                contactNumber: editForm.contactNumber,
                status: editForm.status,
            };

            const { data: updatedStudent } = await apiClient.put(`/students/${manageStudent._id}`, payload);

            setStudents(prev =>
                prev.map(s => {
                    if (s._id !== manageStudent._id) return s;

                    const merged = { ...s, ...updatedStudent };

                    // If the API responds with an unpopulated `user` (ObjectId or minimal object),
                    // keep the existing populated user so the UI doesn't lose `user.name`.
                    const updatedUser = updatedStudent?.user;
                    const updatedUserIsPopulated =
                        updatedUser &&
                        typeof updatedUser === 'object' &&
                        (updatedUser.name || updatedUser.email || updatedUser.role);

                    if (!updatedUserIsPopulated) {
                        merged.user = s.user;
                    }

                    return merged;
                })
            );
            setManageStudent(null);
        } catch (err) {
            setModalError(err.response?.data?.message || err.message || 'Unable to save changes');
        } finally {
            setModalSaving(false);
        }
    };

    const openAddModal = () => {
        setAddForm({
            name: '',
            email: '',
            password: '',
            enrollmentNumber: '',
            department: '',
            year: 1,
            semesterInYear: 1,
            semester: 1,
            contactNumber: '',
        });
        setIsEnrollmentAuto(true);
        setAddError('');
        setShowAddModal(true);
    };

    useEffect(() => {
        setAddForm(prev => {
            const year = Number(prev.year) || 1;
            const semesterInYear = Number(prev.semesterInYear) || 1;
            const yearClamped = Math.max(1, Math.min(maxYear || 6, year));
            const semester = (yearClamped - 1) * 2 + (semesterInYear === 2 ? 2 : 1);
            if (Number(prev.semester) === semester) return prev;
            return { ...prev, semester };
        });
    }, [addForm.year, addForm.semesterInYear, maxYear]);

    useEffect(() => {
        if (!showAddModal) return;
        if (!isEnrollmentAuto) return;

        const year = Math.max(1, Math.min(maxYear || 6, Number(addForm.year) || 1));
        const romanYear = romanize(year) || 'I';
        const deptCode = departmentOptions.find(d => d.name === addForm.department)?.code || '';
        if (!deptCode) {
            setAddForm(prev => (prev.enrollmentNumber ? { ...prev, enrollmentNumber: '' } : prev));
            return;
        }

        const prefix = `${romanYear}-${deptCode}-`;
        const used = new Set(
            students
                .map(s => s.enrollmentNumber)
                .filter(Boolean)
                .filter(en => en.startsWith(prefix))
        );

        let next = 1;
        while (used.has(`${prefix}${pad3(next)}`)) next += 1;

        const nextEnrollment = `${prefix}${pad3(next)}`;
        setAddForm(prev => (prev.enrollmentNumber === nextEnrollment ? prev : { ...prev, enrollmentNumber: nextEnrollment }));
    }, [showAddModal, isEnrollmentAuto, addForm.department, addForm.year, students, maxYear, departmentOptions]);

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

            <div className="year-filter-bar glass-panel" style={{ marginBottom: '0.75rem' }}>
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

            {isAdmin ? (
                <div className="year-filter-bar glass-panel" style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.05)' }}>
                    {availableDepartments.map(dept => (
                        <button
                            key={dept}
                            className={`year-tag ${selectedDepartment === dept ? 'active' : ''}`}
                            onClick={() => setSelectedDepartment(dept)}
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                        >
                            {dept === 'Mechatronics Engineering' ? 'Mechatronics (VMC)' : dept === 'Civil Engineering' ? 'Civil (VC)' : dept}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px' }}>
                    <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: '600' }}>Department:</span>
                    <span className="badge badge-primary font-mono" style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        {userDepartment}
                    </span>
                </div>
            )}

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
                                    <p className="student-id">{student.displayRoll || student.enrollmentNumber || student._id}</p>
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
                                    <Link
                                        className="btn btn-secondary btn-sm"
                                        to={`/students/${student._id}`}
                                        state={{ student }}
                                    >
                                        Profile
                                    </Link>
                                    {isAdmin && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setManageStudent(student)}>
                                            <Settings size={14} />
                                            Manage
                                        </button>
                                    )}
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
                                <h2>Edit Student Profile</h2>
                                <p className="modal-subtitle">Update academic year, major, and contact for {manageStudent.displayName}</p>
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
                                        <span>{manageStudent.enrollmentNumber || 'Enrollment not set'}</span>
                                    </span>
                                </div>
                            </div>

                            <div className="role-selector-grid" style={{ marginTop: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="form-label">Enrollment No.</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. I-MC-001"
                                        value={editForm.enrollmentNumber}
                                        onChange={(e) => setEditForm({ ...editForm, enrollmentNumber: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Major / Department</label>
                                    <select
                                        className="form-input"
                                        value={editForm.department}
                                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                                    >
                                        <option value="" disabled>Select department</option>
                                        {departmentOptions.map(dep => (
                                            <option key={dep.code} value={dep.name}>{dep.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Academic Year</label>
                                    <select
                                        className="form-input"
                                        value={editForm.year}
                                        onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value, 10) })}
                                    >
                                        {Array.from({ length: maxYear || 6 }, (_, i) => i + 1).map(y => (
                                            <option key={y} value={y}>{romanize(y)} ({ordinalYearLabel(y)})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Semester</label>
                                    <select
                                        className="form-input"
                                        value={editForm.semesterInYear}
                                        onChange={(e) => setEditForm({ ...editForm, semesterInYear: parseInt(e.target.value, 10) })}
                                    >
                                        <option value={1}>Semester 1</option>
                                        <option value={2}>Semester 2</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Optional"
                                        value={editForm.contactNumber}
                                        onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select
                                        className="form-input"
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Probation">Probation</option>
                                        <option value="Suspended">Suspended</option>
                                    </select>
                                </div>
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
                                onClick={handleSaveProfile}
                                disabled={modalSaving}
                            >
                                <Save size={18} />
                                {modalSaving ? 'Saving...' : 'Save Profile'}
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
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g. I-MC-001"
                                            value={addForm.enrollmentNumber}
                                            onChange={e => { setIsEnrollmentAuto(false); setAddForm({ ...addForm, enrollmentNumber: e.target.value }); }}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Department</label>
                                        <select
                                            className="form-input"
                                            value={addForm.department}
                                            onChange={e => { setIsEnrollmentAuto(true); setAddForm({ ...addForm, department: e.target.value }); }}
                                            required
                                        >
                                            <option value="" disabled>Select department</option>
                                            {departmentOptions.map(dep => (
                                                <option key={dep.code} value={dep.name}>{dep.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Year</label>
                                        <select
                                            className="form-input"
                                            value={addForm.year}
                                            onChange={e => { setIsEnrollmentAuto(true); setAddForm({ ...addForm, year: parseInt(e.target.value, 10) }); }}
                                            required
                                        >
                                            {Array.from({ length: maxYear || 6 }, (_, i) => i + 1).map(y => (
                                                <option key={y} value={y}>{romanize(y)} ({ordinalYearLabel(y)})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Semester</label>
                                        <select
                                            className="form-input"
                                            value={addForm.semesterInYear}
                                            onChange={e => setAddForm({ ...addForm, semesterInYear: parseInt(e.target.value, 10) })}
                                            required
                                        >
                                            <option value={1}>Semester 1</option>
                                            <option value={2}>Semester 2</option>
                                        </select>
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
