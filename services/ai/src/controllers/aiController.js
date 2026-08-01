const axios = require('axios');
const AIConfig = require('../models/AIConfig');

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant for a Campus Management System.
You assist students and teachers with academic queries, finding resources, or navigating the platform.
Keep your answers concise and professional.`;

// Helper: get or create the singleton config document
const getOrCreateConfig = async () => {
    let config = await AIConfig.findOne({ configKey: 'default' });
    if (!config) {
        config = await AIConfig.create({ configKey: 'default' });
    }
    return config;
};

// @desc    Chat with AI Assistant via Ollama
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = async (req, res) => {
    try {
        const { message, history } = req.body;

        // Read the system prompt from the database (falls back to default)
        const config = await getOrCreateConfig();
        const systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(history || []),
            { role: 'user', content: message },
        ];

        const ollamaUrl = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';

        const response = await axios.post(`${ollamaUrl}/api/chat`, {
            model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
            messages: messages,
            stream: false,
            options: {
                temperature: config.temperature ?? 0.7,
                num_predict: config.maxTokens ?? 500,
            },
        });

        res.json({
            reply: response.data.message.content,
        });
    } catch (error) {
        console.error('AI Integration Error:', error.message);
        res.status(500).json({
            message: 'Failed to communicate with AI Assistant. Ensure Ollama is running locally.'
        });
    }
};

// @desc    Get current AI configuration
// @route   GET /api/ai/config
// @access  Private (Admin)
const getAIConfig = async (req, res) => {
    try {
        const config = await getOrCreateConfig();
        res.json(config);
    } catch (error) {
        console.error('Get AI Config Error:', error.message);
        res.status(500).json({ message: 'Failed to fetch AI configuration.' });
    }
};

// @desc    Update AI configuration (system prompt, temperature, maxTokens, activePreset)
// @route   PUT /api/ai/config
// @access  Private (Admin)
const updateAIConfig = async (req, res) => {
    try {
        const { systemPrompt, activePreset, temperature, maxTokens } = req.body;

        const config = await getOrCreateConfig();

        if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;
        if (activePreset !== undefined) config.activePreset = activePreset;
        if (temperature !== undefined) config.temperature = temperature;
        if (maxTokens !== undefined) config.maxTokens = maxTokens;

        await config.save();

        res.json(config);
    } catch (error) {
        console.error('Update AI Config Error:', error.message);
        res.status(500).json({ message: 'Failed to update AI configuration.' });
    }
};

module.exports = {
    chatWithAI,
    getAIConfig,
    updateAIConfig,
};
