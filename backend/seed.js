const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');
const Student = require('./src/models/Student');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Set it in backend/.env before running the seed.');
}

const requireNonEmpty = (value, name) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${name} is required`);
    }
    return value.trim();
};

const boolFromEnv = (value) => String(value).toLowerCase() === 'true';
const normalizeEmail = (email) => requireNonEmpty(email, 'seed email').toLowerCase();

const seedUsers = async () => {
    try {
        const nodeEnv = process.env.NODE_ENV || 'development';
        const demoMode = process.argv.includes('--demo');
        const allowProduction = boolFromEnv(process.env.SEED_ALLOW_PRODUCTION);
        if (nodeEnv === 'production' && !allowProduction) {
            throw new Error(
                'Refusing to seed users in production. Set SEED_ALLOW_PRODUCTION=true if you are absolutely sure.'
            );
        }

        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding');

        const usersToSeed = [
            {
                name: process.env.SEED_ADMIN_NAME || 'System Admin',
                email: process.env.SEED_ADMIN_EMAIL || 'admin@gmail.com',
                password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMeAdmin123!',
                role: 'Admin',
                demo: {
                    department: 'Academic Administration',
                    title: 'System Administrator',
                    status: 'Active',
                },
            },
            {
                name: process.env.SEED_TEACHER_NAME || 'John Doe',
                email: process.env.SEED_TEACHER_EMAIL || 'teacher@gmail.com',
                password: process.env.SEED_TEACHER_PASSWORD || 'ChangeMeTeacher123!',
                role: 'Teacher',
                demo: {
                    department: 'Mechatronics Engineering',
                    title: 'Lecturer',
                    status: 'Active',
                    office: 'MECH-204',
                    consultationHours: 'Mon/Wed 2:00 PM - 4:00 PM',
                    specialization: 'Robotics and Control Systems',
                },
            },
            {
                name: process.env.SEED_STUDENT_NAME || 'Jane Smith',
                email: process.env.SEED_STUDENT_EMAIL || 'student@gmail.com',
                password: process.env.SEED_STUDENT_PASSWORD || 'ChangeMeStudent123!',
                role: 'Student',
                demo: {
                    department: 'Mechatronics Engineering',
                    year: 'Final Year',
                    status: 'Active',
                },
            },
        ];

        const overwritePasswords = demoMode || boolFromEnv(process.env.SEED_OVERWRITE_PASSWORDS);
        const results = [];
        let seededStudentUser = null;

        for (const userData of usersToSeed) {
            const email = normalizeEmail(userData.email);
            const name = requireNonEmpty(userData.name, 'seed name');
            const password = requireNonEmpty(userData.password, 'seed password');
            const { demo, ...userFields } = userData;

            const existing = await User.findOne({ email });
            if (!existing) {
                const created = await User.create({ ...userFields, ...demo, email, name, password });
                if (created.role === 'Student') seededStudentUser = created;
                results.push({ email, action: 'created' });
                continue;
            }

            existing.name = name;
            existing.role = userData.role;
            Object.assign(existing, demo);
            if (overwritePasswords) {
                existing.password = password;
            }
            await existing.save();
            if (existing.role === 'Student') seededStudentUser = existing;
            results.push({ email, action: overwritePasswords ? 'updated (with password)' : 'updated' });
        }

        if (seededStudentUser) {
            const enrollmentNumber = process.env.SEED_STUDENT_ENROLLMENT || 'MECH-2026-001';
            const studentProfile = await Student.findOne({ user: seededStudentUser._id });
            if (!studentProfile) {
                await Student.create({
                    user: seededStudentUser._id,
                    enrollmentNumber,
                    department: process.env.SEED_STUDENT_DEPARTMENT || 'Mechatronics Engineering',
                    semester: Number(process.env.SEED_STUDENT_SEMESTER) || 8,
                    contactNumber: process.env.SEED_STUDENT_CONTACT || '09-000-000-001',
                    status: 'Active',
                });
                results.push({ email: seededStudentUser.email, action: 'student profile created' });
            } else {
                studentProfile.enrollmentNumber = studentProfile.enrollmentNumber || enrollmentNumber;
                studentProfile.department = process.env.SEED_STUDENT_DEPARTMENT || studentProfile.department;
                studentProfile.semester = Number(process.env.SEED_STUDENT_SEMESTER) || studentProfile.semester;
                studentProfile.contactNumber = process.env.SEED_STUDENT_CONTACT || studentProfile.contactNumber;
                studentProfile.status = studentProfile.status || 'Active';
                await studentProfile.save();
                results.push({ email: seededStudentUser.email, action: 'student profile verified' });
            }
        }

        console.log('Seed results:');
        for (const r of results) {
            console.log(`- ${r.email}: ${r.action}`);
        }

        console.log(
            demoMode
                ? 'Done. Demo users are ready with the configured demo passwords.'
                : 'Done. If you used the default passwords, log in and change them (or set SEED_*_PASSWORD in backend/.env).'
        );

        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
