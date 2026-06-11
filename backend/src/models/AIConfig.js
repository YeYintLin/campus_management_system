const mongoose = require('mongoose');

const aiConfigSchema = new mongoose.Schema(
    {
        configKey: {
            type: String,
            default: 'default',
            unique: true,
        },
        systemPrompt: {
            type: String,
            default: `You are a helpful AI assistant for a Campus Management System.
You assist students and teachers with academic queries, finding resources, or navigating the platform.
Keep your answers concise and professional.`,
        },
        activePreset: {
            type: String,
            default: 'altair',
        },
        temperature: {
            type: Number,
            default: 0.7,
            min: 0,
            max: 1,
        },
        maxTokens: {
            type: Number,
            default: 500,
            min: 100,
            max: 2000,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('AIConfig', aiConfigSchema);
