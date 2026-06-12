import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';

const navUser = [
  { to: '/assets',        label: 'Browse Assets' },
  { to: '/bookings/mine', label: 'My Bookings' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/profile',       label: 'Profile' },
];

const navAdmin = [
  { to: '/dashboard',     label: 'Dashboard' },
  { to: '/assets',        label: 'Browse Assets' },
  { to: '/assets/manage', label: 'Manage Assets' },
  { to: '/bookings',      label: 'All Bookings' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/audit-logs',    label: 'Audit Logs' },
  { to: '/profile',       label: 'Profile' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = user?.role === 'admin' ? navAdmin : navUser;

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    logout();
    navigate('/login');
  };

  const NavLinks = ({ onClick }) => (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClick}
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
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-200 flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-blue-600">Renex</span>
        </div>
        <NavLinks />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <span className="text-lg font-bold text-blue-600">Renex</span>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          {/* hamburger */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* ── Mobile drawer backdrop ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div className={`md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-white flex flex-col shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">Renex</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <NavLinks onClick={() => setOpen(false)} />
      </div>
    </>
  );
}
