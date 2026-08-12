const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set.');
    process.exit(1);
}

const Course = require('../models/Course');
const User = require('../models/User');

const DAW_MYAT_THU_ZAR_COURSES = [
    // 2nd Year
    { code: 'McE-4049', name: 'Programmable Logic Controller', year: 2, yearLabel: '2nd Year', description: 'PLC Hardware, Ladder Logic Programming, and Relay Logic.' },
    
    // 3rd Year
    { code: 'McE-32032', name: 'Electrical Machine and Control II', year: 3, yearLabel: '3rd Year', description: 'AC/DC Machines, Speed Control, and Industrial Drives.' },
    { code: 'McE-32022', name: 'Programmable Logic Controller II', year: 3, yearLabel: '3rd Year', description: 'Advanced PLC Interfacing, Analog Modules, and Industrial HMI.' },
    
    // 4th Year
    { code: 'McE-42026', name: 'Power Electronics II', year: 4, yearLabel: '4th Year', description: 'Power Inverters, Thyristor Control, and Motor Drivers.' },
    
    // 5th Year
    { code: 'McE-51039', name: 'Industrial Automation I', year: 5, yearLabel: '5th Year', description: 'SCADA Systems, Factory Automation, and Fieldbus Protocols.' },
    { code: 'McE-52039', name: 'Industrial Automation II', year: 5, yearLabel: '5th Year', description: 'Advanced Process Automation, Industrial Robotics, and Control Networks.' },
    { code: 'McE-52018', name: 'Mechatronics System Design', year: 5, yearLabel: '5th Year', description: 'Comprehensive Mechatronic Engineering System Design & Integration.' },
    { code: 'McE-51001', name: 'Control Systems Engineering', year: 5, yearLabel: '5th Year', description: 'State-space representation, PID control tuning, and stability analysis.' }
];

async function seedMyatThuZarCourses() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const teacher = await User.findOne({ email: 'myat.thu.zar@tuhmawbi.edu.mm' });
        if (!teacher) {
            console.error('Teacher Daw Myat Thu Zar not found in database.');
            process.exit(1);
        }
        const teacherId = teacher._id;
        console.log(`Linking 4-year subject curriculum for Daw Myat Thu Zar (${teacherId})...`);

        // 1. Purge corrupt blank course entries like 'McE-'
        const allDbCourses = await Course.find({});
        for (const dbc of allDbCourses) {
            const clean = (dbc.code || '').toUpperCase().replace(/\s+/g, '');
            if (!clean || clean === 'MCE-' || clean === 'MCE') {
                console.log(`[Purge] Deleting corrupt course record: '${dbc.code}' (${dbc._id})`);
                await Course.deleteOne({ _id: dbc._id });
            }
        }

        // 2. Insert or update Daw Myat Thu Zar's 4-Year Subjects
        for (const c of DAW_MYAT_THU_ZAR_COURSES) {
            let existing = await Course.findOne({ code: new RegExp(`^${c.code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') });
            if (!existing) {
                const codeNoSpaces = c.code.replace(/\s+/g, '');
                existing = await Course.findOne({ code: new RegExp(`^${codeNoSpaces.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}$`, 'i') });
            }

            if (existing) {
                existing.name = c.name;
                existing.year = c.year;
                existing.yearLabel = c.yearLabel;
                existing.description = c.description;
                existing.teacher = teacherId;
                await existing.save();
                console.log(`✓ Updated [${c.yearLabel}] ${c.code} - ${c.name}`);
            } else {
                await Course.create({
                    code: c.code,
                    name: c.name,
                    year: c.year,
                    yearLabel: c.yearLabel,
                    description: c.description,
                    teacher: teacherId,
                    students: []
                });
                console.log(`✓ Created [${c.yearLabel}] ${c.code} - ${c.name}`);
            }
        }

        console.log('\n✅ Successfully linked all 4 years of subjects for Daw Myat Thu Zar!');
        process.exit(0);
    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
}

seedMyatThuZarCourses();
