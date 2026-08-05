import React, { useCallback, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Clock, MapPin, Edit3, Save, X, Plus, Book, Monitor, Users, MessageSquare, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Coffee } from 'lucide-react';
import { getNormalizedUserYear } from '../utils/userYear';
import { exportAcademicMatrixExcel, exportDateScheduleExcel, exportExamScheduleExcel } from '../utils/excelExporter';
import './TimeTable.css';

const TU_HMAWBI_PERIODS = [
    { period: 1, label: 'Period 1', time: '09:00 - 09:50 AM', slotKey: '09:00 AM' },
    { period: 2, label: 'Period 2', time: '10:00 - 10:50 AM', slotKey: '10:00 AM' },
    { period: 3, label: 'Period 3', time: '11:00 - 11:50 AM', slotKey: '11:00 AM' },
    { period: 'LUNCH', label: 'Lunch Break', time: '12:00 - 01:00 PM', isLunch: true },
    { period: 4, label: 'Period 4', time: '01:00 - 01:50 PM', slotKey: '01:00 PM' },
    { period: 5, label: 'Period 5', time: '02:00 - 02:50 PM', slotKey: '02:00 PM' },
    { period: 6, label: 'Period 6', time: '03:00 - 03:50 PM', slotKey: '03:00 PM' }
];

