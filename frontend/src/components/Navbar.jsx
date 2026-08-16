import { useContext, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, Users, BookOpen, Clock, FileSpreadsheet, LogOut, BotMessageSquare, GraduationCap, FileEdit, CalendarDays, FolderSearch, ShieldCheck, Settings, FileText, MessageSquare, Bug, Hash } from 'lucide-react';
import './Navbar.css';

const NAV_LINKS = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Timetable', path: '/time-table', icon: <CalendarDays size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Subjects', path: '/courses', icon: <BookOpen size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Attendance', path: '/attendance', icon: <Clock size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Teachers', path: '/teachers', icon: <GraduationCap size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Students', path: '/students', icon: <Users size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Assignments', path: '/assignments', icon: <FileText size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Files', path: '/files', icon: <FolderSearch size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Exams', path: '/exams', icon: <FileEdit size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Records & Grades', path: '/grades', icon: <FileSpreadsheet size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'AI Assistant', path: '/ai-assistant', icon: <BotMessageSquare size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Messages', path: '/chat', icon: <MessageSquare size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'Bug Report', path: '/bug-report', icon: <Bug size={20} />, roles: ['Admin', 'Teacher', 'Student'] },
    { name: 'AI Config', path: '/admin/ai-settings', icon: <FileEdit size={20} />, roles: ['Admin'], requireSystemAdmin: true },
    { name: 'Accounts', path: '/admin/accounts', icon: <ShieldCheck size={20} />, roles: ['Admin'] },
    { name: 'Roll Numbers', path: '/admin/assign-roll-numbers', icon: <Hash size={20} />, roles: ['Admin'] },
    { name: 'Academic', path: '/admin/academic-settings', icon: <Settings size={20} />, roles: ['Admin'], requireSystemAdmin: true },
];

const Navbar = () => {
    const { user, logout, unreadChatCount } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const visibleLinks = useMemo(
        () => NAV_LINKS.filter((link) => {
            const roleNorm = (user?.role || '').toLowerCase().trim();
            const isAdminUser = ['admin', 'superadmin', 'academicadmin'].includes(roleNorm);
            const matchesRole = link.roles.includes(user?.role) || (link.roles.includes('Admin') && isAdminUser);
            if (!matchesRole) return false;

            const isUserMgmtAdmin = user?.adminType === 'user_management' || roleNorm === 'academicadmin';
            if (link.requireSystemAdmin && isUserMgmtAdmin) return false;
            return true;
        }),
        [user?.role, user?.adminType]
    );

    const getUserInitial = (name) => (name?.trim()?.charAt(0) || '?').toUpperCase();
    const isActiveRoute = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

    const handleProfileClick = () => {
        if (!user) return;
        if (user.role === 'Student') {
            navigate(`/students/${user._id}`);
        } else if (user.role === 'Teacher') {
            navigate(`/teachers/${user._id}`);
        } else {
            navigate('/admin/accounts');
        }
    };

    return (
        <nav className="sidebar glass-panel">
            <div className="sidebar-header">
                <h2 className="logo-text">TU Hmawbi CMS</h2>
            </div>

            <div
                className="user-info-pill"
                onClick={handleProfileClick}
                style={{ cursor: 'pointer' }}
                title="Click to view profile"
            >
                <div className="user-avatar-small">{getUserInitial(user?.name)}</div>
                <div className="user-text-details">
                    <span className="user-name">{user?.name || 'Guest User'}</span>
                    <span className="user-role">{user?.role || 'No role'}</span>
                </div>
            </div>

            <div className="nav-links">
                {visibleLinks.map((link) => (
                    <Link
                        key={link.path}
                        to={link.path}
                        className={`nav-item ${isActiveRoute(link.path) ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{link.icon}</span>
                        <span className="nav-label">{link.name}</span>
                        {link.path === '/chat' && unreadChatCount > 0 && (
                            <span className="unread-bubble-badge" title={`${unreadChatCount} unread message(s)`}>
                                {unreadChatCount > 99 ? '99+' : unreadChatCount}
                            </span>
                        )}
                    </Link>
                ))}
            </div>

            <div className="sidebar-footer">
                <button type="button" className="nav-item logout-btn" onClick={handleLogout} aria-label="Logout">
                    <span className="nav-icon"><LogOut size={20} /></span>
                    <span className="nav-label">Logout</span>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
