const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const dotenv = require('dotenv');
const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    '/var/www/cms/services/core/.env',
    '/var/www/cms/.env'
];
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
    }
}

const ScheduledSession = require('./src/models/ScheduledSession');

async function cleanup() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb+srv://yeyint2702:1234567890@cluster0.yczoc.mongodb.net/core_db?retryWrites=true&w=majority';
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
        console.log('Connected to MongoDB successfully.');

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
