import React, { useCallback, useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Clock, MapPin, Edit3, Save, X, Plus, Book, Monitor, Users, MessageSquare, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getNormalizedUserYear } from '../utils/userYear';
import './TimeTable.css';

const DEFAULT_TIMETABLE = {
    '6th Year': {
        'Semester 1': {
            'Monday': {
                '09:00 AM': { course: 'HSS 61011', room: '301/A', type: 'Lecture' },
                '01:00 PM': { course: 'McE 61031', room: '302/A', type: 'Lecture' }
            },
            'Tuesday': {
                '09:00 AM': { course: 'McE 61031', room: '302/A', type: 'Lecture' },
                '02:00 PM': { course: 'McE 61028', room: '303/A', type: 'Lecture' }
            },
            'Wednesday': {
                '09:00 AM': { course: 'McE 61028', room: '303/A', type: 'Lecture' },
                '01:00 PM': { course: 'HSS 61011', room: '301/A', type: 'Lecture' }
            },
            'Thursday': {
                '10:00 AM': { course: 'McE 61031', room: 'Lab 102', type: 'Lab' },
                '01:00 PM': { course: 'McE 61031', room: 'Room 201', type: 'Lecture' }
            },
            'Friday': {
                '10:00 AM': { course: 'McE 61028', room: 'Lab 104', type: 'Lab' },
                '01:00 PM': { course: 'McE 61028', room: 'Lab 104', type: 'Lab' }
            }
        },
        'Semester 2': {
            'Monday': {
                '09:00 AM': { course: 'McE 62040', room: '301/B', type: 'Lecture' }
            },
            'Wednesday': {
                '09:00 AM': { course: 'McE 62045', room: 'Lab 105', type: 'Lab' }
            },
            'Friday': {
                '01:00 PM': { course: 'McE 62099', room: 'Auditorium', type: 'Seminar' }
            }
        }
    },
    '1st Year': {
        'Semester 1': {
            'Monday': {
                '09:00 AM': { course: 'MTH 1101', room: '101', type: 'Lecture' },
                '01:00 PM': { course: 'PHY 1101', room: '102', type: 'Lecture' }
            },
            'Wednesday': {
                '09:00 AM': { course: 'CHM 1101', room: '103', type: 'Lecture' }
            },
            'Friday': {
                '10:00 AM': { course: 'ENG 1101', room: '104', type: 'Lecture' }
            }
        }
    }
};

