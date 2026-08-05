const mongoose = require('mongoose');
require('dotenv').config();
const Semester = require('../src/models/Semester');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cms_core';

mongoose.connect(mongoUri).then(async () => {
    const parseNumber = (val) => {
        if (!val) return null;
        if (typeof val === 'number') return val;
        const m = String(val).match(/\d+/);
        return m ? parseInt(m[0], 10) : null;
    };

    const testGetSemesters = async (yearParam) => {
        const yNum = parseNumber(yearParam);
        const yearConditions = [{ yearLabel: yearParam }, yNum ? { yearNumber: yNum } : null].filter(Boolean);
        const sems = await Semester.find({ $or: yearConditions }).sort({ semesterNumber: 1 }).lean();
        return sems.map(s => s.semesterLabel || (`Semester ${s.semesterNumber}`));
    };

    const sems2ndYear = await testGetSemesters('2nd Year');
    console.log('Semesters returned for 2nd Year:', sems2ndYear);

    const sems1stYear = await testGetSemesters('1st Year');
    console.log('Semesters returned for 1st Year:', sems1stYear);

    const sems5thYear = await testGetSemesters('5th Year');
    console.log('Semesters returned for 5th Year:', sems5thYear);

    mongoose.disconnect();
});
