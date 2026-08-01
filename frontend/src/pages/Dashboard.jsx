import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import TeacherDashboard from './dashboards/TeacherDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import StudentDashboard from './dashboards/StudentDashboard';
import './Dashboard.css';

const Dashboard = () => {
    const { user } = useContext(AuthContext);

    // Route to dedicated role dashboards
    if (user?.role === 'Teacher') return <TeacherDashboard />;
    if (user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'AcademicAdmin') {
        return <AdminDashboard />;
    }
    return <StudentDashboard />;
};

export default Dashboard;
