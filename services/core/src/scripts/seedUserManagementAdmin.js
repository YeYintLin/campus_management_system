const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/core_db';

const seedUserManagementAdmin = async () => {
    try {
        console.log('Connecting to MongoDB:', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);

        const email = 'usermanager@tuhmawbi.edu.mm';
        let user = await User.findOne({ email });

        if (user) {
            user.role = 'Admin';
            user.adminType = 'user_management';
            user.status = 'Active';
            user.isApproved = true;
            user.isEmailVerified = true;
            user.password = 'Password123!';
            await user.save();
            console.log('Updated existing account to User Management Admin:', email);
        } else {
            user = await User.create({
                name: 'Office Registrar (User Management)',
                email: email,
                password: 'Password123!',
                role: 'Admin',
                adminType: 'user_management',
                department: 'Student Affairs & Registration',
                status: 'Active',
                isApproved: true,
                isEmailVerified: true,
            });
            console.log('Created new User Management Admin account:', email);
        }

        console.log('\n--- Account Credentials ---');
        console.log('Email:     usermanager@tuhmawbi.edu.mm');
        console.log('Password:  Password123!');
        console.log('Role:      Admin');
        console.log('AdminType: user_management');
        console.log('---------------------------\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error seeding User Management Admin:', err);
        process.exit(1);
    }
};

seedUserManagementAdmin();
