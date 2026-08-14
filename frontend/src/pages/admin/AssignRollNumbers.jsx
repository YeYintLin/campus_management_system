import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import {
    Hash, Search, Filter, Save, AlertTriangle, CheckCircle2,
    Clock, RefreshCw, Edit3, ArrowRight, UserCheck, ShieldAlert,
    ChevronDown, FileText, ClipboardList
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import './AssignRollNumbers.css';

const DEPARTMENTS = [
    'Mechatronics Engineering',
    'Civil Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Information Technology',
    'Architecture'
];

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

const AssignRollNumbers = () => {
    const { user } = useContext(AuthContext);
    const [academicYear, setAcademicYear] = useState('2025-2026');
    const [department, setDepartment] = useState('Mechatronics Engineering');
    const [yearLevel, setYearLevel] = useState('5th Year');
    const [unassignedOnly, setUnassignedOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Form inputs state: map of enrollmentId -> rollNo input string
    const [rollInputs, setRollInputs] = useState({});
    const [saving, setSaving] = useState(false);
    const [bulkResults, setBulkResults] = useState(null);

    // Bulk Paste Modal State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkText, setBulkText] = useState('');

    // Reassign / Correction Modal State
    const [correctingItem, setCorrectingItem] = useState(null);
    const [correctionRollNo, setCorrectionRollNo] = useState('');
    const [correctionReason, setCorrectionReason] = useState('');
    const [correctionError, setCorrectionError] = useState('');

    const fetchEnrollments = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await apiClient.get('/enrollments', {
                params: {
                    academicYear,
                    department,
                    yearLevel,
                    unassignedOnly,
                    search: searchTerm,
                    limit: 100,
                },
            });
            const data = res.data?.enrollments || [];
            setEnrollments(data);

            // Populate initial inputs
            const inputs = {};
            data.forEach(e => {
                inputs[e._id] = e.rollNo || '';
            });
            setRollInputs(inputs);
        } catch (err) {
            console.error('Failed to load enrollments:', err);
            setError(err.response?.data?.message || 'Failed to load enrollment roster');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEnrollments();
    }, [academicYear, department, yearLevel, unassignedOnly]);

    const handleInputChange = (enrollmentId, value) => {
        setRollInputs(prev => ({
            ...prev,
            [enrollmentId]: value,
        }));
    };

    const handleSaveSingle = async (enrollment) => {
        const value = rollInputs[enrollment._id]?.trim();
        if (!value) {
            alert('Please enter a roll number before saving.');
            return;
        }

        try {
            setSaving(true);
            setError('');
            setSuccessMessage('');
            const res = await apiClient.post('/enrollments/assign-roll-numbers', {
                assignments: [
                    {
                        enrollmentId: enrollment._id,
                        studentId: enrollment.student?._id,
                        rollNo: value,
                        academicYear: enrollment.academicYear,
                        department: enrollment.department,
                    },
                ],
            });

            const result = res.data?.results?.[0];
            if (result?.status === 'error') {
                setError(result.message);
            } else {
                setSuccessMessage(`Successfully assigned ${value} to ${enrollment.student?.name}`);
                fetchEnrollments();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to assign roll number');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAllChanged = async () => {
        const assignments = [];
        enrollments.forEach(e => {
            const inputVal = rollInputs[e._id]?.trim();
            if (inputVal && inputVal !== (e.rollNo || '')) {
                assignments.push({
                    enrollmentId: e._id,
                    studentId: e.student?._id,
                    rollNo: inputVal,
                    academicYear: e.academicYear,
                    department: e.department,
                });
            }
        });

        if (assignments.length === 0) {
            alert('No new or changed roll numbers to save.');
            return;
        }

        try {
            setSaving(true);
            setError('');
            setSuccessMessage('');
            setBulkResults(null);

            const res = await apiClient.post('/enrollments/assign-roll-numbers', { assignments });
            setBulkResults(res.data);
            setSuccessMessage(res.data.message);
            fetchEnrollments();
        } catch (err) {
            setError(err.response?.data?.message || 'Bulk assignment failed');
        } finally {
            setSaving(false);
        }
    };

    // Bulk Paste CSV parsing
    const handleApplyBulkPaste = () => {
        if (!bulkText.trim()) return;
        const lines = bulkText.split('\n');
        const updated = { ...rollInputs };
        let matched = 0;

        lines.forEach(line => {
            const parts = line.split(/[,\t|]/).map(p => p.trim());
            if (parts.length >= 2) {
                const identifier = parts[0].toLowerCase();
                const roll = parts[1].toUpperCase();

                const target = enrollments.find(e => {
                    const s = e.student;
                    return (
                        s?.name?.toLowerCase() === identifier ||
                        s?.email?.toLowerCase() === identifier ||
                        s?.permanentRegNo?.toLowerCase() === identifier ||
                        (s?.rollNo && s.rollNo.toLowerCase() === identifier)
                    );
                });

                if (target) {
                    updated[target._id] = roll;
                    matched++;
                }
            }
        });

        setRollInputs(updated);
        setShowBulkModal(false);
        setBulkText('');
        setSuccessMessage(`Matched and filled ${matched} student roll numbers from paste. Click "Save All Changed" to submit.`);
    };

    // Submit Correction / Reassignment
    const handleCorrectionSubmit = async (e) => {
        e.preventDefault();
        if (!correctionRollNo.trim() || !correctionReason.trim()) {
            setCorrectionError('Both new roll number and correction reason are required.');
            return;
        }

        try {
            setSaving(true);
            setCorrectionError('');
            await apiClient.post(`/enrollments/${correctingItem._id}/reassign-roll-number`, {
                newRollNo: correctionRollNo.trim(),
                reason: correctionReason.trim(),
            });

            setSuccessMessage(`Roll number successfully corrected to ${correctionRollNo.trim()}`);
            setCorrectingItem(null);
            setCorrectionRollNo('');
            setCorrectionReason('');
            fetchEnrollments();
        } catch (err) {
            setCorrectionError(err.response?.data?.message || 'Failed to correct roll number');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="assign-roll-container animate-fade-in">
            {/* ── Page Header ── */}
            <header className="assign-header">
                <div>
                    <div className="badge-chip">
                        <Hash size={14} /> Student Affairs Registry
                    </div>
                    <h1>Assign Roll Numbers</h1>
                    <p className="subtitle">
                        Manually enter or bulk-assign official student roll numbers for the current academic session.
                    </p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setShowBulkModal(true)}
                    >
                        <ClipboardList size={16} /> Bulk Paste
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSaveAllChanged}
                        disabled={saving}
                    >
                        <Save size={16} /> {saving ? 'Saving...' : 'Save All Changed'}
                    </button>
                </div>
            </header>

            {/* ── Filter Bar ── */}
            <div className="glass-card filter-card">
                <div className="filter-grid">
                    <div className="filter-group">
                        <label>Academic Year</label>
                        <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
                            <option value="2024-2025">2024-2025</option>
                            <option value="2025-2026">2025-2026 (Active)</option>
                            <option value="2026-2027">2026-2027</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Department</label>
                        <select value={department} onChange={e => setDepartment(e.target.value)}>
                            {DEPARTMENTS.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Year Level</label>
                        <select value={yearLevel} onChange={e => setYearLevel(e.target.value)}>
                            {YEAR_LEVELS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group toggle-group">
                        <label>Show Only Unassigned</label>
                        <button
                            type="button"
                            className={`toggle-btn ${unassignedOnly ? 'active' : ''}`}
                            onClick={() => setUnassignedOnly(!unassignedOnly)}
                        >
                            {unassignedOnly ? 'Unassigned Only' : 'All Students'}
                        </button>
                    </div>
                </div>

                <div className="search-bar-row">
                    <div className="search-input-wrap">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by student name, email, or permanent registration number..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchEnrollments()}
                        />
                    </div>
                    <button type="button" className="btn-secondary" onClick={fetchEnrollments}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Status Alerts ── */}
            {error && (
                <div className="alert-banner error-banner animate-fade-in">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="alert-banner success-banner animate-fade-in">
                    <CheckCircle2 size={18} />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* ── Bulk Results Summary ── */}
            {bulkResults && bulkResults.results && (
                <div className="glass-card results-card animate-fade-in">
                    <h3>Batch Assignment Results</h3>
                    <p className="text-muted text-sm">{bulkResults.message}</p>
                    <div className="results-list">
                        {bulkResults.results.map((r, idx) => (
                            <div key={idx} className={`result-row ${r.status}`}>
                                <span className="row-num">Row #{r.row}</span>
                                <span className="row-roll">{r.rollNo}</span>
                                <span className="row-msg">{r.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Student Roll Table ── */}
            <div className="glass-card table-card">
                {loading ? (
                    <div className="table-loading">
                        <Clock size={24} className="spin" />
                        <p>Loading student roster...</p>
                    </div>
                ) : enrollments.length === 0 ? (
                    <div className="empty-roster">
                        <UserCheck size={36} />
                        <h4>No matching student enrollments found</h4>
                        <p className="text-muted text-sm">
                            Ensure students are enrolled for {academicYear} {department} ({yearLevel}).
                        </p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="roll-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Student Name</th>
                                    <th>Permanent Reg No</th>
                                    <th>Email</th>
                                    <th>Attendance</th>
                                    <th>Current Roll No</th>
                                    <th>Assign / New Roll No</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {enrollments.map((item, index) => {
                                    const student = item.student;
                                    const currentRoll = item.rollNo;
                                    const inputValue = rollInputs[item._id] ?? '';
                                    const isModified = inputValue.trim() !== (currentRoll || '');

                                    return (
                                        <tr key={item._id} className={isModified ? 'row-modified' : ''}>
                                            <td className="text-muted">{index + 1}</td>
                                            <td>
                                                <div className="student-name-cell">
                                                    <strong>{student?.name || 'Unknown'}</strong>
                                                    <span className="text-muted text-xs">{item.yearLevel} • {item.department}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="code-pill">
                                                    {student?.permanentRegNo || 'STU-' + (student?._id?.slice(-6) || 'N/A').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="text-muted text-sm">{student?.email}</td>
                                            <td>
                                                <span className={`att-badge ${item.attendanceRate >= 75 ? 'good' : 'warning'}`}>
                                                    {item.attendanceRate || 0}%
                                                </span>
                                            </td>
                                            <td>
                                                {currentRoll ? (
                                                    <span className="roll-assigned-badge">{currentRoll}</span>
                                                ) : (
                                                    <span className="roll-unassigned-badge">Not yet assigned</span>
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="roll-input"
                                                    placeholder="e.g. V-MC-1"
                                                    value={inputValue}
                                                    onChange={e => handleInputChange(item._id, e.target.value)}
                                                />
                                            </td>
                                            <td className="text-right">
                                                <div className="action-btn-group">
                                                    <button
                                                        type="button"
                                                        className="btn-save-row"
                                                        title="Save this roll number"
                                                        onClick={() => handleSaveSingle(item)}
                                                        disabled={saving || !inputValue.trim()}
                                                    >
                                                        Save
                                                    </button>
                                                    {currentRoll && (
                                                        <button
                                                            type="button"
                                                            className="btn-correct-row"
                                                            title="Correct/Reassign roll number with audit reason"
                                                            onClick={() => {
                                                                setCorrectingItem(item);
                                                                setCorrectionRollNo(currentRoll);
                                                                setCorrectionReason('');
                                                                setCorrectionError('');
                                                            }}
                                                        >
                                                            <Edit3 size={13} /> Correct
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Bulk Paste Modal ── */}
            {showBulkModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><ClipboardList size={18} /> Bulk Paste Student Roll Numbers</h3>
                            <button type="button" className="btn-close" onClick={() => setShowBulkModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p className="text-sm text-muted">
                                Paste list with <code>Student Name / Email / Reg No</code> and <code>Roll Number</code> separated by tab or comma:
                            </p>
                            <pre className="paste-example">
                                Ma Hnin Nandar, V-MC-1{"\n"}
                                student@tuhmawbi.edu.mm, V-MC-2{"\n"}
                                STU-2022-MC-003, V-MC-3
                            </pre>
                            <textarea
                                className="bulk-textarea"
                                rows={8}
                                placeholder="Paste CSV or spreadsheet columns here..."
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                            />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => setShowBulkModal(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn-primary" onClick={handleApplyBulkPaste}>
                                Apply to Table
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Correction / Reassignment Modal ── */}
            {correctingItem && (
                <div className="modal-backdrop" onClick={() => setCorrectingItem(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><ShieldAlert size={18} /> Roll Number Correction</h3>
                            <button type="button" className="btn-close" onClick={() => setCorrectingItem(null)}>×</button>
                        </div>
                        <form onSubmit={handleCorrectionSubmit}>
                            <div className="modal-body">
                                <p className="text-sm text-muted">
                                    Correcting roll number for <strong>{correctingItem.student?.name}</strong> ({correctingItem.academicYear}).
                                    This action will be logged in the permanent audit trail.
                                </p>

                                {correctionError && (
                                    <div className="alert-banner error-banner">
                                        <AlertTriangle size={16} />
                                        <span>{correctionError}</span>
                                    </div>
                                )}

                                <div className="form-field">
                                    <label>Current Roll Number</label>
                                    <input type="text" value={correctingItem.rollNo || 'None'} disabled />
                                </div>

                                <div className="form-field">
                                    <label>New Corrected Roll Number *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. V-MC-5"
                                        value={correctionRollNo}
                                        onChange={e => setCorrectionRollNo(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-field">
                                    <label>Reason for Correction *</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Explain why this roll number is being changed (e.g. Student Affairs roster correction)..."
                                        value={correctionReason}
                                        onChange={e => setCorrectionReason(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setCorrectingItem(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : 'Confirm Correction & Log Audit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignRollNumbers;
