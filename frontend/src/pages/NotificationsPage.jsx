import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Clock, Calendar, AlertCircle, Trash2, Check, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import './NotificationsPage.css';

const NotificationsPage = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'unread', 'exam', 'system'

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const { data } = await apiClient.get('/notifications');
            const list = Array.isArray(data) ? data : [];
            setNotifications(list);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAsRead = async (id) => {
        try {
            await apiClient.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unread = notifications.filter(n => !n.read);
            await Promise.all(unread.map(n => apiClient.put(`/notifications/${n._id}/read`)));
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error('Failed to mark all read:', err);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.read;
        if (filter === 'exam') return n.type === 'exam' || n.type === 'practical' || n.type === 'tutorial';
        if (filter === 'system') return n.type === 'system' || n.type === 'file' || n.type === 'timetable';
        return true;
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="notifications-page animate-fade-in">
            <header className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '0.5rem', borderRadius: '10px' }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#fff', margin: 0 }}>Notifications</h1>
                    <p className="subtitle" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'You are all caught up'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn btn-secondary" onClick={markAllAsRead} style={{ fontSize: '0.85rem' }}>
                        <Check size={16} />
                        Mark All Read
                    </button>
                )}
            </header>

            {/* Filter Pills */}
            <div className="year-filter-bar glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                <button className={`year-tag ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                    All ({notifications.length})
                </button>
                <button className={`year-tag ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
                    Unread ({unreadCount})
                </button>
                <button className={`year-tag ${filter === 'exam' ? 'active' : ''}`} onClick={() => setFilter('exam')}>
                    Exams & Labs
                </button>
                <button className={`year-tag ${filter === 'system' ? 'active' : ''}`} onClick={() => setFilter('system')}>
                    System Alerts
                </button>
            </div>

            {/* Notifications List */}
            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '16px' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem', color: '#818cf8' }} />
                        <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>No Notifications Found</h3>
                        <p style={{ fontSize: '0.85rem' }}>There are no updates in this category.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredNotifications.map(notif => (
                            <div
                                key={notif._id}
                                className={`notif-card glass-panel ${notif.read ? 'read' : 'unread'}`}
                                onClick={() => {
                                    if (!notif.read) markAsRead(notif._id);
                                    if (notif.link) navigate(notif.link);
                                }}
                                style={{
                                    padding: '1rem 1.25rem',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '1rem',
                                    cursor: 'pointer',
                                    background: notif.read ? 'rgba(255,255,255,0.02)' : 'rgba(99,102,241,0.08)',
                                    border: notif.read ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(99,102,241,0.25)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: notif.type === 'exam' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                                    color: notif.type === 'exam' ? '#f59e0b' : '#818cf8',
                                    flexShrink: 0
                                }}>
                                    {notif.type === 'exam' ? <Calendar size={18} /> : <Bell size={18} />}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#fff', lineHeight: '1.4' }}>
                                        {notif.message}
                                    </p>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'Recent'}
                                    </span>
                                </div>

                                {!notif.read && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            markAsRead(notif._id);
                                        }}
                                        style={{
                                            background: 'rgba(99,102,241,0.2)',
                                            color: '#818cf8',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '0.35rem',
                                            cursor: 'pointer'
                                        }}
                                        title="Mark as read"
                                    >
                                        <Check size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
