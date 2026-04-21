import { useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import Notifications from './Notifications';
import { ThemeContext } from '../context/ThemeContext';
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
    { prefix: '/exams', title: 'Exams' },
];

const getPageTitle = (pathname) => {
    const match = PAGE_TITLES.find((item) => pathname.startsWith(item.prefix));
    return match ? match.title : 'Campus';
};

const TopNavBar = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const location = useLocation();
    const pageTitle = getPageTitle(location.pathname);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([
        { id: 1, type: 'file', message: 'New CS101 Lecture Notes uploaded', time: '2h ago', read: false },
        { id: 2, type: 'exam', message: 'Midterm schedule updated for 3rd Year', time: '5h ago', read: false },
        { id: 3, type: 'system', message: 'Welcome to TU Hmawbi CMS!', time: '1d ago', read: true },
    ]);
    const unreadCount = notifications.filter((notification) => !notification.read).length;

    const handleMarkAsRead = (id) => {
        setNotifications((previous) =>
            previous.map((notification) =>
                notification.id === id ? { ...notification, read: true } : notification
            )
        );
    };

    return (
        <header className="content-topbar glass-panel">
            <div className="topbar-left">
                <span className="topbar-brand">TU Hmawbi CMS</span>
                <h2>{pageTitle}</h2>
            </div>

            <div className="topbar-center">
                <div className="form topbar-search-form">
                    <input className="input" type="text" placeholder="Search courses, files, and users..." required aria-label="Search" />
                    <span className="input-border"></span>
                </div>
            </div>

            <div className="topbar-right">
                <button
                    type="button"
                    className="topbar-theme-toggle"
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

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
                            height="24"
                            width="24"
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
