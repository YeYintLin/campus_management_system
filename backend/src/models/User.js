const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ['Admin', 'Teacher', 'Student'],
            default: 'Student',
        },
        department: {
            type: String,
            trim: true,
        },
        title: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            trim: true,
        },
        year: {
            type: String,
            trim: true,
        },
        office: {
            type: String,
            trim: true,
        },
        consultationHours: {
            type: String,
            trim: true,
        },
        specialization: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema, 'Users');
