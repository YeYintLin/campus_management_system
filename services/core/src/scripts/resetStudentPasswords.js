require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongo:27017/core_db';
const NEW_PASSWORD = process.argv[2] || 'TUHmawbi2026!';

async function resetPasswords() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        const studentUsers = await User.find({ role: { $regex: /student/i } });
        console.log(`Found ${studentUsers.length} student accounts.`);

        for (const user of studentUsers) {
            user.password = NEW_PASSWORD;
            user.isEmailVerified = true;
            user.isApproved = true;
            user.status = 'Active';
            await user.save(); // triggers bcrypt hash in pre-save hook
            console.log(`✅ Reset password for: ${user.email} (${user.name}) -> ${NEW_PASSWORD}`);
        }

        console.log('\n=============================================');
        console.log(`All ${studentUsers.length} student passwords have been set to: ${NEW_PASSWORD}`);
        console.log('All accounts are marked isEmailVerified: true & isApproved: true');
        console.log('=============================================\n');

        process.exit(0);
    } catch (err) {
        console.error('Error resetting student passwords:', err);
        process.exit(1);
    }
}

resetPasswords();
