const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const ELibraryItem = require('../models/ELibraryItem');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://yeyint2702:1234567890@cluster0.yczoc.mongodb.net/core_db?retryWrites=true&w=majority';
const PRIVATE_STORAGE_DIR = path.join(__dirname, '../../storage/private_elibrary');

if (!fs.existsSync(PRIVATE_STORAGE_DIR)) {
    fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
}

// Sample initial Mechatronics resources
const seedBooks = [
    {
        title: 'Modern Control Systems (13th Edition)',
        author: 'Richard C. Dorf & Robert H. Bishop',
        category: 'Textbook',
        yearLevel: '5th Year',
        courseCode: 'McE-51017',
        courseName: 'Modern Control System I',
        department: 'Mechatronics Engineering',
        description: 'Comprehensive textbook on classical and modern feedback control systems, state-space methods, frequency response, and stability analysis.',
        originalFileName: 'Modern_Control_Systems_Dorf_13th.pdf',
        storedFileName: 'elib-dorf-modern-control-13th.pdf',
        fileSize: 15420300, // ~15.4 MB
        fileType: 'pdf',
        coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&auto=format&fit=crop&q=80',
        downloadsCount: 42,
        viewsCount: 135,
        isFeatured: true,
        tags: ['Control Systems', 'State Space', 'Stability', 'Root Locus', 'Bode Plots']
    },
    {
        title: 'Introduction to Robotics: Mechanics and Control (3rd Edition)',
        author: 'John J. Craig',
        category: 'Textbook',
        yearLevel: '5th Year',
        courseCode: 'McE-51021',
        courseName: 'Robotic Analysis I',
        department: 'Mechatronics Engineering',
        description: 'Authoritative treatment of robot manipulators: forward and inverse kinematics, velocities and static forces (Jacobians), dynamics, trajectory generation, and linear control.',
        originalFileName: 'Introduction_to_Robotics_Craig_3rd.pdf',
        storedFileName: 'elib-craig-robotics-3rd.pdf',
        fileSize: 18720100, // ~18.7 MB
        fileType: 'pdf',
        coverImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&auto=format&fit=crop&q=80',
        downloadsCount: 56,
        viewsCount: 180,
        isFeatured: true,
        tags: ['Robotics', 'Kinematics', 'Jacobians', 'Dynamics', 'Trajectory']
    },
    {
        title: 'Fuzzy Logic with Engineering Applications (4th Edition)',
        author: 'Timothy J. Ross',
        category: 'Textbook',
        yearLevel: '5th Year',
        courseCode: 'McE-51027',
        courseName: 'Fuzzy Logic I',
        department: 'Mechatronics Engineering',
        description: 'Covers fuzzy sets, membership functions, fuzzification, fuzzy inference engines, defuzzification methods, and rule-based mechatronic control applications.',
        originalFileName: 'Fuzzy_Logic_Engineering_Applications_Ross.pdf',
        storedFileName: 'elib-ross-fuzzy-logic-4th.pdf',
        fileSize: 12300000,
        fileType: 'pdf',
        coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop&q=80',
        downloadsCount: 29,
        viewsCount: 94,
        isFeatured: false,
        tags: ['Fuzzy Logic', 'Fuzzy Sets', 'Inference', 'Mamdani', 'Sugeno']
    },
    {
        title: 'Industrial Management & Organization Notes',
        author: 'Department of Mechatronics Faculty',
        category: 'Lecture Notes',
        yearLevel: '5th Year',
        courseCode: 'McE-51018',
        courseName: 'Industrial Management I',
        department: 'Mechatronics Engineering',
        description: 'Complete lecture notes on engineering economics, project management, inventory control (EOQ), quality assurance, and organizational structure.',
        originalFileName: 'Industrial_Management_Lecture_Notes_2025.pdf',
        storedFileName: 'elib-mce51018-lecture-notes.pdf',
        fileSize: 4520000,
        fileType: 'pdf',
        coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop&q=80',
        downloadsCount: 38,
        viewsCount: 110,
        isFeatured: false,
        tags: ['Management', 'Economics', 'Project Planning', 'Inventory']
    },
    {
        title: 'Microprocessor & Microcontroller Lab Manual',
        author: 'Mechatronics Embedded Lab Group',
        category: 'Lab Manual',
        yearLevel: '5th Year',
        courseCode: 'McE-51029',
        courseName: 'Microprocessor and Microcontroller I',
        department: 'Mechatronics Engineering',
        description: 'Step-by-step laboratory experiment guide for 8086/8051 and ARM Cortex-M microcontrollers: GPIO, timers, interrupts, ADC, and UART interfacing.',
        originalFileName: 'Microprocessor_Lab_Manual_TUHmawbi.pdf',
        storedFileName: 'elib-microprocessor-lab-manual.pdf',
        fileSize: 6200000,
        fileType: 'pdf',
        coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80',
        downloadsCount: 64,
        viewsCount: 220,
        isFeatured: true,
        tags: ['Lab Manual', '8051', 'ARM Cortex', 'Interrupts', 'Embedded C']
    },
    {
        title: 'Autonomous Mobile Robot Navigation (Final Year Thesis)',
        author: 'Kyaw Zayar Tun & Wai Hlan Kaung',
        category: 'Thesis / Project',
        yearLevel: '6th Year',
        courseCode: 'McE-61031',
        courseName: 'System Design',
        department: 'Mechatronics Engineering',
        description: 'Final Year Thesis on ROS 2-based SLAM and obstacle avoidance navigation for automated guided vehicles (AGV) in industrial factory floors.',
        originalFileName: 'AGV_SLAM_Navigation_Thesis_Report.pdf',
        storedFileName: 'elib-agv-slam-thesis-report.pdf',
        fileSize: 22500000,
        fileType: 'pdf',
        coverImage: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&auto=format&fit=crop&q=80',
        downloadsCount: 81,
        viewsCount: 310,
        isFeatured: true,
        tags: ['Thesis', 'ROS 2', 'SLAM', 'Lidar', 'Autonomous Navigation', 'AGV']
    }
];

async function seedELibrary() {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const teacher = await User.findOne({
            role: 'Teacher',
            $or: [
                { department: /Mechatronics/i },
                { email: /aung\.kyaw\.soe/i }
            ]
        }) || await User.findOne({ role: { $in: ['Teacher', 'Admin'] } });

        const teacherId = teacher ? teacher._id : new mongoose.Types.ObjectId();
        const teacherName = teacher ? teacher.name : 'Dr. Aung Kyaw Soe';

        // Create sample placeholder files in private storage with valid PDF magic bytes
        for (const book of seedBooks) {
            const filePath = path.join(PRIVATE_STORAGE_DIR, book.storedFileName);
            if (!fs.existsSync(filePath)) {
                // PDF header %PDF-1.4 + metadata stream
                const pdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (' + book.title + ') >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'utf8');
                fs.writeFileSync(filePath, pdfHeader);
            }

            await ELibraryItem.findOneAndUpdate(
                { storedFileName: book.storedFileName },
                {
                    $set: {
                        ...book,
                        storagePath: filePath,
                        uploadedBy: teacherId,
                        uploadedByName: teacherName,
                        uploadedByRole: 'Teacher'
                    }
                },
                { upsert: true, new: true }
            );
            console.log(`✓ Seeded E-Library resource: [${book.courseCode}] ${book.title}`);
        }

        console.log('🎉 E-Library seeding completed successfully!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding error:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    seedELibrary();
}

module.exports = { seedELibrary, seedBooks };
