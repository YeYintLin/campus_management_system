import { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
    LayoutDashboard, CalendarDays, Clock, FileSpreadsheet,
    Menu, X, BookOpen, Users, FileText, FolderSearch, FileEdit,
    GraduationCap, ShieldCheck, Settings, LogOut, MessageSquare, Bug
} from 'lucide-react';
import './MobileBottomNav.css';

const MobileBottomNav = () => {
    const { user, logout, unreadChatCount } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    if (!user) return null;

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

    const handleLogout = () => {
        setIsMenuOpen(false);
        logout();
        navigate('/login');
    };

    const isAdmin = user.role === 'Admin' || user.role === 'SuperAdmin' || user.role === 'AcademicAdmin';

    return (
        <>
            {/* ── Fixed Mobile Bottom Nav Bar (visible <= 768px) ── */}
            <nav className="mobile-bottom-nav">
                <Link
                    to="/dashboard"
                    className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                >
                    <LayoutDashboard size={20} />
                    <span>Home</span>
                </Link>

                <Link
                    to="/time-table"
                    className={`mobile-nav-item ${isActive('/time-table') ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                >
                    <CalendarDays size={20} />
                    <span>Schedule</span>
                </Link>

                <Link
                    to="/attendance"
                    className={`mobile-nav-item ${isActive('/attendance') ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                >
                    <Clock size={20} />
                    <span>Attend</span>
                </Link>

                <Link
                    to="/grades"
                    className={`mobile-nav-item ${isActive('/grades') ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                >
                    <FileSpreadsheet size={20} />
                    <span>Grades</span>
                </Link>

                <button
                    type="button"
                    className={`mobile-nav-item ${isMenuOpen ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="More Menu"
                >
                    <div className="mobile-icon-wrapper">
                        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        {unreadChatCount > 0 && <span className="mobile-nav-badge-dot" />}
                    </div>
                    <span>More</span>
                </button>
            </nav>

            {/* ── Mobile Slide-Up "More" Sheet ── */}
            {isMenuOpen && (
                <div className="mobile-menu-overlay" onClick={() => setIsMenuOpen(false)}>
                    <div className="mobile-menu-sheet glass-panel animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="sheet-header">
                            <div
                                className="user-mini-badge clickable-profile-badge"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    if (user?.role === 'Student') navigate(`/students/${user._id}`);
                                    else if (user?.role === 'Teacher') navigate(`/teachers/${user._id}`);
                                }}
                                title="View Profile"
                            >
                                <div className="avatar-dot">{(user.name?.charAt(0) || 'U').toUpperCase()}</div>
                                <div className="user-badge-info">
                                    <h4>{user.name}</h4>
                                    <p>{user.role}</p>
                                </div>
                            </div>
                            <button type="button" className="close-sheet-btn" onClick={() => setIsMenuOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="sheet-links">
                            <Link to="/chat" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <MessageSquare size={18} />
                                <span>Messages</span>
                                {unreadChatCount > 0 && (
                                    <span className="unread-bubble-badge sheet-badge">
                                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                                    </span>
                                )}
                            </Link>
                            <Link to="/courses" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <BookOpen size={18} />
                                <span>Subjects</span>
                            </Link>
                            <Link to="/students" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <Users size={18} />
                                <span>Students</span>
                            </Link>
                            <Link to="/teachers" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <GraduationCap size={18} />
                                <span>Teachers</span>
                            </Link>
                            <Link to="/assignments" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <FileText size={18} />
                                <span>Assignments</span>
                            </Link>
                            <Link to="/exams" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <FileEdit size={18} />
                                <span>Exams</span>
                            </Link>
                            <Link to="/files" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <FolderSearch size={18} />
                                <span>Files</span>
                            </Link>
                            <Link to="/bug-report" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                <Bug size={18} />
                                <span>Bug Report</span>
                            </Link>

                            {isAdmin && (
                                <>
                                    <div className="sheet-divider" />
                                    <Link to="/admin/academic-settings" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                        <Settings size={18} />
                                        <span>Academic Config</span>
                                    </Link>
                                    <Link to="/admin/accounts" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                        <ShieldCheck size={18} />
                                        <span>Accounts</span>
                                    </Link>
                                    <Link to="/admin/ai-settings" className="sheet-item" onClick={() => setIsMenuOpen(false)}>
                                        <FileEdit size={18} />
                                        <span>AI Config</span>
                                    </Link>
                                </>
                            )}
                        </div>

                        <div className="sheet-footer">
                            <button type="button" className="sheet-logout-btn" onClick={handleLogout}>
                                <LogOut size={18} />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileBottomNav;
