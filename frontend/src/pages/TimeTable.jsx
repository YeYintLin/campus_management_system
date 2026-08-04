import React, { useCallback, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Clock, MapPin, Edit3, Save, X, Plus, Book, Monitor, Users, MessageSquare, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { getNormalizedUserYear } from '../utils/userYear';
import { exportAcademicMatrixExcel, exportDateScheduleExcel, exportExamScheduleExcel } from '../utils/excelExporter';
import './TimeTable.css';

const TU_HMAWBI_PERIODS = [
    { period: 1, label: 'Period 1', time: '09:00 - 09:50 AM', startMin: 540, endMin: 590, slotKey: '09:00 AM' },
    { period: 2, label: 'Period 2', time: '10:00 - 10:50 AM', startMin: 600, endMin: 650, slotKey: '10:00 AM' },
    { period: 3, label: 'Period 3', time: '11:00 - 11:50 AM', startMin: 660, endMin: 710, slotKey: '11:00 AM' },
    { period: 'LUNCH', label: 'LUNCH BREAK', time: '12:00 - 01:00 PM', isLunch: true },
    { period: 4, label: 'Period 4', time: '01:00 - 01:50 PM', startMin: 780, endMin: 830, slotKey: '01:00 PM' },
    { period: 5, label: 'Period 5', time: '02:00 - 02:50 PM', startMin: 840, endMin: 890, slotKey: '02:00 PM' },
    { period: 6, label: 'Period 6', time: '03:00 - 03:50 PM', startMin: 900, endMin: 950, slotKey: '03:00 PM' }
];

const TimeTable = () => {
    const { user } = useContext(AuthContext);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const canManageTimetable = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : '6th Year');
    const [selectedSemester, setSelectedSemester] = useState('Semester 1');
    const [selectedCategory, setSelectedCategory] = useState('Academic'); // 'Academic', 'Practical', 'Tutorial', 'Exam'
    const [selectedMajor, setSelectedMajor] = useState('MC');

    const [schedules, setSchedules] = useState({});
    const [dateSessions, setDateSessions] = useState([]);
    const [classSectionInfo, setClassSectionInfo] = useState({ familyTeacher: 'Daw Thin Yu Maw', majorRoom: '3/212-A' });
    const [loading, setLoading] = useState(true);

    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [tempCellData, setTempCellData] = useState({ course: '', room: '', type: 'Lecture', sessionLabel: 'Lecture' });

    // Excel import state
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');

    const years = isStudent ? [studentYear] : ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
    const semesters = ['Semester 1', 'Semester 2'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const majors = ['MC', 'EIE', 'CS', 'MECH', 'EE', 'EC', 'CE', 'ARCH'];

    const timetableCategories = [
        { id: 'Academic', label: '📖 Academic Timetable', desc: 'Weekly 6-Period Lecture Matrix' },
        { id: 'Practical', label: '🔬 Practical Timetable', desc: 'Date-based Experiment Sessions' },
        { id: 'Tutorial', label: '✍️ Tutorial Timetable', desc: 'Date-based Recitation Sessions' },
        { id: 'Exam', label: '📝 Exam Schedule', desc: 'Mid-Term & Final Examination Dates' }
    ];

    const fetchTimetableData = useCallback(async () => {
        setLoading(true);
        setImportError('');
        try {
            if (selectedCategory === 'Academic') {
                const { data } = await apiClient.get('/timetable', {
                    params: { year: selectedYear, semester: selectedSemester, major: selectedMajor }
                });
                
                const scheduleMap = {};
                if (Array.isArray(data) && data.length > 0) {
                    data.forEach(slot => {
                        if (slot && slot.day && slot.time) {
                            if (!scheduleMap[slot.day]) scheduleMap[slot.day] = {};
                            scheduleMap[slot.day][slot.time] = {
                                course: slot.courseCode || slot.course || '',
                                name: slot.courseName || '',
                                room: slot.room || '3/212-A',
                                type: slot.type || 'Lecture',
                                sessionLabel: slot.sessionLabel || 'Lecture'
                            };
                        }
                    });
                }
                setSchedules(scheduleMap);
            } else {
                const { data } = await apiClient.get('/sessions', {
                    params: { year: selectedYear, semester: selectedSemester, major: selectedMajor, sessionType: selectedCategory }
                });
                setDateSessions(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch timetable:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedSemester, selectedCategory, selectedMajor]);

    useEffect(() => {
        fetchTimetableData();
    }, [fetchTimetableData]);

    const handleFileUploadClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        setImportError('');
        setImportSuccess('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('year', selectedYear);
        formData.append('semester', selectedSemester);
        formData.append('major', selectedMajor);
        formData.append('sessionType', selectedCategory);

        try {
            const { data } = await apiClient.post('/sessions/batch-import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportSuccess(data.message || 'Imported timetable successfully!');
            fetchTimetableData();
            setTimeout(() => setImportSuccess(''), 5000);
        } catch (err) {
            console.error('Import failed:', err);
            setImportError(err.response?.data?.message || 'Failed to import Excel file.');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const handleExportOfficialExcel = () => {
        if (selectedCategory === 'Academic') {
            exportAcademicMatrixExcel(selectedYear, selectedSemester, selectedMajor, classSectionInfo.familyTeacher, classSectionInfo.majorRoom, schedules);
        } else if (selectedCategory === 'Exam') {
            exportExamScheduleExcel(selectedYear, selectedSemester, selectedMajor, 'Mid-Term', dateSessions);
        } else {
            exportDateScheduleExcel(selectedCategory, selectedYear, selectedSemester, selectedMajor, dateSessions);
        }
    };

    return (
        <div className="timetable-page animate-fade-in">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
            />

            <header className="page-header">
                <div>
                    <h1>Technological University (Hmawbi) Timetable</h1>
                    <p className="subtitle">Official Academic, Practical, Tutorial & Examination Schedules</p>
                </div>
                <div className="header-actions">
                    {canManageTimetable && (
                        <>
                            <button className="btn btn-secondary-glass" onClick={handleExportOfficialExcel} title="Export Official TU Hmawbi Excel File">
                                <Download size={18} />
                                Export Official Excel
                            </button>
                            <button className="btn btn-primary" onClick={handleFileUploadClick} disabled={importing}>
                                <Upload size={18} />
                                {importing ? 'Parsing...' : 'Import Excel Sheet'}
                            </button>
                        </>
                    )}
                </div>
            </header>

            {importSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={18} />
                    <span>{importSuccess}</span>
                </div>
            )}

            {importError && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} />
                    <span>{importError}</span>
                </div>
            )}

            {/* 4 Category Tabs */}
            <div className="glass-panel" style={{ padding: '0.6rem 1rem', borderRadius: '16px', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {timetableCategories.map(cat => (
                    <button
                        key={cat.id}
                        className={`btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary-glass'}`}
                        onClick={() => setSelectedCategory(cat.id)}
                        style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: '700', borderRadius: '12px' }}
                        title={cat.desc}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Filters: Year, Semester & Major */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div className="year-filter-bar glass-panel" style={{ margin: 0 }}>
                    {years.map(year => (
                        <button key={year} className={`year-tag ${selectedYear === year ? 'active' : ''}`} onClick={() => setSelectedYear(year)}>
                            {year}
                        </button>
                    ))}
                </div>

                <div className="year-filter-bar semester-filter-bar glass-panel" style={{ margin: 0 }}>
                    {semesters.map(sem => (
                        <button key={sem} className={`year-tag ${selectedSemester === sem ? 'active' : ''}`} onClick={() => setSelectedSemester(sem)}>
                            {sem}
                        </button>
                    ))}
                </div>

                <select className="form-input" style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: '12px' }} value={selectedMajor} onChange={e => setSelectedMajor(e.target.value)}>
                    {majors.map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>Dept: {m}</option>)}
                </select>
            </div>

            {/* Official Schedule Header Card */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', borderLeft: '4px solid #6366f1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                            Technological University (Hmawbi) — {selectedYear} ({selectedSemester})
                        </h3>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Department of {selectedMajor} Engineering | Family Teacher: <strong style={{ color: '#818cf8' }}>{classSectionInfo.familyTeacher}</strong> | Major Room: <strong style={{ color: '#4ade80' }}>{classSectionInfo.majorRoom}</strong>
                        </p>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                        {selectedCategory} View
                    </span>
                </div>
            </div>

            {/* MAIN SCHEDULE VIEW */}
            <div className="glass-panel timetable-wrapper" style={{ padding: '1.25rem', borderRadius: '20px' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>Loading {selectedCategory} timetable...</p>
                    </div>
                ) : selectedCategory === 'Academic' ? (
                    /* 6-PERIOD ACADEMIC MATRIX GRID */
                    <div className="table-container">
                        <table className="timetable-grid">
                            <thead>
                                <tr>
                                    <th style={{ width: '120px' }}>Day</th>
                                    {TU_HMAWBI_PERIODS.map((p, idx) => (
                                        <th key={idx} style={{ background: p.isLunch ? 'rgba(239,68,68,0.1)' : 'transparent', color: p.isLunch ? '#f87171' : 'inherit' }}>
                                            <div>{p.label}</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.8 }}>{p.time}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {days.map(day => (
                                    <tr key={day}>
                                        <td className="day-cell"><strong>{day}</strong></td>
                                        {TU_HMAWBI_PERIODS.map((p, pIdx) => {
                                            if (p.isLunch) {
                                                return (
                                                    <td key={pIdx} style={{ background: 'rgba(239,68,68,0.06)', color: '#f87171', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '700', textAlign: 'center', letterSpacing: '0.05em' }}>
                                                        LUNCH BREAK<br /><span style={{ fontSize: '0.7rem', fontWeight: '400' }}>12:00 to 1:00 pm</span>
                                                    </td>
                                                );
                                            }

                                            const session = schedules[day]?.[p.slotKey];
                                            return (
                                                <td key={pIdx} className="slot-cell">
                                                    {session ? (
                                                        <div className="session-block glass-panel hover-glow" style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#818cf8' }}>{session.course}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                <MapPin size={10} /> <span>{session.room}</span>
                                                            </div>
                                                            <span style={{ display: 'inline-block', marginTop: '0.3rem', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                                                                {session.sessionLabel}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>- Free -</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* DATE-BASED SCHEDULE TABLE (Practical / Tutorial / Exam) */
                    <div>
                        {dateSessions.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <p>No {selectedCategory} sessions scheduled for {selectedYear} ({selectedSemester}).</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="timetable-grid" style={{ width: '100%', textAlign: 'left' }}>
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Subject Code</th>
                                            <th>{selectedCategory} Title</th>
                                            <th>Teacher</th>
                                            <th>Student (Group)</th>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Place</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dateSessions.map((s, idx) => (
                                            <tr key={s._id || idx}>
                                                <td><span className="badge badge-primary">{s.year}</span></td>
                                                <td><strong style={{ color: '#818cf8' }}>{s.courseCode}</strong></td>
                                                <td><strong style={{ color: '#fff' }}>{s.title || s.courseName}</strong></td>
                                                <td style={{ color: 'var(--text-muted)' }}>{s.teacher || 'Faculty Member'}</td>
                                                <td><span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)' }}>{s.groupTag}</span></td>
                                                <td style={{ color: '#4ade80', fontWeight: '600' }}>{new Date(s.date).toLocaleDateString()}</td>
                                                <td style={{ fontSize: '0.85rem' }}>{s.startTime} - {s.endTime}</td>
                                                <td><span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}><MapPin size={12} />{s.place}</span></td>
                                                <td>
                                                    <span className={`badge ${s.status === 'Published' ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.75rem' }}>
                                                        {s.status}
                                                    </span>
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
        </div>
    );
};

export default TimeTable;
