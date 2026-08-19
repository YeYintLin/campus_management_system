const AcademicPlan = require('../models/AcademicPlan');
const path = require('path');

// @desc    Get official academic plan milestone tables
// @route   GET /api/academic-plan
// @access  Public / Private
const getAcademicPlans = async (req, res) => {
    try {
        const { appliesTo } = req.query;
        const filter = { isActive: true };
        if (appliesTo) filter.appliesTo = appliesTo;

        const plans = await AcademicPlan.find(filter).sort({ tableId: 1 });
        res.json(plans);
    } catch (error) {
        console.error('getAcademicPlans error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload / update official academic plan document or scan photo
// @route   POST /api/academic-plan/photo
// @access  Private (Teacher, Admin)
const updateAcademicPlanPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image or PDF document' });
        }

        const { tableId = 'table-a' } = req.body;
        const documentUrl = `/uploads/${req.file.filename}`;

        const updatedPlan = await AcademicPlan.findOneAndUpdate(
            { tableId },
            { $set: { documentUrl } },
            { new: true, upsert: true }
        );

        res.json({
            message: 'Academic plan document uploaded successfully',
            documentUrl,
            plan: updatedPlan
        });
    } catch (error) {
        console.error('updateAcademicPlanPhoto error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAcademicPlans,
    updateAcademicPlanPhoto
};
