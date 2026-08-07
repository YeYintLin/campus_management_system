const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Semester = require('./src/models/Semester');
const User = require('./src/models/User');
const Course = require('./src/models/Course');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cms_core';

const createSlugEmail = (name) => {
    const cleanName = name
        .toLowerCase()
        .replace(/^(dr\.|daw|u|mg)\s+/i, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '.');
    return `${cleanName}@tuhmawbi.edu.mm`;
};

const seedExcelTeachers = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding real Excel teachers...');

        const sems = await Semester.find().lean();
        const teacherMap = new Map();

        // Extract subjects per teacher from Semester collection legend
        sems.forEach(s => {
            (s.legend || []).forEach(leg => {
                if (leg && leg.teacher) {
                    const rawNames = leg.teacher.split(/,|\s+&\s+/).map(t => t.trim()).filter(Boolean);
                    rawNames.forEach(tName => {
                        if (!teacherMap.has(tName)) teacherMap.set(tName, []);
                        if (leg.code && leg.subject) {
                            teacherMap.get(tName).push({
                                code: leg.code.trim(),
                                name: leg.subject.trim(),
                                year: s.yearLabel,
                                semester: s.semesterLabel
                            });
                        }
                    });
                }
            });
        });

        console.log(`Extracted ${teacherMap.size} unique teachers from Excel timetables.`);

        // Fallback: If no timetables are stored in MongoDB yet, seed the static 22 real teachers
        if (teacherMap.size === 0) {
            console.log('No timetable legends found in MongoDB. Seeding default 22 real teacher profiles...');
            const fallbackTeachers = [
                { name: 'Daw Myat Thu Zar', dept: 'Mechatronics Engineering', email: 'myat.thu.zar@tuhmawbi.edu.mm' },
                { name: 'Dr. Sandar', dept: 'Mechatronics Engineering', email: 'sandar@tuhmawbi.edu.mm' },
                { name: 'Daw Ei Ei Khin', dept: 'Mechatronics Engineering', email: 'ei.ei.khin@tuhmawbi.edu.mm' },
                { name: 'Daw Khin Saw Win', dept: 'Myanmar', email: 'khin.saw.win@tuhmawbi.edu.mm' },
                { name: 'Daw Cho Cho Win', dept: 'English', email: 'cho.cho.win@tuhmawbi.edu.mm' },
                { name: 'Daw Ni Ni San', dept: 'Engineering Mathematics', email: 'ni.ni.san@tuhmawbi.edu.mm' },
                { name: 'Daw Hnin Nu Phyu', dept: 'Engineering Physics', email: 'hnin.nu.phyu@tuhmawbi.edu.mm' },
                { name: 'Daw Thin Thin Moe', dept: 'Engineering Chemistry', email: 'thin.thin.moe@tuhmawbi.edu.mm' },
                { name: 'U Thein Htoo', dept: 'Mechatronics Engineering', email: 'thein.htoo@tuhmawbi.edu.mm' },
                { name: 'Daw Mu Mu Aye', dept: 'Mechatronics Engineering', email: 'mu.mu.aye@tuhmawbi.edu.mm' },
                { name: 'Daw Su Su Hmwe', dept: 'Mechatronics Engineering', email: 'su.su.hmwe@tuhmawbi.edu.mm' },
                { name: 'Daw Thinzar Win', dept: 'Mechatronics Engineering', email: 'thinzar.win@tuhmawbi.edu.mm' },
                { name: 'Daw Win Win Maw', dept: 'Mechatronics Engineering', email: 'win.win.maw@tuhmawbi.edu.mm' },
                { name: 'U Aung Ko Latt', dept: 'Mechatronics Engineering', email: 'aung.ko.latt@tuhmawbi.edu.mm' },
                { name: 'Daw Moe Moe Thin', dept: 'Mechatronics Engineering', email: 'moe.moe.thin@tuhmawbi.edu.mm' },
                { name: 'Daw Phyu Phyu Han', dept: 'Mechatronics Engineering', email: 'phyu.phyu.han@tuhmawbi.edu.mm' },
                { name: 'Daw Nwe Nwe Aung', dept: 'Mechatronics Engineering', email: 'nwe.nwe.aung@tuhmawbi.edu.mm' },
                { name: 'Daw Zin Mar Aye', dept: 'Mechatronics Engineering', email: 'zin.mar.aye@tuhmawbi.edu.mm' },
                { name: 'Daw Aye Thida', dept: 'Mechatronics Engineering', email: 'aye.thida@tuhmawbi.edu.mm' },
                { name: 'Daw Nilar Win', dept: 'Mechatronics Engineering', email: 'nilar.win@tuhmawbi.edu.mm' },
                { name: 'Daw Su Myat Mon', dept: 'Mechatronics Engineering', email: 'su.myat.mon@tuhmawbi.edu.mm' },
                { name: 'Daw Phyu Lay Khine', dept: 'Mechatronics Engineering', email: 'phyu.lay.khine@tuhmawbi.edu.mm' }
            ];

            fallbackTeachers.forEach(t => {
                teacherMap.set(t.name, []);
            });
        }

        for (const [teacherName, subjects] of teacherMap.entries()) {
            const email = createSlugEmail(teacherName);

            // Deduplicate subjects by code
            const uniqueSubjects = [];
            const seenCodes = new Set();
            subjects.forEach(sub => {
                if (!seenCodes.has(sub.code)) {
                    seenCodes.add(sub.code);
                    uniqueSubjects.push(sub);
                }
            });

            let user = await User.findOne({
                $or: [
                    { email: email },
                    { name: teacherName }
                ]
            });

            const determineDepartment = (tName, subs) => {
                const text = (tName + ' ' + subs.map(s => s.code + ' ' + s.name).join(' ')).toLowerCase();
                if (text.includes('myanmar') || subs.some(s => (s.code || '').trim().startsWith('M-'))) {
                    return 'Myanmar';
                }
                if (text.includes('physics') || subs.some(s => (s.code || '').toLowerCase().includes('eph'))) {
                    return 'Engineering Physics';
                }
                if (text.includes('chemistry') || subs.some(s => (s.code || '').toLowerCase().includes('chem'))) {
                    return 'Engineering Chemistry';
                }
                if (text.includes('mathematics') || subs.some(s => (s.code || '').toLowerCase().startsWith('em-') || (s.code || '').toLowerCase().startsWith('em '))) {
                    return 'Engineering Mathematics';
                }
                if (text.includes('english') || subs.some(s => (s.code || '').toLowerCase().startsWith('e-') || (s.code || '').toLowerCase().startsWith('e '))) {
                    return 'English';
                }
                return 'Mechatronics Engineering';
            };

            const dept = determineDepartment(teacherName, uniqueSubjects);

            if (!user) {
                user = await User.create({
                    name: teacherName,
                    email: email,
                    password: 'password',
                    role: 'Teacher',
                    department: dept,
                    title: teacherName.startsWith('Dr.') ? 'Associate Professor' : 'Lecturer',
                    status: 'Active',
                    specialization: uniqueSubjects.map(s => s.name).join(', ')
                });
                console.log(`Created Teacher User: ${teacherName} (${email}) [${dept}] with password 'password'`);
            } else {
                user.email = email;
                user.role = 'Teacher';
                user.password = 'password';
                user.department = dept;
                user.specialization = uniqueSubjects.map(s => s.name).join(', ');
                await user.save();
                console.log(`Updated Teacher User: ${teacherName} (${email}) [${dept}] with password 'password'`);
            }

            // Upsert Course documents and associate with teacher user
            for (const sub of uniqueSubjects) {
                let course = await Course.findOne({ code: sub.code });
                if (!course) {
                    course = await Course.create({
                        code: sub.code,
                        name: sub.name,
                        description: `${sub.name} course taught at Technological University (Hmawbi).`,
                        teacher: user._id,
                        students: []
                    });
                    console.log(`  + Created Course: ${sub.code} - ${sub.name} (Assigned to ${teacherName})`);
                } else {
                    course.teacher = user._id;
                    if (!course.name) course.name = sub.name;
                    await course.save();
                    console.log(`  + Updated Course: ${sub.code} - ${sub.name} (Assigned to ${teacherName})`);
                }
            }
        }

        // Clean non-academic entries from Course collection
        const nonAcadResult = await Course.deleteMany({
            $or: [
                { code: { $regex: /private study|extra|self-study|lunch/i } },
                { name: { $regex: /private study|extra|self-study|lunch/i } }
            ]
        });
        if (nonAcadResult.deletedCount > 0) {
            console.log(`Cleaned ${nonAcadResult.deletedCount} non-academic course entries.`);
        }

        console.log('Seeding completed successfully!');
        mongoose.disconnect();
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedExcelTeachers();
