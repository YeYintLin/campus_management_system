import React, { useCallback, useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { Calendar, Clock, MapPin, Edit3, Save, X, Plus, Book, Monitor, Users, MessageSquare } from 'lucide-react';
import './TimeTable.css';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const times = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];

const TimeTable = () => {
    const { user } = useContext(AuthContext);
    const canManageTimetable = user?.role === 'Admin' || user?.role === 'Teacher';

    const [selectedYear, setSelectedYear] = useState('1st Year');
    const [selectedSemester, setSelectedSemester] = useState('Semester 1');
    const [schedules, setSchedules] = useState({}); // Stores the active schedule map
    const [loading, setLoading] = useState(true);
    
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [tempCellData, setTempCellData] = useState({ course: '', room: '', type: 'Lecture' });

    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
    const semesters = ['Semester 1', 'Semester 2'];

    const fetchTimetable = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/timetable', {
                params: { year: selectedYear, semester: selectedSemester }
            });
            
            // Map the flat array of slots into a nested object: day -> time -> slot details
            const scheduleMap = {};
            data.forEach(slot => {
                if (!scheduleMap[slot.day]) scheduleMap[slot.day] = {};
                scheduleMap[slot.day][slot.time] = {
                    course: slot.course,
                    room: slot.room,
                    type: slot.type
                };
            });
            
            setSchedules(scheduleMap);
        } catch (err) {
            console.error('Failed to fetch timetable:', err);
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
                // If completely cleared, delete the slot
                await apiClient.delete('/timetable', {
                    params: { year: selectedYear, semester: selectedSemester, day, time }
                });
            } else {
                // Upsert the slot
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
            // Refresh grid
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
            <header className="page-header">
                <div>
                    <h1>Academic Timetable</h1>
                    <p className="subtitle">Manage and track your weekly academic schedule</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary">
                        <Calendar size={18} />
                        Sync Calendar
                    </button>
                    {canManageTimetable && (
                        <button
                            className={`btn ${isEditingMode ? 'btn-success' : 'btn-primary'}`}
                            onClick={handleEditToggle}
                        >
                            {isEditingMode ? <Save size={18} /> : <Edit3 size={18} />}
                            {isEditingMode ? 'Finish Editing' : 'Customize Schedule'}
                        </button>
                    )}
                </div>
            </header>

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
        </div>
    );
};

export default TimeTable;
