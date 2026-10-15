import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Protected from './components/Protected';
import Landing from './pages/Landing';
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import NewComplaint from './pages/NewComplaint';
import MyComplaints from './pages/MyComplaints';
import ComplaintDetail from './pages/ComplaintDetail';
import Profile from './pages/Profile';
import AdminComplaints from './pages/AdminComplaints';
import AdminUsers from './pages/AdminUsers';
import { PageLoader } from './components/ui';

// Charts and QR code libraries are heavy: only download them for admins who open those pages
const AdminOverview = lazy(() => import('./pages/AdminOverview'));
const AdminQR = lazy(() => import('./pages/AdminQR'));

export default function App() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-8"><PageLoader /></div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/complaints/:id" element={<ComplaintDetail />} />

          <Route element={<Protected roles={['reporter']} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report/new" element={<NewComplaint />} />
            <Route path="/complaints" element={<MyComplaints />} />
          </Route>

          <Route element={<Protected roles={['admin', 'technician']} />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/complaints" element={<AdminComplaints />} />
          </Route>
          <Route element={<Protected roles={['admin']} />}>
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/qr" element={<AdminQR />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
