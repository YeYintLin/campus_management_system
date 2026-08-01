const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Timetable = require('./src/models/Timetable');
const Exam = require('./src/models/Exam');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear 6th Year Timetable & Exams
        await Timetable.deleteMany({ year: '6th Year' });
        await Exam.deleteMany({ year: '6th Year' });
        console.log('Cleared existing 6th Year timetable and exams.');

        // 6th Year Semester 1 Timetable
        const timetableEntries = [
            { year: '6th Year', semester: 'Semester 1', day: 'Monday',    time: '09:00 AM - 12:00 PM', course: 'HSS 61011', room: 'Room 201', type: 'Lecture' },
            { year: '6th Year', semester: 'Semester 1', day: 'Tuesday',   time: '09:00 AM - 12:00 PM', course: 'McE 61031', room: 'Lab 102',  type: 'Lab' },
            { year: '6th Year', semester: 'Semester 1', day: 'Wednesday', time: '09:00 AM - 12:00 PM', course: 'McE 61028', room: 'Room 203', type: 'Lecture' },
            { year: '6th Year', semester: 'Semester 1', day: 'Thursday',  time: '01:00 PM - 04:00 PM', course: 'McE 61031', room: 'Room 201', type: 'Lecture' },
            { year: '6th Year', semester: 'Semester 1', day: 'Friday',    time: '01:00 PM - 04:00 PM', course: 'McE 61028', room: 'Lab 104',  type: 'Lab' },
        ];

        for (const entry of timetableEntries) {
            await Timetable.create(entry);
        }
        console.log(`Seeded ${timetableEntries.length} timetable entries for 6th Year Sem 1.`);

        // 6th Year Semester 1 Exams
        const examEntries = [
            { title: 'Humanities & Social Science Final Exam', course: 'HSS 61011', duration: '3 Hours', date: '2026-09-15', time: '09:00 AM', room: 'Exam Hall A', year: '6th Year', status: 'Scheduled' },
            { title: 'System Design Examination',            course: 'McE 61031', duration: '3 Hours', date: '2026-09-17', time: '09:00 AM', room: 'Exam Hall B', year: '6th Year', status: 'Scheduled' },
            { title: 'Quality Control Examination',           course: 'McE 61028', duration: '3 Hours', date: '2026-09-19', time: '09:00 AM', room: 'Exam Hall A', year: '6th Year', status: 'Scheduled' },
        ];

        for (const entry of examEntries) {
            await Exam.create(entry);
        }
        console.log(`Seeded ${examEntries.length} exam schedules for 6th Year Sem 1.`);

        process.exit(0);
    } catch (err) {
        console.error('Error seeding timetable & exams:', err);
        process.exit(1);
    }
};

run();
