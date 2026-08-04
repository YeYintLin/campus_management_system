import * as XLSX from 'xlsx';

/**
 * Official TU Hmawbi Excel Exporter
 * Generates downloadable .xlsx workbooks in exact original TU Hmawbi document layouts
 */

export const exportAcademicMatrixExcel = (year, semester, major, familyTeacher, majorRoom, scheduleMap) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const header = [
        ['Technological University (Hmawbi)'],
        [`Timetable for ${year} (${semester})`],
        [`Department of ${major} Engineering`],
        [`Family Teacher: ${familyTeacher || 'Faculty Member'} | Major Room: ${majorRoom || '3/212-A'}`],
        []
    ];

    const tableHeader = [
        'Day',
        'Period 1 (9:00-9:50am)',
        'Period 2 (10:00-10:50am)',
        'Period 3 (11:00-11:50am)',
        'LUNCH BREAK (12:00-1:00pm)',
        'Period 4 (1:00-1:50pm)',
        'Period 5 (2:00-2:50pm)',
        'Period 6 (3:00-3:50pm)'
    ];

    const rows = days.map(day => {
        const daySlots = scheduleMap[day] || {};
        return [
            day,
            daySlots['09:00 AM']?.course || '',
            daySlots['10:00 AM']?.course || '',
            daySlots['11:00 AM']?.course || '',
            'LUNCH BREAK',
            daySlots['01:00 PM']?.course || '',
            daySlots['02:00 PM']?.course || '',
            daySlots['03:00 PM']?.course || ''
        ];
    });

    const aoa = [...header, tableHeader, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}_Academic_Timetable`);
    XLSX.writeFile(wb, `TU_Hmawbi_${year}_${major}_Academic_Timetable.xlsx`);
};

export const exportDateScheduleExcel = (sessionType, year, semester, major, sessions) => {
    const titleText = `${sessionType} Timetable for ${major} (${year} ${semester})`;
    const header = [
        ['TECHNOLOGICAL UNIVERSITY HMAWBI'],
        [`Department of ${major} Engineering`],
        [titleText],
        []
    ];

    const tableHeader = ['Year', 'Subject Code', `${sessionType} Title`, 'Teacher', 'Student (Group)', 'Date', 'Time', 'Place'];

    const rows = (sessions || []).map(s => {
        const dStr = s.date ? new Date(s.date).toLocaleDateString() : '';
        return [
            s.year || year,
            s.courseCode || 'SUBJ',
            s.title || s.courseName || '',
            s.teacher || '',
            s.groupTag || 'All',
            dStr,
            `${s.startTime || '08:30 AM'} to ${s.endTime || '11:30 AM'}`,
            s.place || '3/212-A'
        ];
    });

    const aoa = [...header, tableHeader, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${sessionType}_Schedule`);
    XLSX.writeFile(wb, `TU_Hmawbi_${year}_${major}_${sessionType}_Timetable.xlsx`);
};

export const exportExamScheduleExcel = (year, semester, major, examType, sessions) => {
    const header = [
        ['Technological University (Hmawbi)'],
        [`${examType || 'Mid-Term'} Exam Timetable For ${year} Engineering Course`],
        [`(${semester})`],
        []
    ];

    const tableHeader = ['Sr. No.', 'Day & Date', 'Time (AM)', 'Major', 'Subject Code & Name', 'Status'];

    const rows = (sessions || []).map((s, idx) => {
        const dObj = s.date ? new Date(s.date) : new Date();
        const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleDateString('en-US', { weekday: 'long' })}`;
        return [
            idx + 1,
            dateStr,
            `${s.startTime || '08:30 AM'} To ${s.endTime || '11:30 AM'}`,
            s.major || major,
            `${s.courseCode} ${s.courseName}`,
            s.status || 'Draft'
        ];
    });

    const aoa = [...header, tableHeader, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Exam_Schedule`);
    XLSX.writeFile(wb, `TU_Hmawbi_${year}_${major}_${examType}_Exam_Timetable.xlsx`);
};
