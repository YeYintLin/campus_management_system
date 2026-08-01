const mongoose = require('mongoose');
const User = require('./src/models/User');
const Student = require('./src/models/Student');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI = 'mongodb+srv://yeyint2702:1234567890@cluster0.yczoc.mongodb.net/core_db?retryWrites=true&w=majority';

async function syncStatuses() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const students = await Student.find().populate('user');
        let updatedCount = 0;

        for (const s of students) {
            if (s.user && s.user.status && s.status !== s.user.status) {
                s.status = s.user.status;
                await s.save();
                updatedCount++;
                console.log(`Synced ${s.user.name}: ${s.status}`);
            }
        }

        console.log(`Finished. Synced ${updatedCount} student statuses.`);
    } catch (e) {
        console.error('Error syncing:', e.message);
    } finally {
        await mongoose.disconnect();
    }
}

syncStatuses();
