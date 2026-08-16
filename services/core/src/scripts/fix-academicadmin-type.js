const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/core_db';

async function run() {
    try {
        console.log('Connecting to MongoDB at:', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);

        const result = await User.updateMany(
            { role: 'Academicadmin', adminType: { $ne: 'user_management' } },
            { $set: { adminType: 'user_management' } }
        );

        console.log(`[Migration Complete] Fixed ${result.modifiedCount} Academicadmin account(s).`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

run();
