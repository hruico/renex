import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AdminOnly from '@/components/layout/AdminOnly';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Assets from '@/pages/Assets';
import AssetDetail from '@/pages/AssetDetail';
import ManageAssets from '@/pages/ManageAssets';
import AssetForm from '@/pages/AssetForm';
import Bookings from '@/pages/Bookings';
import MyBookings from '@/pages/MyBookings';
import BookingDetail from '@/pages/BookingDetail';
import Notifications from '@/pages/Notifications';
import AuditLogs from '@/pages/AuditLogs';
import AssetHealth from '@/pages/AssetHealth';
import Profile from '@/pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<AdminOnly><Dashboard /></AdminOnly>} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/manage" element={<AdminOnly><ManageAssets /></AdminOnly>} />
          <Route path="/assets/manage/new" element={<AdminOnly><AssetForm /></AdminOnly>} />
          <Route path="/assets/manage/:id/edit" element={<AdminOnly><AssetForm /></AdminOnly>} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/assets/:id/health" element={<AdminOnly><AssetHealth /></AdminOnly>} />
          <Route path="/bookings" element={<AdminOnly><Bookings /></AdminOnly>} />
          <Route path="/bookings/mine" element={<MyBookings />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/audit-logs" element={<AdminOnly><AuditLogs /></AdminOnly>} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
