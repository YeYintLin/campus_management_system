import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Save, RefreshCw, Bot, MessageSquare, ShieldCheck, AlertCircle } from 'lucide-react';
import './AIPromptSettings.css';

const AIPromptSettings = () => {
    const { user } = useContext(AuthContext);

    const presets = [
        {
            id: 'altair',
            name: 'Altair Standard',
            icon: <Bot size={20} />,
            prompt: `You are Antigravity, the official AI Academic Assistant for Altair Institute of Technology. 
Your goal is to assist students and faculty with course information, schedules, and academic guidance.
Always maintain a professional, helpful, and educational tone.`
        },
        {
            id: 'tutor',
            name: 'Academic Tutor',
            icon: <MessageSquare size={20} />,
            prompt: `You are an expert Academic Tutor at Altair Institute. 
Your goal is to help students understand complex concepts by breaking them down.
Don't just give answers; ask leading questions to guide their learning process.`
        },
        {
            id: 'admin',
            name: 'Admin Assistant',
            icon: <ShieldCheck size={20} />,
            prompt: `You are the Altair Administrative Assistant. 
Focus on operational efficiency, administrative procedures, and policy guidance.
Provide clear, concise information about school regulations and deadlines.`
        }
    ];

    const [prompt, setPrompt] = useState(presets[0].prompt);
    const [temperature, setTemperature] = useState(0.7);
    const [maxLen, setMaxLen] = useState(500);
    const [activePreset, setActivePreset] = useState('altair');

    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(new Date().toLocaleTimeString());
    const [showToast, setShowToast] = useState(false);

    // Redirect or block if not admin (though route is protected)
    if (user?.role !== 'Admin') {
        return <div className="p-8 text-center">Unauthorized. Admins only.</div>;
    }

    const handleApplyPreset = (preset) => {
        setActivePreset(preset.id);
        setPrompt(preset.prompt);
    };

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => {
            setIsSaving(false);
            setLastSaved(new Date().toLocaleTimeString());
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        }, 1200);
    };

    const handleReset = () => {
        if (window.confirm("Reset prompt to default institutional settings?")) {
            handleApplyPreset(presets[0]);
            setTemperature(0.7);
            setMaxLen(500);
        }
    };

    return (
        <div className="ai-settings-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>AI Persona Configuration</h1>
                    <p className="subtitle">Tune the behavior and tone of the campus AI assistant</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary-glass" onClick={handleReset}>
                        <RefreshCw size={18} />
                        Reset Default
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        <Save size={18} />
                        {isSaving ? 'Synchronizing...' : 'Apply Changes'}
                    </button>
                </div>
            </header>

            <div className="ai-presets-section">
                <h2 className="section-title">Select Persona Preset</h2>
                <div className="presets-grid">
                    {presets.map(preset => (
                        <div
                            key={preset.id}
                            className={`preset-card glass-panel ${activePreset === preset.id ? 'active' : ''}`}
                            onClick={() => handleApplyPreset(preset)}
                        >
                            <div className="preset-icon">{preset.icon}</div>
                            <h3>{preset.name}</h3>
                            <div className="active-indicator"></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ai-settings-grid">
                <div className="main-config-area">
                    <div className="glass-panel prompt-editor-panel">
                        <div className="panel-header">
                            <div className="title-with-icon">
                                <Bot size={20} className="text-primary" />
                                <h2>System Prompt</h2>
                            </div>
                            <span className="status-label">
                                <ShieldCheck size={14} />
                                Core Behavior
                            </span>
                        </div>
                        <div className="editor-container">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="styled-textarea"
                                placeholder="Enter AI system instructions..."
                            />
                        </div>
                        <div className="panel-footer">
                            <p className="hint-text">
                                <AlertCircle size={14} />
                                These instructions define how the AI responds to all users.
                            </p>
                            <span className="last-saved">Last synced: {lastSaved}</span>
                        </div>
                    </div>

                    <div className="advanced-tuning-panel glass-panel mt-6">
                        <div className="panel-header">
                            <h2>Precision Tuning</h2>
                            <p className="hint-text">Fine-tune response quality</p>
                        </div>
                        <div className="tuning-controls">
                            <div className="control-item">
                                <div className="control-info">
                                    <label>Creativity (Temperature)</label>
                                    <span className="value-badge">{temperature}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={temperature}
                                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                    className="range-slider"
                                />
                                <div className="range-labels">
                                    <span>Precise</span>
                                    <span>Balanced</span>
                                    <span>Creative</span>
                                </div>
                            </div>

                            <div className="control-item">
                                <div className="control-info">
                                    <label>Response Length</label>
                                    <span className="value-badge">{maxLen} Tokens</span>
                                </div>
                                <input
                                    type="range"
                                    min="100"
                                    max="2000"
                                    step="100"
                                    value={maxLen}
                                    onChange={(e) => setMaxLen(parseInt(e.target.value))}
                                    className="range-slider"
                                />
                                <div className="range-labels">
                                    <span>Concise</span>
                                    <span>Rich</span>
                                    <span>Deep Explain</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="ai-preview-sidebar">
                    <div className="glass-panel preview-panel">
                        <div className="panel-header">
                            <h2>Live Persona Preview</h2>
                        </div>
                        <div className="preview-chat-demo">
                            <div className="demo-message bot">
                                <div className="bot-avatar"><Bot size={16} /></div>
                                <div className="message-bubble">
                                    Hello! I am the Altair AI Assistant. How can I help you today?
                                </div>
                            </div>
                            <div className="demo-message user">
                                <div className="message-bubble">
                                    When is the next CS midterm?
                                </div>
                            </div>
                            <div className="demo-message bot">
                                <div className="bot-avatar"><Bot size={16} /></div>
                                <div className="message-bubble typing">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                        <div className="persona-traits">
                            <h3>Current Traits</h3>
                            <div className="traits-list">
                                <span className="trait-tag">Professional</span>
                                <span className="trait-tag">Academic</span>
                                <span className="trait-tag">Helpful</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel documentation-panel">
                        <h3>Configuration Guide</h3>
                        <ul className="guide-list">
                            <li><strong>Persona:</strong> Set the name and role of the assistant.</li>
                            <li><strong>Tone:</strong> Define if it should be casual or formal.</li>
                            <li><strong>Guardrails:</strong> Instruct it what NOT to discuss.</li>
                        </ul>
                    </div>
                </aside>
            </div>

            {showToast && (
                <div className="success-toast glass-panel">
                    <ShieldCheck size={20} />
                    <span>AI configurations updated successfully!</span>
                </div>
            )}
        </div>
    );
};

export default AIPromptSettings;
