import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';

const navUser = [
  { to: '/assets',          label: 'Browse Assets' },
  { to: '/bookings/mine',   label: 'My Bookings' },
  { to: '/notifications',   label: 'Notifications' },
  { to: '/profile',         label: 'Profile' },
];

const navAdmin = [
  { to: '/dashboard',       label: 'Dashboard' },
  { to: '/assets',          label: 'Browse Assets' },
  { to: '/assets/manage',   label: 'Manage Assets' },
  { to: '/bookings',        label: 'All Bookings' },
  { to: '/notifications',   label: 'Notifications' },
  { to: '/audit-logs',      label: 'Audit Logs' },
  { to: '/profile',         label: 'Profile' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const links = user?.role === 'admin' ? navAdmin : navUser;

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100">
        <span className="text-lg font-bold text-blue-600">Renex</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        <button onClick={handleLogout} className="mt-1 text-sm text-red-500 hover:text-red-700">Logout</button>
      </div>
    </aside>
  );
}
