import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Plus, Save, Trash2 } from 'lucide-react';
import './AcademicSettings.css';

const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const AcademicSettings = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [maxYear, setMaxYear] = useState(6);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        if (!isAdmin) return;
        const fetchConfig = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await apiClient.get('/academic-config');
                setMaxYear(data?.maxYear ?? 6);
                setDepartments(Array.isArray(data?.departments) ? data.departments : []);
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
            };
            const { data } = await apiClient.put('/academic-config', payload);
            setMaxYear(data?.maxYear ?? payload.maxYear);
            setDepartments(Array.isArray(data?.departments) ? data.departments : payload.departments);
            setSuccess('Saved!');
            setTimeout(() => setSuccess(''), 1500);
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
                    <p className="subtitle">Manage departments and year range used for student enrollment numbers.</p>
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
                <div className="glass-panel empty-state" style={{ marginBottom: '1rem' }}>
                    <p>{error}</p>
                </div>
            )}
            {success && (
                <div className="glass-panel empty-state" style={{ marginBottom: '1rem', color: 'var(--success)' }}>
                    <p>{success}</p>
                </div>
            )}

            <div className="glass-panel academic-settings-card">
                <div className="settings-row">
                    <div className="form-group">
                        <label className="form-label">Max Year</label>
                        <input
                            type="number"
                            className="form-input"
                            min="1"
                            max="12"
                            value={maxYear}
                            onChange={(e) => setMaxYear(e.target.value)}
                            disabled={loading || saving}
                        />
                    </div>
                </div>

                <div className="settings-divider" />

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
