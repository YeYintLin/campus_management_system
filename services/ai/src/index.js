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
    console.error('FATAL: JWT_SECRET is not set. Set it in services/ai/.env');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'ai-service',
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

app.get('/', (req, res) => {
    res.send('AI Service API');
});

// Database Connection
const PORT = process.env.PORT || 5004;
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set. Set it in services/ai/.env');
    process.exit(1);
}

mongoose
    .connect(MONGODB_URI)
    .then(() => {
        dbStatus = 'connected';
        console.log('Connected to MongoDB (AI Service)');
    })
    .catch((err) => {
        dbStatus = 'error';
        console.error('Error connecting to MongoDB:', err.message);
    });

server = app.listen(PORT, () => {
    console.log(`AI Service running on port ${PORT}`);
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
