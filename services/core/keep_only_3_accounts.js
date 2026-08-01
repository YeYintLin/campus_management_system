const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');
const Student = require('./src/models/Student');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
}

const run = async () => {
    try {
        console.log('Connecting to MongoDB database...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB!');

        const allowedAccounts = [
            {
                name: 'System Admin',
                email: 'admin@tuhmawbi.edu.mm',
                password: 'ChangeMeAdmin123!',
                role: 'Admin',
                department: 'Academic Administration',
                title: 'System Administrator',
                status: 'Active',
            },
            {
                name: 'Teacher User',
                email: 'teacher@tuhmawbi.edu.mm',
                password: 'ChangeMeTeacher123!',
                role: 'Teacher',
                department: 'Mechatronics Engineering',
                title: 'Lecturer',
                status: 'Active',
            },
            {
                name: 'Student User',
                email: 'student@tuhmawbi.edu.mm',
                password: 'ChangeMeStudent123!',
                role: 'Student',
                department: 'Mechatronics Engineering',
                status: 'Active',
            },
        ];

        const allowedEmails = allowedAccounts.map(a => a.email.toLowerCase());

        console.log('\n--- 1. Upserting 3 Primary Test Accounts ---');
        const userMap = {};

        for (const acc of allowedAccounts) {
            let user = await User.findOne({ email: acc.email.toLowerCase() });
            if (!user) {
                user = await User.create({
                    name: acc.name,
                    email: acc.email.toLowerCase(),
                    password: acc.password,
                    role: acc.role,
                    department: acc.department,
                    title: acc.title,
                    status: acc.status,
                });
                console.log(`+ Created account: ${acc.email} (${acc.role})`);
            } else {
                user.name = acc.name;
                user.password = acc.password;
                user.role = acc.role;
                user.department = acc.department;
                user.status = acc.status;
                if (acc.title) user.title = acc.title;
                await user.save();
                console.log(`~ Updated account: ${acc.email} (${acc.role})`);
            }
            userMap[acc.role] = user;
        }

        // Ensure Student Profile exists for the student account
        const studentUser = userMap['Student'];
        if (studentUser) {
            let studentProfile = await Student.findOne({ user: studentUser._id });
            if (!studentProfile) {
                studentProfile = await Student.create({
                    user: studentUser._id,
                    enrollmentNumber: 'I-MC-001',
                    department: 'Mechatronics Engineering',
                    semester: 6,
                    contactNumber: '09-123456789',
                    status: 'Active',
                });
                console.log('+ Created student profile for student@tuhmawbi.edu.mm');
            } else {
                studentProfile.enrollmentNumber = 'I-MC-001';
                studentProfile.department = 'Mechatronics Engineering';
                studentProfile.semester = 6;
                studentProfile.contactNumber = '09-123456789';
                studentProfile.status = 'Active';
                await studentProfile.save();
                console.log('~ Updated student profile for student@tuhmawbi.edu.mm');
            }
        }

        console.log('\n--- 2. Removing All Other User Accounts & Profiles ---');
        
        // Remove student profiles not matching our single student user
        const deletedProfilesResult = await Student.deleteMany({ user: { $ne: studentUser._id } });
        console.log(`- Removed ${deletedProfilesResult.deletedCount} extra student profiles.`);

        // Remove user accounts not in allowedEmails
        const deletedUsersResult = await User.deleteMany({ email: { $nin: allowedEmails } });
        console.log(`- Removed ${deletedUsersResult.deletedCount} extra user accounts.`);

        console.log('\n--- 3. Final Verification of Database Accounts ---');
        const remainingUsers = await User.find({}, 'name email role status');
        console.log(`Total remaining users in DB: ${remainingUsers.length}`);
        remainingUsers.forEach(u => {
            console.log(` - [${u.role}] ${u.name} (${u.email}) - Status: ${u.status || 'Active'}`);
        });

        const remainingProfiles = await Student.find().populate('user', 'name email');
        console.log(`Total remaining student profiles in DB: ${remainingProfiles.length}`);
        remainingProfiles.forEach(p => {
            console.log(` - Profile: ${p.enrollmentNumber} | Student: ${p.user?.name} (${p.user?.email})`);
        });

        await mongoose.disconnect();
        console.log('\nSuccessfully cleaned up database to leave only 1 Admin, 1 Teacher, and 1 Student account!');
        process.exit(0);
    } catch (err) {
        console.error('Error during cleanup:', err);
        process.exit(1);
    }
};

run();
