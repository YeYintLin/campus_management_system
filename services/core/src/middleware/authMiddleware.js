const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set');
    }
    return secret;
};

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(
                token,
                getJwtSecret()
            );

            // Stateless: Attach user claims onto req.user
            req.user = {
                _id: decoded.id,
                id: decoded.id,
                name: decoded.name || '',
                role: decoded.role,
                adminType: decoded.adminType || ((decoded.role || '').toLowerCase() === 'academicadmin' ? 'user_management' : (['admin', 'superadmin'].includes((decoded.role || '').toLowerCase()) ? 'system_technical' : undefined)),
                email: decoded.email,
                year: decoded.year,
                department: decoded.department,
            };

            // Stale Session Mitigation: If year, name, or department claim is missing in older JWT tokens, look up from DB
            if ((!req.user.year || !req.user.name || !req.user.department) && req.user.id) {
                try {
                    const User = require('../models/User');
                    const userDoc = await User.findById(req.user.id).select('name year department role adminType');
                    if (userDoc) {
                        if (!req.user.name) req.user.name = userDoc.name;
                        if (!req.user.year) req.user.year = userDoc.year;
                        if (!req.user.department) req.user.department = userDoc.department;
                        if (!req.user.role) req.user.role = userDoc.role;
                        if (!req.user.adminType && userDoc.adminType) req.user.adminType = userDoc.adminType;
                    }
                } catch (dbErr) {
                    console.error('Fallback user lookup error:', dbErr.message);
                }
            }

            next();
        } catch (error) {
            console.error('Stateless Auth Token Verification Failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    const roleStr = (req.user?.role || '').toLowerCase().trim();
    if (req.user && (roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'academicadmin')) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an Admin' });
    }
};

const teacher = (req, res, next) => {
    const roleStr = (req.user?.role || '').toLowerCase().trim();
    if (req.user && (roleStr === 'teacher' || roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'academicadmin')) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as a Teacher' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (req.user && roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ message: `Not authorized. Requires one of: ${roles.join(', ')}` });
        }
    };
};

const requireSystemAdmin = (req, res, next) => {
    const isUserMgmt = req.user?.adminType === 'user_management' || (req.user?.role || '').toLowerCase() === 'academicadmin';
    if (req.user && isUserMgmt) {
        return res.status(403).json({ message: 'Requires Technical/System Admin access' });
    }
    next();
};

module.exports = { protect, admin, teacher, authorize, requireSystemAdmin };
