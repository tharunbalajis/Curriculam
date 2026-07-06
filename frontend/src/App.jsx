import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import TopAdminDashboard from './pages/TopAdminDashboard';
import SubAdminDashboard from './pages/SubAdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyTaskDetail from './pages/FacultyTaskDetail';
import TaskFill from './pages/TaskFill';
import TaskReview from './pages/TaskReview';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['top_admin']}>
                  <TopAdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/subadmin"
              element={
                <ProtectedRoute roles={['sub_admin']}>
                  <SubAdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/faculty"
              element={
                <ProtectedRoute roles={['faculty']}>
                  <FacultyDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/faculty/task/:id"
              element={
                <ProtectedRoute roles={['faculty']}>
                  <FacultyTaskDetail />
                </ProtectedRoute>
              }
            />

            <Route path="/task/:token" element={<TaskFill />} />

            <Route
              path="/review/:token"
              element={
                <ProtectedRoute roles={['sub_admin']}>
                  <TaskReview />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
