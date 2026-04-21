import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../api/apiClient';
import './AIAssistant.css';

const AIAssistant = () => {
    const [messages, setMessages] = useState([
        { id: 1, text: "Hello! I'm your campus AI assistant. How can I help you today?", sender: 'ai' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { id: Date.now(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        setError(null);

        try {
            // Prepare history for context-aware chat (standard OpenAI-like format)
            const history = messages
                .filter(m => m.id !== 1) // Optional: exclude initial greeting
                .map(m => ({
                    role: m.sender === 'user' ? 'user' : 'assistant',
                    content: m.text
                }));

            const { data } = await apiClient.post('/ai/chat', {
                message: input,
                history: history
            });

            const aiMsg = {
                id: Date.now() + 1,
                text: data.reply,
                sender: 'ai'
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error('AI Assistant Error:', err);
            setError("Failed to connect to AI. Please ensure Ollama is running llama3 locally.");
            const errorMsg = {
                id: Date.now() + 1,
                text: "I'm having trouble connecting to my brain right now. Please make sure Ollama is running llama3:latest on your system.",
                sender: 'ai',
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="ai-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>AI Campus Assistant</h1>
                    <p className="subtitle">Powered by Local LLM (Ollama)</p>
                </div>
            </header>

            {error && (
                <div className="chat-error glass-panel">
                    <p>{error}</p>
                </div>
            )}

            <div className="glass-panel chat-container">
                <div className="chat-messages">
                    {messages.map(msg => (
                        <div key={msg.id} className={`message-bubble-wrapper ${msg.sender} ${msg.isError ? 'error-msg' : ''}`}>
                            {msg.sender === 'ai' && (
                                <div className="ai-avatar">AI</div>
                            )}
                            <div className={`message-bubble ${msg.sender}-bubble`}>
                                <p>{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="message-bubble-wrapper ai">
                            <div className="ai-avatar">AI</div>
                            <div className="message-bubble typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area">
                    <form onSubmit={handleSend} className="chat-form">
                        <input
                            type="text"
                            className="form-input chat-input"
                            placeholder="Ask me anything..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary send-btn" disabled={!input.trim() || isTyping}>
                            {isTyping ? 'Generating...' : 'Send'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
