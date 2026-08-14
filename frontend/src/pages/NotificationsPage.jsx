import { useState, useEffect } from 'react';
import { Bell, Calendar, Check, ArrowLeft } from 'lucide-react';
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
            {/* Header */}
            <header className="notifications-header">
                <button
                    type="button"
                    className="btn btn-secondary notif-back-btn"
                    onClick={() => navigate(-1)}
                    aria-label="Go back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="notifications-header-text">
                    <h1>Notifications</h1>
                    <p className="subtitle">
                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'You are all caught up'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button type="button" className="btn btn-secondary mark-all-read-btn" onClick={markAllAsRead}>
                        <Check size={16} />
                        <span>Mark All Read</span>
                    </button>
                )}
            </header>

            {/* Filter Pills */}
            <div className="notifications-filter-bar">
                <button
                    type="button"
                    className={`notif-filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({notifications.length})
                </button>
                <button
                    type="button"
                    className={`notif-filter-btn ${filter === 'unread' ? 'active' : ''}`}
                    onClick={() => setFilter('unread')}
                >
                    Unread ({unreadCount})
                </button>
                <button
                    type="button"
                    className={`notif-filter-btn ${filter === 'exam' ? 'active' : ''}`}
                    onClick={() => setFilter('exam')}
                >
                    Exams & Labs
                </button>
                <button
                    type="button"
                    className={`notif-filter-btn ${filter === 'system' ? 'active' : ''}`}
                    onClick={() => setFilter('system')}
                >
                    System Alerts
                </button>
            </div>

            {/* Notifications List */}
            {loading ? (
                <div className="notif-loading-state glass-panel">
                    <p>Loading notifications...</p>
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="notif-empty-state glass-panel">
                    <Bell size={44} style={{ opacity: 0.3, marginBottom: '0.85rem', color: 'var(--primary-color)' }} />
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-color, #fff)', margin: '0 0 0.4rem' }}>No Notifications Found</h3>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>There are no updates in this category.</p>
                </div>
            ) : (
                <div className="notifications-list">
                    {filteredNotifications.map(notif => (
                        <div
                            key={notif._id}
                            className={`notif-card ${notif.read ? 'read' : 'unread'}`}
                            onClick={() => {
                                if (!notif.read) markAsRead(notif._id);
                                if (notif.link) navigate(notif.link);
                            }}
                        >
                            <div className={`notif-icon-box ${notif.type === 'exam' ? 'exam' : 'system'}`}>
                                {notif.type === 'exam' ? <Calendar size={18} /> : <Bell size={18} />}
                            </div>

                            <div className="notif-content-body">
                                <p className="notif-message-text">
                                    {notif.message}
                                </p>
                                <span className="notif-time-stamp">
                                    {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'Recent'}
                                </span>
                            </div>

                            {!notif.read && (
                                <button
                                    type="button"
                                    className="notif-check-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        markAsRead(notif._id);
                                    }}
                                    title="Mark as read"
                                    aria-label="Mark as read"
                                >
                                    <Check size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
