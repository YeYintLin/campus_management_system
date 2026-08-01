const mongoose = require('mongoose');
const User = require('./src/models/User');
const Student = require('./src/models/Student');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
const MONGO_URI = 'mongodb+srv://yeyint2702:1234567890@cluster0.yczoc.mongodb.net/core_db?retryWrites=true&w=majority';

async function checkStudents() {
    await mongoose.connect(MONGO_URI);
    const students = await Student.find().populate('user');
    console.log('Total students:', students.length);
    students.forEach(s => {
        console.log(`Student ID: ${s._id}, User: ${s.user?.email} (${s.user?._id}), Student Status: ${s.status}, User Status: ${s.user?.status}`);
    });
    await mongoose.disconnect();
}

checkStudents();
