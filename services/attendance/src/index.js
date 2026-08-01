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

if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Set it in services/attendance/.env');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const attendanceRoutes = require('./routes/attendanceRoutes');
app.use('/api/attendance', attendanceRoutes);

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'attendance-service',
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

app.get('/', (req, res) => {
    res.send('Attendance Service API');
});

// Database Connection
const PORT = process.env.PORT || 5003;
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set. Set it in services/attendance/.env');
    process.exit(1);
}

const { startAttendanceCron } = require('./services/attendanceCron');

mongoose
    .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
    })
    .then(() => {
        dbStatus = 'connected';
        console.log('Connected to MongoDB (Attendance Service)');
        startAttendanceCron();
    })
    .catch((err) => {
        dbStatus = 'error';
        console.error('Error connecting to MongoDB (Attendance Service):', err.message);
    });

server = app.listen(PORT, () => {
    console.log(`Attendance Service running on port ${PORT}`);
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
