import { X, Bell, FileText, FileEdit, Info, Check } from 'lucide-react';

const ICON_BY_TYPE = {
    file: <FileText size={16} className="text-primary" />,
    exam: <FileEdit size={16} className="text-warning" />,
    system: <Info size={16} className="text-info" />,
};

const Notifications = ({ notifications, onMarkAsRead, onClose }) => {
    const getIcon = (type) => ICON_BY_TYPE[type] || <Bell size={16} />;

    return (
        <div className="notifications-tray glass-panel animate-slide-in">
            <div className="tray-header">
                <h3>Notifications</h3>
                <button type="button" className="close-btn" onClick={onClose} aria-label="Close notifications">
                    <X size={18} />
                </button>
            </div>
            <div className="tray-body">
                {notifications.length === 0 ? (
                    <div className="empty-notifications">
                        <Bell size={32} opacity={0.2} />
                        <p>No new notifications</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div key={notif.id} className={`notif-item ${notif.read ? 'read' : 'unread'}`}>
                            <div className="notif-icon-wrapper">
                                {getIcon(notif.type)}
                            </div>
                            <div className="notif-content">
                                <p>{notif.message}</p>
                                <span>{notif.time}</span>
                            </div>
                            {!notif.read && (
                                <button
                                    type="button"
                                    className="mark-read-btn"
                                    onClick={() => onMarkAsRead(notif.id)}
                                    title="Mark as read"
                                >
                                    <Check size={14} />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
            {notifications.length > 0 && (
                <div className="tray-footer">
                    <button type="button" className="view-all">View All Activity</button>
                </div>
            )}
        </div>
    );
};

export default Notifications;
