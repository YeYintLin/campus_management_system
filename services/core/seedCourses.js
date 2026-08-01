const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');
const Course = require('./src/models/Course');
const Student = require('./src/models/Student');
const Grade = require('./src/models/Grade');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in backend/.env');
}

// Exactly 3 subjects for 6th Year Semester 1
const coursesData = [
    { 
        code: 'HSS 61011', 
        name: 'Humanities and Social Science', 
        description: 'Professional ethics, engineering management, humanities, and social science principles.' 
    },
    { 
        code: 'McE 61031', 
        name: 'System Design', 
        description: 'Mechatronic system design methodology, sensor-actuator integration, control design, and engineering synthesis.' 
    },
    { 
        code: 'McE 61028', 
        name: 'Quality Control', 
        description: 'Statistical quality control, total quality management (TQM), reliability engineering, and industrial process control.' 
    }
];

const seed = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the teacher
        const teacher = await User.findOne({ role: 'Teacher' });
        if (!teacher) {
            console.error('No teacher found in database. Run node seed.js first.');
            process.exit(1);
        }
        console.log(`Using teacher: ${teacher.name} (${teacher.email})`);

        // Find students
        const students = await User.find({ role: 'Student' });
        console.log(`Found ${students.length} students in database.`);

        // Clear existing courses
        await Course.deleteMany({});
        console.log('Cleared existing courses.');

        // Clear existing grades
        await Grade.deleteMany({});
        console.log('Cleared existing grades.');

        const createdCourses = [];
        for (const cData of coursesData) {
            const course = await Course.create({
                ...cData,
                teacher: teacher._id,
                students: students.map(s => s._id) // Enroll all 15 VI-MC students in all 3 subjects
            });
            console.log(`Created course: ${course.code} - ${course.name}`);
            createdCourses.push(course);
        }

        // Seed grades for each student across the 3 final year subjects
        let gradeCount = 0;
        for (const student of students) {
            for (const course of createdCourses) {
                const score = Math.floor(Math.random() * 25) + 75; // Scores between 75 and 100

                await Grade.create({
                    course: course._id,
                    student: student._id,
                    assessmentType: course.code, // Frontend maps by code
                    score,
                    maxScore: 100,
                    comments: '6th Year Sem 1 Assessment'
                });
                gradeCount++;
            }
        }

        console.log(`\nSuccessfully seeded EXACTLY ${createdCourses.length} subjects for 6th Year Sem 1 and ${gradeCount} grades!`);
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seed();
