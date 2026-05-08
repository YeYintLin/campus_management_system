const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');

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

const seedUsers = async () => {
    try {
        const nodeEnv = process.env.NODE_ENV || 'development';
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
            },
            {
                name: process.env.SEED_TEACHER_NAME || 'John Doe',
                email: process.env.SEED_TEACHER_EMAIL || 'teacher@gmail.com',
                password: process.env.SEED_TEACHER_PASSWORD || 'ChangeMeTeacher123!',
                role: 'Teacher',
            },
            {
                name: process.env.SEED_STUDENT_NAME || 'Jane Smith',
                email: process.env.SEED_STUDENT_EMAIL || 'student@gmail.com',
                password: process.env.SEED_STUDENT_PASSWORD || 'ChangeMeStudent123!',
                role: 'Student',
            },
        ];

        const overwritePasswords = boolFromEnv(process.env.SEED_OVERWRITE_PASSWORDS);
        const results = [];

        for (const userData of usersToSeed) {
            const email = requireNonEmpty(userData.email, 'seed email');
            const name = requireNonEmpty(userData.name, 'seed name');

            const existing = await User.findOne({ email });
            if (!existing) {
                await User.create({ ...userData, email, name });
                results.push({ email, action: 'created' });
                continue;
            }

            existing.name = name;
            existing.role = userData.role;
            if (overwritePasswords) {
                existing.password = requireNonEmpty(userData.password, 'seed password');
            }
            await existing.save();
            results.push({ email, action: overwritePasswords ? 'updated (with password)' : 'updated' });
        }

        console.log('Seed results:');
        for (const r of results) {
            console.log(`- ${r.email}: ${r.action}`);
        }

        console.log(
            'Done. If you used the default passwords, log in and change them (or set SEED_*_PASSWORD in backend/.env).'
        );

        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
