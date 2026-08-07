import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Search, UserPlus, ArrowLeft, Check, CheckCheck, Loader2, User, Shield, GraduationCap } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import './Chat.css';

const Chat = () => {
    const { partnerId: urlPartnerId } = useParams();
    const navigate = useNavigate();
    const { user, fetchUnreadChatCount } = useContext(AuthContext);

    const [conversations, setConversations] = useState([]);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [messages, setMessages] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);

    // User Picker Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [eligibleUsers, setEligibleUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Filter conversations list
    const [filterQuery, setFilterQuery] = useState('');

    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadedPartnerIdRef = useRef(null);

    // Fetch conversation list
    const fetchConversations = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/chat/conversations');
            setConversations(data || []);
            if (fetchUnreadChatCount) fetchUnreadChatCount();
        } catch (err) {
            console.error('Failed to fetch conversations:', err);
        }
    }, [fetchUnreadChatCount]);

    // Fetch chat history with selected partner
    const fetchHistory = useCallback(async (partnerId, before = null) => {
        if (!partnerId) return;
        try {
            if (before) setLoadingMore(true);
            else setLoadingHistory(true);

            const params = { limit: 30 };
            if (before) params.before = before;

            const { data } = await apiClient.get(`/chat/history/${partnerId}`, { params });
            const newMessages = (data.messages || []).reverse(); // Oldest first for rendering

            if (before) {
                setMessages(prev => [...newMessages, ...prev]);
            } else {
                setMessages(newMessages);
                setTimeout(scrollToBottom, 100);
            }
            setHasMore(data.hasMore || false);

            // Mark conversation as read & update unread count locally without triggering refetch loop
            await apiClient.put(`/chat/read/${partnerId}`);
            setConversations(prev =>
                prev.map(c => (c.partner?._id === partnerId ? { ...c, unreadCount: 0 } : c))
            );
            if (fetchUnreadChatCount) fetchUnreadChatCount();
        } catch (err) {
            console.error('Failed to fetch chat history:', err);
        } finally {
            setLoadingHistory(false);
            setLoadingMore(false);
        }
    }, []);

    // Initial load & Polling (every 15s)
    useEffect(() => {
        fetchConversations();
        const interval = setInterval(() => {
            fetchConversations();
        }, 15000);

        return () => clearInterval(interval);
    }, [fetchConversations]);

    // Handle URL partnerId route sync (only runs when urlPartnerId changes)
    useEffect(() => {
        if (!urlPartnerId) {
            loadedPartnerIdRef.current = null;
            return;
        }

        if (loadedPartnerIdRef.current === urlPartnerId) {
            return; // Already loaded history for this partner
        }

        loadedPartnerIdRef.current = urlPartnerId;
        const existing = conversations.find(c => c.partner?._id === urlPartnerId);
        if (existing) {
            setSelectedPartner(existing.partner);
            fetchHistory(existing.partner._id);
        } else {
            apiClient.get(`/users/${urlPartnerId}`)
                .then(({ data }) => {
                    setSelectedPartner(data);
                    fetchHistory(data._id);
                })
                .catch(err => console.error('Could not fetch partner info:', err));
        }
    }, [urlPartnerId, fetchHistory, conversations]);

    // Load more history when scrolling to top
    const handleLoadMore = () => {
        if (messages.length > 0 && hasMore && !loadingMore && selectedPartner) {
            const oldestMessageId = messages[0]._id;
            fetchHistory(selectedPartner._id, oldestMessageId);
        }
    };

    // Select partner to chat with
    const handleSelectPartner = (partner) => {
        loadedPartnerIdRef.current = partner._id;
        setSelectedPartner(partner);
        setMessages([]);
        fetchHistory(partner._id);
        navigate(`/chat/${partner._id}`, { replace: true });
    };

    // Send Message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedPartner || sending) return;

        const text = messageInput.trim();
        setMessageInput('');
        setSending(true);

        try {
            const { data } = await apiClient.post('/chat/send', {
                recipient: selectedPartner._id,
                content: text
            });
            setMessages(prev => [...prev, data]);
            setTimeout(scrollToBottom, 50);
            fetchConversations();
        } catch (err) {
            console.error('Failed to send message:', err);
            const errorMsg = err.response?.data?.message || 'Failed to send message';
            alert(errorMsg);
            setMessageInput(text); // restore input
        } finally {
            setSending(false);
        }
    };

    // User Picker search
    const fetchEligibleUsers = async (query = '') => {
        try {
            setLoadingUsers(true);
            const { data } = await apiClient.get('/chat/users', { params: { search: query } });
            setEligibleUsers(data || []);
        } catch (err) {
            console.error('Failed to fetch eligible users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleOpenUserModal = () => {
        setShowUserModal(true);
        setUserSearchQuery('');
        fetchEligibleUsers('');
    };

    const handleSearchUsers = (e) => {
        const q = e.target.value;
        setUserSearchQuery(q);
        fetchEligibleUsers(q);
    };

    const handleSelectUserFromModal = (userObj) => {
        setShowUserModal(false);
        handleSelectPartner(userObj);
    };

    const getRoleBadge = (role) => {
        if (role === 'Admin' || role === 'Superadmin' || role === 'Academicadmin') {
            return <span className="role-tag admin"><Shield size={12} /> Admin</span>;
        }
        if (role === 'Teacher') {
            return <span className="role-tag teacher"><GraduationCap size={12} /> Teacher</span>;
        }
        return <span className="role-tag student"><User size={12} /> Student</span>;
    };

    const filteredConversations = conversations.filter(c => 
        c.partner?.name?.toLowerCase().includes(filterQuery.toLowerCase()) ||
        c.partner?.email?.toLowerCase().includes(filterQuery.toLowerCase())
    );

    return (
        <div className="chat-page-container animate-fade-in">
            {/* Sidebar / Conversation List Panel */}
            <div className={`chat-sidebar glass-panel ${selectedPartner ? 'mobile-hidden' : ''}`}>
                <div className="chat-sidebar-header">
                    <div className="header-title-row">
                        <h3>Messages</h3>
                        <button className="btn btn-primary btn-sm" onClick={handleOpenUserModal}>
                            <UserPlus size={16} />
                            <span>New</span>
                        </button>
                    </div>
                    <div className="chat-search-bar">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Filter conversations..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="conversations-list">
                    {filteredConversations.length === 0 ? (
                        <div className="empty-chat-list">
                            <MessageSquare size={36} opacity={0.3} />
                            <p>No active conversations</p>
                            <button className="btn btn-secondary btn-sm" onClick={handleOpenUserModal}>
                                Start a chat
                            </button>
                        </div>
                    ) : (
                        filteredConversations.map(conv => {
                            const isSelected = selectedPartner?._id === conv.partner?._id;
                            const isUnread = conv.unreadCount > 0;
                            return (
                                <div
                                    key={conv.partner?._id}
                                    className={`conversation-item ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                                    onClick={() => handleSelectPartner(conv.partner)}
                                >
                                    <div className="user-avatar-circle">
                                        {(conv.partner?.name?.charAt(0) || 'U').toUpperCase()}
                                    </div>
                                    <div className="conv-details">
                                        <div className="conv-top-row">
                                            <span className="conv-name">{conv.partner?.name}</span>
                                            <span className="conv-time">
                                                {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <div className="conv-bottom-row">
                                            <span className="conv-snippet">
                                                {conv.lastMessageSender === user?._id ? 'You: ' : ''}{conv.lastMessage}
                                            </span>
                                            {conv.unreadCount > 0 && (
                                                <span className="unread-badge">{conv.unreadCount}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Chat Thread Panel */}
            <div className={`chat-main glass-panel ${!selectedPartner ? 'mobile-hidden' : ''}`}>
                {selectedPartner ? (
                    <>
                        {/* Header */}
                        <div className="chat-thread-header">
                            <button className="back-btn mobile-only" onClick={() => setSelectedPartner(null)}>
                                <ArrowLeft size={20} />
                            </button>
                            <div className="user-avatar-circle">
                                {(selectedPartner.name?.charAt(0) || 'U').toUpperCase()}
                            </div>
                            <div className="partner-details">
                                <div className="partner-name-row">
                                    <h4>{selectedPartner.name}</h4>
                                    {getRoleBadge(selectedPartner.role)}
                                </div>
                                <span className="partner-email">{selectedPartner.email}</span>
                            </div>
                        </div>

                        {/* Message History Body */}
                        <div className="chat-messages-body" ref={chatContainerRef}>
                            {hasMore && (
                                <div className="load-more-container">
                                    <button 
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? <Loader2 size={14} className="spin" /> : 'Load previous messages'}
                                    </button>
                                </div>
                            )}

                            {loadingHistory ? (
                                <div className="chat-loading">
                                    <Loader2 size={28} className="spin text-primary" />
                                    <p>Loading messages...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="chat-empty-thread">
                                    <MessageSquare size={48} opacity={0.2} />
                                    <p>No messages yet. Say hello to {selectedPartner.name}!</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    const isSentByMe = (msg.sender?._id || msg.sender) === user?._id;
                                    return (
                                        <div
                                            key={msg._id || index}
                                            className={`message-bubble-wrapper ${isSentByMe ? 'sent' : 'received'}`}
                                        >
                                            <div className="message-bubble">
                                                <p className="message-text">{msg.content}</p>
                                                <div className="message-meta">
                                                    <span className="message-time">
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isSentByMe && (
                                                        <span className="read-status">
                                                            {msg.read ? <CheckCheck size={14} className="read-icon" /> : <Check size={14} />}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Footer */}
                        <form className="chat-input-bar" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                placeholder={`Message ${selectedPartner.name}...`}
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                disabled={sending}
                            />
                            <button type="submit" className="btn btn-primary send-btn" disabled={!messageInput.trim() || sending}>
                                {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <MessageSquare size={64} opacity={0.2} />
                        <h3>Your Messages</h3>
                        <p>Select a conversation or start a new message.</p>
                        <button className="btn btn-primary" onClick={handleOpenUserModal}>
                            <UserPlus size={18} />
                            Start New Chat
                        </button>
                    </div>
                )}
            </div>

            {/* User Picker Modal */}
            {showUserModal && (
                <div className="modal-backdrop animate-fade-in" onClick={() => setShowUserModal(false)}>
                    <div className="user-picker-modal glass-panel animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Conversation</h3>
                            <button className="close-btn" onClick={() => setShowUserModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {user?.role === 'Student' && (
                                <p className="modal-hint">
                                    ℹ️ As a student, you can start direct chats with Teachers and Administrators.
                                </p>
                            )}
                            <div className="chat-search-bar modal-search">
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search user by name or email..."
                                    value={userSearchQuery}
                                    onChange={handleSearchUsers}
                                />
                            </div>

                            <div className="user-list">
                                {loadingUsers ? (
                                    <div className="chat-loading">
                                        <Loader2 size={24} className="spin text-primary" />
                                    </div>
                                ) : eligibleUsers.length === 0 ? (
                                    <p className="no-users-found">No eligible users found.</p>
                                ) : (
                                    eligibleUsers.map(u => (
                                        <div
                                            key={u._id}
                                            className="user-picker-item"
                                            onClick={() => handleSelectUserFromModal(u)}
                                        >
                                            <div className="user-avatar-circle">
                                                {(u.name?.charAt(0) || 'U').toUpperCase()}
                                            </div>
                                            <div className="user-info">
                                                <span className="user-name">{u.name}</span>
                                                <span className="user-email">{u.email}</span>
                                            </div>
                                            {getRoleBadge(u.role)}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;
