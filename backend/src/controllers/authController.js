const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET || 'supersecretkey', {
        expiresIn: '30d',
    });
};

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (Can be restricted to Admin in a real scenario for Teachers/Students)
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
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
            role: role || 'Student',
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role),
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
        const { email, username, password } = req.body;
        const identifierRaw = typeof email === 'string' && email.trim() ? email : username;
        const identifier = typeof identifierRaw === 'string' ? identifierRaw.trim() : '';

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Email/username and password are required' });
        }

        const loginQuery = identifier.includes('@')
            ? { email: normalizeEmail(identifier) }
            : { name: new RegExp(`^${identifier}$`, 'i') };

        const user = await User.findOne(loginQuery);

        if (user && (await user.comparePassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
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
        const { name, email, password, role } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!name || !normalizedEmail || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const user = await User.create({ name, email: normalizedEmail, password, role });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
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
