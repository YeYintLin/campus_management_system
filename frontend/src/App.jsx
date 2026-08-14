import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext, useEffect, Suspense, lazy } from 'react';
import { AuthContext } from './context/AuthContext';

// Lazy load components for better performance
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));
const Students = lazy(() => import('./pages/Students'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const Courses = lazy(() => import('./pages/Courses'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Grades = lazy(() => import('./pages/Grades'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Teachers = lazy(() => import('./pages/Teachers'));
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'));
const Exams = lazy(() => import('./pages/Exams'));
const TimeTable = lazy(() => import('./pages/TimeTable'));
const Files = lazy(() => import('./pages/Files'));
const Assignments = lazy(() => import('./pages/Assignments'));
const AIPromptSettings = lazy(() => import('./pages/AIPromptSettings'));
const AccountManagement = lazy(() => import('./pages/AccountManagement'));
const AcademicSettings = lazy(() => import('./pages/AcademicSettings'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const Chat = lazy(() => import('./pages/Chat'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const BugReport = lazy(() => import('./pages/BugReport'));

const restrictedRoles = new Set(['Student', 'Teacher']);

function App() {
  const { user } = useContext(AuthContext);
  const inspectionRestricted = user && restrictedRoles.has(user.role);



  return (
    <div className="app-container">
      <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:studentId" element={<StudentProfile />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:partnerId" element={<Chat />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:teacherId" element={<TeacherProfile />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/time-table" element={<TimeTable />} />
            <Route path="/files" element={<Files />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/bug-report" element={<BugReport />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/admin/ai-settings" element={<AIPromptSettings />} />
            <Route path="/admin/accounts" element={<AccountManagement />} />
            <Route path="/admin/academic-settings" element={<AcademicSettings />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
