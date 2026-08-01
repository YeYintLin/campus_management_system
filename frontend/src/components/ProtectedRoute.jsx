import { Navigate, Outlet } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Navbar from './Navbar';
import TopNavBar from './TopNavBar';
import AIChatWidget from './AIChatWidget';
import MobileBottomNav from './MobileBottomNav';
import PWAInstallPrompt from './PWAInstallPrompt';

const ProtectedRoute = ({ allowedRoles }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <>
            <Navbar />
            <div className="content-wrapper">
                <TopNavBar />
                <Outlet />
            </div>
            <MobileBottomNav />
            <AIChatWidget />
            <PWAInstallPrompt />
        </>
    );
};

export default ProtectedRoute;
