import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function AdminOnly({ children }) {
  const { user } = useAuthStore();
  if (user?.role !== 'admin') return <Navigate to="/assets" replace />;
  return children;
}
