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

            // Stateless: Attach both _id (for backward compatibility) and id
            req.user = {
                _id: decoded.id,
                id: decoded.id,
                role: decoded.role,
                adminType: decoded.adminType || ((decoded.role || '').toLowerCase() === 'academicadmin' ? 'user_management' : (['admin', 'superadmin'].includes((decoded.role || '').toLowerCase()) ? 'system_technical' : undefined)),
                email: decoded.email
            };

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

const requireSystemAdmin = (req, res, next) => {
    const isUserMgmt = req.user?.adminType === 'user_management' || (req.user?.role || '').toLowerCase() === 'academicadmin';
    if (req.user && isUserMgmt) {
        return res.status(403).json({ message: 'Requires Technical/System Admin access' });
    }
    next();
};

module.exports = { protect, admin, teacher, requireSystemAdmin };
