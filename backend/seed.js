const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cms';

const seedUsers = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding');

        // Delete existing mock users to recreate them correctly with hashed passwords
        await User.deleteMany({ email: { $in: ['admin@gmail.com', 'teacher@gmail.com', 'student@gmail.com'] } });

        const usersToCreate = [
            {
                name: 'System Admin',
                email: 'admin@gmail.com',
                password: '123456',
                role: 'Admin',
            },
            {
                name: 'John Doe',
                email: 'teacher@gmail.com',
                password: 'password123',
                role: 'Teacher',
            },
            {
                name: 'Jane Smith',
                email: 'student@gmail.com',
                password: 'password123',
                role: 'Student',
            }
        ];

        for (const userData of usersToCreate) {
            await User.create(userData);
        }

        console.log(`${usersToCreate.length} users successfully seeded with hashed passwords`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
