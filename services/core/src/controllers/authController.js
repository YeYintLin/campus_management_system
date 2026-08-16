const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../utils/emailService');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set');
    }
    return secret;
};

const generateToken = (id, role, email, department, year, adminType) => {
    const payload = { id, role, email, department, year };
    if (['Admin', 'Superadmin', 'Academicadmin'].includes(role)) {
        payload.adminType = adminType || 'system_technical';
    }
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: '30d',
    });
};

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role, department, year, rollNo } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const targetRole = (role === 'Teacher') ? 'Teacher' : 'Student';

        if (!name || !normalizedEmail || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const userExists = await User.findOne({ email: normalizedEmail });

        if (userExists) {
            // If account exists but email is not verified, allow re-triggering verification code
            if (!userExists.isEmailVerified) {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                userExists.emailVerificationCode = code;
                userExists.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
                await userExists.save();
                await sendVerificationEmail(normalizedEmail, code);
                return res.status(200).json({
                    message: 'Account exists but is unverified. A new verification code has been sent.',
                    requiresVerification: true,
                    email: normalizedEmail,
                });
            }
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const user = await User.create({
            name,
            email: normalizedEmail,
            password,
            role: targetRole,
            department: targetRole === 'Student' ? (department || 'Mechatronics Engineering') : department,
            year: targetRole === 'Student' ? (year || 'Final Year (VI)') : year,
            rollNo: targetRole === 'Student' ? (rollNo || '') : '',
            isEmailVerified: false,
            emailVerificationCode: code,
            emailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000),
            isApproved: false,
            status: 'Pending',
        });

        if (user) {
            await sendVerificationEmail(normalizedEmail, code);
            res.status(201).json({
                message: 'Registration successful! Please check your email for the 6-digit verification code.',
                requiresVerification: true,
                email: normalizedEmail,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify 6-digit email code
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail || !code) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const user = await User.findOne({ email: normalizedEmail }).select('+emailVerificationCode');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(200).json({
                message: 'Email is already verified.',
                isEmailVerified: true,
                isApproved: user.isApproved,
            });
        }

        if (!user.emailVerificationCode || user.emailVerificationCode !== code.toString().trim()) {
            user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
            
            if (user.emailVerificationAttempts >= 5) {
                user.emailVerificationCode = undefined;
                user.emailVerificationExpires = undefined;
                user.emailVerificationAttempts = 0;
                await user.save();
                return res.status(400).json({ 
                    message: 'Too many invalid verification attempts (5/5). Your verification code has been invalidated. Please click "Resend Code" to get a new code.' 
                });
            }
            
            await user.save();
            const remaining = 5 - user.emailVerificationAttempts;
            return res.status(400).json({ 
                message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before code is invalidated.` 
            });
        }

        if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
            return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
        }

        user.isEmailVerified = true;
        user.emailVerificationCode = undefined;
        user.emailVerificationExpires = undefined;
        user.emailVerificationAttempts = 0;
        await user.save();

        res.json({
            message: 'Email verified successfully! Your account is now pending Admin approval.',
            isEmailVerified: true,
            isApproved: user.isApproved,
            requiresApproval: !user.isApproved,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resend verification code
// @route   POST /api/auth/resend-code
// @access  Public
const resendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailVerificationCode = code;
        user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
        user.emailVerificationAttempts = 0;
        await user.save();

        await sendVerificationEmail(normalizedEmail, code);

        res.json({ message: 'A new 6-digit verification code has been sent to your email.' });
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
            user = await User.findOne({ name: new RegExp(`^${escapeRegex(identifier)}$`, 'i') });
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

        if (user.status === 'Deactivated' || user.status === 'Suspended') {
            return res.status(403).json({
                code: 'AUTH_USER_SUSPENDED',
                message: 'Your account has been suspended by an administrator. You cannot log in until an administrator approves or reactivates your account.',
            });
        }

        const isAdminRole = ['Admin', 'Superadmin', 'Academicadmin'].includes(user.role);

        // Security check 1: Email verification (Bypassed for Admins & legacy accounts)
        if (!isAdminRole && user.isEmailVerified === false) {
            return res.status(403).json({
                code: 'AUTH_EMAIL_NOT_VERIFIED',
                requiresVerification: true,
                email: user.email,
                message: 'Please verify your Gmail address first before logging in.',
            });
        }

        // Security check 2: Admin approval (Bypassed for Admins)
        if (!isAdminRole && (user.isApproved === false || user.status === 'Pending')) {
            return res.status(403).json({
                code: 'AUTH_PENDING_APPROVAL',
                requiresApproval: true,
                message: 'Your email is verified, but your account is pending Admin approval. Please wait for an administrator to approve your account.',
            });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            adminType: isAdminRole ? (user.adminType || 'system_technical') : undefined,
            year: user.year,
            department: user.department,
            rollNo: user.rollNo,
            status: user.status,
            token: generateToken(user._id, user.role, user.email, user.department, user.year, user.adminType),
        });
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
        const { name, email, password, role, department, year, adminType } = req.body;
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

        // Admin-created users are pre-verified & pre-approved
        const user = await User.create({
            name,
            email: normalizedEmail,
            password,
            role,
            adminType: role === 'Admin' ? (adminType || 'system_technical') : undefined,
            department: dept,
            year: yr,
            isEmailVerified: true,
            isApproved: true,
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
                adminType: user.adminType,
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
    verifyEmail,
    resendVerificationCode,
    loginUser,
    getUserProfile,
    adminRegisterUser,
};
