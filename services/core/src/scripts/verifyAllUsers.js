require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function verifyAll() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const res = await User.updateMany(
            {},
            { $set: { isEmailVerified: true, isApproved: true } }
        );

        console.log(`✅ Successfully verified and approved ${res.modifiedCount || res.nModified || 0} user accounts!`);
        process.exit(0);
    } catch (err) {
        console.error('Error verifying users:', err);
        process.exit(1);
    }
}

verifyAll();
