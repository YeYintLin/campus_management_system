const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');
const Student = require('./src/models/Student');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not set in services/core/.env');
}

const vimcStudents = [
  { roll: 'VI-MC-1',  name: 'Wai Hlan Kaung',    email: 'vimc1@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-2',  name: 'May Myat Noe San',  email: 'vimc2@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-3',  name: 'Kaday Win Htike',   email: 'vimc3@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-4',  name: 'Htoo Aung Wai',     email: 'vimc4@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-5',  name: 'Zwe Ye Win Kyaw',   email: 'vimc5@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-6',  name: 'Ye Yint Lin',       email: 'student@tuhmawbi.edu.mm' }, // Main Student Account
  { roll: 'VI-MC-7',  name: 'Swan Thura Kyaw',   email: 'vimc7@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-8',  name: 'Kyal Sin Myat',     email: 'vimc8@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-9',  name: 'May Thu Thu Khaing',email: 'vimc9@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-10', name: 'Su Ay Ka Yee Htun', email: 'vimc10@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-11', name: 'Paing Zay Khant',   email: 'vimc11@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-12', name: 'Win Thiri Naing',   email: 'vimc12@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-13', name: 'Sai Nyan Lin Tun',  email: 'vimc13@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-14', name: 'Aye Chan Khaing',   email: 'vimc14@tuhmawbi.edu.mm' },
  { roll: 'VI-MC-15', name: 'Kaung Myat Tun',    email: 'vimc15@tuhmawbi.edu.mm' },
];

const DEFAULT_PASSWORD = 'TUHmawbi2026!';

const seedVimc = async () => {
  try {
    console.log('Connecting to MongoDB core_db...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const results = [];

    for (const item of vimcStudents) {
      let user = await User.findOne({ email: item.email });

      if (!user) {
        user = await User.create({
          name: item.name,
          email: item.email,
          password: DEFAULT_PASSWORD,
          role: 'Student',
          department: 'Mechatronics Engineering',
          year: '6th Year',
          status: 'Active'
        });
        results.push({ roll: item.roll, name: item.name, action: 'User Created' });
      } else {
        user.name = item.name;
        user.department = 'Mechatronics Engineering';
        user.year = '6th Year';
        user.status = 'Active';
        await user.save();
        results.push({ roll: item.roll, name: item.name, action: 'User Updated' });
      }

      // Upsert Student Profile
      let studentProfile = await Student.findOne({ enrollmentNumber: item.roll });
      if (!studentProfile) {
        studentProfile = await Student.findOne({ user: user._id });
      }

      if (!studentProfile) {
        await Student.create({
          user: user._id,
          enrollmentNumber: item.roll,
          department: 'Mechatronics Engineering',
          semester: 12,
          contactNumber: '09-123456789',
          status: 'Active'
        });
        results.push({ roll: item.roll, name: item.name, action: 'Student Profile Created' });
      } else {
        studentProfile.user = user._id;
        studentProfile.enrollmentNumber = item.roll;
        studentProfile.department = 'Mechatronics Engineering';
        studentProfile.semester = 12;
        studentProfile.status = 'Active';
        await studentProfile.save();
        results.push({ roll: item.roll, name: item.name, action: 'Student Profile Updated' });
      }
    }

    console.log('\n--- UPDATED SEED RESULTS ---');
    console.table(results);
    console.log('\nSuccessfully updated all 15 VI-MC student names in English!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating VI-MC student names:', error);
    process.exit(1);
  }
};

seedVimc();