const TimeTable = () => {
    const { user } = useContext(AuthContext);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const canManageTimetable = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const getCurrentWeekday = () => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = dayNames[new Date().getDay()];
        return (today === 'Saturday' || today === 'Sunday') ? 'Monday' : today;
    };

    const actualToday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : '6th Year');
    const [selectedSemester, setSelectedSemester] = useState('Semester 1');
    const [selectedCategory, setSelectedCategory] = useState('Academic'); // 'Academic', 'Practical', 'Tutorial', 'Exam'
    const [selectedMajor, setSelectedMajor] = useState('MC');
    const [selectedMobileDay, setSelectedMobileDay] = useState(getCurrentWeekday);

    const [schedules, setSchedules] = useState({});
    const [dateSessions, setDateSessions] = useState([]);
    const [classSectionInfo, setClassSectionInfo] = useState({ familyTeacher: 'Daw Thin Yu Maw', majorRoom: '3/212-A' });
    const [loading, setLoading] = useState(true);

    // Excel import state
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');

    const years = isStudent ? [studentYear] : ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];
    const semesters = ['Semester 1', 'Semester 2'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const majors = ['MC', 'EIE', 'CS', 'MECH', 'EE', 'EC', 'CE', 'ARCH'];

    const timetableCategories = [
        { id: 'Academic', label: '📖 Academic Timetable', desc: 'Weekly 6-Period Lecture Matrix' },
        { id: 'Practical', label: '🔬 Practical Timetable', desc: 'Date-based Experiment Sessions' },
        { id: 'Tutorial', label: '✍️ Tutorial Timetable', desc: 'Date-based Recitation Sessions' },
        { id: 'Exam', label: '📝 Exam Schedule', desc: 'Mid-Term & Final Examination Dates' }
    ];

    const parseYearNum = (yearStr) => {
        if (!yearStr) return null;
        const match = String(yearStr).match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    };

    const parseSemNum = (semStr) => {
        if (!semStr) return null;
        const match = String(semStr).match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    };

    const fetchTimetableData = useCallback(async () => {
        setLoading(true);
        setImportError('');
        try {
            const yNum = parseYearNum(selectedYear);
            const sNum = parseSemNum(selectedSemester);

            const params = {
                year: yNum || selectedYear,
                semester: sNum || selectedSemester,
                major: selectedMajor
            };

            const { data } = await apiClient.get('/timetable', { params });
            
            const semDoc = Array.isArray(data) ? null : data?.semesterDoc;
            const secObj = Array.isArray(data) ? null : data?.classSection;
            const slotsList = Array.isArray(data) ? data : (data?.slots || []);

            let fTeacher = semDoc?.familyTeacher || secObj?.familyTeacher || 'Faculty Member';
            let mRoom = semDoc?.majorRoom || secObj?.majorRoom || '3/212-A';

            const scheduleMap = {};
            if (slotsList.length > 0) {
                slotsList.forEach(slot => {
                    if (slot && slot.day && (slot.startTime || slot.time)) {
                        const slotType = slot.type || 'Lecture';

                        // In Practical/Tutorial tabs, filter specifically; in Academic tab, show complete weekly matrix
                        if (selectedCategory === 'Practical' && !['practical', 'lab'].includes(slotType.toLowerCase())) return;
                        if (selectedCategory === 'Tutorial' && slotType.toLowerCase() !== 'tutorial') return;

                        const timeKey = slot.startTime || slot.time;
                        if (!scheduleMap[slot.day]) scheduleMap[slot.day] = {};
                        scheduleMap[slot.day][timeKey] = {
                            course: slot.courseCode || slot.course || '',
                            name: slot.courseName || '',
                            room: slot.room || mRoom,
                            type: slotType,
                            sessionLabel: slot.sessionLabel || slotType
                        };
                        if (slot.room) mRoom = slot.room;
                        if (slot.classSection?.familyTeacher) fTeacher = slot.classSection.familyTeacher;
                        if (slot.classSection?.majorRoom) mRoom = slot.classSection.majorRoom;
                    }
                });
            }

            setClassSectionInfo({ familyTeacher: fTeacher, majorRoom: mRoom });
            setSchedules(scheduleMap);

            if (selectedCategory !== 'Academic') {
                try {
                    const { data: dateData } = await apiClient.get('/sessions', {
                        params: { year: selectedYear, semester: selectedSemester, major: selectedMajor, sessionType: selectedCategory }
                    });
                    setDateSessions(Array.isArray(dateData) ? dateData : []);
                } catch (e) {
                    setDateSessions([]);
                }
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

    const [availableSemesters, setAvailableSemesters] = useState(['Semester 1', 'Semester 2']);

    useEffect(() => {
        const loadSemesters = async () => {
            try {
                const { data } = await apiClient.get('/timetable/semesters', { params: { year: selectedYear } });
                if (Array.isArray(data) && data.length > 0) {
                    const fetchedSems = Array.from(new Set(data.map(s => s.semesterLabel).filter(Boolean)));
                    if (fetchedSems.length > 0) {
                        setAvailableSemesters(fetchedSems);
                        if (!fetchedSems.includes(selectedSemester)) {
                            setSelectedSemester(fetchedSems[0]);
                        }
                    }
                } else {
                    setAvailableSemesters(['Semester 1', 'Semester 2']);
                }
            } catch (e) {
                setAvailableSemesters(['Semester 1', 'Semester 2']);
            }
        };
        loadSemesters();
    }, [selectedYear]);

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
            setImportError(err.response?.data?.message || err.response?.data?.error || 'Failed to import Excel file.');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const handleExportOfficialExcel = async () => {
        try {
            const response = await apiClient.get('/timetable/export', { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Official_Time_Table_${selectedYear}_${selectedSemester}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Exporting original file failed, falling back to generator:', err);
            if (selectedCategory === 'Academic') {
                exportAcademicMatrixExcel(selectedYear, selectedSemester, selectedMajor, classSectionInfo.familyTeacher, classSectionInfo.majorRoom, schedules);
            } else if (selectedCategory === 'Exam') {
                exportExamScheduleExcel(selectedYear, selectedSemester, selectedMajor, 'Mid-Term', dateSessions);
            } else {
                exportDateScheduleExcel(selectedCategory, selectedYear, selectedSemester, selectedMajor, dateSessions);
            }
        }
    };

    const getTypeClass = (type = '') => {
        const t = type.toLowerCase();
        if (t.includes('lab') || t.includes('practical')) return 'tier-lab';
        if (t.includes('seminar')) return 'tier-seminar';
        if (t.includes('tutorial')) return 'tier-tutorial';
        return 'tier-lecture';
    };

    const formatCourseDisplayName = (code = '', name = '') => {
        const raw = (code || name || '').trim();
        if (raw.toLowerCase().includes('extra-cirruculum') || raw.toLowerCase().includes('extracurricular') || raw.toLowerCase().includes('extra-curriculum') || raw.toLowerCase().includes('extra cirruculum')) {
            return 'Extra Activity';
        }
        return raw;
    };

    const hasAnySlots = Object.values(schedules).some(dayObj => Object.values(dayObj || {}).some(slot => slot && slot.course));

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
                    <h1>Timetable</h1>
                    <p className="subtitle">Manage and track your weekly academic schedule</p>
                </div>
                <div className="header-actions">
                    {canManageTimetable && (
                        <>
                            <button className="btn btn-secondary" onClick={handleExportOfficialExcel} title="Export Official TU Hmawbi Excel File">
                                <Download size={18} />
                                Export Excel
                            </button>
                            <button className="btn btn-primary" onClick={handleFileUploadClick} disabled={importing}>
                                <Upload size={18} />
                                {importing ? 'Parsing...' : 'Import Excel'}
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

            {/* Category Filter Pills */}
            <div className="year-filter-bar glass-panel" style={{ marginBottom: '1rem' }}>
                {timetableCategories.map(cat => (
                    <button
                        key={cat.id}
                        className={`year-tag ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                        title={cat.desc}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Academic Year Pills */}
            <div className="year-filter-bar glass-panel">
                {years.map(year => (
                    <button key={year} className={`year-tag ${selectedYear === year ? 'active' : ''}`} onClick={() => setSelectedYear(year)}>
                        {year}
                    </button>
                ))}
            </div>

            {/* Semester & Major Filters */}
            <div className="year-filter-bar semester-filter-bar glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {availableSemesters.map(sem => (
                        <button key={sem} className={`year-tag ${selectedSemester === sem ? 'active' : ''}`} onClick={() => setSelectedSemester(sem)}>
                            {sem}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dept:</span>
                    <select
                        className="form-input"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', color: '#fff', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                        value={selectedMajor}
                        onChange={e => setSelectedMajor(e.target.value)}
                    >
                        {majors.map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
                    </select>
                </div>
            </div>

            {/* Class Section Info Bar */}
            <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Technological University (Hmawbi) — <strong style={{ color: '#fff' }}>{selectedYear} ({selectedSemester})</strong> | Dept: <strong style={{ color: '#818cf8' }}>{selectedMajor}</strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Family Teacher: <span style={{ color: '#4ade80', fontWeight: '600' }}>{classSectionInfo.familyTeacher}</span> | Room: <span style={{ color: '#6366f1', fontWeight: '600' }}>{classSectionInfo.majorRoom}</span>
                </div>
            </div>

            {/* DESKTOP MATRIX / TABLE VIEW */}
            <div className="desktop-schedule-container">
                <div className="glass-panel timetable-wrapper">
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p>Loading schedule...</p>
                        </div>
                    ) : selectedCategory === 'Academic' ? (
                        !hasAnySlots ? (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem', color: '#818cf8' }} />
                                <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>No Timetable Published for {selectedYear} ({selectedSemester})</h3>
                                <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
                                    There are no class schedules published for {selectedYear} ({selectedSemester}) in {selectedMajor} Department.
                                </p>
                                {canManageTimetable && (
                                    <button className="btn btn-primary" onClick={handleFileUploadClick} disabled={importing}>
                                        <Upload size={16} />
                                        Upload Official Excel File
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="table-container">
                            <table className="timetable-grid">
                                <thead>
                                    <tr>
                                        <th className="sticky-col" style={{ minWidth: '110px' }}>Day</th>
                                        {TU_HMAWBI_PERIODS.map((p, idx) => (
                                            <th key={idx} style={{ background: p.isLunch ? 'rgba(239,68,68,0.06)' : 'transparent', color: p.isLunch ? '#f87171' : 'inherit' }}>
                                                <div>{p.label}</div>
                                                <div style={{ fontSize: '0.72rem', textTransform: 'none', opacity: 0.7, marginTop: '0.2rem' }}>{p.time}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {days.map(day => (
                                        <tr key={day}>
                                            <td className="time-column sticky-col">{day}</td>
                                            {TU_HMAWBI_PERIODS.map((p, pIdx) => {
                                                if (p.isLunch) {
                                                    return (
                                                        <td key={pIdx} style={{ background: 'rgba(239,68,68,0.03)', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: 'rgba(248,113,113,0.7)', fontSize: '0.75rem', fontWeight: '700' }}>
                                                                <Coffee size={14} />
                                                                <span>Lunch</span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                const session = schedules[day]?.[p.slotKey];
                                                return (
                                                    <td key={pIdx} className="schedule-td">
                                                        {session ? (
                                                            <div className={`session-block ${getTypeClass(session.type)} hover-glow`}>
                                                                <div className="session-top">
                                                                    <span className="course-name" title={session.name || session.course}>
                                                                        {formatCourseDisplayName(session.course, session.name)}
                                                                    </span>
                                                                </div>
                                                                <div className="session-bottom-row">
                                                                    <div className="session-room">
                                                                        <MapPin size={11} />
                                                                        <span>{session.room}</span>
                                                                    </div>
                                                                    <span className="type-tag">{session.sessionLabel || session.type}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="empty-slot">
                                                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.15)' }}>-</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                    ) : (
                        <div className="table-container" style={{ padding: '1rem' }}>
                            {dateSessions.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <p>No {selectedCategory} sessions scheduled.</p>
                                </div>
                            ) : (
                                <table className="attendance-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Subject Code</th>
                                            <th>{selectedCategory} Title</th>
                                            <th>Teacher</th>
                                            <th>Group</th>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Place</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dateSessions.map((s, idx) => (
                                            <tr key={s._id || idx}>
                                                <td><span className="year-tag active" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>{s.year}</span></td>
                                                <td><strong style={{ color: 'var(--primary-color)' }}>{s.courseCode}</strong></td>
                                                <td><strong style={{ color: '#fff' }}>{s.title || s.courseName}</strong></td>
                                                <td style={{ color: 'var(--text-muted)' }}>{s.teacher || 'Faculty'}</td>
                                                <td><span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>{s.groupTag}</span></td>
                                                <td style={{ color: 'var(--success)', fontWeight: '600' }}>{new Date(s.date).toLocaleDateString()}</td>
                                                <td style={{ fontSize: '0.85rem' }}>{s.startTime} - {s.endTime}</td>
                                                <td><span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}><MapPin size={12} />{s.place}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MOBILE TIMELINE CARD VIEW (Active on phones <= 768px) */}
            <div className="mobile-schedule-container">
                {selectedCategory === 'Academic' ? (
                    <div>
                        {/* Mobile Day Selector Bar */}
                        <div className="year-filter-bar glass-panel" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(actualToday === 'Saturday' || actualToday === 'Sunday') && (
                                <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: '600', padding: '0.2rem 0.5rem', background: 'rgba(34,197,94,0.1)', borderRadius: '6px' }}>
                                    🎉 Today is {actualToday} (Weekend) — Showing Monday's Schedule
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                                {days.map(d => (
                                    <button key={d} className={`year-tag ${selectedMobileDay === d ? 'active' : ''}`} onClick={() => setSelectedMobileDay(d)}>
                                        {d}{actualToday === d ? ' • Today' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mobile Period Timeline Cards for selectedDay */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {TU_HMAWBI_PERIODS.map((p, idx) => {
                                if (p.isLunch) {
                                    return (
                                        <div key={idx} className="glass-panel" style={{ padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                            <Coffee size={18} style={{ color: '#f87171' }} />
                                            <div>
                                                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#f87171' }}>LUNCH BREAK</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>12:00 to 1:00 PM</span>
                                            </div>
                                        </div>
                                    );
                                }

                                const session = schedules[selectedMobileDay]?.[p.slotKey];
                                return (
                                    <div key={idx} className="glass-panel" style={{ padding: '1rem', borderRadius: '14px', borderLeft: session ? '4px solid #6366f1' : '1px solid var(--surface-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {p.label} ({p.time})
                                            </span>
                                            {session && <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{session.sessionLabel}</span>}
                                        </div>
                                        {session ? (
                                            <div>
                                                <h4 style={{ margin: '0 0 0.3rem', fontSize: '1.05rem', color: '#fff' }}>{session.course}</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    <MapPin size={12} />
                                                    <span>Room: {session.room}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', italic: 'true' }}>Free Period</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Mobile Date-based list */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {dateSessions.map((s, idx) => (
                            <div key={idx} className="glass-panel" style={{ padding: '1rem', borderRadius: '14px', borderLeft: '4px solid #10b981' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                    <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{s.courseCode}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: '700' }}>{new Date(s.date).toLocaleDateString()}</span>
                                </div>
                                <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', color: '#fff' }}>{s.title || s.courseName}</h4>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <div>Time: {s.startTime} - {s.endTime}</div>
                                    <div>Place: {s.place} | Group: {s.groupTag}</div>
                                    <div>Teacher: {s.teacher || 'Faculty Member'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimeTable;
