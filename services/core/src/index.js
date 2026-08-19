const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const dns = require('dns');

try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

dotenv.config();

const app = express();
let dbStatus = 'starting';
let server;

// Fail fast if JWT secret is missing. This prevents accidentally running with an insecure default.
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Set it in services/core/.env');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const courseRoutes = require('./routes/courseRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');
const academicConfigRoutes = require('./routes/academicConfigRoutes');
const examRoutes = require('./routes/examRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const searchRoutes = require('./routes/searchRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const fileLogRoutes = require('./routes/fileLogRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bugReportRoutes = require('./routes/bugReportRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const academicRecordRoutes = require('./routes/academicRecordRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const academicPlanRoutes = require('./routes/academicPlanRoutes');
const eLibraryRoutes = require('./routes/eLibraryRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/academic-config', academicConfigRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/files', fileLogRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/records', academicRecordRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/academic-plan', academicPlanRoutes);
app.use('/api/elibrary', eLibraryRoutes);

// Healthcheck endpoint (used by Docker/Kubernetes probes)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

app.get('/', (req, res) => {
    res.send('CMS API Default Endpoint');
});

// Database Connection
const PORT = process.env.PORT || 5002;
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set. Set it in services/core/.env');
    process.exit(1);
}

mongoose
    .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
    })
    .then(() => {
        dbStatus = 'connected';
        console.log('Connected to MongoDB');
        
        // Purge corrupt blank courses & run dynamic timetable course sync across all years
        (async () => {
            try {
                const Course = require('./models/Course');
                const allCourses = await Course.find({});
                for (const c of allCourses) {
                    const cleanCode = (c.code || '').toUpperCase().replace(/\s+/g, '');
                    if (!cleanCode || cleanCode === 'MCE-' || cleanCode === 'MCE') {
                        console.log(`[Auto-Purge] Deleting corrupt course record: '${c.code}' (${c._id})`);
                        await Course.deleteOne({ _id: c._id });
                    }
                }

                const { syncCourseCollectionWithTimetable } = require('./controllers/courseController');
                await syncCourseCollectionWithTimetable();
                console.log('Dynamic multi-year course timetable sync completed successfully.');
            } catch (auditErr) {
                console.error('Course audit error:', auditErr.message);
            }
        })();
    })
    .catch((err) => {
        dbStatus = 'error';
        console.error('Error connecting to MongoDB:', err.message);
    });

mongoose.connection.on('disconnected', () => {
    dbStatus = 'disconnected';
});

mongoose.connection.on('reconnected', () => {
    dbStatus = 'connected';
});

server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const shutdown = () => {
    if (server) {
        server.close(() => {
            mongoose.connection.close(false).finally(() => process.exit(0));
        });
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
