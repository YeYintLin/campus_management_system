import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Plus, Save, Trash2, Sliders, AlertTriangle } from 'lucide-react';
import './AcademicSettings.css';

const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const AcademicSettings = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'AcademicAdmin';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [maxYear, setMaxYear] = useState(6);
    const [departments, setDepartments] = useState([]);
    const [atRiskAttendanceThreshold, setAtRiskAttendanceThreshold] = useState(75);
    const [atRiskFailingThreshold, setAtRiskFailingThreshold] = useState(2);
    const [passMarkPercent, setPassMarkPercent] = useState(40);

    useEffect(() => {
        if (!isAdmin) return;
        const fetchConfig = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await apiClient.get('/academic-config');
                setMaxYear(data?.maxYear ?? 6);
                setDepartments(Array.isArray(data?.departments) ? data.departments : []);
                setAtRiskAttendanceThreshold(data?.atRiskAttendanceThreshold ?? 75);
                setAtRiskFailingThreshold(data?.atRiskFailingThreshold ?? 2);
                setPassMarkPercent(data?.passMarkPercent ?? 40);
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Failed to load academic settings');
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [isAdmin]);

    const activeDepartments = useMemo(
        () => departments.filter(d => d?.name && d?.code),
        [departments]
    );

    if (!isAdmin) {
        return <div className="p-8 text-center glass-panel">Unauthorized. Administrative access required.</div>;
    }

    const addDepartment = () => {
        setDepartments(prev => [...prev, { name: '', code: '', active: true }]);
        setSuccess('');
    };

    const removeDepartment = (index) => {
        setDepartments(prev => prev.filter((_, i) => i !== index));
        setSuccess('');
    };

    const updateDepartment = (index, patch) => {
        setDepartments(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
        setSuccess('');
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const payload = {
                maxYear: clamp(parseInt(maxYear, 10) || 6, 1, 12),
                departments: activeDepartments.map(d => ({
                    name: String(d.name || '').trim(),
                    code: String(d.code || '').trim(),
                    active: d.active !== false,
                })),
                atRiskAttendanceThreshold: clamp(parseInt(atRiskAttendanceThreshold, 10) || 75, 0, 100),
                atRiskFailingThreshold: clamp(parseInt(atRiskFailingThreshold, 10) || 2, 1, 10),
                passMarkPercent: clamp(parseInt(passMarkPercent, 10) || 40, 0, 100),
            };
            const { data } = await apiClient.put('/academic-config', payload);
            setMaxYear(data?.maxYear ?? payload.maxYear);
            setDepartments(Array.isArray(data?.departments) ? data.departments : payload.departments);
            setAtRiskAttendanceThreshold(data?.atRiskAttendanceThreshold ?? payload.atRiskAttendanceThreshold);
            setAtRiskFailingThreshold(data?.atRiskFailingThreshold ?? payload.atRiskFailingThreshold);
            setPassMarkPercent(data?.passMarkPercent ?? payload.passMarkPercent);
            setSuccess('Academic settings saved successfully!');
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save academic settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="academic-settings-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Academic Settings</h1>
                    <p className="subtitle">Configure institutional rules, departments, and dynamic at-risk thresholds.</p>
                </div>
                <div className="header-actions">
                    <button type="button" className="btn btn-secondary" onClick={addDepartment} disabled={loading || saving}>
                        <Plus size={18} />
                        Add Department
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {error && (
                <div className="glass-panel empty-state" style={{ marginBottom: '1rem', color: '#fb7185' }}>
                    <p>{error}</p>
                </div>
            )}
            {success && (
                <div className="glass-panel empty-state" style={{ marginBottom: '1rem', color: 'var(--success)' }}>
                    <p>{success}</p>
                </div>
            )}

            <div className="glass-panel academic-settings-card">
                {/* ── Section: Academic Rules & Thresholds ── */}
                <div className="departments-header" style={{ marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sliders size={20} className="text-primary" />
                        <h3>Academic Rules & At-Risk Thresholds</h3>
                    </div>
                    <p className="text-muted">These rules automatically calculate at-risk students on the dashboard.</p>
                </div>

                <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginBottom: '1.5rem' }}>
                    <div className="form-group">
                        <label className="form-label">Max Academic Years</label>
                        <input
                            type="number"
                            className="form-input"
                            min="1"
                            max="12"
                            value={maxYear}
                            onChange={(e) => setMaxYear(e.target.value)}
                            disabled={loading || saving}
                        />
                        <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>Program length (e.g. 6 years)</span>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Min. Attendance Threshold (%)</label>
                        <input
                            type="number"
                            className="form-input"
                            min="0"
                            max="100"
                            value={atRiskAttendanceThreshold}
                            onChange={(e) => setAtRiskAttendanceThreshold(e.target.value)}
                            disabled={loading || saving}
                        />
                        <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>Below this % flags student as at-risk</span>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Max Failing Subjects Count</label>
                        <input
                            type="number"
                            className="form-input"
                            min="1"
                            max="10"
                            value={atRiskFailingThreshold}
                            onChange={(e) => setAtRiskFailingThreshold(e.target.value)}
                            disabled={loading || saving}
                        />
                        <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>Failing ≥ this many subjects flags student</span>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Subject Pass Mark (%)</label>
                        <input
                            type="number"
                            className="form-input"
                            min="0"
                            max="100"
                            value={passMarkPercent}
                            onChange={(e) => setPassMarkPercent(e.target.value)}
                            disabled={loading || saving}
                        />
                        <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>Score % required to pass a subject</span>
                    </div>
                </div>

                <div className="settings-divider" />

                {/* ── Section: Departments ── */}
                <div className="departments-header">
                    <h3>Departments</h3>
                    <p className="text-muted">Code is used in enrollment number (e.g. I-MC-001).</p>
                </div>

                <div className="departments-table">
                    <div className="dept-row dept-head">
                        <div>Name</div>
                        <div>Code</div>
                        <div>Active</div>
                        <div />
                    </div>

                    {loading ? (
                        <div className="dept-empty">Loading...</div>
                    ) : departments.length === 0 ? (
                        <div className="dept-empty">No departments yet. Click “Add Department”.</div>
                    ) : (
                        departments.map((dept, index) => (
                            <div className="dept-row" key={`${dept.code}-${index}`}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Department name"
                                    value={dept?.name || ''}
                                    onChange={(e) => updateDepartment(index, { name: e.target.value })}
                                    disabled={saving}
                                />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Code (e.g. MC)"
                                    value={dept?.code || ''}
                                    onChange={(e) => updateDepartment(index, { code: e.target.value })}
                                    disabled={saving}
                                />
                                <label className="dept-active">
                                    <input
                                        type="checkbox"
                                        checked={dept?.active !== false}
                                        onChange={(e) => updateDepartment(index, { active: e.target.checked })}
                                        disabled={saving}
                                    />
                                    <span>{dept?.active !== false ? 'Yes' : 'No'}</span>
                                </label>
                                <button
                                    type="button"
                                    className="btn btn-secondary dept-delete"
                                    onClick={() => removeDepartment(index)}
                                    disabled={saving}
                                    title="Remove department"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AcademicSettings;
