const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set');
    }
    return secret;
};

const generateToken = (id, role, email) => {
    return jwt.sign({ id, role, email }, getJwtSecret(), {
        expiresIn: '30d',
    });
};

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (Can be restricted to Admin in a real scenario for Teachers/Students)
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!name || !normalizedEmail || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const userExists = await User.findOne({ email: normalizedEmail });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email: normalizedEmail,
            password,
            // Security: public registration must never allow creating privileged roles.
            role: 'Student',
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role, user.email),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const isProduction = (process.env.NODE_ENV || 'development') === 'production';
        const { email, username, password } = req.body;
        const identifierRaw = typeof email === 'string' && email.trim() ? email : username;
        const identifier = typeof identifierRaw === 'string' ? identifierRaw.trim() : '';

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Email/username and password are required' });
        }

        let user = null;
        if (identifier.includes('@')) {
            user = await User.findOne({ email: normalizeEmail(identifier) });
        } else {
            // Allow "username" as exact name match (case-insensitive).
            user = await User.findOne({ name: new RegExp(`^${escapeRegex(identifier)}$`, 'i') });
            // Also allow email local-part (e.g. `admin` for `admin@gmail.com`) for convenience.
            if (!user) {
                user = await User.findOne({ email: new RegExp(`^${escapeRegex(identifier)}@`, 'i') });
            }
        }

        if (!user) {
            return res.status(401).json({
                code: 'AUTH_USER_NOT_FOUND',
                message: isProduction ? 'Invalid email or password' : 'User not found',
            });
        }

                const passwordMatches = await user.comparePassword(password);
        if (!passwordMatches) {
            return res.status(401).json({
                code: 'AUTH_INVALID_PASSWORD',
                message: isProduction ? 'Invalid email or password' : 'Invalid password',
            });
        }

        if (user.status === 'Deactivated') {
            return res.status(403).json({
                code: 'AUTH_USER_DEACTIVATED',
                message: 'Your account has been deactivated. Please contact support.',
            });
        }

        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role, user.email),
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin registers a new user
// @route   POST /api/auth/admin-register
// @access  Private/Admin
const adminRegisterUser = async (req, res) => {
    try {
        const { name, email, password, role, department, year } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!name || !normalizedEmail || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const dept = department || 'Mechatronics Engineering';
        const yr = year || 'Final Year (VI)';

        const user = await User.create({
            name,
            email: normalizedEmail,
            password,
            role,
            department: dept,
            year: yr,
            status: 'Active'
        });

        if (user) {
            if (role === 'Student') {
                const count = await Student.countDocuments();
                const rollNum = `VI-MC-${(count + 1).toString().padStart(2, '0')}`;
                await Student.create({
                    user: user._id,
                    enrollmentNumber: rollNum,
                    department: dept,
                    semester: 'First Semester',
                    status: 'Active'
                });
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                year: user.year,
                status: user.status
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    adminRegisterUser,
};
