import './EmptyState.css';

const EmptyState = ({ icon: Icon, message, submessage, iconSize = 28, compact = false }) => (
    <div className={`empty-state-container ${compact ? 'empty-state-compact' : ''}`}>
        {Icon && (
            <div className="empty-state-icon">
                <Icon size={iconSize} />
            </div>
        )}
        <p className="empty-state-message">{message}</p>
        {submessage && <p className="empty-state-sub">{submessage}</p>}
    </div>
);

export default EmptyState;
