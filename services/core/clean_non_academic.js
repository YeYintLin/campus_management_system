const mongoose = require('mongoose');
require('dotenv').config();
const Course = require('./src/models/Course');

const clean = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Course.deleteMany({
        $or: [
            { code: { $regex: /private study|extra|self-study|lunch/i } },
            { name: { $regex: /private study|extra|self-study|lunch/i } }
        ]
    });

    console.log('Deleted non-academic course documents count:', result.deletedCount);
    mongoose.disconnect();
};

clean();
