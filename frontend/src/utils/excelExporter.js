import * as XLSX from 'xlsx';

/**
 * Official TU Hmawbi Excel Exporter
 * Generates downloadable .xlsx workbooks matching the EXACT 100% original TU Hmawbi document layout
 * (e.g. Time Table 2025-2026 (1.6.25).xlsx)
 */

export const exportAcademicMatrixExcel = (year, semester, major, familyTeacher, majorRoom, scheduleMap, courseList = []) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const yearRoman = year === '1st Year' ? 'I' : year === '2nd Year' ? 'II' : year === '3rd Year' ? 'III' : year === '4th Year' ? 'IV' : year === '5th Year' ? 'V' : 'ME';

    const header = [
        ['Technological University (Hmawbi)'],
        ['Timetable for 2025-2026 Academic Year'],
        [`Department of ${major === 'MC' ? 'Mechatronic' : major} Engineering`],
        [`Timetable for ${yearRoman} ${major} (${semester || 'Second Semester'})`],
        [`                                                                      Major Room (  ${majorRoom || '3/212-A'} )`],
        [
            'Day',
            '1\r\n9:00-9:50am',
            '2\r\n10:00-10:50am',
            '3\r\n11:00-11:50am',
            'LUNCH BREAK\r\n12:00 to 1:00 pm',
            '4\r\n1:00-1:50pm',
            '5\r\n2:00-2:50pm',
            '6\r\n3:00-3:50pm'
        ],
        []
    ];

    const rows = days.map(day => {
        const daySlots = scheduleMap[day] || {};
        const getCellStr = (timeKey) => {
            const slot = daySlots[timeKey];
            if (!slot || !slot.course) return '';
            const code = slot.course;
            const type = slot.type || 'Lecture';
            if (type.toLowerCase().includes('tutorial') || type.toLowerCase() === 't') return `${code}(T)`;
            if (type.toLowerCase().includes('practical') || type.toLowerCase() === 'p') return `${code}(P)`;
            if (type.toLowerCase().includes('lecture') || type.toLowerCase() === 'l') return `${code}(L)`;
            return code;
        };

        return [
            day,
            getCellStr('09:00 AM'),
            getCellStr('10:00 AM'),
            getCellStr('11:00 AM'),
            '', // LUNCH BREAK Column
            getCellStr('01:00 PM'),
            getCellStr('02:00 PM'),
            getCellStr('03:00 PM')
        ];
    });

    const footer = [
        [`Family Teacher - ${familyTeacher || 'Daw Myat Thu Zar'}`],
        ['(L)=Lecture                      (T)=Tutorial                                  (P)=Practical']
    ];

    // Build Course & Teacher Legend Table
    const legendRows = [];
    if (Array.isArray(courseList) && courseList.length > 0) {
        courseList.forEach((c, idx) => {
            legendRows.push([`(${idx + 1})${c.code || c.courseCode}`, '', c.name || c.courseName || c.code, '', '', c.teacher || 'Faculty Member']);
        });
    } else {
        // Collect courses from schedule map
        const collected = new Map();
        Object.values(scheduleMap).forEach(dayObj => {
            Object.values(dayObj || {}).forEach(slot => {
                if (slot && slot.course) {
                    const cleanCode = slot.course.replace(/\(L\)|\(T\)|\(P\)/gi, '').trim();
                    if (!collected.has(cleanCode)) {
                        collected.set(cleanCode, {
                            code: cleanCode,
                            name: slot.courseName || cleanCode,
                            teacher: slot.teacher || familyTeacher || 'Faculty Member'
                        });
                    }
                }
            });
        });
        Array.from(collected.values()).forEach((c, idx) => {
            legendRows.push([`(${idx + 1})${c.code}`, '', c.name, '', '', c.teacher]);
        });
    }

    const aoa = [...header, ...rows, ...footer, ...legendRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths for beautiful Excel display
    ws['!cols'] = [
        { wch: 14 }, // Day
        { wch: 18 }, // Period 1
        { wch: 18 }, // Period 2
        { wch: 26 }, // Period 3
        { wch: 20 }, // Lunch
        { wch: 26 }, // Period 4
        { wch: 18 }, // Period 5
        { wch: 18 }  // Period 6
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${yearRoman}_MC_Timetable`);
    XLSX.writeFile(wb, `Time_Table_2025-2026_${yearRoman}_MC.xlsx`);
};

export const exportDateScheduleExcel = (sessionType, year, semester, major, sessions) => {
    const titleText = `${sessionType} Timetable for ${major} (${year} ${semester})`;
    const header = [
        ['Technological University (Hmawbi)'],
        ['Timetable for 2025-2026 Academic Year'],
        [`Department of ${major === 'MC' ? 'Mechatronic' : major} Engineering`],
        [titleText],
        []
    ];

    const tableHeader = ['Sr. No.', 'Day & Date', 'Subject Code & Name', 'Teacher', 'Student (Group)', 'Time', 'Place / Room'];

    const rows = (sessions || []).map((s, idx) => {
        const dStr = s.date ? new Date(s.date).toLocaleDateString() : '';
        return [
            idx + 1,
            dStr,
            `${s.courseCode || 'SUBJ'} - ${s.title || s.courseName || ''}`,
            s.teacher || '',
            s.groupTag || 'All',
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
        ['Timetable for 2025-2026 Academic Year'],
        [`Department of ${major === 'MC' ? 'Mechatronic' : major} Engineering`],
        [`${examType || 'Mid-Term'} Exam Timetable For ${year} Engineering Course`],
        [`(${semester})`],
        []
    ];

    const tableHeader = ['Sr. No.', 'Day & Date', 'Time (AM/PM)', 'Major', 'Subject Code & Name', 'Invigilator / Room'];

    const rows = (sessions || []).map((s, idx) => {
        const dObj = s.date ? new Date(s.date) : new Date();
        const dateStr = `${dObj.toLocaleDateString()} ${dObj.toLocaleDateString('en-US', { weekday: 'long' })}`;
        return [
            idx + 1,
            dateStr,
            `${s.startTime || '08:30 AM'} To ${s.endTime || '11:30 AM'}`,
            s.major || major,
            `${s.courseCode || s.course || ''} ${s.title || s.courseName || ''}`,
            `${s.teacher || 'Faculty Member'} (${s.place || 'Room 1/109'})`
        ];
    });

    const aoa = [...header, tableHeader, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Exam_Seating_Timetable');
    XLSX.writeFile(wb, `TU_Hmawbi_${year}_${major}_Exam_Seating_Timetable.xlsx`);
};
