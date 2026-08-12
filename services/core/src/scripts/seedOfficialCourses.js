const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set in environment.');
    process.exit(1);
}

const Course = require('../models/Course');
const User = require('../models/User');

const OFFICIAL_COURSES = [
    // 5th Year Subjects
    { code: 'McE-51039', name: 'Industrial Automation I', year: 5, description: 'Programmable Logic Controllers (PLC), SCADA, and Industrial Robotics.' },
    { code: 'McE-52039', name: 'Industrial Automation II', year: 5, description: 'Advanced Factory Automation, Sensor Networks & Process Control.' },
    { code: 'McE-52018', name: 'Mechatronics System Design', year: 5, description: 'Comprehensive Mechatronic Engineering System Design & Integration.' },
    { code: 'McE-51001', name: 'Control Systems Engineering', year: 5, description: 'State-space representation, PID control tuning, and stability analysis.' },

    // 4th Year Subjects
    { code: 'McE-42026', name: 'Power Electronics & Drives', year: 4, description: 'Power Converters, Inverters, Motor Speed Control, and Gate Drivers.' },
    { code: 'McE-41026', name: 'Microcontroller Applications', year: 4, description: 'Embedded Systems Architecture, AVR/ARM, and Interfacing.' },
    { code: 'McE-4049', name: 'Digital Signal Processing', year: 4, description: 'Discrete Fourier Transform, FIR/IIR Filter Design, and DSP Chips.' },

    // 3rd Year Subjects
    { code: 'McE-32032', name: 'Kinematics & Dynamics of Machinery', year: 3, description: 'Mechanical linkages, gear trains, cams, and balancing of machinery.' },
    { code: 'McE-31032', name: 'Analog Circuit Design', year: 3, description: 'Operational Amplifiers, Transistors, Analog Filters, and Feedback.' },
    { code: 'McE-31022', name: 'Instrumentation & Measurement', year: 3, description: 'Sensors, Transducers, Signal Conditioning, and Data Acquisition.' },
    { code: 'McE-3027', name: 'Fluid Power Control', year: 3, description: 'Hydraulic and Pneumatic Systems Design for Industrial Applications.' },

    // 1st & 2nd Year Core Subjects
    { code: 'E-11001', name: 'English I', year: 1, description: 'Technical English & Academic Communication.' },
    { code: 'Math-11002', name: 'Engineering Mathematics I', year: 1, description: 'Calculus, Differential Equations, and Linear Algebra.' },
    { code: 'Physics-11003', name: 'Engineering Physics', year: 1, description: 'Classical Mechanics, Electromagnetism, and Optics.' },
    { code: 'McE-21005', name: 'Circuit Theory', year: 2, description: 'Kirchhoff\'s Laws, AC Circuit Analysis, and Network Theorems.' },
    { code: 'McE-22006', name: 'Digital Electronics', year: 2, description: 'Logic Gates, Combinational/Sequential Circuits, and Flip-Flops.' },
    { code: 'McE-61011', name: 'Graduation Capstone Thesis', year: 6, description: 'Final Year Mechatronics Engineering Research & Development Project.' },
];

async function seedCourses() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        // Find Daw Myat Thu Zar teacher user
        const teacher = await User.findOne({ email: 'myat.thu.zar@tuhmawbi.edu.mm' });
        const teacherId = teacher ? teacher._id : null;

        if (teacherId) {
            console.log(`Assigning instructor Daw Myat Thu Zar (${teacherId}) to courses.`);
        } else {
            console.log('Teacher Daw Myat Thu Zar not found; courses will be created without fixed teacher.');
        }

        let createdCount = 0;
        let updatedCount = 0;

        const myatThuZarCourseCodes = new Set(['McE-51039', 'McE-52039', 'McE-52018', 'McE-51001']);

        for (const c of OFFICIAL_COURSES) {
            const isHerSubject = myatThuZarCourseCodes.has(c.code);
            const assignedTeacher = isHerSubject ? teacherId : null;

            const existing = await Course.findOne({ code: c.code });
            if (existing) {
                existing.name = c.name;
                existing.year = c.year;
                existing.description = c.description;
                existing.teacher = assignedTeacher;
                await existing.save();
                updatedCount++;
            } else {
                await Course.create({
                    code: c.code,
                    name: c.name,
                    year: c.year,
                    description: c.description,
                    teacher: assignedTeacher,
                    students: [],
                });
                createdCount++;
            }
        }

        const officialCodesSet = new Set(OFFICIAL_COURSES.map(c => c.code.toUpperCase().replace(/\s+/g, '')));

        // Delete stray courses that are not in official curriculum list
        const allDbCourses = await Course.find({});
        let deletedStrayCount = 0;
        for (const dbc of allDbCourses) {
            const cleanCode = (dbc.code || '').toUpperCase().replace(/\s+/g, '');
            if (!officialCodesSet.has(cleanCode)) {
                await Course.deleteOne({ _id: dbc._id });
                deletedStrayCount++;
            }
        }

        console.log(`[SEED SUCCESS] Created ${createdCount} new subjects, updated ${updatedCount} existing subjects, purged ${deletedStrayCount} stray course codes.`);
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seedCourses();
