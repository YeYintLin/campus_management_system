const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup
app.use(cors());

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:5002';
const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:5003';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5004';

// Logging proxy requests
const proxyLogger = (req, res, next) => {
    console.log(`[Gateway Proxy] ${req.method} ${req.url}`);
    next();
};

app.use(proxyLogger);

// Gateway Health Route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'gateway', uptime: process.uptime() });
});

// Proxy routes for Attendance Service (mapped first to prevent overlapping)
app.use(createProxyMiddleware({
    target: ATTENDANCE_SERVICE_URL,
    changeOrigin: true,
    pathFilter: '/api/attendance'
}));

// Proxy routes for AI Service
app.use(createProxyMiddleware({
    target: AI_SERVICE_URL,
    changeOrigin: true,
    pathFilter: '/api/ai'
}));

// Proxy routes for Core Service (handles everything else under /api and /uploads)
app.use(createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathFilter: (path, req) => {
        return path.startsWith('/uploads') || 
               (path.startsWith('/api') && !path.startsWith('/api/attendance') && !path.startsWith('/api/ai'));
    }
}));

app.use('/', (req, res) => {
    res.status(404).send('CMS API Gateway: Route not found');
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
