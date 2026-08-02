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
        const authHeader = req.headers.authorization;
        const user = req.user;

        // 1. Read base system prompt & params from DB
        const config = await getOrCreateConfig();
        const baseSystemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

        // 2. Fetch User Profile & Academic Year
        let userYear = '1st Year';
        if (user.role === 'Student') {
            try {
                const profileRes = await axios.get(`${CORE_SERVICE_URL}/api/users/${user._id}`, {
                    headers: { Authorization: authHeader }
                });
                const u = profileRes.data;
                const roll = u.studentProfile?.rollNumber || '';
                if (roll.startsWith('1')) userYear = '1st Year';
                else if (roll.startsWith('2')) userYear = '2nd Year';
                else if (roll.startsWith('3')) userYear = '3rd Year';
                else if (roll.startsWith('4')) userYear = '4th Year';
                else if (roll.startsWith('5')) userYear = '5th Year';
                else if (roll.startsWith('6')) userYear = '6th Year';
            } catch (err) {
                console.error('AI Controller profile fetch warning:', err.message);
            }
        }

        // 3. Fetch Student Grades & Calculate Average Score / GPA
        let gradesContext = '';
        try {
            const gradesRes = await axios.get(`${CORE_SERVICE_URL}/api/grades`, {
                headers: { Authorization: authHeader }
            });
            const grades = gradesRes.data || [];
            if (grades.length > 0) {
                const totalScore = grades.reduce((acc, g) => acc + (g.score || 0), 0);
                const avgScore = (totalScore / grades.length).toFixed(1);
                
                const gradeDetails = grades.map(g => 
                    `- ${g.course?.name || g.course?.code || 'Course'}: ${g.score}% (Grade: ${g.letterGrade || 'N/A'}, Term: ${g.term || 'Semester 1'})`
                ).join('\n');

                gradesContext = `STUDENT ACADEMIC RECORDS:
- Total Enrolled Subjects: ${grades.length}
- Overall Semester Average Score: ${avgScore}%
- Subject Breakdown:
${gradeDetails}`;
            } else {
                gradesContext = `STUDENT ACADEMIC RECORDS: No semester grades recorded yet.`;
            }
        } catch (err) {
            console.error('AI Controller grades fetch warning:', err.message);
            gradesContext = `STUDENT ACADEMIC RECORDS: Grade data unavailable.`;
        }

        // 4. Institutional Marking Scheme
        const markingSchemeContext = `TU HMAWBI INSTITUTIONAL MARKING SCHEME & ASSESSMENT BREAKDOWN:
- Final Examination: 40%
- Midterm Examination: 25%
- Laboratory & Practical Work: 20%
- Quizzes & Assignments: 15%
- Total: 100% (Minimum Passing Threshold: 50% / Grade C / GPA 2.0)`;

        // 5. Repository File Context (Filtered by Student's Academic Year & Search Keywords)
        let fileContext = '';
        const lowerMsg = (message || '').toLowerCase();
        const keywords = ['thesis', 'project', 'plc', 'ai', 'robotic', 'robotics', 'file', 'book', 'tutorial', 'paper', 'exam', 'guideline', 'question', 'pdf', 'look for'];
        const matchesTopic = keywords.some(k => lowerMsg.includes(k));

        const repositoryFiles = [
            { name: 'React_Basics_Tutorial.pdf', type: 'PDF', size: '2.4 MB', category: 'Tutorial', year: '1st Year' },
            { name: 'Final_Exam_2024.pdf', type: 'PDF', size: '1.5 MB', category: 'Old Question', year: '4th Year' },
            { name: 'CS_Algorithms_Textbook.pdf', type: 'PDF', size: '12.2 MB', category: 'Reference Books', year: '3rd Year' },
            { name: 'Advanced_JS_Tutorial.mp4', type: 'VIDEO', size: '45 MB', category: 'Tutorial', year: '2nd Year' },
            { name: 'Midterm_MTH101_2023.docx', type: 'DOCX', size: '85 KB', category: 'Old Question', year: '1st Year' },
            { name: 'Clean_Code_Reference.epub', type: 'BOOK', size: '2.8 MB', category: 'Reference Books', year: 'All' },
            { name: 'McE_6th_Year_Project_Guidelines.pdf', type: 'PDF', size: '3.1 MB', category: 'Tutorial', year: '6th Year' },
            { name: 'Industrial_PLC_Automation_Handbook.pdf', type: 'PDF', size: '5.6 MB', category: 'Reference Books', year: '6th Year' },
            { name: 'AI_Robotics_Control_Systems.pdf', type: 'PDF', size: '8.4 MB', category: 'Reference Books', year: '6th Year' }
        ];

        // Filter files strictly by student's academic year (or 'All')
        const relevantFiles = repositoryFiles.filter(f => f.year === userYear || f.year === 'All' || user.role !== 'Student');

        if (matchesTopic && relevantFiles.length > 0) {
            const fileList = relevantFiles.map(f =>
                `• ${f.name} (Category: ${f.category}, Year: ${f.year}, Size: ${f.size})`
            ).join('\n');
            fileContext = `ACADEMIC REPOSITORY FILES FOR ${userYear.toUpperCase()}:
The student asked for study files/thesis materials. Present these matching files from the repository:
${fileList}`;
        }

        // 6. Assemble Enhanced RAG System Prompt
        const enrichedPrompt = `${baseSystemPrompt}

STRICT GUARDRAILS & INSTRUCTIONS:
- You are Antigravity, the official AI Academic Assistant for TU Hmawbi Campus Management System.
- You MUST ONLY answer questions related to campus management, student grades, class average scores, marking schemes, academic subjects, timetables, and repository files.
- Current User: ${user.name} (${user.role}, Year: ${userYear})

${gradesContext}

${markingSchemeContext}

${fileContext}

FORMATTING RULES:
- If asked "what is my average score" or "what is the average score for this semester", state the exact calculated semester average score from the records context above (${gradesContext}).
- If asked about marking schemes, quote the 40% Final Exam, 25% Midterm, 20% Lab, 15% Assignment breakdown.
- If asked about thesis topics, PLC, AI, Robotics, or study materials, list ONLY the repository files matching the student's year (${userYear}) provided above.
`;

        const messages = [
            { role: 'system', content: enrichedPrompt },
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
