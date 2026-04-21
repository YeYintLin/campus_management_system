const axios = require('axios');

// @desc    Chat with AI Assistant via Ollama
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = async (req, res) => {
    try {
        const { message, history } = req.body;

        const systemPrompt = `You are a helpful AI assistant for a Campus Management System.
    You assist students and teachers with academic queries, finding resources, or navigating the platform.
    Keep your answers concise and professional.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(history || []),
            { role: 'user', content: message },
        ];

        const ollamaUrl = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';

        const response = await axios.post(`${ollamaUrl}/api/chat`, {
            model: 'deepseek-v3.1:671b-cloud', // or the specific model configured locally
            messages: messages,
            stream: false,
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

module.exports = {
    chatWithAI,
};
