/**
 * Notification Priority Sorter
 * Priority Hierarchy:
 * 1. Exam (Highest Priority)
 * 2. Practical
 * 3. Tutorial
 * 4. Assignment / Grade
 * 5. Other Stuff (System, File, Bug Report, Chat, etc.)
 */

export const getNotificationPriorityRank = (type) => {
    const t = String(type || '').toLowerCase();
    if (t === 'exam' || t.includes('exam')) return 1;
    if (t === 'practical' || t.includes('practical') || t.includes('lab')) return 2;
    if (t === 'tutorial' || t.includes('tutorial')) return 3;
    if (t === 'assignment' || t.includes('assignment') || t === 'grade' || t.includes('grade')) return 4;
    return 5;
};

export const sortNotificationsByPriority = (notifications = []) => {
    if (!Array.isArray(notifications)) return [];
    
    return [...notifications].sort((a, b) => {
        // 1. Unread first
        if (Boolean(a.read) !== Boolean(b.read)) {
            return a.read ? 1 : -1;
        }

        // 2. Priority Rank (Exam > Practical > Tutorial > Other)
        const rankA = getNotificationPriorityRank(a.type);
        const rankB = getNotificationPriorityRank(b.type);
        if (rankA !== rankB) {
            return rankA - rankB;
        }

        // 3. Newest / Most recent date
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
    });
};
