const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set in environment.');
    process.exit(1);
}

const backfillExistingUsers = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'Users');

        // Backfill users that don't have explicit email verification status or were created before verification feature
        const result = await User.updateMany(
            {
                $or: [
                    { isEmailVerified: { $exists: false } },
                    { isApproved: { $exists: false } },
                    { status: { $exists: false } },
                    { status: null },
                    { status: '' },
                ],
            },
            {
                $set: {
                    isEmailVerified: true,
                    isApproved: true,
                    status: 'Active',
                    emailVerificationAttempts: 0,
                },
            }
        );

        console.log(`[MIGRATION SUCCESS] Updated ${result.modifiedCount} existing user documents.`);

        // Log total user count summary
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isEmailVerified: true, isApproved: true });
        console.log(`Summary: ${activeUsers} / ${totalUsers} total users are active & approved.`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    } catch (err) {
        console.error('[MIGRATION FAILED] Error backfilling users:', err);
        process.exit(1);
    }
};

backfillExistingUsers();
