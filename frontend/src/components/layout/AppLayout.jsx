import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* pt-14 offsets the fixed mobile top bar; md:pt-0 removes it on desktop */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-[4.5rem] md:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
