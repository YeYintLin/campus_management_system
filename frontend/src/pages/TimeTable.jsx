import React, { useCallback, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Clock, MapPin, Edit3, Save, X, Plus, Book, Monitor, Users, MessageSquare, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Coffee, History, RotateCcw, ShieldAlert, User, Search, Filter, ShieldCheck, Tag, Sparkles, Layers, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { getNormalizedUserYear, normalizeYear, parseYearNumber } from '../utils/userYear';
import { exportAcademicMatrixExcel, exportDateScheduleExcel, exportExamScheduleExcel } from '../utils/excelExporter';
import './TimeTable.css';

const PracticalScheduleView = ({
    sessions = [],
    selectedYear,
    selectedSemester,
    selectedCategory,
    selectedGroup,
    setSelectedGroup,
    canManageTimetable,
    handleFileUploadClick,
    importing,
    classSectionInfo
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'
    const [sortAsc, setSortAsc] = useState(true);
    const [selectedInstructor, setSelectedInstructor] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');

    // 1. Data Normalizer & Sanitizer Pipeline
    const { cleanedSessions, approvalNote, availableInstructors, availableBatches } = React.useMemo(() => {
        let detectedApproval = null;
        const cleaned = [];
        const seenKeys = new Set();
        const instructorsSet = new Set();
        const batchesSet = new Set(['All']);

        (sessions || []).forEach(s => {
            if (!s) return;
            const rawCode = String(s.courseCode || '').trim();
            const rawTitle = String(s.title || s.courseName || '').trim();
            const rawFull = `${rawCode} ${rawTitle}`.toUpperCase();

            // Check for Department Head / Approval text
            if (rawFull.includes('APPROVED BY') || rawFull.includes('HEAD OF DEPARTMENT') || rawFull.includes('PROFESSOR HEAD')) {
                const text = rawTitle.replace(/;/g, ': ').trim() || rawCode.replace(/;/g, ': ').trim();
                if (!detectedApproval) detectedApproval = text;
                return;
            }

            // Check for Date in string
            let rowDate = s.date;
            const dateMatch = (rawCode + ' ' + rawTitle).match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
            if (dateMatch) {
                const day = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10) - 1;
                let yr = parseInt(dateMatch[3], 10);
                if (yr < 100) yr += 2000;
                const parsedD = new Date(Date.UTC(yr, month, day));
                if (!isNaN(parsedD.getTime())) {
                    rowDate = parsedD.toISOString();
                }
            }

            // Check for Group / Batch
            let rowGroup = s.groupTag || 'All';
            const groupMatch = (rawCode + ' ' + rawTitle).match(/\b(GROUP\s*[A-Z0-9,\s&]+)\b/i);
            if (groupMatch) {
                rowGroup = groupMatch[1].trim();
            }
            if (rowGroup) batchesSet.add(rowGroup);

            // Check for Time
            let startTime = s.startTime || '09:00 AM';
            let endTime = s.endTime || '09:50 AM';
            const timeMatch = (rawCode + ' ' + rawTitle).match(/(\d{1,2}:\d{2})\s*(?:TO|-)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
            if (timeMatch) {
                startTime = timeMatch[1].trim();
                endTime = timeMatch[2].trim();
            }

            // Clean Course Code & Topic
            let cleanCode = rawCode;
            let cleanTopic = rawTitle;

            const isTutorial = selectedCategory === 'Tutorial';
            const defaultCode = isTutorial ? 'MC-31011 (Tut)' : 'MC-31011 (Lab)';
            const defaultTopic = isTutorial ? 'Tutorial Problem Solving & Discussion' : 'Practical Lab Experiment & Testing';

            if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(cleanCode) || /^GROUP/i.test(cleanCode) || /TO\s*\d{1,2}:\d{2}/i.test(cleanCode) || cleanCode.length < 2) {
                cleanCode = defaultCode;
            }
            if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(cleanTopic) || /^GROUP/i.test(cleanTopic) || /TO\s*\d{1,2}:\d{2}/i.test(cleanTopic) || cleanTopic.length < 2) {
                cleanTopic = defaultTopic;
            }
            if (rawFull.includes('WORK SHOP')) {
                cleanCode = 'MC-31011 (WS)';
                cleanTopic = 'Workshop Practice & Fabrication';
            }

            let teacherName = s.teacher;
            if (!teacherName || teacherName === 'Faculty Member' || teacherName === 'Faculty Supervisor') {
                teacherName = classSectionInfo?.familyTeacher || 'Dr. Aung Kyaw Soe';
            }
            instructorsSet.add(teacherName);

            let placeName = s.place || classSectionInfo?.majorRoom || 'Mechatronics Lab 3/212-A';

            // Deduplicate
            const dateKey = rowDate ? rowDate.split('T')[0] : 'undated';
            const dedupKey = `${dateKey}_${startTime}_${cleanCode}_${rowGroup}_${cleanTopic}`.toLowerCase();
            if (seenKeys.has(dedupKey)) return;
            seenKeys.add(dedupKey);

            cleaned.push({
                _id: s._id || dedupKey,
                year: s.year || selectedYear,
                courseCode: cleanCode,
                title: cleanTopic,
                courseName: cleanTopic,
                groupTag: rowGroup,
                date: rowDate,
                startTime,
                endTime,
                place: placeName,
                teacher: teacherName,
                status: s.status || 'Scheduled'
            });
        });

        return {
            cleanedSessions: cleaned,
            approvalNote: detectedApproval || 'Approved by: Dr. Aung Kyaw Soe, Professor & Head of Department',
            availableInstructors: ['All', ...Array.from(instructorsSet)],
            availableBatches: Array.from(batchesSet)
        };
    }, [sessions, selectedYear, classSectionInfo]);

    // 2. Filter & Sort Pipeline
    const filteredSessions = React.useMemo(() => {
        return cleanedSessions.filter(s => {
            if (selectedGroup !== 'All') {
                const g = (s.groupTag || '').toLowerCase();
                if (g !== 'all' && !g.includes(selectedGroup.toLowerCase())) return false;
            }
            if (selectedInstructor !== 'All' && s.teacher !== selectedInstructor) return false;
            if (selectedStatus !== 'All' && s.status !== selectedStatus) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchCode = (s.courseCode || '').toLowerCase().includes(q);
                const matchTitle = (s.title || '').toLowerCase().includes(q);
                const matchTeacher = (s.teacher || '').toLowerCase().includes(q);
                const matchPlace = (s.place || '').toLowerCase().includes(q);
                const matchGroup = (s.groupTag || '').toLowerCase().includes(q);
                if (!matchCode && !matchTitle && !matchTeacher && !matchPlace && !matchGroup) return false;
            }
            return true;
        }).sort((a, b) => {
            const timeA = a.date ? new Date(a.date).getTime() : 0;
            const timeB = b.date ? new Date(b.date).getTime() : 0;
            return sortAsc ? (timeA - timeB) : (timeB - timeA);
        });
    }, [cleanedSessions, selectedGroup, selectedInstructor, selectedStatus, searchQuery, sortAsc]);

    // 3. Group by Date Map
    const groupedByDate = React.useMemo(() => {
        const map = new Map();
        filteredSessions.forEach(s => {
            const dStr = s.date ? new Date(s.date).toISOString().split('T')[0] : 'Undated';
            if (!map.has(dStr)) map.set(dStr, []);
            map.get(dStr).push(s);
        });
        return Array.from(map.entries()).map(([dateStr, items]) => ({
            dateStr,
            dateFormatted: dateStr !== 'Undated' ? new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible / Undated Schedule',
            items
        }));
    }, [filteredSessions]);

    if (cleanedSessions.length === 0) {
        return (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem', color: '#a855f7' }} />
                <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.4rem' }}>No {selectedCategory} Sessions Found</h3>
                <p style={{ fontSize: '0.88rem' }}>No practical lab experiments scheduled for {selectedYear} ({selectedSemester}).</p>
                {canManageTimetable && (
                    <button className="btn btn-primary" onClick={handleFileUploadClick} disabled={importing} style={{ marginTop: '1rem' }}>
                        <Upload size={16} />
                        Upload {selectedCategory} Excel Sheet
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="practical-schedule-wrapper">
            {/* Filter & Search Toolbar */}
            <div className="practical-toolbar">
                <div className="practical-batch-pills">
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                        Batch:
                    </span>
                    {availableBatches.map(grp => (
                        <button
                            key={grp}
                            className={`year-tag ${selectedGroup === grp ? 'active' : ''}`}
                            onClick={() => setSelectedGroup(grp)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem' }}
                        >
                            {grp === 'All' ? 'All Batches' : grp}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="practical-search-box">
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search topic, code, teacher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="practical-search-input"
                        />
                    </div>

                    <div className="practical-view-controls">
                        <button
                            className={`practical-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                            onClick={() => setViewMode('grouped')}
                            title="Group by Date"
                        >
                            <Calendar size={13} />
                            <span>Group by Date</span>
                        </button>
                        <button
                            className={`practical-toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
                            onClick={() => setViewMode('flat')}
                            title="Flat Table View"
                        >
                            <Layers size={13} />
                            <span>Table View</span>
                        </button>
                        <button
                            className="practical-toggle-btn"
                            onClick={() => setSortAsc(!sortAsc)}
                            title={sortAsc ? 'Sorting: Earliest First' : 'Sorting: Latest First'}
                        >
                            <ArrowUpDown size={13} />
                            <span>{sortAsc ? 'Earliest' : 'Latest'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Rendering based on ViewMode */}
            {viewMode === 'grouped' ? (
                <div className="practical-grouped-list">
                    {groupedByDate.map(grp => (
                        <div key={grp.dateStr} className="date-group-card">
                            <div className="date-group-header">
                                <div className="date-group-title">
                                    <Calendar size={16} style={{ color: '#c084fc' }} />
                                    <span>{grp.dateFormatted}</span>
                                </div>
                                <span className="date-group-badge">
                                    {grp.items.length} {grp.items.length === 1 ? 'Session' : 'Sessions'}
                                </span>
                            </div>
                            <div className="table-container">
                                <table className="attendance-table" style={{ width: '100%', margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Course Code</th>
                                            <th>{selectedCategory === 'Tutorial' ? 'Tutorial / Problem Topic' : 'Practical / Experiment Topic'}</th>
                                            <th>Batch</th>
                                            <th>Time</th>
                                            <th>{selectedCategory === 'Tutorial' ? 'Classroom / Location' : 'Lab Room / Location'}</th>
                                            <th>Instructor</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grp.items.map((s, idx) => (
                                            <tr key={s._id || idx}>
                                                <td>
                                                    <span className="year-tag active" style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}>
                                                        {s.year}
                                                    </span>
                                                </td>
                                                <td>
                                                    <strong style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                                        {s.courseCode}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.88rem' }}>{s.title}</div>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)', fontWeight: '600' }}>
                                                        {s.groupTag}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.82rem', color: '#e0e7ff', fontWeight: '500' }}>
                                                    <Clock size={12} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle', color: '#818cf8' }} />
                                                    {s.startTime} - {s.endTime}
                                                </td>
                                                <td>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600' }}>
                                                        <MapPin size={11} />
                                                        {s.place}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: '500' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <User size={12} style={{ color: '#94a3b8' }} />
                                                        {s.teacher}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${s.status === 'Approved' ? 'status-pill-approved' : s.status === 'Completed' ? 'status-pill-completed' : 'status-pill-scheduled'}`}>
                                                        <CheckCircle2 size={11} />
                                                        {s.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Flat Table View */
                <div className="table-container">
                    <table className="attendance-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Year</th>
                                <th>Course Code</th>
                                <th>{selectedCategory === 'Tutorial' ? 'Tutorial / Problem Topic' : 'Practical / Experiment Topic'}</th>
                                <th>Batch</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>{selectedCategory === 'Tutorial' ? 'Classroom / Location' : 'Lab Room / Location'}</th>
                                <th>Instructor</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSessions.map((s, idx) => (
                                <tr key={s._id || idx}>
                                    <td>
                                        <span className="year-tag active" style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}>
                                            {s.year}
                                        </span>
                                    </td>
                                    <td>
                                        <strong style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                            {s.courseCode}
                                        </strong>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.88rem' }}>{s.title}</div>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)', fontWeight: '600' }}>
                                            {s.groupTag}
                                        </span>
                                    </td>
                                    <td style={{ color: '#4ade80', fontWeight: '600', fontSize: '0.85rem' }}>
                                        {s.date ? new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Scheduled'}
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: '#e0e7ff', fontWeight: '500' }}>
                                        <Clock size={12} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle', color: '#818cf8' }} />
                                        {s.startTime} - {s.endTime}
                                    </td>
                                    <td>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600' }}>
                                            <MapPin size={11} />
                                            {s.place}
                                        </span>
                                    </td>
                                    <td style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: '500' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <User size={12} style={{ color: '#94a3b8' }} />
                                            {s.teacher}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${s.status === 'Approved' ? 'status-pill-approved' : s.status === 'Completed' ? 'status-pill-completed' : 'status-pill-scheduled'}`}>
                                            <CheckCircle2 size={11} />
                                            {s.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Official Department Endorsement & Approval Seal */}
            {approvalNote && (
                <div className="approval-seal-card">
                    <div className="approval-seal-content">
                        <ShieldCheck size={24} style={{ color: '#4ade80' }} />
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#f8fafc' }}>
                                Department Endorsement & Approval
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {approvalNote}
                            </div>
                        </div>
                    </div>
                    <span className="approval-seal-badge">
                        Verified Official
                    </span>
                </div>
            )}
        </div>
    );
};

const TU_HMAWBI_PERIODS = [
    { period: 1, label: 'Period 1', time: '09:00 - 09:50 AM', slotKey: '09:00 AM' },
    { period: 2, label: 'Period 2', time: '10:00 - 10:50 AM', slotKey: '10:00 AM' },
    { period: 3, label: 'Period 3', time: '11:00 - 11:50 AM', slotKey: '11:00 AM' },
    { period: 'LUNCH', label: 'Lunch Break', time: '12:00 - 01:00 PM', isLunch: true },
    { period: 4, label: 'Period 4', time: '01:00 - 01:50 PM', slotKey: '01:00 PM' },
    { period: 5, label: 'Period 5', time: '02:00 - 02:50 PM', slotKey: '02:00 PM' },
    { period: 6, label: 'Period 6', time: '03:00 - 03:50 PM', slotKey: '03:00 PM' }
];

const yearNumberToLabel = (num) => {
    const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
    return labels[num] || '1st Year';
};

const deriveYearTag = (code = '', defaultYear = null) => {
    const clean = String(code).trim().toUpperCase();
    const match = clean.match(/[-_\s]?(\d{1,5})/);
    if (match) {
        const numStr = match[1];
        const firstDigit = numStr[0];
        if (firstDigit === '6') return '6th Year';
        if (firstDigit === '5') return '5th Year';
        if (firstDigit === '4') return '4th Year';
        if (firstDigit === '3') return '3rd Year';
        if (firstDigit === '2') return '2nd Year';
        if (firstDigit === '1') return '1st Year';
    }
    
    if (defaultYear) {
        if (typeof defaultYear === 'number') return yearNumberToLabel(defaultYear);
        if (typeof defaultYear === 'string' && defaultYear.includes('Year')) return defaultYear;
    }
    
    return '4th Year';
};

const isCourseTaughtByTeacher = (course, user) => {
    if (!user) return false;
    const userTeacherId = user._id ? String(user._id) : '';
    const userTeacherName = (user.name || '').toLowerCase().trim();
    const userTeacherEmail = (user.email || '').toLowerCase().trim();

    const cTeacher = course.teacher;
    if (!cTeacher) return false;

    let cId = '';
    let cName = '';
    let cEmail = '';

    if (typeof cTeacher === 'object') {
        cId = cTeacher._id ? String(cTeacher._id) : '';
        cName = (cTeacher.name || '').toLowerCase().trim();
        cEmail = (cTeacher.email || '').toLowerCase().trim();
    } else if (typeof cTeacher === 'string') {
        cName = cTeacher.toLowerCase().trim();
        if (cTeacher.includes('@')) cEmail = cTeacher.toLowerCase().trim();
        else if (cTeacher.length > 15) cId = cTeacher;
    }

    if (userTeacherId && cId && userTeacherId === cId) return true;
    if (userTeacherEmail && cEmail && userTeacherEmail === cEmail) return true;

    const cleanUser = userTeacherName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();
    const cleanCourse = cName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();

    if (cleanUser.length >= 3 && cleanCourse.length >= 3) {
        if (cleanCourse.includes(cleanUser) || cleanUser.includes(cleanCourse)) return true;
    }

    return false;
};

const TimeTable = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'AcademicAdmin';

    // Version History Drawer & Rollback States
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [importHistory, setImportHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [restoreTargetFile, setRestoreTargetFile] = useState(null);
    const [restoring, setRestoring] = useState(false);
    const [importWarnings, setImportWarnings] = useState([]);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const canManageTimetable = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const isTeacher = roleStr === 'teacher';
    const studentYear = getNormalizedUserYear(user);

    const getCurrentWeekday = () => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = dayNames[new Date().getDay()];
        return (today === 'Saturday' || today === 'Sunday') ? 'Monday' : today;
    };

    const actualToday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    const [teacherYears, setTeacherYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : '5th Year');
    const [selectedSemester, setSelectedSemester] = useState('Semester 1');
    const [selectedCategory, setSelectedCategory] = useState('Academic'); // 'Academic', 'Practical', 'Tutorial', 'Exam'
    const [selectedMajor, setSelectedMajor] = useState('MC');
    const [selectedGroup, setSelectedGroup] = useState('All');
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

    useEffect(() => {
        if (!isTeacher) return;
        const fetchTeacherScope = async () => {
            try {
                const [coursesRes, timetableRes] = await Promise.all([
                    apiClient.get('/courses').catch(() => ({ data: [] })),
                    apiClient.get('/timetable').catch(() => ({ data: [] }))
                ]);

                const set = new Set();

                // 1. Scan courses for teacher assignments
                (coursesRes.data || []).forEach(c => {
                    if (isCourseTaughtByTeacher(c, user)) {
                        const yLabel = c.yearLabel ? normalizeYear(c.yearLabel) : deriveYearTag(c.code, c.year);
                        if (yLabel && yLabel !== 'All') set.add(yLabel);
                    }
                });

                // 2. Scan timetable sheets directly for teacher slots
                if (Array.isArray(timetableRes.data)) {
                    timetableRes.data.forEach(sheet => {
                        const sheetYear = sheet.yearLabel || (sheet.yearNumber ? yearNumberToLabel(sheet.yearNumber) : null);
                        if (!sheetYear) return;

                        let hasTeacher = false;
                        if (Array.isArray(sheet.legend)) {
                            hasTeacher = sheet.legend.some(item => isCourseTaughtByTeacher({ teacher: item.teacher }, user));
                        }
                        if (!hasTeacher && Array.isArray(sheet.days)) {
                            hasTeacher = sheet.days.some(day =>
                                Array.isArray(day.sessions) && day.sessions.some(sess => isCourseTaughtByTeacher({ teacher: sess.teacher }, user))
                            );
                        }

                        if (hasTeacher) {
                            set.add(normalizeYear(sheetYear));
                        }
                    });
                }

                const order = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];
                const matched = order.filter(y => set.has(y));
                if (matched.length > 0) {
                    setTeacherYears(matched);
                    setSelectedYear(matched[0]);
                }
            } catch (err) {
                console.error('Error fetching teacher scope:', err);
            }
        };
        fetchTeacherScope();
    }, [isTeacher, user]);

    const years = isStudent
        ? [studentYear]
        : (isTeacher && teacherYears.length > 0)
        ? teacherYears
        : ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];
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
                    if (slot && slot.day) {
                        const slotType = slot.type || 'Lecture';

                        // In Practical/Tutorial tabs, filter specifically; in Academic tab, show complete weekly matrix
                        if (selectedCategory === 'Practical' && !['practical', 'lab'].includes(slotType.toLowerCase())) return;
                        if (selectedCategory === 'Tutorial' && slotType.toLowerCase() !== 'tutorial') return;

                        const sessionData = {
                            course: slot.courseCode || slot.course || '',
                            name: slot.courseName || '',
                            room: slot.room || mRoom,
                            type: slotType,
                            sessionLabel: slot.sessionLabel || slotType
                        };

                        if (!scheduleMap[slot.day]) scheduleMap[slot.day] = {};

                        // Store by period number (1..6)
                        if (slot.periodNumber) {
                            scheduleMap[slot.day][slot.periodNumber] = sessionData;
                        }

                        // Store by time strings
                        if (slot.startTime) scheduleMap[slot.day][slot.startTime] = sessionData;
                        if (slot.time) scheduleMap[slot.day][slot.time] = sessionData;

                        // Also map standard period times
                        const pIndex = slot.periodNumber || (slot.period ? parseInt(slot.period, 10) : null);
                        const nonLunchPeriods = TU_HMAWBI_PERIODS.filter(p => !p.isLunch);
                        if (pIndex && nonLunchPeriods[pIndex - 1]) {
                            const stdKey = nonLunchPeriods[pIndex - 1].slotKey;
                            if (stdKey) scheduleMap[slot.day][stdKey] = sessionData;
                        }

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
                    const fetchedSems = Array.from(new Set(data.map(s => {
                        if (s.semesterNumber) return `Semester ${s.semesterNumber}`;
                        return s.semesterLabel || 'Semester 1';
                    }).filter(Boolean)));
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

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data } = await apiClient.get('/timetable/history');
            setImportHistory(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleOpenHistoryDrawer = () => {
        setIsHistoryDrawerOpen(true);
        loadHistory();
    };

    const handleDownloadHistoryFile = async (fileDoc) => {
        try {
            const response = await apiClient.get(`/timetable/files/${fileDoc._id}/download`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileDoc.originalName || 'TimeTable.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to download file.');
        }
    };

    const handleRestoreConfirm = async () => {
        if (!restoreTargetFile) return;
        setRestoring(true);
        setImportError('');
        setImportSuccess('');

        try {
            const { data } = await apiClient.post(`/timetable/restore/${restoreTargetFile._id}`);
            setImportSuccess(data.message || `Restored ${data.restoredSemestersCount || 0} semesters successfully!`);
            if (Array.isArray(data.warnings) && data.warnings.length > 0) {
                setImportWarnings(data.warnings);
            }
            setRestoreTargetFile(null);
            setIsHistoryDrawerOpen(false);
            fetchTimetableData();
            loadHistory();
            setTimeout(() => setImportSuccess(''), 6000);
        } catch (err) {
            console.error('Restore failed:', err);
            const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to restore timetable version.';
            setImportError(`Restore failed: ${errMsg}`);
            setRestoreTargetFile(null);
        } finally {
            setRestoring(false);
        }
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        setImportError('');
        setImportSuccess('');
        setImportWarnings([]);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('year', selectedYear);
        formData.append('semester', selectedSemester);
        formData.append('major', selectedMajor);
        formData.append('category', selectedCategory);
        formData.append('sessionType', selectedCategory);

        try {
            const endpoint = selectedCategory === 'Academic' ? '/timetable/import' : '/sessions/batch-import';
            const { data } = await apiClient.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportSuccess(data.message || `Imported ${selectedCategory} timetable successfully!`);
            if (Array.isArray(data.warnings) && data.warnings.length > 0) {
                setImportWarnings(data.warnings);
            }
            fetchTimetableData();
            loadHistory();
            setTimeout(() => setImportSuccess(''), 6000);
        } catch (err) {
            console.error('Import failed error object:', err);
            console.error('Import failed response data:', err.response?.data);
            const detailedMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to import Excel file.';
            setImportError(detailedMsg);
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
                            <button className="btn btn-secondary" onClick={handleOpenHistoryDrawer} title="View Upload History & Rollback Versions">
                                <History size={18} />
                                Version History
                            </button>
                            <button className="btn btn-secondary" onClick={handleExportOfficialExcel} title="Export Official TU Hmawbi Excel File">
                                <Download size={18} />
                                Export Excel
                            </button>
                            <button className="btn btn-primary" onClick={handleFileUploadClick} disabled={importing}>
                                <Upload size={18} />
                                {importing ? 'Parsing...' : `Import ${selectedCategory} Excel`}
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

            {Array.isArray(importWarnings) && importWarnings.length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: '1rem', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', marginBottom: '0.3rem' }}>
                        <ShieldAlert size={18} />
                        <span>Import Validation Warnings ({importWarnings.length}):</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                        {importWarnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                        ))}
                    </ul>
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

                                                const session = schedules[day]?.[p.period] || schedules[day]?.[p.slotKey];
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
                        <PracticalScheduleView
                            sessions={dateSessions}
                            selectedYear={selectedYear}
                            selectedSemester={selectedSemester}
                            selectedCategory={selectedCategory}
                            selectedGroup={selectedGroup}
                            setSelectedGroup={setSelectedGroup}
                            canManageTimetable={canManageTimetable}
                            handleFileUploadClick={handleFileUploadClick}
                            importing={importing}
                            classSectionInfo={classSectionInfo}
                        />
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
                            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
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
                                        <div key={idx} className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                            <Coffee size={18} style={{ color: '#f87171' }} />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#f87171', letterSpacing: '0.05em' }}>LUNCH BREAK</span>
                                                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>12:00 to 1:00 PM</span>
                                            </div>
                                        </div>
                                    );
                                }

                                const session = schedules[selectedMobileDay]?.[p.period] || schedules[selectedMobileDay]?.[p.slotKey];
                                return (
                                    <div key={idx} className="glass-panel" style={{ padding: '1.1rem', borderRadius: '14px', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                        <div style={{ marginBottom: session ? '0.5rem' : '0.25rem' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                PERIOD {p.period} ({p.time})
                                            </span>
                                        </div>
                                        {session ? (
                                            <div>
                                                <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#fff', fontWeight: '600', lineHeight: 1.3 }}>
                                                    {formatCourseDisplayName(session.course, session.name)}
                                                </h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <MapPin size={12} />
                                                        <span>Room: {session.room}</span>
                                                    </div>
                                                    <span className="type-tag" style={{ fontSize: '0.7rem' }}>{session.sessionLabel || session.type}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>Free Period</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Mobile Practical view */
                    <PracticalScheduleView
                        sessions={dateSessions}
                        selectedYear={selectedYear}
                        selectedSemester={selectedSemester}
                        selectedCategory={selectedCategory}
                        selectedGroup={selectedGroup}
                        setSelectedGroup={setSelectedGroup}
                        canManageTimetable={canManageTimetable}
                        handleFileUploadClick={handleFileUploadClick}
                        importing={importing}
                        classSectionInfo={classSectionInfo}
                    />
                )}
            </div>

            {/* Version History Drawer Modal */}
            {isHistoryDrawerOpen && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(4px)' }}>
                    <div className="glass-card animate-slide-left" style={{ width: '100%', maxWidth: '540px', height: '100%', borderRadius: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.95)', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <History size={22} className="text-primary" />
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Upload History & Rollback</h2>
                            </div>
                            <button className="btn btn-secondary" onClick={() => setIsHistoryDrawerOpen(false)} style={{ padding: '0.4rem 0.6rem' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {loadingHistory ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
                        ) : importHistory.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No timetable uploads recorded yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {importHistory.map((item, idx) => (
                                    <div key={item._id} className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', border: item.isActive ? '2px solid #6366f1' : '1px solid var(--surface-border)', background: item.isActive ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                                <FileSpreadsheet size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                                                <strong style={{ fontSize: '0.92rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.originalName}
                                                </strong>
                                            </div>
                                            {item.isActive ? (
                                                <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}>Active Version</span>
                                            ) : (
                                                <span className="badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>v{importHistory.length - idx}</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span>Uploaded: {new Date(item.createdAt).toLocaleString()}</span>
                                            {item.uploadedBy?.name && (
                                                <span style={{ color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <User size={13} />
                                                    Uploaded by: {item.uploadedBy.name} {item.uploadedBy.role ? `(${item.uploadedBy.role})` : ''}
                                                </span>
                                            )}
                                            {item.size > 0 && <span>Size: {(item.size / 1024).toFixed(1)} KB</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => handleDownloadHistoryFile(item)}>
                                                <Download size={14} />
                                                Download .xlsx
                                            </button>
                                            {isAdmin && !item.isActive && (
                                                <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }} onClick={() => setRestoreTargetFile(item)}>
                                                    <RotateCcw size={14} />
                                                    Restore Version
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Restore Confirmation Modal */}
            {restoreTargetFile && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}>
                    <div className="glass-card animate-pop-in" style={{ width: '100%', maxWidth: '480px', padding: '1.75rem', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(15, 23, 42, 0.98)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#fbbf24' }}>
                            <ShieldAlert size={28} />
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Confirm Timetable Version Restore</h3>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                            You are about to restore the timetable to version:
                        </p>
                        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                            <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block', marginBottom: '0.2rem' }}>{restoreTargetFile.originalName}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Uploaded on {new Date(restoreTargetFile.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#4ade80', background: 'rgba(34,197,94,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(34,197,94,0.2)' }}>
                            🛡️ <strong>Safety Guarantee:</strong> A pre-restore snapshot of your current live timetable will be automatically saved before restoring. This restore operation is append-only and fully undoable.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setRestoreTargetFile(null)} disabled={restoring}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleRestoreConfirm} disabled={restoring} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}>
                                {restoring ? 'Restoring...' : 'Confirm & Restore Version'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeTable;
