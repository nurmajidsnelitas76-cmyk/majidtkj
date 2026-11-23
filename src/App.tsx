import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AttendanceRecapPage from './pages/app/AttendanceRecapPage';
import DashboardPage from './pages/app/DashboardPage';
import EmployeeAttendancePage from './pages/app/EmployeeAttendancePage';
import StudentAttendancePage from './pages/app/StudentAttendancePage';
import StudentsManagementPage from './pages/app/StudentsManagementPage';
import UserManagementPage from './pages/app/UserManagementPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/app" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="absensi-karyawan" element={<EmployeeAttendancePage />} />
            <Route path="absensi-siswa" element={<StudentAttendancePage />} />
            <Route path="rekap-absensi/:kategori" element={<AttendanceRecapPage />} />
            <Route path="data-siswa" element={<StudentsManagementPage />} />
            <Route path="user-management" element={<UserManagementPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
