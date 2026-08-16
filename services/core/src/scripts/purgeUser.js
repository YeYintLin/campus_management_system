const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/core_db';

const targetQuery = (process.argv[2] || 'yeyint2702').trim();

async function purgeUser() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db;

        console.log(`Searching for accounts matching: "${targetQuery}"...`);
        const queryRegex = new RegExp(targetQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const users = await db.collection('users').find({
            $or: [
                { email: queryRegex },
                { name: queryRegex }
            ]
        }).toArray();

        if (!users || users.length === 0) {
            console.log(`No user found matching "${targetQuery}". Database is clean!`);
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log(`Found ${users.length} matching user(s):`);
        for (const u of users) {
            console.log(`- ${u.name} (Email: "${u.email}", Role: ${u.role}, ID: ${u._id})`);
        }

        for (const user of users) {
            const userId = user._id;
            console.log(`\nPurging: ${user.name} (${user.email})...`);

            const student = await db.collection('students').findOne({ user: userId });
            const studentId = student?._id;

            // 1. Delete from users collection
            const userDel = await db.collection('users').deleteOne({ _id: userId });
            console.log(`✓ Deleted from users: ${userDel.deletedCount}`);

            // 2. Delete from students collection
            if (studentId) {
                const studentDel = await db.collection('students').deleteOne({ _id: studentId });
                console.log(`✓ Deleted from students: ${studentDel.deletedCount}`);

                // 3. Delete academic enrollments
                const enrollDel = await db.collection('academicenrollments').deleteMany({ student: studentId });
                console.log(`✓ Deleted from academicenrollments: ${enrollDel.deletedCount}`);

                // 4. Delete grades
                const gradeDel = await db.collection('grades').deleteMany({ student: studentId });
                console.log(`✓ Deleted from grades: ${gradeDel.deletedCount}`);
            }

            // 5. Delete notifications
            const notifDel = await db.collection('notifications').deleteMany({ user: userId });
            console.log(`✓ Deleted notifications: ${notifDel.deletedCount}`);

            // 6. Delete messages
            const msgDel = await db.collection('messages').deleteMany({ $or: [{ sender: userId }, { recipient: userId }] });
            console.log(`✓ Deleted messages: ${msgDel.deletedCount}`);
        }

        console.log(`\n🎉 All matched accounts purged completely without a trace!`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error purging user:', err.message);
        process.exit(1);
    }
}

purgeUser();
