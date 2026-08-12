const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ResourceFile = require('../models/ResourceFile');
const CustomFolder = require('../models/CustomFolder');
const Course = require('../models/Course');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/core_db';

async function verify() {
    try {
        console.log(`Connecting to URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
        await mongoose.connect(MONGO_URI);
        const dbName = mongoose.connection.name;
        console.log(`Connected Database Name: "${dbName}"\n`);

        const resFileCount = await ResourceFile.countDocuments({});
        const customFolderCount = await CustomFolder.countDocuments({});
        const courseCount = await Course.countDocuments({});

        console.log(`=== RAW DB COUNTS ===`);
        console.log(`ResourceFiles count : ${resFileCount}`);
        console.log(`CustomFolders count : ${customFolderCount}`);
        console.log(`Courses count       : ${courseCount}\n`);

        console.log(`=== SAMPLE RESOURCE FILES (Up to 5) ===`);
        const sampleFiles = await ResourceFile.find({}).limit(5).lean();
        console.log(JSON.stringify(sampleFiles, null, 2));

        console.log(`\n=== SAMPLE CUSTOM FOLDERS (Up to 5) ===`);
        const sampleFolders = await CustomFolder.find({}).limit(5).lean();
        console.log(JSON.stringify(sampleFolders, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Verification Error:', err.message);
        process.exit(1);
    }
}

verify();
