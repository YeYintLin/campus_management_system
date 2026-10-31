// Lightweight in-memory rate limiter for sensitive authentication endpoints
const loginAttempts = new Map();

// Clean up stale IP records every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of loginAttempts.entries()) {
        if (now - data.firstAttempt > 15 * 60 * 1000) {
            loginAttempts.delete(ip);
        }
    }
}, 10 * 60 * 1000).unref();

/**
 * Rate limits login attempts per IP address
 * Max 10 attempts per 15-minute sliding window
 */
const loginRateLimiter = (req, res, next) => {
    // In test environment, bypass rate limiter
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 10;

    let record = loginAttempts.get(ip);
    if (!record || (now - record.firstAttempt > windowMs)) {
        record = { count: 1, firstAttempt: now };
        loginAttempts.set(ip, record);
        return next();
    }

    record.count += 1;
    if (record.count > maxAttempts) {
        const retryAfterSec = Math.ceil((windowMs - (now - record.firstAttempt)) / 1000);
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
            code: 'AUTH_TOO_MANY_ATTEMPTS',
            message: `Too many login attempts from this IP address. Please try again after ${Math.ceil(retryAfterSec / 60)} minutes.`
        });
    }

    next();
};

module.exports = { loginRateLimiter };
