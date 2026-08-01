const User = require('../models/User');
const Student = require('../models/Student');

const USER_PROFILE_FIELDS = [
    'name',
    'email',
    'department',
    'title',
    'status',
    'year',
    'office',
    'consultationHours',
    'specialization',
];

// @desc    Get users filtered by query (e.g., role)
// @route   GET /api/users
// @access  Private (Admin)
const getUsers = async (req, res) => {
    try {
        const filter = {};
        if (req.query.role) {
            filter.role = req.query.role;
        }

        const users = await User.find(filter).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin)
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const formatUserProfile = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    title: user.title,
    status: user.status,
    year: user.year,
    office: user.office,
    consultationHours: user.consultationHours,
    specialization: user.specialization,
});


// @desc    Update user's role
// @route   PUT /api/users/:id/role
// @access  Private (Admin)
const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const allowedRoles = ['Admin', 'Teacher', 'Student'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.role = role;
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user's profile details
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        USER_PROFILE_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                user[field] = req.body[field];
            }
        });

        await user.save();

        if (req.body.status) {
            await Student.findOneAndUpdate({ user: user._id }, { status: req.body.status });
        }

        res.json(formatUserProfile(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUsers,
    getUserById,
    updateUserRole,
    updateUserProfile,
};
