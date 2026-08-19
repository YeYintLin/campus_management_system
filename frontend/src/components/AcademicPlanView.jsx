import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, FileText, Image as ImageIcon, Download, Maximize2, X, AlertCircle } from 'lucide-react';
import apiClient from '../api/apiClient';
import './AcademicPlanView.css';

const AcademicPlanView = ({ canManageTimetable }) => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('all-years-2025-2026-closing');
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxMedia, setLightboxMedia] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchAcademicPlans();
    }, []);

    const fetchAcademicPlans = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await apiClient.get('/academic-plan');
            if (Array.isArray(res.data) && res.data.length > 0) {
                setPlans(res.data);
            } else {
                // Fallback default structure
                setPlans([]);
            }
        } catch (err) {
            console.error('Failed to load academic plan:', err);
            setError('Unable to load official academic plan from server.');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e, tableId) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('tableId', tableId);

        try {
            setUploading(true);
            const res = await apiClient.post('/academic-plan/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data?.documentUrl) {
                fetchAcademicPlans();
            }
        } catch (err) {
            console.error('Photo upload failed:', err);
            alert(err.response?.data?.message || 'Failed to upload plan document.');
        } finally {
            setUploading(false);
        }
    };

    const currentPlan = plans.find(p => p.appliesTo === activeTab) || plans[0];

    const getCategoryBadgeClass = (category) => {
        switch (category) {
            case 'Registration': return 'badge-cat-reg';
            case 'Opening': return 'badge-cat-open';
            case 'Teaching': return 'badge-cat-teach';
            case 'Study': return 'badge-cat-study';
            case 'Exam': return 'badge-cat-exam';
            case 'Grading': return 'badge-cat-grade';
            case 'Vacation': return 'badge-cat-vac';
            case 'Results': return 'badge-cat-res';
            default: return 'badge-cat-default';
        }
    };

    if (loading) {
        return (
            <div className="academic-plan-loading glass-panel">
                <Clock className="spin" size={28} />
                <p>Loading Official Academic Plan Schedule...</p>
            </div>
        );
    }

    return (
        <div className="academic-plan-container animate-fade-in">
            {/* Header / Department Banner */}
            <div className="academic-plan-header glass-card">
                <div className="dept-crest">
                    <Calendar size={32} color="var(--primary-color)" />
                </div>
                <div className="header-text">
                    <span className="gov-dept-tag">အဆင့်မြင့်သိပ္ပံနှင့်နည်းပညာဦးစီးဌာန • Department of Higher Science and Technology</span>
                    <h2>{currentPlan?.titleMy || 'သင်တန်းကာလအစီအစဉ်'}</h2>
                    <p className="subtitle-en">{currentPlan?.titleEn || 'Official Academic Calendar & Milestone Timeline'}</p>
                </div>
            </div>

            {/* Sub-Tabs: Table A vs Table B */}
            <div className="plan-cycle-tabs glass-panel">
                <button
                    className={`cycle-tab-btn ${activeTab === 'all-years-2025-2026-closing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all-years-2025-2026-closing')}
                >
                    <div className="tab-pill-title">
                        <span className="table-badge">Table A</span>
                        <strong>၂၀၂၅-၂၀၂၆ ပညာသင်နှစ် (ပထမနှစ်ဝက်)</strong>
                    </div>
                    <span className="tab-pill-desc">All Existing Years (1st - 6th Year & ME) Closing Cycle</span>
                </button>

                <button
                    className={`cycle-tab-btn ${activeTab === '2nd-year-sem2-and-incoming-1st-year-sem1-2026-2027' ? 'active' : ''}`}
                    onClick={() => setActiveTab('2nd-year-sem2-and-incoming-1st-year-sem1-2026-2027')}
                >
                    <div className="tab-pill-title">
                        <span className="table-badge">Table B</span>
                        <strong>၂၀၂၅-၂၀၂၆ ဒုတိယနှစ်ဝက် & ၂၀၂၆-၂၀၂၇ ပထမနှစ်ဝက်</strong>
                    </div>
                    <span className="tab-pill-desc">2nd Year Sem 2 & Incoming 1st Year Sem 1 Cycle</span>
                </button>
            </div>

            {/* Main Milestone Table Card */}
            <div className="glass-card plan-table-card">
                <div className="plan-table-header">
                    <div className="table-header-left">
                        <span className="academic-badge">{currentPlan?.academicYear}</span>
                        <span className="semester-badge">{currentPlan?.semester || 'Full Cycle'}</span>
                    </div>

                    <div className="table-header-right">
                        {currentPlan?.documentUrl && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    setLightboxMedia(currentPlan.documentUrl);
                                    setIsLightboxOpen(true);
                                }}
                            >
                                <ImageIcon size={15} />
                                View Original Scan
                            </button>
                        )}

                        {canManageTimetable && (
                            <label className="btn btn-primary btn-sm upload-plan-btn">
                                <FileText size={15} />
                                {uploading ? 'Uploading...' : 'Upload Official Scan'}
                                <input
                                    type="file"
                                    accept="image/*, .pdf"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handlePhotoUpload(e, currentPlan?.tableId || 'table-a')}
                                />
                            </label>
                        )}
                    </div>
                </div>

                <div className="table-responsive plan-table-wrap">
                    <table className="official-plan-table">
                        <thead>
                            <tr>
                                <th style={{ width: '60px' }}>စဉ် (Sr)</th>
                                <th>အကြောင်းအရာ (Milestone Description)</th>
                                <th style={{ width: '130px' }}>မှ (From)</th>
                                <th style={{ width: '130px' }}>ထိ (To)</th>
                                <th style={{ width: '160px' }}>ကြာမြင့်ချိန် (Duration)</th>
                                <th style={{ width: '110px' }}>အခြေအနေ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentPlan?.milestones?.map((m) => (
                                <tr key={m.sr} className={m.isCurrent ? 'row-current-phase' : m.isCompleted ? 'row-completed' : ''}>
                                    <td className="cell-sr font-mono font-bold">{m.sr}</td>
                                    <td className="cell-title">
                                        <div className="title-my">{m.titleMy}</div>
                                        <div className="title-en">{m.titleEn}</div>
                                    </td>
                                    <td className="cell-date font-mono">{m.startDate}</td>
                                    <td className="cell-date font-mono">{m.endDate || '—'}</td>
                                    <td className="cell-duration">
                                        <span className={`category-pill ${getCategoryBadgeClass(m.category)}`}>
                                            {m.duration}
                                        </span>
                                    </td>
                                    <td className="cell-status">
                                        {m.isCurrent ? (
                                            <span className="status-live-tag">
                                                <span className="live-dot" />
                                                Active
                                            </span>
                                        ) : m.isCompleted ? (
                                            <span className="status-done-tag">
                                                <CheckCircle2 size={14} />
                                                Done
                                            </span>
                                        ) : (
                                            <span className="status-pending-tag">Upcoming</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Official Seal Notice */}
                <div className="plan-table-footer">
                    <p>
                        * ဤသင်တန်းကာလအစီအစဉ်သည် အဆင့်မြင့်သိပ္ပံနှင့်နည်းပညာဦးစီးဌာန၏ တရားဝင်သတ်မှတ်ချက်အတိုင်းဖြစ်ပါသည်။ (Official Ministry Schedule)
                    </p>
                </div>
            </div>

            {/* Lightbox Modal for Scanned Document */}
            {isLightboxOpen && lightboxMedia && (
                <div className="plan-lightbox-overlay animate-fade-in" onClick={() => setIsLightboxOpen(false)}>
                    <div className="plan-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <div className="lightbox-bar">
                            <span>Official Academic Plan Scan</span>
                            <div className="lightbox-actions">
                                <a href={lightboxMedia} download className="icon-btn" title="Download">
                                    <Download size={18} />
                                </a>
                                <button className="icon-btn" onClick={() => setIsLightboxOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="lightbox-body">
                            <img src={lightboxMedia} alt="Official Academic Plan Document" className="scanned-image-preview" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicPlanView;
