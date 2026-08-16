import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import {
    Plus, Save, Trash2, Sliders, AlertTriangle, ArrowRight,
    CheckCircle2, Users, Award, ShieldAlert, History, RefreshCw,
    Clock, Hash, PlayCircle, Eye, ChevronRight
} from 'lucide-react';
import './AcademicSettings.css';

const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const AcademicSettings = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const roleLower = (user?.role || '').toLowerCase();
    const isAdmin = (roleLower === 'admin' || roleLower === 'superadmin') && user?.adminType !== 'user_management' && roleLower !== 'academicadmin';

    const [activeTab, setActiveTab] = useState('config'); // 'config' | 'promotion' | 'audit'

    // Config state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [maxYear, setMaxYear] = useState(6);
    const [departments, setDepartments] = useState([]);
    const [atRiskAttendanceThreshold, setAtRiskAttendanceThreshold] = useState(75);
    const [atRiskFailingThreshold, setAtRiskFailingThreshold] = useState(2);
    const [passMarkPercent, setPassMarkPercent] = useState(40);
    const [activeTerm, setActiveTerm] = useState('Semester 2');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('2025-2026');
    const [perYearActiveTerms, setPerYearActiveTerms] = useState({});

    // Promotion Engine State
    const [promoStep, setPromoStep] = useState(1); // 1: Select, 2: Preview & Adjust, 3: Executing / Results
    const [promoFromYear, setPromoFromYear] = useState('2025-2026');
    const [promoToYear, setPromoToYear] = useState('2026-2027');
    const [promoCohort, setPromoCohort] = useState('5th Year');
    const [promoDept, setPromoDept] = useState('Mechatronics Engineering');
    const [promoPreviewData, setPromoPreviewData] = useState(null);
    const [promoDecisions, setPromoDecisions] = useState({});
    const [promoRunning, setPromoRunning] = useState(false);
    const [promoRunResult, setPromoRunResult] = useState(null);

    // Audit Logs State
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);

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
                setActiveTerm(data?.activeTerm || 'Semester 2');
                setCurrentAcademicYear(data?.currentAcademicYear || '2025-2026');
                setPerYearActiveTerms(data?.perYearActiveTerms || {});
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

    const fetchAuditLogs = async () => {
        try {
            setAuditLoading(true);
            const { data } = await apiClient.get('/promotions/audit-logs');
            setAuditLogs(data?.logs || []);
        } catch (err) {
            console.error('Failed to load audit logs:', err);
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'audit') {
            fetchAuditLogs();
        }
    }, [activeTab]);

    if (!isAdmin) {
        return <div className="p-8 text-center glass-panel" style={{ margin: '2rem' }}>Unauthorized. System / Technical Admin access required.</div>;
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

    const handlePerYearOverrideChange = (yr, val) => {
        setPerYearActiveTerms(prev => ({
            ...prev,
            [yr]: val
        }));
    };

    const handleSaveConfig = async () => {
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
                activeTerm: String(activeTerm || 'Semester 2').trim(),
                currentAcademicYear: String(currentAcademicYear || '2025-2026').trim(),
                perYearActiveTerms: perYearActiveTerms
            };
            const { data } = await apiClient.put('/academic-config', payload);

            // Also update dynamic AcademicSettings threshold
            await apiClient.put('/promotions/settings', {
                key: 'attendanceQualificationThreshold',
                value: clamp(parseInt(atRiskAttendanceThreshold, 10) || 75, 0, 100),
            });

            setMaxYear(data?.maxYear ?? payload.maxYear);
            setDepartments(Array.isArray(data?.departments) ? data.departments : payload.departments);
            setAtRiskAttendanceThreshold(data?.atRiskAttendanceThreshold ?? payload.atRiskAttendanceThreshold);
            setAtRiskFailingThreshold(data?.atRiskFailingThreshold ?? payload.atRiskFailingThreshold);
            setPassMarkPercent(data?.passMarkPercent ?? payload.passMarkPercent);
            setActiveTerm(data?.activeTerm ?? payload.activeTerm);
            setCurrentAcademicYear(data?.currentAcademicYear ?? payload.currentAcademicYear);
            setPerYearActiveTerms(data?.perYearActiveTerms ?? payload.perYearActiveTerms);
            setSuccess('Academic settings & institutional thresholds saved successfully!');
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save academic settings');
        } finally {
            setSaving(false);
        }
    };

    // Promotion Engine: Preview Step
    const handleRunPreview = async () => {
        try {
            setLoading(true);
            setError('');
            const { data } = await apiClient.post('/promotions/preview', {
                fromYear: promoFromYear,
                toYear: promoToYear,
                cohortYearLevel: promoCohort,
                department: promoDept,
            });

            setPromoPreviewData(data);
            const initialDecisions = {};
            (data.students || []).forEach(s => {
                initialDecisions[s.studentId] = s.suggestedAction;
            });
            setPromoDecisions(initialDecisions);
            setPromoStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate promotion preview');
        } finally {
            setLoading(false);
        }
    };

    // Promotion Engine: Execute Step
    const handleExecutePromotion = async () => {
        if (!window.confirm(`Are you sure you want to execute Annual Promotion from ${promoFromYear} to ${promoToYear} for ${promoPreviewData?.students?.length || 0} students?`)) {
            return;
        }

        try {
            setPromoRunning(true);
            setError('');
            const decisionsArray = (promoPreviewData?.students || []).map(s => ({
                studentId: s.studentId,
                enrollmentId: s.enrollmentId,
                action: promoDecisions[s.studentId] || s.suggestedAction,
            }));

            const { data } = await apiClient.post('/promotions/execute', {
                fromYear: promoFromYear,
                toYear: promoToYear,
                cohortYearLevel: promoCohort,
                decisions: decisionsArray,
            });

            setPromoRunResult(data);
            setPromoStep(3);
            setSuccess('Promotion batch completed successfully!');
        } catch (err) {
            setError(err.response?.data?.message || 'Promotion execution failed');
        } finally {
            setPromoRunning(false);
        }
    };

    return (
        <div className="academic-settings-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Institutional Academic Management</h1>
                    <p className="subtitle">Academic calendar rules, annual student promotion engine, and roll number assignment.</p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate('/admin/assign-roll-numbers')}
                    >
                        <Hash size={16} /> Assign Roll Numbers
                    </button>
                    {activeTab === 'config' && (
                        <button type="button" className="btn btn-primary" onClick={handleSaveConfig} disabled={loading || saving}>
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    )}
                </div>
            </header>

            {/* ── Navigation Tabs ── */}
            <div className="settings-tabs-bar">
                <button
                    type="button"
                    className={`tab-item ${activeTab === 'config' ? 'active' : ''}`}
                    onClick={() => setActiveTab('config')}
                >
                    <Sliders size={16} /> General Settings & Thresholds
                </button>
                <button
                    type="button"
                    className={`tab-item ${activeTab === 'promotion' ? 'active' : ''}`}
                    onClick={() => setActiveTab('promotion')}
                >
                    <Users size={16} /> Annual Promotion Wizard
                </button>
                <button
                    type="button"
                    className={`tab-item ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    <History size={16} /> Promotion Audit Logs
                </button>
            </div>

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

            {/* ── TAB 1: General Institutional Config ── */}
            {activeTab === 'config' && (
                <div className="glass-panel academic-settings-card">
                    <div className="departments-header" style={{ marginBottom: '1.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sliders size={20} className="text-primary" />
                            <h3>Academic Session & Dynamic Thresholds</h3>
                        </div>
                    </div>

                    <div className="settings-form-grid">
                        <div className="form-group">
                            <label>Current Active Academic Year</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. 2025-2026"
                                value={currentAcademicYear}
                                onChange={(e) => setCurrentAcademicYear(e.target.value)}
                                disabled={loading || saving}
                            />
                        </div>

                        <div className="form-group">
                            <label>Attendance Qualification Threshold (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className="form-input"
                                value={atRiskAttendanceThreshold}
                                onChange={(e) => setAtRiskAttendanceThreshold(e.target.value)}
                                disabled={loading || saving}
                            />
                            <span className="text-muted text-xs">Students below this % are flagged as not qualified for annual promotion.</span>
                        </div>

                        <div className="form-group">
                            <label>Pass Mark Threshold (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className="form-input"
                                value={passMarkPercent}
                                onChange={(e) => setPassMarkPercent(e.target.value)}
                                disabled={loading || saving}
                            />
                        </div>

                        <div className="form-group">
                            <label>Global Default Active Term</label>
                            <select
                                className="form-select"
                                value={activeTerm}
                                onChange={(e) => setActiveTerm(e.target.value)}
                                disabled={loading || saving}
                            >
                                <option value="Semester 1">Semester 1</option>
                                <option value="Semester 2">Semester 2</option>
                            </select>
                        </div>
                    </div>

                    <div className="settings-divider" />

                    <div className="departments-header">
                        <h3>Academic Departments</h3>
                        <p className="text-muted">Code is used in roll numbers and email domain mapping (e.g. MC for Mechatronics).</p>
                    </div>

                    <div className="departments-table">
                        <div className="dept-row dept-head">
                            <div>Name</div>
                            <div>Code</div>
                            <div>Active</div>
                            <div />
                        </div>

                        {departments.map((dept, index) => (
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
                        ))}
                    </div>
                </div>
            )}

            {/* ── TAB 2: Annual Promotion Wizard ── */}
            {activeTab === 'promotion' && (
                <div className="glass-panel promotion-wizard-card">
                    {/* Step Bar */}
                    <div className="wizard-step-bar">
                        <div className={`step-node ${promoStep >= 1 ? 'active' : ''}`}>
                            <span className="step-num">1</span>
                            <span>Select Cohort</span>
                        </div>
                        <ChevronRight size={18} className="text-muted" />
                        <div className={`step-node ${promoStep >= 2 ? 'active' : ''}`}>
                            <span className="step-num">2</span>
                            <span>Review & Adjust</span>
                        </div>
                        <ChevronRight size={18} className="text-muted" />
                        <div className={`step-node ${promoStep >= 3 ? 'active' : ''}`}>
                            <span className="step-num">3</span>
                            <span>Execute & Verify</span>
                        </div>
                    </div>

                    {/* Step 1: Select Cohort */}
                    {promoStep === 1 && (
                        <div className="wizard-body">
                            <h3>Select Academic Year & Cohort</h3>
                            <p className="text-muted text-sm">
                                Advance a student cohort to the next academic year. Roll numbers will start unassigned and can be assigned manually via the Assign Roll Numbers screen.
                            </p>

                            <div className="wizard-form-grid">
                                <div className="form-group">
                                    <label>From Academic Year</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={promoFromYear}
                                        onChange={e => setPromoFromYear(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>To Academic Year (New)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={promoToYear}
                                        onChange={e => setPromoToYear(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cohort Year Level</label>
                                    <select
                                        className="form-select"
                                        value={promoCohort}
                                        onChange={e => setPromoCohort(e.target.value)}
                                    >
                                        <option value="1st Year">1st Year</option>
                                        <option value="2nd Year">2nd Year</option>
                                        <option value="3rd Year">3rd Year</option>
                                        <option value="4th Year">4th Year</option>
                                        <option value="5th Year">5th Year</option>
                                        <option value="6th Year">6th Year (Graduating Batch)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Department</label>
                                    <select
                                        className="form-select"
                                        value={promoDept}
                                        onChange={e => setPromoDept(e.target.value)}
                                    >
                                        <option value="Mechatronics Engineering">Mechatronics Engineering</option>
                                        <option value="Civil Engineering">Civil Engineering</option>
                                        <option value="Electrical Engineering">Electrical Engineering</option>
                                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                                        <option value="Information Technology">Information Technology</option>
                                    </select>
                                </div>
                            </div>

                            <div className="wizard-footer">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleRunPreview}
                                    disabled={loading}
                                >
                                    <PlayCircle size={18} /> Preview Promotion Roster
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Review Preview & Adjust Decisions */}
                    {promoStep === 2 && promoPreviewData && (
                        <div className="wizard-body">
                            <div className="preview-summary-box">
                                <div>
                                    <h4>Roster: {promoPreviewData.cohortYearLevel} ({promoPreviewData.fromYear} → {promoPreviewData.toYear})</h4>
                                    <span className="text-muted text-sm">
                                        Total: {promoPreviewData.totalStudents} students • Qualified ($\ge {promoPreviewData.attendanceThreshold}%$): {promoPreviewData.qualifiedCount}
                                    </span>
                                </div>
                                <button type="button" className="btn btn-secondary" onClick={() => setPromoStep(1)}>
                                    Back
                                </button>
                            </div>

                            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                                <table className="promo-table">
                                    <thead>
                                        <tr>
                                            <th>Student Name</th>
                                            <th>Permanent Reg No</th>
                                            <th>Current Roll</th>
                                            <th>Attendance</th>
                                            <th>Status</th>
                                            <th>Action Decision</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {promoPreviewData.students.map(s => {
                                            const decision = promoDecisions[s.studentId] || s.suggestedAction;
                                            return (
                                                <tr key={s.studentId}>
                                                    <td>
                                                        <strong>{s.name}</strong>
                                                        <div className="text-muted text-xs">{s.email}</div>
                                                    </td>
                                                    <td><span className="code-pill">{s.permanentRegNo}</span></td>
                                                    <td>{s.currentRollNo}</td>
                                                    <td>
                                                        <span className={`att-badge ${s.isQualified ? 'good' : 'warning'}`}>
                                                            {s.attendanceRate}%
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {s.isQualified ? (
                                                            <span className="text-success text-xs font-bold">Qualified</span>
                                                        ) : (
                                                            <span className="text-warning text-xs font-bold">Attendance Low</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="form-select decision-select"
                                                            value={decision}
                                                            onChange={e => setPromoDecisions(prev => ({
                                                                ...prev,
                                                                [s.studentId]: e.target.value
                                                            }))}
                                                        >
                                                            <option value="Promote">Promote ({s.targetYearLevel})</option>
                                                            <option value="HoldBack">Hold Back (Repeat Year)</option>
                                                            <option value="Graduate">Graduate (Degree Awarded)</option>
                                                            <option value="Withdraw">Withdraw</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="wizard-footer">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleExecutePromotion}
                                    disabled={promoRunning}
                                >
                                    <CheckCircle2 size={18} /> {promoRunning ? 'Executing Batch...' : 'Confirm & Execute Promotion'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Run Results */}
                    {promoStep === 3 && promoRunResult && (
                        <div className="wizard-body animate-fade-in">
                            <div className="run-result-banner">
                                <CheckCircle2 size={36} className="text-success" />
                                <div>
                                    <h3>Annual Promotion Execution Complete</h3>
                                    <p className="text-muted text-sm">
                                        Batch Run ID: <code>{promoRunResult.runId}</code> ({promoRunResult.fromYear} → {promoRunResult.toYear})
                                    </p>
                                </div>
                            </div>

                            <div className="stats-mini-grid">
                                <div className="stat-pill"><strong>{promoRunResult.promoted}</strong> Promoted</div>
                                <div className="stat-pill"><strong>{promoRunResult.heldBack}</strong> Held Back</div>
                                <div className="stat-pill"><strong>{promoRunResult.graduated}</strong> Graduated</div>
                                <div className="stat-pill"><strong>{promoRunResult.withdrawn}</strong> Withdrawn</div>
                                <div className="stat-pill error"><strong>{promoRunResult.failed}</strong> Failed</div>
                            </div>

                            <div className="wizard-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setPromoStep(1);
                                        setPromoRunResult(null);
                                        setPromoPreviewData(null);
                                    }}
                                >
                                    Start Another Promotion
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => navigate('/admin/assign-roll-numbers')}
                                >
                                    Go to Assign Roll Numbers <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB 3: Audit Logs ── */}
            {activeTab === 'audit' && (
                <div className="glass-panel audit-logs-card">
                    <div className="departments-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <History size={20} className="text-primary" />
                            <h3>Promotion & Student Lifecycle Audit Logs</h3>
                        </div>
                        <button type="button" className="btn btn-secondary" onClick={fetchAuditLogs}>
                            <RefreshCw size={16} className={auditLoading ? 'spin' : ''} /> Refresh
                        </button>
                    </div>

                    {auditLoading ? (
                        <div className="p-8 text-center"><Clock size={24} className="spin" /> Loading audit history...</div>
                    ) : auditLogs.length === 0 ? (
                        <div className="p-8 text-center text-muted">No promotion audit runs recorded yet.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="promo-table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Action</th>
                                        <th>Admin</th>
                                        <th>Session</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map(log => (
                                        <tr key={log._id}>
                                            <td className="text-muted text-xs">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </td>
                                            <td><strong>{log.action}</strong></td>
                                            <td>{log.performedBy?.name || 'System Admin'}</td>
                                            <td>{log.academicYear || 'N/A'}</td>
                                            <td>
                                                <div className="text-xs text-muted">
                                                    Processed: {log.details?.totalProcessed || 0} • Promoted: {log.details?.promoted || 0} • Held Back: {log.details?.heldBack || 0} • Run: {log.details?.runId || 'N/A'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AcademicSettings;
