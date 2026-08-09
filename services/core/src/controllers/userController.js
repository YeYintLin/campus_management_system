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

// @desc    Get users filtered by query (e.g., role, status)
// @route   GET /api/users
// @access  Private (Admin)
const getUsers = async (req, res) => {
    try {
        const filter = {};
        if (req.query.role) {
            filter.role = req.query.role;
        }
        if (req.query.status) {
            filter.status = req.query.status;
        }

        const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
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
    isEmailVerified: user.isEmailVerified,
    isApproved: user.isApproved,
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

        res.json(formatUserProfile(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user's profile details & email (with duplicate email check)
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Email duplicate check
        if (req.body.email && req.body.email.trim().toLowerCase() !== user.email) {
            const newEmail = req.body.email.trim().toLowerCase();
            const emailExists = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
            if (emailExists) {
                return res.status(400).json({ message: 'Another account already uses this email address' });
            }
            user.email = newEmail;
        }

        USER_PROFILE_FIELDS.forEach((field) => {
            if (field !== 'email' && Object.prototype.hasOwnProperty.call(req.body, field)) {
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

// @desc    Admin resets password for a user
// @route   PUT /api/users/:id/reset-password
// @access  Private (Admin)
const resetUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: `Password for ${user.name} (${user.email}) reset successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getYearPrefix = (yearStr) => {
    const text = String(yearStr || '').toUpperCase();
    if (text.includes('VI') || text.includes('6TH') || text.includes('FINAL')) return 'VI';
    if (text.includes('V') || text.includes('5TH')) return 'V';
    if (text.includes('IV') || text.includes('4TH')) return 'IV';
    if (text.includes('III') || text.includes('3RD')) return 'III';
    if (text.includes('II') || text.includes('2ND')) return 'II';
    if (text.includes('I') || text.includes('1ST')) return 'I';
    return 'VI';
};

const getDeptCode = (deptStr) => {
    const text = String(deptStr || '').toUpperCase();
    if (text.includes('MECHATRONIC')) return 'MC';
    if (text.includes('COMPUTER')) return 'CE';
    if (text.includes('INFORMATION') || text.includes('IT')) return 'IT';
    if (text.includes('ELECTRICAL') || text.includes('EP')) return 'EP';
    if (text.includes('MECHANICAL') || text.includes('MECH')) return 'Mech';
    if (text.includes('CIVIL')) return 'Civil';
    if (text.includes('ELECTRONIC') || text.includes('EC')) return 'EC';
    return 'MC';
};

const formatOfficialRollNumber = (year, department, rollNoInput) => {
    const raw = String(rollNoInput || '').trim();
    if (!raw) return '';
    if (raw.includes('-') || raw.includes(' ')) {
        return raw;
    }
    const yearPrefix = getYearPrefix(year);
    const deptCode = getDeptCode(department);
    return `${yearPrefix}-${deptCode} ${raw}`;
};

// @desc    Admin approves pending user account
// @route   PUT /api/users/:id/approve
// @access  Private (Admin)
const approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isApproved = true;
        user.status = 'Active';

        // Format official roll number for students if number was provided (e.g. 6 -> I-MC 6)
        let formattedRoll = '';
        if (user.role === 'Student') {
            formattedRoll = formatOfficialRollNumber(user.year, user.department, user.rollNo);
            if (formattedRoll) {
                user.rollNo = formattedRoll;
            }
        }
        await user.save();

        // Create student profile record if role is Student and no Student doc exists
        if (user.role === 'Student') {
            const existingStudent = await Student.findOne({ user: user._id });
            if (!existingStudent) {
                const count = await Student.countDocuments();
                const rollNum = formattedRoll || user.rollNo || `VI-MC-${(count + 1).toString().padStart(2, '0')}`;
                await Student.create({
                    user: user._id,
                    enrollmentNumber: rollNum,
                    department: user.department || 'Mechatronics Engineering',
                    semester: 1,
                    status: 'Active'
                });
            } else {
                if (formattedRoll) existingStudent.enrollmentNumber = formattedRoll;
                existingStudent.status = 'Active';
                await existingStudent.save();
            }
        }

        res.json({ message: `Account for ${user.name} approved successfully. User can now log in.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Admin rejects pending user account
// @route   PUT /api/users/:id/reject
// @access  Private (Admin)
const rejectUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isApproved = false;
        user.status = 'Deactivated';
        await user.save();

        res.json({ message: `Account for ${user.name} has been rejected/deactivated.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUsers,
    getUserById,
    updateUserRole,
    updateUserProfile,
    resetUserPassword,
    approveUser,
    rejectUser,
};
