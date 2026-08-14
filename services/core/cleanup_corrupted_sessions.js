const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ScheduledSession = require('./src/models/ScheduledSession');

async function cleanup() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/cms_core';
        console.log('Connecting to MongoDB at:', mongoUri);
        await mongoose.connect(mongoUri);

        console.log('Scanning for corrupted ScheduledSession records...');

        const deleteQuery = {
            $or: [
                { courseCode: { $regex: '^[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4}$' } },
                { courseCode: { $regex: '^GROUP', $options: 'i' } },
                { courseCode: { $regex: '^BATCH', $options: 'i' } },
                { courseCode: { $regex: '[0-9]{1,2}:[0-9]{2}' } },
                { courseCode: { $regex: 'APPROVED|PREPARED|DEPARTMENT|UNIVERSITY|HEAD', $options: 'i' } },
                { courseCode: { $in: ['', null, 'undefined', 'null', 'SR', 'NO', 'SR. NO', 'SR.NO'] } }
            ]
        };

        const result = await ScheduledSession.deleteMany(deleteQuery);
        console.log(`✅ Cleanup Complete: Deleted ${result.deletedCount} corrupted ScheduledSession documents.`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
        process.exit(1);
    }
}

cleanup();
