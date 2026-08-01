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
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an Admin' });
    }
};

const teacher = (req, res, next) => {
    if (req.user && (req.user.role === 'Teacher' || req.user.role === 'Admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as a Teacher' });
    }
};

module.exports = { protect, admin, teacher };
