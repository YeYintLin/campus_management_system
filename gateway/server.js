const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Disable Express fingerprinting
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
    next();
});

// Production Hardened CORS setup
const allowedOrigins = [
    'https://campus-management-system-one.vercel.app',
    'http://localhost:5173',
    'http://localhost:8050',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
];
if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN.split(',').forEach(o => allowedOrigins.push(o.trim()));
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-service-token']
}));

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
