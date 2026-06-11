const AcademicConfig = require('../models/AcademicConfig');

const DEFAULT_CONFIG = {
    maxYear: 6,
    departments: [
        { name: 'Mechatronics', code: 'MC', active: true },
        { name: 'Civil', code: 'C', active: true },
        { name: 'Computer Science', code: 'CS', active: true },
    ],
};

const normalizeDepartments = (departments) => {
    if (!Array.isArray(departments)) return [];
    return departments
        .map((d) => ({
            name: String(d?.name || '').trim(),
            code: String(d?.code || '').trim(),
            active: Boolean(d?.active !== false),
        }))
        .filter((d) => d.name && d.code);
};

const validateUniqueCodes = (departments) => {
    const seen = new Set();
    for (const d of departments) {
        const key = String(d.code || '').toLowerCase();
        if (seen.has(key)) {
            return { ok: false, message: `Duplicate department code (case-insensitive): ${d.code}` };
        }
        seen.add(key);
    }
    return { ok: true };
};

// @desc    Get academic config (departments, maxYear)
// @route   GET /api/academic-config
// @access  Private (Admin, Teacher)
const getAcademicConfig = async (req, res) => {
    try {
        let config = await AcademicConfig.findOne();
        if (!config) {
            config = await AcademicConfig.create(DEFAULT_CONFIG);
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update academic config (upsert singleton)
// @route   PUT /api/academic-config
// @access  Private (Admin)
const updateAcademicConfig = async (req, res) => {
    try {
        const maxYearRaw = req.body?.maxYear;
        const maxYear = Math.max(1, Math.min(12, parseInt(maxYearRaw ?? DEFAULT_CONFIG.maxYear, 10)));
        const departments = normalizeDepartments(req.body?.departments);
        const uniqueCheck = validateUniqueCodes(departments);
        if (!uniqueCheck.ok) {
            return res.status(400).json({ message: uniqueCheck.message });
        }

        let config = await AcademicConfig.findOne();
        if (!config) config = new AcademicConfig(DEFAULT_CONFIG);

        config.maxYear = maxYear;
        config.departments = departments;
        await config.save();

        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAcademicConfig, updateAcademicConfig };
