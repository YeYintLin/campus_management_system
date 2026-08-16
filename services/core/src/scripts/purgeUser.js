const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/core_db';

const targetEmail = process.argv[2] || 'yeyint2702@gmail.com';

async function purgeUser() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;

        const normalizedEmail = targetEmail.trim().toLowerCase();
        const user = await db.collection('users').findOne({ email: normalizedEmail });

        if (!user) {
            console.log(`No user found with email: "${normalizedEmail}". Already clean!`);
            await mongoose.disconnect();
            process.exit(0);
        }

        const userId = user._id;
        console.log(`Found user: ${user.name} (${user.email}) [ID: ${userId}]`);

        // Find associated student document if any
        const student = await db.collection('students').findOne({ user: userId });
        const studentId = student?._id;

        // 1. Delete from users collection
        const userDel = await db.collection('users').deleteOne({ _id: userId });
        console.log(`✓ Deleted User document: ${userDel.deletedCount}`);

        // 2. Delete from students collection
        if (studentId) {
            const studentDel = await db.collection('students').deleteOne({ _id: studentId });
            console.log(`✓ Deleted Student document: ${studentDel.deletedCount}`);

            // 3. Delete academic enrollments
            const enrollDel = await db.collection('academicenrollments').deleteMany({ student: studentId });
            console.log(`✓ Deleted AcademicEnrollments: ${enrollDel.deletedCount}`);

            // 4. Delete grades
            const gradeDel = await db.collection('grades').deleteMany({ student: studentId });
            console.log(`✓ Deleted Grades: ${gradeDel.deletedCount}`);
        }

        // 5. Delete notifications
        const notifDel = await db.collection('notifications').deleteMany({ user: userId });
        console.log(`✓ Deleted Notifications: ${notifDel.deletedCount}`);

        // 6. Delete messages
        const msgDel = await db.collection('messages').deleteMany({ $or: [{ sender: userId }, { recipient: userId }] });
        console.log(`✓ Deleted Messages: ${msgDel.deletedCount}`);

        // 7. Delete audit logs
        if (studentId) {
            await db.collection('auditlogs').deleteMany({ $or: [{ performedBy: userId }, { targetStudent: studentId }] });
        } else {
            await db.collection('auditlogs').deleteMany({ performedBy: userId });
        }

        console.log(`\n🎉 User "${normalizedEmail}" has been completely wiped without a trace!`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error purging user:', err.message);
        process.exit(1);
    }
}

purgeUser();
