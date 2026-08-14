import { useCallback, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, Search, X } from 'lucide-react';
import { sortNotificationsByPriority } from '../utils/notificationSorter';
import Notifications from './Notifications';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import './TopNavBar.css';

const PAGE_TITLES = [
    { prefix: '/admin/ai-settings', title: 'AI Prompt Settings' },
    { prefix: '/admin/accounts', title: 'Account Management' },
    { prefix: '/ai-assistant', title: 'AI Assistant' },
    { prefix: '/time-table', title: 'Timetable' },
    { prefix: '/attendance', title: 'Attendance' },
    { prefix: '/dashboard', title: 'Dashboard' },
    { prefix: '/students', title: 'Students' },
    { prefix: '/teachers', title: 'Teachers' },
    { prefix: '/courses', title: 'Courses' },
    { prefix: '/grades', title: 'Grades' },
    { prefix: '/files', title: 'Files' },
    { prefix: '/assignments', title: 'Assignments' },
    { prefix: '/exams', title: 'Exams' },
];

const getPageTitle = (pathname) => {
    const match = PAGE_TITLES.find((item) => pathname.startsWith(item.prefix));
    return match ? match.title : 'Campus';
};

const TopNavBar = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const pageTitle = getPageTitle(location.pathname);
    
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const searchRef = useRef(null);

    const performSearch = useCallback(async (query) => {
        try {
            const { data } = await apiClient.get('/search', { params: { q: query } });
            setSearchResults(data);
            setShowSearchDropdown(true);
        } catch (err) {
            console.error('Search failed:', err);
        }
    }, []);

    useEffect(() => {
        let ignore = false;

        const fetchNotifications = async () => {
            try {
                const { data } = await apiClient.get('/notifications');
                if (ignore) return;

                const sorted = sortNotificationsByPriority(data || []);

                const formatted = sorted.map(n => {
                    const diffMs = new Date() - new Date(n.createdAt);
                    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffHrs / 24);
                    let timeStr = 'Just now';
                    if (diffDays > 0) timeStr = `${diffDays}d ago`;
                    else if (diffHrs > 0) timeStr = `${diffHrs}h ago`;
                    else if (diffMs > 60000) timeStr = `${Math.floor(diffMs / 60000)}m ago`;

                    return { ...n, time: timeStr };
                });
                setNotifications(formatted);
            } catch (err) {
                if (!ignore) console.error('Failed to fetch notifications:', err);
            }
        };

        fetchNotifications();
        return () => {
            ignore = true;
        };
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) {
                performSearch(searchQuery);
            } else {
                setSearchResults(null);
            }
        }, 300);
        return () => clearTimeout(debounceTimer);
    }, [performSearch, searchQuery]);

    const unreadCount = notifications.filter((notification) => !notification.read).length;

    const handleMarkAsRead = async (id) => {
        try {
            await apiClient.put(`/notifications/${id}/read`);
            setNotifications((previous) =>
                previous.map((notification) =>
                    notification._id === id ? { ...notification, read: true } : notification
                )
            );
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    };

    const handleNavigate = (path) => {
        setShowSearchDropdown(false);
        setSearchQuery('');
        navigate(path);
    };

    return (
        <header className="content-topbar glass-panel">
            <div className="topbar-left-group">
                <div
                    className="topbar-avatar-badge mobile-only"
                    title={`View ${user?.name || 'User'}'s Profile`}
                    onClick={() => {
                        if (user?.role === 'Student') navigate(`/students/${user._id}`);
                        else if (user?.role === 'Teacher') navigate(`/teachers/${user._id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {(user?.name?.trim()?.charAt(0) || 'U').toUpperCase()}
                </div>
                <div className="topbar-left">
                    <span className="topbar-brand">TU Hmawbi CMS</span>
                    <h2>{pageTitle}</h2>
                </div>
            </div>

            <div className={`topbar-center ${showMobileSearch ? 'mobile-expanded' : ''}`} ref={searchRef}>
                <div className="form topbar-search-form">
                    <input 
                        className="input" 
                        type="text" 
                        placeholder="Search courses, users, exams..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => { if(searchResults) setShowSearchDropdown(true) }}
                        aria-label="Search" 
                    />
                    <span className="input-border"></span>
                    
                    {showSearchDropdown && searchResults && (
                        <div className="search-dropdown glass-panel">
                            {searchResults.users?.length > 0 && (
                                <div className="search-category">
                                    <h4>Users</h4>
                                    {searchResults.users.map(u => (
                                        <div key={u._id} className="search-result-item" onClick={() => handleNavigate(u.role === 'Student' ? `/students/${u._id}` : `/teachers/${u._id}`)}>
                                            <span>{u.name}</span>
                                            <span className="search-badge">{u.role}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchResults.courses?.length > 0 && (
                                <div className="search-category">
                                    <h4>Courses</h4>
                                    {searchResults.courses.map(c => (
                                        <div key={c._id} className="search-result-item" onClick={() => handleNavigate('/courses')}>
                                            <span>{c.code} - {c.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchResults.exams?.length > 0 && (
                                <div className="search-category">
                                    <h4>Exams</h4>
                                    {searchResults.exams.map(e => (
                                        <div key={e._id} className="search-result-item" onClick={() => handleNavigate('/exams')}>
                                            <span>{e.title}</span>
                                            <span className="search-badge">{e.course}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchResults.assignments?.length > 0 && (
                                <div className="search-category">
                                    <h4>Assignments</h4>
                                    {searchResults.assignments.map(a => (
                                        <div key={a._id} className="search-result-item" onClick={() => handleNavigate('/assignments')}>
                                            <span>{a.title}</span>
                                            <span className="search-badge">{a.course}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(!searchResults.users?.length && !searchResults.courses?.length && !searchResults.exams?.length && !searchResults.assignments?.length) && (
                                <div className="search-no-results">No results found for "{searchQuery}"</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="topbar-right">
                {/* Mobile Search Toggle */}
                <button
                    type="button"
                    className="topbar-search-toggle mobile-only"
                    onClick={() => setShowMobileSearch(!showMobileSearch)}
                    aria-label="Toggle mobile search"
                >
                    {showMobileSearch ? <X size={18} /> : <Search size={18} />}
                </button>

                {/* Theme Toggle */}
                <button
                    type="button"
                    className="topbar-theme-toggle"
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* Notifications */}
                <div className="topbar-notif-area">
                    <button
                        type="button"
                        className="topbar-notif-loader"
                        aria-label="Open notifications"
                        onClick={() => setShowNotifications((previous) => !previous)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            height="20"
                            width="20"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                stroke="currentColor"
                            ></path>
                        </svg>
                        {unreadCount > 0 && <div className="topbar-notif-point"></div>}
                    </button>
                    {showNotifications && (
                        <Notifications
                            notifications={notifications}
                            onMarkAsRead={handleMarkAsRead}
                            onClose={() => setShowNotifications(false)}
                        />
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopNavBar;
