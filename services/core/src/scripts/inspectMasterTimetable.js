const fs = require('fs');
const XLSX = require('xlsx');
const { parseTUHmawbiExcel } = require('../utils/excelParser');

const filePath = 'C:\\Users\\ASUS\\Downloads\\Time Table 2025-2026 (1.6.25).xlsx';

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('--- Master Timetable Inspection ---');
console.log('Sheet Names:', workbook.SheetNames);

const { parsedMatrix, parsedSessions, headerError } = parseTUHmawbiExcel(fileBuffer, 'Academic');

console.log('\n--- Parsed Academic Matrix Slots ---');
console.log('Total slots parsed:', parsedMatrix.length);
if (headerError) console.log('Header Notice:', headerError);

const teacherSubjects = new Map();
parsedMatrix.forEach(slot => {
    const teacher = slot.teacher || slot.familyTeacher || 'Unassigned';
    const code = slot.courseCode;
    const year = slot.year;
    if (code) {
        if (!teacherSubjects.has(teacher)) teacherSubjects.set(teacher, []);
        teacherSubjects.get(teacher).push({ code, name: slot.courseName, year, day: slot.day });
    }
});

console.log('\n--- Teacher Subject Mapping ---');
for (const [teacher, subjects] of teacherSubjects.entries()) {
    console.log(`Teacher: ${teacher}`);
    const unique = [...new Set(subjects.map(s => `${s.code} (${s.year})`))];
    console.log('  Subjects:', unique);
}
