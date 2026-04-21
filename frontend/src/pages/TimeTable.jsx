import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Edit3, Save, X, Plus, Book, Monitor, Users, MessageSquare } from 'lucide-react';
import './TimeTable.css';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const times = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];

const initialSchedules = {
    '1st Year': {
        'Monday': { '09:00 AM': { course: 'CS101', room: 'Hall A', type: 'Lecture' }, '11:00 AM': { course: 'ENG105', room: 'Room 105', type: 'Lecture' } },
        'Tuesday': { '10:00 AM': { course: 'MTH101', room: 'Room 201', type: 'Lab' } },
        'Wednesday': { '09:00 AM': { course: 'CS101', room: 'Hall A', type: 'Lecture' } },
        'Thursday': { '11:00 AM': { course: 'ENG105', room: 'Room 105', type: 'Tutorial' } },
        'Friday': { '10:00 AM': { course: 'MTH101', room: 'Room 201', type: 'Seminar' } },
    },
    '2nd Year': {
        'Monday': { '11:00 AM': { course: 'MTH202', room: 'Room 201', type: 'Lecture' } },
        'Tuesday': { '02:00 PM': { course: 'PHY201', room: 'Lab 3', type: 'Seminar' } },
        'Wednesday': { '01:00 PM': { course: 'HIS210', room: 'Room 304', type: 'Lecture' } },
        'Thursday': { '11:00 AM': { course: 'MTH202', room: 'Room 201', type: 'Tutorial' } },
        'Friday': { '01:00 PM': { course: 'HIS210', room: 'Room 304', type: 'Tutorial' } },
    },
    '3rd Year': {
        'Monday': { '09:00 AM': { course: 'CS301', room: 'Lab 1', type: 'Project' } },
        'Tuesday': { '10:00 AM': { course: 'PHY301', room: 'Lab 3', type: 'Lab' } },
        'Thursday': { '03:00 PM': { course: 'PHY301', room: 'Lab 3', type: 'Lab' } },
    }
};

const TimeTable = () => {
    const [selectedYear, setSelectedYear] = useState('1st Year');
    const [schedules, setSchedules] = useState(initialSchedules);
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [tempCellData, setTempCellData] = useState({ course: '', room: '', type: 'Lecture' });

    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
    const currentSchedule = schedules[selectedYear] || {};

    const handleEditToggle = () => {
        setIsEditingMode(!isEditingMode);
        setEditingCell(null);
    };

    const handleCellClick = (day, time) => {
        if (!isEditingMode) return;
        setEditingCell({ day, time });
        const existingData = currentSchedule[day]?.[time];
        setTempCellData(existingData ? { ...existingData } : { course: '', room: '', type: 'Lecture' });
    };

    const handleSaveCell = (e) => {
        e.stopPropagation();
        if (!editingCell) return;
        const { day, time } = editingCell;
        setSchedules(prev => {
            const nextSchedules = { ...prev };
            if (!nextSchedules[selectedYear]) nextSchedules[selectedYear] = {};
            const yearSchedule = { ...nextSchedules[selectedYear] };
            if (!yearSchedule[day]) yearSchedule[day] = {};

            if (!tempCellData.course && !tempCellData.room) {
                delete yearSchedule[day][time];
            } else {
                yearSchedule[day][time] = { ...tempCellData };
            }

            nextSchedules[selectedYear] = yearSchedule;
            return nextSchedules;
        });
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
                    <button
                        className={`btn ${isEditingMode ? 'btn-success' : 'btn-primary'}`}
                        onClick={handleEditToggle}
                    >
                        {isEditingMode ? <Save size={18} /> : <Edit3 size={18} />}
                        {isEditingMode ? 'Finish Editing' : 'Customize Schedule'}
                    </button>
                </div>
            </header>

            <div className="year-filter-bar glass-panel">
                {years.map(year => (
                    <button
                        key={year}
                        className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                        onClick={() => setSelectedYear(year)}
                    >
                        {year}
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
                                        const session = currentSchedule[day]?.[time];
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
                </div>
            </div>
        </div>
    );
};

export default TimeTable;