const TimeTable = () => {
    const { user } = useContext(AuthContext);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const canManageTimetable = roleStr === 'admin' || roleStr === 'teacher' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);

    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : '1st Year');
    const [selectedSemester, setSelectedSemester] = useState('Semester 1');
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);
    
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [tempCellData, setTempCellData] = useState({ course: '', room: '', type: 'Lecture' });

    // Excel import state
    const fileInputRef = useRef(null);
    const [parsedSlots, setParsedSlots] = useState([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');

    const years = isStudent
        ? [studentYear]
        : ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
    const semesters = ['Semester 1', 'Semester 2'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const times = [
        '08:00 AM',
        '09:00 AM',
        '10:00 AM',
        '11:00 AM',
        '12:00 PM',
        '01:00 PM',
        '02:00 PM',
        '03:00 PM',
        '04:00 PM',
    ];

    const fetchTimetable = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/timetable', {
                params: { year: selectedYear, semester: selectedSemester }
            });
            
            const scheduleMap = {};
            if (Array.isArray(data) && data.length > 0) {
                data.forEach(slot => {
                    if (slot && slot.day && slot.time) {
                        if (!scheduleMap[slot.day]) scheduleMap[slot.day] = {};
                        scheduleMap[slot.day][slot.time] = {
                            course: slot.course || '',
                            room: slot.room || '',
                            type: slot.type || 'Lecture'
                        };
                    }
                });
                setSchedules(scheduleMap);
            } else {
                const fallback = DEFAULT_TIMETABLE[selectedYear]?.[selectedSemester] || DEFAULT_TIMETABLE['6th Year']['Semester 1'];
                setSchedules(fallback || {});
            }
        } catch (err) {
            console.error('Failed to fetch timetable, using fallback:', err);
            const fallback = DEFAULT_TIMETABLE[selectedYear]?.[selectedSemester] || DEFAULT_TIMETABLE['6th Year']['Semester 1'];
            setSchedules(fallback || {});
        } finally {
            setLoading(false);
        }
    }, [selectedSemester, selectedYear]);

    useEffect(() => {
        fetchTimetable();
    }, [fetchTimetable]);

    const handleYearSelect = (year) => {
        setSelectedYear(year);
        setSelectedSemester('Semester 1');
        setEditingCell(null);
    };

    const handleEditToggle = () => {
        if (!canManageTimetable) return;
        setIsEditingMode(!isEditingMode);
        setEditingCell(null);
    };

    const handleCellClick = (day, time) => {
        if (!isEditingMode) return;
        setEditingCell({ day, time });
        const existingData = schedules[day]?.[time];
        setTempCellData(existingData ? { ...existingData } : { course: '', room: '', type: 'Lecture' });
    };

    const handleSaveCell = async (e) => {
        e.stopPropagation();
        if (!editingCell) return;
        const { day, time } = editingCell;
        
        try {
            if (!tempCellData.course && !tempCellData.room) {
                await apiClient.delete('/timetable', {
                    params: { year: selectedYear, semester: selectedSemester, day, time }
                });
            } else {
                await apiClient.put('/timetable', {
                    year: selectedYear,
                    semester: selectedSemester,
                    day,
                    time,
                    course: tempCellData.course,
                    room: tempCellData.room,
                    type: tempCellData.type
                });
            }
            fetchTimetable();
        } catch (err) {
            console.error('Failed to save cell:', err);
            alert('Failed to save timetable slot.');
        }

        setEditingCell(null);
    };

    const handleCancelCell = (e) => {
        e.stopPropagation();
        setEditingCell(null);
    };

    // -------------------------------------------------------------
    // EXCEL IMPORT HANDLERS
    // -------------------------------------------------------------
    const handleFileUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleExcelFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportError('');
        setImportSuccess('');

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target.result;
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (!rawData || rawData.length < 2) {
                    setImportError('Uploaded Excel file appears empty or invalid.');
                    return;
                }

                // Check header format
                const headerRow = rawData[0].map(cell => String(cell || '').trim());
                const slotsToImport = [];

                // Detect if List format (Year, Semester, Day, Time, Course, Room, Type)
                const hasDayCol = headerRow.some(h => h.toLowerCase() === 'day');
                const hasTimeCol = headerRow.some(h => h.toLowerCase() === 'time');
                const hasCourseCol = headerRow.some(h => h.toLowerCase().includes('course') || h.toLowerCase().includes('subject'));

                if (hasDayCol && hasTimeCol && hasCourseCol) {
                    // List Format
                    const dayIdx = headerRow.findIndex(h => h.toLowerCase() === 'day');
                    const timeIdx = headerRow.findIndex(h => h.toLowerCase() === 'time');
                    const courseIdx = headerRow.findIndex(h => h.toLowerCase().includes('course') || h.toLowerCase().includes('subject'));
                    const roomIdx = headerRow.findIndex(h => h.toLowerCase().includes('room'));
                    const typeIdx = headerRow.findIndex(h => h.toLowerCase().includes('type'));
                    const yearIdx = headerRow.findIndex(h => h.toLowerCase().includes('year'));
                    const semIdx = headerRow.findIndex(h => h.toLowerCase().includes('sem'));

                    for (let i = 1; i < rawData.length; i++) {
                        const row = rawData[i];
                        if (!row || !row[courseIdx]) continue;

                        const parsedDay = normalizeDay(row[dayIdx]);
                        const parsedTime = normalizeTime(row[timeIdx]);

                        if (parsedDay && parsedTime) {
                            slotsToImport.push({
                                year: row[yearIdx] || selectedYear,
                                semester: row[semIdx] || selectedSemester,
                                day: parsedDay,
                                time: parsedTime,
                                course: String(row[courseIdx]).trim(),
                                room: roomIdx !== -1 && row[roomIdx] ? String(row[roomIdx]).trim() : 'Room 101',
                                type: typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : 'Lecture'
                            });
                        }
                    }
                } else {
                    // Matrix / Grid Format (Header has Monday, Tuesday, etc.)
                    const dayColIndices = {};
                    headerRow.forEach((colName, idx) => {
                        const normDay = normalizeDay(colName);
                        if (normDay) dayColIndices[normDay] = idx;
                    });

                    for (let i = 1; i < rawData.length; i++) {
                        const row = rawData[i];
                        if (!row || row.length === 0) continue;

                        const timeVal = normalizeTime(row[0]);
                        if (!timeVal) continue;

                        Object.entries(dayColIndices).forEach(([dayName, colIdx]) => {
                            const cellVal = row[colIdx];
                            if (cellVal) {
                                const valStr = String(cellVal).trim();
                                const parts = valStr.split(/[\(/]/);
                                const course = parts[0].trim();
                                const room = parts[1] ? parts[1].replace(/[\)]/g, '').trim() : 'Room 101';

                                slotsToImport.push({
                                    year: selectedYear,
                                    semester: selectedSemester,
                                    day: dayName,
                                    time: timeVal,
                                    course,
                                    room,
                                    type: 'Lecture'
                                });
                            }
                        });
                    }
                }

                if (slotsToImport.length === 0) {
                    setImportError('No valid timetable slots could be parsed from the file.');
                    return;
                }

                setParsedSlots(slotsToImport);
                setIsImportModalOpen(true);
            } catch (err) {
                console.error('Error reading Excel file:', err);
                setImportError('Failed to read Excel file. Please ensure it is a valid .xlsx or .xls document.');
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleConfirmImport = async () => {
        if (!parsedSlots || parsedSlots.length === 0) return;
        setImporting(true);
        setImportError('');

        try {
            const { data } = await apiClient.post('/timetable/batch', { slots: parsedSlots });
            setImportSuccess(data.message || `Successfully imported ${parsedSlots.length} slots!`);
            setIsImportModalOpen(false);
            fetchTimetable();
            setTimeout(() => setImportSuccess(''), 4000);
        } catch (err) {
            console.error('Failed to import timetable slots:', err);
            setImportError(err.response?.data?.message || 'Failed to import timetable slots.');
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            ['Year', 'Semester', 'Day', 'Time', 'Course', 'Room', 'Type'],
            ['1st Year', 'Semester 1', 'Monday', '09:00 AM', 'CS101', 'MECH-204', 'Lecture'],
            ['1st Year', 'Semester 1', 'Monday', '10:00 AM', 'MTH101', 'MECH-102', 'Lecture'],
            ['1st Year', 'Semester 1', 'Tuesday', '11:00 AM', 'PHY101', 'LAB-3', 'Lab'],
            ['1st Year', 'Semester 1', 'Wednesday', '01:00 PM', 'ENG105', 'MECH-204', 'Tutorial'],
            ['1st Year', 'Semester 1', 'Thursday', '02:00 PM', 'MECH201', 'MECH-301', 'Lecture'],
            ['1st Year', 'Semester 1', 'Friday', '03:00 PM', 'CS102', 'LAB-1', 'Project'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
        XLSX.writeFile(wb, 'Academic_Timetable_Template.xlsx');
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'Lecture': return <Monitor size={14} />;
            case 'Lab': return <Monitor size={14} />;
            case 'Seminar': return <Users size={14} />;
            case 'Tutorial': return <MessageSquare size={14} />;
            default: return <Book size={14} />;
        }
    };

    return (
        <div className="timetable-page animate-fade-in">
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelFileChange}
            />

            <header className="page-header">
                <div>
                    <h1>Academic Timetable</h1>
                    <p className="subtitle">Manage and track your weekly academic schedule</p>
                </div>
                <div className="header-actions">
                    {canManageTimetable && (
                        <>
                            <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download Excel Template">
                                <Download size={18} />
                                Sample Template
                            </button>
                            <button className="btn btn-secondary" onClick={handleFileUploadClick}>
                                <Upload size={18} />
                                Import Excel
                            </button>
                            <button
                                className={`btn ${isEditingMode ? 'btn-success' : 'btn-primary'}`}
                                onClick={handleEditToggle}
                            >
                                {isEditingMode ? <Save size={18} /> : <Edit3 size={18} />}
                                {isEditingMode ? 'Finish Editing' : 'Customize Schedule'}
                            </button>
                        </>
                    )}
                </div>
            </header>

            {importSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={18} />
                    <span>{importSuccess}</span>
                </div>
            )}

            {importError && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} />
                    <span>{importError}</span>
                </div>
            )}

            <div className="year-filter-bar glass-panel">
                {years.map(year => (
                    <button
                        key={year}
                        className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                        onClick={() => handleYearSelect(year)}
                    >
                        {year}
                    </button>
                ))}
            </div>

            <div className="year-filter-bar semester-filter-bar glass-panel">
                {semesters.map(semester => (
                    <button
                        key={semester}
                        className={`year-tag ${selectedSemester === semester ? 'active' : ''}`}
                        onClick={() => { setSelectedSemester(semester); setEditingCell(null); }}
                    >
                        {semester}
                    </button>
                ))}
            </div>

            {isEditingMode && (
                <div className="edit-hint-toast glass-panel">
                    <Edit3 size={16} />
                    <span>Mode: Customizing | Click any cell to add or modify courses</span>
                </div>
            )}

            <div className="glass-panel timetable-wrapper">
                <div className="table-container">
                    {loading ? (
                         <div className="empty-state-full" style={{ padding: '3rem', textAlign: 'center' }}>
                             <p>Loading schedule...</p>
                         </div>
                    ) : (
                        <table className="timetable-grid">
                            <thead>
                                <tr>
                                    <th className="sticky-col">
                                        <Clock size={16} />
                                        <span>Time Slot</span>
                                    </th>
                                    {days.map(day => <th key={day}>{day}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {times.map(time => (
                                    <tr key={time}>
                                        <td className="time-column sticky-col">{time}</td>
                                        {days.map(day => {
                                            const session = schedules[day]?.[time];
                                            const isEditingThisCell = editingCell?.day === day && editingCell?.time === time;

                                            return (
                                                <td
                                                    key={`${day}-${time}`}
                                                    className={`schedule-td ${isEditingMode ? 'active-zone' : ''} ${isEditingThisCell ? 'focused' : ''}`}
                                                    onClick={() => handleCellClick(day, time)}
                                                >
                                                    {isEditingThisCell ? (
                                                        <div className="grid-cell-editor glass-panel" onClick={(e) => e.stopPropagation()}>
                                                            <div className="editor-header">Modify Slot</div>
                                                            <input
                                                                type="text"
                                                                placeholder="Course ID"
                                                                className="editor-input"
                                                                value={tempCellData.course}
                                                                onChange={(e) => setTempCellData({ ...tempCellData, course: e.target.value })}
                                                                autoFocus
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Room No."
                                                                className="editor-input"
                                                                value={tempCellData.room}
                                                                onChange={(e) => setTempCellData({ ...tempCellData, room: e.target.value })}
                                                            />
                                                            <select
                                                                className="editor-input"
                                                                value={tempCellData.type}
                                                                onChange={(e) => setTempCellData({ ...tempCellData, type: e.target.value })}
                                                            >
                                                                <option value="Lecture">Lecture</option>
                                                                <option value="Lab">Lab</option>
                                                                <option value="Seminar">Seminar</option>
                                                                <option value="Tutorial">Tutorial</option>
                                                                <option value="Project">Project</option>
                                                            </select>
                                                            <div className="editor-btns">
                                                                <button className="mini-btn success" onClick={handleSaveCell}>Done</button>
                                                                <button className="mini-btn" onClick={handleCancelCell}><X size={14} /></button>
                                                            </div>
                                                        </div>
                                                    ) : session ? (
                                                        <div className={`session-block tier-${session.type.toLowerCase()}`}>
                                                            <div className="session-top">
                                                                <span className="course-name">{session.course}</span>
                                                                <span className="type-icon">{getTypeIcon(session.type)}</span>
                                                            </div>
                                                            <div className="session-bottom">
                                                                <MapPin size={10} />
                                                                <span>{session.room}</span>
                                                            </div>
                                                            <div className="type-tag">{session.type}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="empty-slot">
                                                            {isEditingMode && <Plus size={16} className="add-vibe" />}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* EXCEL IMPORT CONFIRMATION MODAL */}
            {isImportModalOpen && (
                <div className="modal-overlay" onClick={() => setIsImportModalOpen(false)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Confirm Timetable Excel Import</h2>
                                <p className="modal-subtitle">Parsed {parsedSlots.length} schedule slots from spreadsheet</p>
                            </div>
                            <button className="close-btn" onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table className="attendance-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>Year / Sem</th>
                                        <th>Day & Time</th>
                                        <th>Subject</th>
                                        <th>Room</th>
                                        <th>Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedSlots.map((slot, idx) => (
                                        <tr key={idx}>
                                            <td className="font-mono text-muted">{slot.year} ({slot.semester})</td>
                                            <td className="font-semibold">{slot.day} {slot.time}</td>
                                            <td className="text-primary">{slot.course}</td>
                                            <td>{slot.room}</td>
                                            <td><span className="badge badge-success">{slot.type}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>Slots will be updated in database</span>
                            <div>
                                <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)} style={{ marginRight: '0.5rem' }}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleConfirmImport} disabled={importing}>
                                    {importing ? 'Importing...' : 'Confirm & Save Timetable'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeTable;
