import React, { useState, useRef, useEffect } from 'react';
import { BotMessageSquare, X, Send, Sparkles, RefreshCw } from 'lucide-react';
import apiClient from '../api/apiClient';
import './AIChatWidget.css';

const AIChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Hello! I'm your campus AI assistant. How can I help you today?", sender: 'ai' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            setHasUnread(false);
            scrollToBottom();
        }
    }, [isOpen, messages, isTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = { id: Date.now(), text: input.trim(), sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setIsTyping(true);

        try {
            const history = messages
                .filter(m => m.id !== 1 && !m.isError)
                .map(m => ({
                    role: m.sender === 'user' ? 'user' : 'assistant',
                    content: m.text
                }));

            const { data } = await apiClient.post('/ai/chat', {
                message: currentInput,
                history: history
            });

            const aiMsg = {
                id: Date.now() + 1,
                text: data.reply || "No response received.",
                sender: 'ai'
            };
            setMessages(prev => [...prev, aiMsg]);
            if (!isOpen) setHasUnread(true);
        } catch (err) {
            console.error('AI Chat Error:', err);
            const errorMsg = {
                id: Date.now() + 1,
                text: "I'm having trouble connecting right now. Please try again later.",
                sender: 'ai',
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleClearHistory = () => {
        setMessages([
            { id: 1, text: "Hello! I'm your campus AI assistant. How can I help you today?", sender: 'ai' }
        ]);
    };

    return (
        <div className="ai-widget-wrapper">
            {/* Floating Action Button */}
            <button
                type="button"
                className={`ai-fab ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Campus AI Assistant"
                aria-label="Toggle AI Assistant"
            >
                {isOpen ? (
                    <X size={24} />
                ) : (
                    <>
                        <BotMessageSquare size={24} />
                        {hasUnread && <span className="ai-fab-badge" />}
                    </>
                )}
            </button>

            {/* Slide-in Chat Drawer */}
            {isOpen && (
                <div className="ai-chat-drawer glass-panel animate-slide-up">
                    <div className="ai-chat-header">
                        <div className="ai-header-title">
                            <div className="ai-header-icon">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <h3>AI Campus Assistant</h3>
                                <span className="ai-header-status">Online · Ready to help</span>
                            </div>
                        </div>
                        <div className="ai-header-actions">
                            <button
                                type="button"
                                className="icon-btn-sm"
                                onClick={handleClearHistory}
                                title="Reset Conversation"
                                aria-label="Reset Conversation"
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                type="button"
                                className="icon-btn-sm"
                                onClick={() => setIsOpen(false)}
                                title="Close"
                                aria-label="Close Chat"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="ai-chat-body">
                        {messages.map(msg => (
                            <div key={msg.id} className={`ai-msg-row ${msg.sender} ${msg.isError ? 'error' : ''}`}>
                                {msg.sender === 'ai' && (
                                    <div className="ai-msg-avatar">
                                        <BotMessageSquare size={14} />
                                    </div>
                                )}
                                <div className={`ai-msg-bubble ${msg.sender}-bubble`}>
                                    <p>{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="ai-msg-row ai">
                                <div className="ai-msg-avatar">
                                    <BotMessageSquare size={14} />
                                </div>
                                <div className="ai-msg-bubble ai-bubble typing">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="ai-chat-input-bar">
                        <input
                            type="text"
                            className="ai-chat-input"
                            placeholder="Ask a question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button
                            type="submit"
                            className="ai-send-btn"
                            disabled={!input.trim() || isTyping}
                            aria-label="Send message"
                        >
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AIChatWidget;
