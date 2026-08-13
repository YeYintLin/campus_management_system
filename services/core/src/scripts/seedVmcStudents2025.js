require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');

const vmcStudents = [
  { roll: 'V-MC-1',  name: 'မဟန်နီစိုး', email: 'vmc1@tuhmawbi.edu.mm' },
  { roll: 'V-MC-2',  name: 'မဆူးအိလှိုင်', email: 'vmc2@tuhmawbi.edu.mm' },
  { roll: 'V-MC-3',  name: 'မခိုင်ရတနာထွဋ်', email: 'vmc3@tuhmawbi.edu.mm' },
  { roll: 'V-MC-4',  name: 'မရွှန်းလဲ့လဲ့ဖြိုး', email: 'vmc4@tuhmawbi.edu.mm' },
  { roll: 'V-MC-5',  name: 'မအိမ့်ဖူးစံ', email: 'vmc5@tuhmawbi.edu.mm' },
  { roll: 'V-MC-6',  name: 'မောင်ကောင်းထက်မြတ်', email: 'vmc6@tuhmawbi.edu.mm' },
  { roll: 'V-MC-7',  name: 'မလင်းလဲ့ကြည်ဖြူသန့်', email: 'vmc7@tuhmawbi.edu.mm' },
  { roll: 'V-MC-8',  name: 'မောင်ဇင်မင်းထက်', email: 'vmc8@tuhmawbi.edu.mm' },
  { roll: 'V-MC-9',  name: 'မောင်နိုင်လင်းအောင်', email: 'vmc9@tuhmawbi.edu.mm' },
  { roll: 'V-MC-10', name: 'မောင်ကောင်းသီဟသူ', email: 'vmc10@tuhmawbi.edu.mm' },
  { roll: 'V-MC-11', name: 'မောင်ပိုင်စွမ်းပြည့်', email: 'vmc11@tuhmawbi.edu.mm' },
  { roll: 'V-MC-12', name: 'မောင်စွမ်းရည်ကောင်းမြတ်', email: 'vmc12@tuhmawbi.edu.mm' },
  { roll: 'V-MC-13', name: 'မောင်စိုးရဲထက်', email: 'vmc13@tuhmawbi.edu.mm' },
  { roll: 'V-MC-14', name: 'မောင်ဇေညီညီစိုး', email: 'vmc14@tuhmawbi.edu.mm' }
];

const DEFAULT_PASSWORD = 'TUHmawbi2026!';

async function seedVmcStudents() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const createdUserIds = [];

        for (const s of vmcStudents) {
            let user = await User.findOne({ email: s.email });
            if (!user) {
                user = await User.findOne({ rollNo: s.roll });
            }

            if (!user) {
                user = await User.create({
                    name: s.name,
                    email: s.email,
                    password: DEFAULT_PASSWORD,
                    role: 'Student',
                    department: 'Mechatronics Engineering',
                    year: '5th Year',
                    rollNo: s.roll,
                    isEmailVerified: true,
                    isApproved: true,
                    status: 'Active'
                });
                console.log(`✅ Created User: ${s.roll} - ${s.name}`);
            } else {
                user.name = s.name;
                user.department = 'Mechatronics Engineering';
                user.year = '5th Year';
                user.rollNo = s.roll;
                user.isEmailVerified = true;
                user.isApproved = true;
                user.status = 'Active';
                await user.save();
                console.log(`✅ Updated User: ${s.roll} - ${s.name}`);
            }

            createdUserIds.push(user._id);

            // Upsert Student Profile
            let studentProfile = await Student.findOne({ enrollmentNumber: s.roll });
            if (!studentProfile) {
                studentProfile = await Student.findOne({ user: user._id });
            }

            if (!studentProfile) {
                await Student.create({
                    user: user._id,
                    enrollmentNumber: s.roll,
                    department: 'Mechatronics Engineering',
                    semester: 9,
                    status: 'Active'
                });
                console.log(`✅ Created Student Profile: ${s.roll}`);
            } else {
                studentProfile.user = user._id;
                studentProfile.enrollmentNumber = s.roll;
                studentProfile.department = 'Mechatronics Engineering';
                studentProfile.semester = 9;
                studentProfile.status = 'Active';
                await studentProfile.save();
                console.log(`✅ Updated Student Profile: ${s.roll}`);
            }
        }

        // Enroll all 14 5th-Year students into 5th-Year Mechatronics courses
        const vCourses = await Course.find({ year: 5 });
        for (const c of vCourses) {
            c.students = Array.from(new Set([...(c.students || []).map(id => String(id)), ...createdUserIds.map(id => String(id))]));
            await c.save();
            console.log(`✅ Enrolled 14 students into 5th-Year course: ${c.code} - ${c.name}`);
        }

        console.log('\n======================================================');
        console.log('✅ Successfully added all 14 5th-Year MC students to MongoDB!');
        console.log('======================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding 5th Year students:', err);
        process.exit(1);
    }
}

seedVmcStudents();
