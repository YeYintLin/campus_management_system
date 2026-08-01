const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');
const Student = require('./src/models/Student');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Set it in services/core/.env before running the seed.');
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
                email: process.env.SEED_ADMIN_EMAIL || 'admin@tuhmawbi.edu.mm',
                password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMeAdmin123!',
                role: 'Admin',
                demo: {
                    department: 'Academic Administration',
                    title: 'System Administrator',
                    status: 'Active',
                },
            },
            {
                name: process.env.SEED_TEACHER_NAME || 'Teacher User',
                email: process.env.SEED_TEACHER_EMAIL || 'teacher@tuhmawbi.edu.mm',
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
                name: process.env.SEED_STUDENT_NAME || 'Student User',
                email: process.env.SEED_STUDENT_EMAIL || 'student@tuhmawbi.edu.mm',
                password: process.env.SEED_STUDENT_PASSWORD || 'ChangeMeStudent123!',
                role: 'Student',
                demo: {
                    department: 'Mechatronics Engineering',
                    year: '3rd Year',
                    status: 'Active',
                },
            },
        ];

        const overwritePasswords = demoMode || boolFromEnv(process.env.SEED_OVERWRITE_PASSWORDS);
        const results = [];
        const allowedEmails = usersToSeed.map(u => normalizeEmail(u.email));

        for (const userData of usersToSeed) {
            const email = normalizeEmail(userData.email);
            const name = requireNonEmpty(userData.name, 'seed name');
            const password = requireNonEmpty(userData.password, 'seed password');
            const { demo, ...userFields } = userData;

            const existing = await User.findOne({ email });
            if (!existing) {
                await User.create({ ...userFields, ...demo, email, name, password });
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
            results.push({ email, action: overwritePasswords ? 'updated (with password)' : 'updated' });
        }

        // Clean up any extra users not in allowed list
        const deletedUsers = await User.deleteMany({ email: { $nin: allowedEmails } });
        if (deletedUsers.deletedCount > 0) {
            results.push({ email: 'extra_users', action: `removed ${deletedUsers.deletedCount} extra accounts` });
        }

        // Ensure student profile exists for the student account
        const studentUsers = await User.find({ role: 'Student' });
        const studentUserIds = studentUsers.map(u => u._id);

        // Delete extra student profiles
        const deletedProfiles = await Student.deleteMany({ user: { $nin: studentUserIds } });
        if (deletedProfiles.deletedCount > 0) {
            results.push({ email: 'extra_profiles', action: `removed ${deletedProfiles.deletedCount} extra student profiles` });
        }

        for (let i = 0; i < studentUsers.length; i++) {
            const studentUser = studentUsers[i];
            const enrollmentNumber = 'I-MC-001';

            const studentProfile = await Student.findOne({ user: studentUser._id });
            if (!studentProfile) {
                await Student.create({
                    user: studentUser._id,
                    enrollmentNumber,
                    department: studentUser.department || 'Mechatronics Engineering',
                    semester: 6,
                    contactNumber: '09-123456789',
                    status: 'Active',
                });
                results.push({ email: studentUser.email, action: 'student profile created' });
            } else {
                studentProfile.enrollmentNumber = enrollmentNumber;
                studentProfile.department = 'Mechatronics Engineering';
                studentProfile.semester = 6;
                studentProfile.contactNumber = '09-123456789';
                studentProfile.status = 'Active';
                await studentProfile.save();
                results.push({ email: studentUser.email, action: 'student profile verified' });
            }
        }

        console.log('Seed results:');
        for (const r of results) {
            console.log(`- ${r.email}: ${r.action}`);
        }

        console.log('Done seeding users.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
