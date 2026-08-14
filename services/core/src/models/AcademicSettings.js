const mongoose = require('mongoose');

const academicSettingsSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        department: {
            type: String,
            default: null, // null means global default; string allows per-department overrides
            trim: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

academicSettingsSchema.index({ key: 1, department: 1 }, { unique: true });

// Helper to get threshold by key and optional department
academicSettingsSchema.statics.getSetting = async function (key, department = null, defaultValue = null) {
    try {
        if (department) {
            const deptSetting = await this.findOne({ key, department });
            if (deptSetting && deptSetting.value !== undefined) return deptSetting.value;
        }
        const globalSetting = await this.findOne({ key, department: null });
        if (globalSetting && globalSetting.value !== undefined) return globalSetting.value;
        return defaultValue;
    } catch {
        return defaultValue;
    }
};

module.exports = mongoose.model('AcademicSettings', academicSettingsSchema);
