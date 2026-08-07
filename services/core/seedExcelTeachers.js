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

        // Fallback: If no timetables are stored in MongoDB yet, seed the static 22 real teachers provided
        const fallbackTeachersMap = new Map([
            // 1. Mechatronics Engineering Department
            ['Daw Lin Thu Htet', { dept: 'Mechatronics Engineering', email: 'lin.thu.htet@tuhmawbi.edu.mm' }],
            ['Daw Ei Thae Phyu', { dept: 'Mechatronics Engineering', email: 'ei.thae.phyu@tuhmawbi.edu.mm' }],
            ['Dr. Aung Kyaw Soe', { dept: 'Mechatronics Engineering', email: 'aung.kyaw.soe@tuhmawbi.edu.mm' }],
            ['Daw Khaing Thida Aung', { dept: 'Mechatronics Engineering', email: 'khaing.thida.aung@tuhmawbi.edu.mm' }],
            ['Daw Myat Thu Zar', { dept: 'Mechatronics Engineering', email: 'myat.thu.zar@tuhmawbi.edu.mm' }],
            ['Daw Kyawt Kyawt Win', { dept: 'Mechatronics Engineering', email: 'kyawt.kyawt.win@tuhmawbi.edu.mm' }],
            ['Dr. Win Thurein', { dept: 'Mechatronics Engineering', email: 'win.thurein@tuhmawbi.edu.mm' }],
            ['Daw Hnin Wai Wai Thet', { dept: 'Mechatronics Engineering', email: 'hnin.wai.wai.thet@tuhmawbi.edu.mm' }],
            ['Daw Khaing Zar Win', { dept: 'Mechatronics Engineering', email: 'khaing.zar.win@tuhmawbi.edu.mm' }],

            // 2. Engineering Physics Department
            ['Dr. Ei Ei Min', { dept: 'Engineering Physics', email: 'ei.ei.min@tuhmawbi.edu.mm' }],
            ['Daw Win Win Yi', { dept: 'Engineering Physics', email: 'win.win.yi@tuhmawbi.edu.mm' }],

            // 3. Engineering Mathematics Department
            ['Daw Phyu Phyu Thant', { dept: 'Engineering Mathematics', email: 'phyu.phyu.thant@tuhmawbi.edu.mm' }],
            ['Dr. Zaw Min Tun', { dept: 'Engineering Mathematics', email: 'dr.zaw.min.tun@tuhmawbi.edu.mm' }],
            ['Dr. Aye Aye Khaing', { dept: 'Engineering Mathematics', email: 'aye.aye.khaing@tuhmawbi.edu.mm' }],
            ['Daw Myint Myint Thu', { dept: 'Engineering Mathematics', email: 'myint.myint.thu@tuhmawbi.edu.mm' }],
            ['Dr. Pyone Myat Khaing', { dept: 'Engineering Mathematics', email: 'pyone.myat.khaing@tuhmawbi.edu.mm' }],

            // 4. Myanmar Department
            ['Daw Nandar Moe San', { dept: 'Myanmar', email: 'nandar.moe.san@tuhmawbi.edu.mm' }],
            ['Daw Hay Man Soe', { dept: 'Myanmar', email: 'hay.man.soe@tuhmawbi.edu.mm' }],

            // 5. English Department
            ['Daw Khin Lay Myint', { dept: 'English', email: 'khin.lay.myint@tuhmawbi.edu.mm' }],
            ['Daw Swe Zin Phyo', { dept: 'English', email: 'swe.zin.phyo@tuhmawbi.edu.mm' }],
            ['Daw Mar Pyay Nay Lin', { dept: 'English', email: 'mar.pyay.nay.lin@tuhmawbi.edu.mm' }],
            ['Daw Thiri Kyaw', { dept: 'English', email: 'thiri.kyaw@tuhmawbi.edu.mm' }]
        ]);

        if (teacherMap.size === 0) {
            console.log('No timetable legends found in MongoDB. Seeding default 22 real teacher profiles...');
            for (const tName of fallbackTeachersMap.keys()) {
                teacherMap.set(tName, []);
            }
        }

        for (const [teacherName, subjects] of teacherMap.entries()) {
            const fallbackData = fallbackTeachersMap.get(teacherName);
            const email = fallbackData ? fallbackData.email : createSlugEmail(teacherName);

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
                if (fallbackData) return fallbackData.dept;
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
